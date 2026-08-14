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
import * as mcpClientModule from '@deepseek-ai/dsh-mcp-client'

const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url))
const ASSETS_FILE = process.env.DSH_NAVBAR_ASSETS_FILE || join(BUNDLE_DIR, 'assets.json')
const MCP_FILE = process.env.DSH_NAVBAR_MCP_FILE || join(BUNDLE_DIR, 'mcp-servers.json')
const AUTOMATION_FILE = process.env.DSH_NAVBAR_AUTOMATION_FILE || join(BUNDLE_DIR, 'automation-assets.json')

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

// --- Automation asset registry (durable, same pattern as subagents) ------
function loadAutomationAssets() {
  try {
    const raw = readFileSync(AUTOMATION_FILE, 'utf8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch (e) { /* absent or malformed -> start empty */ }
  return []
}

function persistAutomationAssets(assets) {
  try {
    mkdirSync(dirname(AUTOMATION_FILE), { recursive: true })
    writeFileSync(AUTOMATION_FILE, JSON.stringify(assets, null, 2), 'utf8')
  } catch (e) {
    throw new Error('automation asset persist failed: ' + (e && e.message ? e.message : String(e)))
  }
}

export default class SubagentAssetsService extends TypertRemoteService {
  static inject = ['tools', 'subagents', 'shell', 'fs']

  constructor(ctx) {
    super(ctx, 'subagentAssets')
    // Also register the MCP servers service on the same bundle.
    this.mcp = new McpServersService(ctx)
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

  // ------------------------------------------------------------------
  // Automation assets: durable registry (name/desc/spec + enabled),
  // persisted to automation-assets.json beside the bundle.
  // ------------------------------------------------------------------
  async listAutomationAssets() {
    return loadAutomationAssets()
  }

  async saveAutomationAsset(asset) {
    if (!asset || typeof asset !== 'object' || !asset.id) throw new Error('invalid asset')
    const list = loadAutomationAssets()
    const idx = list.findIndex(function (a) { return a.id === asset.id })
    const clean = {
      id: String(asset.id),
      name: String(asset.name || ''),
      desc: String(asset.desc || ''),
      spec: String(asset.spec || ''),
      ...asset.enabled === undefined ? {} : { enabled: !!asset.enabled },
    }
    if (idx >= 0) list[idx] = clean
    else list.push(clean)
    persistAutomationAssets(list)
    return loadAutomationAssets()
  }

  async deleteAutomationAsset(id) {
    const list = loadAutomationAssets().filter(function (a) { return a.id !== id })
    persistAutomationAssets(list)
    return loadAutomationAssets()
  }

  // ------------------------------------------------------------------
  // Live background jobs (read-only view + kill) from ctx.jobs.
  // A non-agent caller (this host service) sees unowned jobs only, per
  // the registry semantics; owned jobs stay private to their session.
  // ------------------------------------------------------------------
  async listJobs() {
    const jobs = this.ctx.get('jobs')
    if (jobs === undefined) return []
    try {
      const snaps = jobs.list()
      return (snaps || []).map(function (j) {
        return {
          id: j.id,
          kind: j.kind,
          label: j.label,
          status: j.status,
          detail: j.detail || '',
          startedAt: j.startedAt,
          finishedAt: j.finishedAt,
          ownerSession: j.ownerSession,
        }
      })
    } catch (e) {
      return []
    }
  }

  async killJob(id) {
    const jobs = this.ctx.get('jobs')
    if (jobs === undefined) throw new Error('jobs service is not mounted')
    return { result: jobs.kill(id) }
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
        // tools.restrict() only accepts GLOBAL tool names (MCP + plugin tools);
        // agent-scoped built-ins (read/bash/glob/...) are always visible and
        // must be filtered out here, otherwise restrict() throws on unknown names.
        let allowed = []
        if (Array.isArray(asset.tools) && asset.tools.length > 0) {
          const global = new Set()
          try {
            const schemas = tools.schemas()
            for (const schema of schemas || []) {
              if (schema && typeof schema.name === 'string') global.add(schema.name)
            }
          } catch (e) { /* fall through: treat all names as unknown */ }
          allowed = asset.tools.filter(function (name) { return global.has(name) })
        }
        const toolFilter = allowed.length > 0 ? { allow: allowed } : undefined
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

// ---------------------------------------------------------------------------
// McpServersService: durable MCP server registry + LIVE plugin mounting.
//
// Each server entry is persisted to mcp-servers.json beside this bundle. On
// save/enable we mount (or re-mount) a real `@deepseek-ai/dsh-mcp-client`
// plugin instance through ctx.plugin() — the tools appear/disappear in the
// harness immediately, no restart needed. On disable/delete we dispose the
// fiber, which disconnects, unregisters tools, and releases the namespace.
//
// Entries created by the profile's own cordis.patch.yml (mcp-filesystem,
// mcp-doubao-search) are NOT touched; they are listed as read-only "system"
// servers by diffing live mcp__ namespaces against the persisted file.
// ---------------------------------------------------------------------------
class McpServersService extends TypertRemoteService {
  static inject = ['tools', 'subagents', 'shell', 'fs']

  constructor(ctx) {
    super(ctx, 'mcpServers')
    this.ctx = ctx
    this.fibers = new Map() // server id -> { fiber, error }
    const fibers = this.fibers
    // Boot: mount every persisted enabled server.
    for (const server of loadMcpServers()) {
      if (server.enabled !== false) this.mountServer(server)
    }
    ctx.effect(function () {
      return function () {
        for (const entry of fibers.values()) {
          try { if (entry.fiber) entry.fiber.dispose() } catch (e) { /* already disposed */ }
        }
        fibers.clear()
      }
    })
  }

  // ---------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------
  persist(list) {
    try {
      mkdirSync(BUNDLE_DIR, { recursive: true })
      writeFileSync(MCP_FILE, JSON.stringify(list, null, 2), 'utf8')
    } catch (e) {
      throw new Error('mcp server persist failed: ' + (e && e.message ? e.message : String(e)))
    }
  }

  // ---------------------------------------------------------------
  // Live mounting
  // ---------------------------------------------------------------
  // Build the mcp-client plugin config from a persisted entry.
  configOf(server) {
    const base = {
      serverName: server.serverName,
      toolCallTimeoutMs: Number(server.timeoutMs) || 30000,
      failOnStartupError: false,
    }
    if (server.transport === 'streamable-http') {
      base.transport = 'streamable-http'
      base.url = server.url || ''
      if (server.headers && typeof server.headers === 'object') base.headers = server.headers
    } else {
      base.transport = 'stdio'
      base.command = server.command || ''
      if (Array.isArray(server.args) && server.args.length) base.args = server.args
      if (server.env && typeof server.env === 'object' && Object.keys(server.env).length) base.env = server.env
      if (server.cwd) base.cwd = server.cwd
    }
    return base
  }

  mountServer(server) {
    const id = server.id
    this.unmountServer(id)
    try {
      const fiber = this.ctx.plugin(mcpClientModule, this.configOf(server))
      this.fibers.set(id, { fiber: fiber, error: null })
      // Surface startup failures (initial connect/sync) as entry.error.
      Promise.resolve(fiber).catch((err) => {
        const entry = this.fibers.get(id)
        if (entry) entry.error = String(err && err.message ? err.message : err)
      })
      return true
    } catch (err) {
      this.fibers.set(id, { fiber: null, error: String(err && err.message ? err.message : err) })
      return false
    }
  }

  unmountServer(id) {
    const entry = this.fibers.get(id)
    if (entry && entry.fiber) {
      try { entry.fiber.dispose() } catch (e) { /* ignore */ }
    }
    this.fibers.delete(id)
  }

  // Live mcp__ namespaces currently registered in the harness tools.
  liveNamespaces() {
    const names = new Set()
    const tools = this.ctx.get('tools')
    if (tools === undefined) return names
    try {
      const schemas = tools.schemas()
      for (const schema of schemas || []) {
        const name = schema && schema.name
        if (typeof name !== 'string') continue
        const m = /^mcp__([A-Za-z0-9_-]+)__/.exec(name)
        if (m) names.add(m[1])
      }
    } catch (e) { /* ignore */ }
    return names
  }

  toolCount(namespace) {
    const tools = this.ctx.get('tools')
    if (tools === undefined) return 0
    let count = 0
    try {
      const prefix = 'mcp__' + namespace + '__'
      const schemas = tools.schemas()
      for (const schema of schemas || []) {
        if (schema && typeof schema.name === 'string' && schema.name.startsWith(prefix)) count++
      }
    } catch (e) { /* ignore */ }
    return count
  }

  // ---------------------------------------------------------------
  // RPC methods (strict manifest in lib/typert.host.js)
  // ---------------------------------------------------------------
  async listServers() {
    const persisted = loadMcpServers()
    const live = this.liveNamespaces()
    const out = []
    // 1) Persisted (user-managed) servers with live status.
    for (const server of persisted) {
      const entry = this.fibers.get(server.id)
      const namespace = server.serverName
      const mounted = server.enabled !== false && live.has(namespace)
      const pending = server.enabled !== false && !live.has(namespace) && (!entry || !entry.error)
      out.push({
        id: server.id,
        name: server.name || namespace,
        serverName: namespace,
        transport: server.transport || 'stdio',
        command: server.command || '',
        args: server.args || [],
        env: server.env || {},
        cwd: server.cwd || '',
        url: server.url || '',
        headers: server.headers || {},
        timeoutMs: Number(server.timeoutMs) || 30000,
        enabled: server.enabled !== false,
        status: server.enabled === false ? 'off'
          : mounted ? 'connected'
          : entry && entry.error ? 'error'
          : pending ? 'connecting'
          : 'unknown',
        error: (entry && entry.error) || '',
        toolCount: mounted ? this.toolCount(namespace) : 0,
        system: false,
      })
    }
    // 2) System servers (mounted from cordis.patch.yml, not in our file).
    const known = new Set(persisted.map(function (s) { return s.serverName }))
    for (const namespace of live) {
      if (known.has(namespace)) continue
      out.push({
        id: 'sys-' + namespace,
        name: namespace,
        serverName: namespace,
        transport: '',
        command: '',
        args: [],
        env: {},
        cwd: '',
        url: '',
        headers: {},
        timeoutMs: 0,
        enabled: true,
        status: 'connected',
        error: '',
        toolCount: this.toolCount(namespace),
        system: true,
      })
    }
    // Sort: enabled user servers first, then system, then disabled.
    out.sort(function (a, b) {
      if (a.system !== b.system) return a.system ? 1 : -1
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    return out
  }

  async saveServer(server) {
    if (!server || typeof server !== 'object' || !server.id) throw new Error('invalid server')
    const list = loadMcpServers()
    const idx = list.findIndex(function (s) { return s.id === server.id })
    const namespace = String(server.serverName || '').trim()
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(namespace)) {
      throw new Error('serverName 需为 1-32 位字母、数字、_ 或 -（当前: ' + namespace + '）')
    }
    const live = this.liveNamespaces()
    if (live.has(namespace)) {
      // Only allowed when editing the very server that already owns this namespace.
      const own = idx >= 0 && list[idx].serverName === namespace && list[idx].enabled !== false
      if (!own) throw new Error('serverName「' + namespace + '」已被占用（现存 MCP 命名空间），请换一个名字')
    }
    const clean = {
      id: String(server.id),
      name: String(server.name || namespace),
      serverName: namespace,
      transport: server.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
      command: String(server.command || ''),
      args: Array.isArray(server.args) ? server.args.map(String) : [],
      env: server.env && typeof server.env === 'object' ? server.env : {},
      cwd: String(server.cwd || ''),
      url: String(server.url || ''),
      headers: server.headers && typeof server.headers === 'object' ? server.headers : {},
      timeoutMs: Number(server.timeoutMs) || 30000,
      enabled: server.enabled === undefined ? true : !!server.enabled,
    }
    if (idx >= 0) list[idx] = clean
    else list.push(clean)
    this.persist(list)
    // Live apply: re-mount (dispose + fresh fiber) so config changes take effect now.
    if (clean.enabled) {
      const ok = this.mountServer(clean)
      if (!ok) {
        // Startup error with failOnStartupError=false still keeps the fiber;
        // only config-shape errors throw synchronously. Re-read for status.
      }
    } else {
      this.unmountServer(clean.id)
    }
    return this.listServers()
  }

  async deleteServer(id) {
    const list = loadMcpServers().filter(function (s) { return s.id !== id })
    this.persist(list)
    this.unmountServer(id)
    return this.listServers()
  }
}

function loadMcpServers() {
  try {
    const raw = readFileSync(MCP_FILE, 'utf8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch (e) { /* absent or malformed -> empty */ }
  return []
}
