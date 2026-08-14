// Formal host half of dsh-navbar.
//
// Two contributions:
//  1. SubagentAssetsService (TypertRemoteService, key 'subagentAssets'):
//     durable CRUD for subagent assets, persisted as JSON under this bundle's
//     directory (assets.json). The browser panel reads/writes through RPC so
//     the asset list survives across browsers and restarts.
//  2. `run_subagent_asset` model tool: spawns a subagent from a saved asset
//     definition (model + system prompt + tool allow-list) through
//     ctx.subagents, so DeepSeek can actually USE the assets the user manages
//     in the nav panel.
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url))
// Subagent assets persist as JSON. Override the location with
// DSH_NAVBAR_ASSETS_FILE (e.g. a user-data dir) if the bundle directory is
// read-only; defaults to assets.json beside the bundle for backward
// compatibility. This file is runtime state, NOT part of the source tree.
const ASSETS_FILE = process.env.DSH_NAVBAR_ASSETS_FILE || join(BUNDLE_DIR, 'assets.json')

function loadAssets() {
  try {
    const raw = readFileSync(ASSETS_FILE, 'utf8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch (e) { /* absent or malformed -> start empty */ }
  return []
}

function persistAssets(assets) {
  try {
    mkdirSync(dirname(ASSETS_FILE), { recursive: true })
    writeFileSync(ASSETS_FILE, JSON.stringify(assets, null, 2), 'utf8')
  } catch (e) {
    throw new Error('subagent asset persist failed: ' + (e && e.message ? e.message : String(e)))
  }
}

export default class SubagentAssetsService extends TypertRemoteService {
  static inject = ['tools', 'subagents', 'shell', 'fs']

  constructor(ctx) {
    super(ctx, 'subagentAssets')
    this.registerTool(ctx)
  }

  // ------------------------------------------------------------------
  // RPC methods (strict manifest in lib/typert.host.js).
  // ------------------------------------------------------------------
  async listAssets() {
    return loadAssets()
  }

  // Asset shape: { id, name, model, desc, prompt, tools: string[], enabled? }
  async saveAsset(asset) {
    if (!asset || typeof asset !== 'object' || !asset.id) throw new Error('invalid asset')
    const assets = loadAssets()
    const idx = assets.findIndex(function (a) { return a.id === asset.id })
    const clean = {
      id: String(asset.id),
      name: String(asset.name || ''),
      model: String(asset.model || ''),
      desc: String(asset.desc || ''),
      prompt: String(asset.prompt || ''),
      tools: Array.isArray(asset.tools) ? asset.tools.map(String) : [],
      ...asset.enabled === undefined ? {} : { enabled: !!asset.enabled },
    }
    if (idx >= 0) assets[idx] = clean
    else assets.push(clean)
    persistAssets(assets)
    return loadAssets()
  }

  async deleteAsset(id) {
    const assets = loadAssets().filter(function (a) { return a.id !== id })
    persistAssets(assets)
    return loadAssets()
  }

  // List every tool currently registered in the harness (for the asset form's
  // tool picker). Returns [{ name, description }] sorted by name.
  async listTools() {
    const tools = this.ctx.get('tools')
    if (tools === undefined) return []
    try {
      const schemas = tools.schemas()
      const seen = {}
      const out = []
      for (const schema of schemas || []) {
        if (!schema || typeof schema.name !== 'string' || !schema.name) continue
        if (seen[schema.name]) continue
        seen[schema.name] = true
        out.push({
          name: schema.name,
          description: typeof schema.description === 'string' ? schema.description.slice(0, 120) : '',
        })
      }
      out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0 })
      return out
    } catch (e) {
      return []
    }
  }

  // ------------------------------------------------------------------
  // Model tool: run a saved subagent asset as a real subagent.
  // ------------------------------------------------------------------
  registerTool(ctx) {
    const tools = ctx.get('tools')
    const subagents = ctx.get('subagents')
    if (tools === undefined) return
    const self = this

    tools.register(defineTool({
      name: 'run_subagent_asset',
      description: '按导航栏「子代理」面板中保存的子代理资产定义，启动一个子代理执行任务。'
        + '参数 asset_id 是资产 id（资产列表里有），task 是要子代理执行的具体任务描述。'
        + '子代理使用该资产配置的模型、系统提示词和可用工具范围。'
        + '当用户提到导航栏里配置的子代理并要求执行任务时，调用本工具。',
      parameters: {
        asset_id: { type: 'string', required: true, description: '子代理资产的 id（来自导航栏子代理列表）。' },
        task: { type: 'string', required: true, description: '要交给该子代理执行的具体任务描述。' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { output: { type: 'string', required: true } },
        },
        render: (_a, v) => [{ type: 'text', text: v.output }],
      },
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        if (exec.agent === undefined) throw new Error('no delegating agent in this execution')
        const assets = loadAssets()
        const asset = assets.find(function (a) { return a.id === args.asset_id })
        if (asset === undefined) {
          const names = assets.map(function (a) { return a.id }).join(', ')
          throw new Error('子代理资产不存在: ' + args.asset_id + '（现有: ' + (names || '无') + '）')
        }
        if (asset.enabled === false) {
          throw new Error('子代理资产「' + (asset.name || asset.id) + '」已被关闭，请先在导航栏中开启后再调用')
        }
        if (subagents === undefined) throw new Error('subagent service is not mounted')
        const providers = subagents.list()
        if (!providers.includes('spawn')) throw new Error('subagent provider "spawn" is not mounted')
        // Tool scope: asset tools become an allow-list; absent tools => no filter.
        const toolFilter = Array.isArray(asset.tools) && asset.tools.length > 0
          ? { allow: asset.tools }
          : undefined
        const run = await subagents.start('spawn', {
          label: asset.name || asset.id,
          parent: exec.agent,
          signal: exec.signal,
          ...asset.model ? { agentOptions: { provider: 'opencode-go', model: asset.model } } : {},
          ...toolFilter ? { toolFilter: toolFilter } : {},
          prompt: [{
            type: 'text',
            text: (asset.prompt ? asset.prompt + '\n\n' : '')
              + '现在执行以下任务：\n' + args.task
              + '\n完成后直接给出结果，不要复述任务。',
          }],
        })
        let text = ''
        let stopReason = ''
        try {
          const result = await run.result
          stopReason = result.stopReason
          if (result.stopReason === 'completed' && Array.isArray(result.output)) {
            const parts = []
            for (const block of result.output) {
              if (block && block.type === 'text' && block.text) parts.push(block.text)
            }
            text = parts.join('\n')
          }
        } finally {
          await run.dispose()
        }
        if (!text) {
          throw new Error('子代理未返回内容 (stopReason=' + stopReason + ')')
        }
        return { output: text }
      },
    }))
  }
}
