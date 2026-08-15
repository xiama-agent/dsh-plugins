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
import { TypertRemoteService, bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url))
const ASSETS_FILE = process.env.DSH_NAVBAR_ASSETS_FILE || join(BUNDLE_DIR, 'assets.json')
const AUTOMATION_FILE = process.env.DSH_NAVBAR_AUTOMATION_FILE || join(BUNDLE_DIR, 'automation-assets.json')
const PLUGIN_STATES_FILE = process.env.DSH_NAVBAR_PLUGIN_STATES_FILE || join(BUNDLE_DIR, 'plugin-states.json')
const PLUGIN_DISABLE_FILE = process.env.DSH_NAVBAR_PLUGIN_DISABLE_FILE || join(BUNDLE_DIR, 'plugin-disabled.json')
const CATALOG_FILE = join(BUNDLE_DIR, 'plugin-catalog.json')
const DOWNLOAD_DIR = process.env.DSH_PLUGIN_DOWNLOAD_DIR || join(homedir(), 'dsh-plugin-downloads')
const PROFILE_DIR = process.env.DSH_NAVBAR_PROFILE_DIR || join(homedir(), '.dsh', 'profiles', 'web')

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
    this.plugins = new PluginToolsService(ctx)
    this.market = new MarketplaceService(ctx)
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
        + '可选参数 model 可在本次调用覆盖资产默认模型（格式 provider/model 或裸 model id）。'
        + '当用户提到导航栏里配置的子代理（如 image-viewer）并要求执行任务时，调用本工具。',
      parameters: {
        asset_id: { type: 'string', required: true, description: '子代理资产的 id（来自导航栏子代理列表）。' },
        task: { type: 'string', required: true, description: '要交给该子代理执行的具体任务描述。' },
        model: { type: 'string', description: '可选：本次调用覆盖模型。格式 provider/model（如 opencode-go/mimo-v2.5）或裸 model id（沿用资产提供商）。' },
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
        // Per-call model override (community pattern: provider/model composite id).
        // resolveModelRoute splits "provider/model" -> { provider, model }.
        // DSH merges agentOptions AFTER the parent defaults, so per-call
        // provider/model overrides the asset's configured model with zero patch.
        let agentOptions
        const override = typeof args.model === 'string' && args.model.trim() ? args.model.trim() : undefined
        if (asset.model || override) {
          agentOptions = {}
          if (asset.model) {
            const slash = String(asset.model).indexOf('/')
            if (slash > 0) {
              agentOptions.provider = String(asset.model).slice(0, slash)
              agentOptions.model = String(asset.model).slice(slash + 1)
            } else {
              agentOptions.provider = 'opencode-go'
              agentOptions.model = String(asset.model)
            }
          }
          if (override) {
            const slash = override.indexOf('/')
            if (slash > 0) {
              agentOptions.provider = override.slice(0, slash)
              agentOptions.model = override.slice(slash + 1)
            } else {
              agentOptions.model = override
            }
          }
        }
        const run = await subagents.start('spawn', {
          label: asset.name || asset.id,
          parent: exec.agent,
          signal: exec.signal,
          ...agentOptions ? { agentOptions: agentOptions } : {},
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
// McpServersService: MCP server registry driven by the CORDIS LOADER.
//
// Every MCP server is a `@deepseek-ai/dsh-mcp-client` entry in the loader
// tree (cordis.patch.yml included). We do NOT keep our own JSON copy and do
// NOT mount fibers ourselves: we project the loader entries to the UI and
// write changes back through ctx.loader.create/update/remove. Those methods
// (a) hot-restart the affected entry in memory (loader -> registry.plugin ->
// fiber.update, the same machinery HMR uses) and (b) write the patch file
// back to disk. "Save = live + durable" comes for free.
//
// Because the loader tree is the single source of truth, servers hand-written
// in cordis.patch.yml (fs, doubao_search) appear in the panel as normal
// entries and can be edited/toggled like any other.
// ---------------------------------------------------------------------------
const MCP_CLIENT_MODULE = '@deepseek-ai/dsh-mcp-client'

class McpServersService extends TypertRemoteService {
  static inject = ['tools', 'subagents', 'shell', 'fs', 'loader']

  constructor(ctx) {
    super(ctx, 'mcpServers')
    this.ctx = ctx
  }

  // ---------------------------------------------------------------
  // Loader projection
  // ---------------------------------------------------------------
  // Every mcp-client entry in the loader tree (groups excluded).
  mcpEntries() {
    const loader = this.ctx.get('loader')
    if (loader === undefined) return []
    const out = []
    try {
      for (const entry of loader.entries()) {
        if (!entry || entry.options?.group) continue
        if (entry.options?.name !== MCP_CLIENT_MODULE) continue
        out.push(entry)
      }
    } catch (e) { /* ignore */ }
    return out
  }

  // Entry -> view model. `disabled` lives on entry.options; connection phase
  // comes from the entry's fiber when mounted.
  entryToView(entry) {
    const cfg = entry.options?.config || {}
    const namespace = String(cfg.serverName || entry.id || '')
    const disabled = entry.options?.disabled === true || entry.disabled === true
    const fiber = entry.fiber
    const fiberState = fiber ? fiber.state : undefined
    // Cordis FiberState: 0 pending, 1 loading, 2 active, 3 ... failed/unloading
    let status = 'unknown'
    if (disabled) status = 'off'
    else if (fiberState === 2) status = 'connected'
    else if (fiberState === 0 || fiberState === 1) status = 'connecting'
    else if (fiberState === 3 || fiberState === 4) status = 'error'
    const live = this.liveNamespaces()
    const connected = !disabled && (fiberState === 2 || live.has(namespace))
    return {
      id: entry.id,
      name: namespace,
      serverName: namespace,
      transport: cfg.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
      command: String(cfg.command || ''),
      args: Array.isArray(cfg.args) ? cfg.args.map(String) : [],
      env: cfg.env && typeof cfg.env === 'object' ? cfg.env : {},
      cwd: String(cfg.cwd || ''),
      url: String(cfg.url || ''),
      headers: cfg.headers && typeof cfg.headers === 'object' ? cfg.headers : {},
      timeoutMs: Number(cfg.toolCallTimeoutMs) || 30000,
      enabled: !disabled,
      status: connected ? 'connected' : status,
      error: '',
      toolCount: connected ? this.toolCount(namespace) : 0,
      system: false,
    }
  }

  // ---------------------------------------------------------------
  // RPC methods (strict manifest in lib/typert.host.js)
  // ---------------------------------------------------------------
  async listServers() {
    const out = this.mcpEntries().map((entry) => this.entryToView(entry))
    out.sort(function (a, b) {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    return out
  }

  async saveServer(server) {
    if (!server || typeof server !== 'object' || !server.id) throw new Error('invalid server')
    const loader = this.ctx.get('loader')
    if (loader === undefined) throw new Error('loader service is not mounted')
    const namespace = String(server.serverName || '').trim()
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(namespace)) {
      throw new Error('serverName 需为 1-32 位字母、数字、_ 或 -（当前: ' + namespace + '）')
    }
    // Duplicate serverName across live entries (including hand-written ones).
    const dup = this.mcpEntries().find(function (e) {
      return e.id !== server.id && (e.options?.config?.serverName || e.id) === namespace
    })
    if (dup) throw new Error('serverName「' + namespace + '」已被占用（现存 MCP 条目），请换一个名字')
    // UI shape -> mcp-client loader config (jsonSafe: drop undefined fields).
    const cfg = {
      serverName: namespace,
      transport: server.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
    }
    if (cfg.transport === 'streamable-http') {
      if (!server.url) throw new Error('streamable-http 类型需要 URL')
      cfg.url = String(server.url)
      if (server.headers && typeof server.headers === 'object' && Object.keys(server.headers).length) cfg.headers = server.headers
    } else {
      if (!server.command) throw new Error('stdio 类型需要命令')
      cfg.command = String(server.command)
      if (Array.isArray(server.args) && server.args.length) cfg.args = server.args.map(String)
      if (server.env && typeof server.env === 'object' && Object.keys(server.env).length) cfg.env = server.env
      if (server.cwd) cfg.cwd = String(server.cwd)
    }
    if (server.timeoutMs) cfg.toolCallTimeoutMs = Number(server.timeoutMs)
    cfg.failOnStartupError = false
    const enabled = server.enabled === undefined ? true : !!server.enabled
    const existing = this.mcpEntries().find(function (e) { return e.id === server.id })
    if (existing) {
      // Preserve fields the UI does not expose (e.g. reconnect policy) so
      // editing a server never silently drops them (community best practice).
      const oldCfg = existing.options?.config
      if (oldCfg && typeof oldCfg === 'object' && oldCfg.reconnect !== undefined) cfg.reconnect = oldCfg.reconnect
      await loader.update(server.id, { config: cfg, disabled: !enabled })
    } else {
      await loader.create({ id: server.id, name: MCP_CLIENT_MODULE, config: cfg, disabled: !enabled })
    }
    return this.listServers()
  }

  async deleteServer(id) {
    const loader = this.ctx.get('loader')
    if (loader === undefined) throw new Error('loader service is not mounted')
    await loader.remove(id)
    return this.listServers()
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
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
}

// ---------------------------------------------------------------------------
// PluginToolsService: central plugin tool registry with LIVE enable switches.
//
// Feature bundles (e.g. dsh-filecard) register their model tools here instead
// of calling ctx.tools.register directly. This service owns the on/off state
// (persisted to plugin-states.json) and applies it immediately:
//   enabled  -> tools.register(def)  (tool appears in the model's tool list)
//   disabled -> disposer()           (tool disappears, no restart needed)
//
// The nav panel's plugin switches call setPluginEnabled over RPC; other host
// bundles call registerPluginTools in-process. Runtime fields keep every
// caller honest about what the model actually sees right now.
// ---------------------------------------------------------------------------
class PluginToolsService extends TypertRemoteService {
  static inject = ['tools']

  constructor(ctx) {
    // Register on the ROOT context so every bundle (dsh-filecard, ...) can
    // resolve `pluginTools` along its parent fiber chain. A plain
    // `super(ctx, ...)` would register only on this bundle's own fiber and
    // sibling bundles would never see the service. TypertRemoteService still
    // binds `this.typertRemote`, which the gateway uses for RPC dispatch.
    super(ctx.root, 'pluginTools')
    this.ctx = ctx
    this.registrations = new Map() // pluginId -> { defs: Map<name,def>, disposers: Map<name,fn> }
    this.states = loadPluginStates()
    // Bundle-level disable list (external plugins switched off in the nav
    // panel). Persisted so a dsh restart keeps them off; re-applied lazily
    // because sibling bundles may not be mounted yet when we boot.
    this.disabled = loadDisabledBundles()
    this.ensureDisabledBundles()
    // Retry a few times after boot: bundles mount asynchronously, and a
    // disabled one that slips through would run until the next check.
    const retries = [1000, 5000, 15000]
    for (const delay of retries) {
      setTimeout(() => { try { this.ensureDisabledBundles() } catch (e) { /* ignore */ } }, delay)
    }
  }

  // ---------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------
  persistStates() {
    try {
      mkdirSync(BUNDLE_DIR, { recursive: true })
      writeFileSync(PLUGIN_STATES_FILE, JSON.stringify(this.states, null, 2), 'utf8')
    } catch (e) { /* best effort */ }
  }

  // ---------------------------------------------------------------
  // Bundle-level disable list (external/UI plugins)
  // ---------------------------------------------------------------
  // 用户指定：这些基础设施/视图类插件不需要开关（显示为系统组件）。
  isSystemPlugin(id) {
    return id === 'dsh-navbar'
      || id === 'dsh-token-stats'
      || id === 'dshmarket'
      || String(id).startsWith('@deepseek-ai/')
  }

  saveDisabledBundles() {
    try {
      mkdirSync(BUNDLE_DIR, { recursive: true })
      writeFileSync(PLUGIN_DISABLE_FILE, JSON.stringify(this.disabled, null, 2), 'utf8')
    } catch (e) { /* best effort */ }
  }

  // Find the loader entry of an installed bundle by package name or entry id.
  bundleEntry(pluginId) {
    const loader = this.ctx.get('loader')
    if (loader === undefined) return null
    try {
      for (const entry of loader.entries()) {
        if (!entry || !entry.options) continue
        if (entry.options.name === pluginId || entry.id === pluginId || entry.options.id === pluginId) return entry
      }
    } catch (e) { /* ignore */ }
    // Diagnostic: dump every loader entry so a miss is debuggable without a
    // live session (written only when a lookup fails).
    try {
      const rows = []
      const loader2 = this.ctx.get('loader')
      if (loader2 !== undefined) {
        for (const entry of loader2.entries()) {
          rows.push({ id: entry.id, optionsId: entry.options && entry.options.id, name: entry.options && entry.options.name })
        }
      }
      mkdirSync(BUNDLE_DIR, { recursive: true })
      writeFileSync(join(BUNDLE_DIR, 'loader-debug.log'),
        new Date().toISOString() + ' bundleEntry miss: ' + pluginId + '\n' + JSON.stringify(rows, null, 1) + '\n', 'utf8')
    } catch (e) { /* ignore */ }
    return null
  }

  // Hot-unmount a bundle entry from wherever it lives in the loader tree.
  // loader.remove() only touches the ROOT group's store — entries mounted in
  // a nested group (dshmarket hot-mounts live in an Include subtree with ids
  // like `mkt-*`) are invisible to it. Removing via the entry's own parent
  // group works for both root and nested entries.
  async removeBundleEntry(entry) {
    if (!entry || !entry.options) return false
    const id = entry.options.id
    if (!id) return false
    const parent = entry.parent
    if (parent && typeof parent.remove === 'function') {
      try {
        await parent.remove(id)
        return true
      } catch (e) { /* fall through to root loader */ }
    }
    const loader = this.ctx.get('loader')
    if (loader !== undefined && typeof loader.remove === 'function') {
      try {
        await loader.remove(id)
        return true
      } catch (e) { /* ignore */ }
    }
    return false
  }

  // Hot-unmount every bundle in the disable list that is currently mounted.
  ensureDisabledBundles() {
    for (const id of Object.keys(this.disabled)) {
      if (this.isSystemPlugin(id)) continue // 系统/锁定插件永不热卸载
      try {
        const entry = this.bundleEntry(id)
        if (entry) void this.removeBundleEntry(entry)
      } catch (e) { /* keep the disable list; retried on next call */ }
    }
  }

  // ---------------------------------------------------------------
  // Tool registration (called in-process by feature bundles)
  // ---------------------------------------------------------------
  registerPluginTools(pluginId, toolDefs) {
    if (!pluginId || !Array.isArray(toolDefs)) throw new Error('invalid plugin tool registration')
    let entry = this.registrations.get(pluginId)
    if (!entry) {
      entry = { defs: new Map(), disposers: new Map() }
      this.registrations.set(pluginId, entry)
    }
    const enabled = this.stateOf(pluginId)
    const tools = this.ctx.get('tools')
    const results = []
    for (const def of toolDefs) {
      if (!def || typeof def.name !== 'string') continue
      // Replace any previous registration of the same tool name.
      const old = entry.defs.get(def.name)
      if (old) {
        const d = entry.disposers.get(def.name)
        if (d) { try { d() } catch (e) { /* ignore */ } entry.disposers.delete(def.name) }
      }
      entry.defs.set(def.name, def)
      if (enabled && tools !== undefined) {
        try {
          const disposer = tools.register(def)
          entry.disposers.set(def.name, disposer)
          results.push({ name: def.name, registered: true })
        } catch (e) {
          results.push({ name: def.name, registered: false, error: String(e && e.message ? e.message : e) })
        }
      } else {
        results.push({ name: def.name, registered: false, disabled: true })
      }
    }
    return results
  }

  // ---------------------------------------------------------------
  // RPC: nav panel switches
  // ---------------------------------------------------------------
  async setPluginEnabled(pluginId, enabled) {
    if (!pluginId) throw new Error('invalid plugin id')
    if (this.isSystemPlugin(pluginId)) throw new Error('系统插件不可开关')
    this.states[pluginId] = !!enabled
    this.persistStates()
    if (this.registrations.has(pluginId)) {
      // 自制插件：工具级实时开关（bundle 保持装载，仅注册/注销工具）。
      this.applyState(pluginId, !!enabled)
    } else {
      // 外部/UI 插件（dshmarket 等，无工具注册）：bundle 级热启停。
      // 关闭 = loader.remove（host 侧实时卸载）+ 记入禁用列表；
      // 开启 = 用保存的 entry.options 重新 loader.create。
      if (enabled) {
        const options = this.disabled[pluginId]
        delete this.disabled[pluginId]
        this.saveDisabledBundles()
        if (options) {
          const loader = this.ctx.get('loader')
          if (loader !== undefined) {
            try { await loader.create(options) } catch (e) { /* keep running */ }
          }
        }
      } else {
        const entry = this.bundleEntry(pluginId)
        if (entry) {
          this.disabled[pluginId] = entry.options
          this.saveDisabledBundles()
          // 从 entry 所属 group 移除（覆盖 root 与 dshmarket 热挂载子树）。
          await this.removeBundleEntry(entry)
        } else {
          this.disabled[pluginId] = {}
          this.saveDisabledBundles()
        }
      }
    }
    return this.listPlugins()
  }

  // Unified plugin inventory:
  //   1. installed packages (profile dependencies + hot-mounted dsh bundles
  //      found in node_modules) — mirrors what dshmarket's "已安装" lists,
  //   2. live tool registrations (this registry — the real-time switches),
  //   3. downloaded-but-not-yet-fused marketplace sources (pending entries).
  // The nav panel keeps its live switches for registrable plugins; installed
  // plugins without a tool registration render as external/system rows.
  async listPlugins() {
    const out = []
    const seen = new Set()
    const tools = this.ctx.get('tools')
    // --- 1) installed plugins (all sources) -------------------------------
    for (const ins of this.scanInstalled()) {
      seen.add(ins.id)
      const entry = this.registrations.get(ins.id)
      const sys = this.isSystemPlugin(ins.id)
      const enabled = entry ? this.stateOf(ins.id) : (sys ? true : this.disabled[ins.id] === undefined)
      const names = entry ? Array.from(entry.defs.keys()) : []
      let liveCount = 0
      for (const name of names) {
        if (tools !== undefined && tools.get(name) !== undefined) liveCount++
      }
      out.push({
        id: ins.id,
        name: ins.name,
        enabled: enabled,
        toolCount: names.length,
        liveToolCount: liveCount,
        tools: names,
        version: ins.version || '',
        source: ins.source || '',
        sourceDetail: ins.sourceDetail || '',
        desc: ins.desc || '',
        installed: true,
        locked: sys,
        // 外部安装 = npm/github/热挂载 且无工具注册（自制 link 插件不算）
        external: !entry && !sys && ins.source !== 'link',
      })
    }
    // --- 2) live registrations not present in the profile (hot/in-memory) ---
    for (const [pluginId, entry] of this.registrations) {
      if (seen.has(pluginId)) continue
      seen.add(pluginId)
      const enabled = this.stateOf(pluginId)
      let liveCount = 0
      for (const name of entry.defs.keys()) {
        if (tools !== undefined && tools.get(name) !== undefined) liveCount++
      }
      out.push({
        id: pluginId,
        name: pluginId,
        enabled: enabled,
        toolCount: entry.defs.size,
        liveToolCount: liveCount,
        tools: Array.from(entry.defs.keys()),
        version: '',
        source: '',
        sourceDetail: '',
        desc: '',
        installed: false,
        locked: false,
        external: false,
      })
    }
    // --- 3) downloaded-but-not-yet-fused plugins from the marketplace ------
    const downloaded = this.downloadedPlugins()
    for (const d of downloaded) {
      if (seen.has(d.id)) continue
      out.push({
        id: d.id,
        name: d.name,
        enabled: false,
        toolCount: 0,
        liveToolCount: 0,
        tools: [],
        version: '',
        source: '',
        sourceDetail: '',
        desc: '',
        installed: false,
        locked: true,
        external: false,
        pending: true,
        downloadPath: d.path,
      })
    }
    return out
  }

  // Read every installed plugin from the web profile: package.json
  // dependencies (local links / npm / github specs) plus any dsh bundle
  // physically present in node_modules but missing from the manifest
  // (dshmarket hot mounts land there without touching package.json).
  scanInstalled() {
    const pkgPath = join(PROFILE_DIR, 'package.json')
    const nmDir = join(PROFILE_DIR, 'node_modules')
    const out = []
    const seen = new Set()
    try {
      const manifest = JSON.parse(readFileSync(pkgPath, 'utf8'))
      for (const [name, spec] of Object.entries(manifest.dependencies || {})) {
        if (name.startsWith('@deepseek-ai/')) continue // built-in platform packages
        seen.add(name)
        const entry = { id: name, name: name, version: '', source: 'npm', sourceDetail: String(spec), desc: '', hasDshManifest: false }
        const s = String(spec)
        if (s.startsWith('link:')) { entry.source = 'link'; entry.sourceDetail = s.slice(5) }
        else if (s.startsWith('git') || s.startsWith('github:')) { entry.source = 'github'; entry.sourceDetail = s }
        try {
          const m = JSON.parse(readFileSync(join(nmDir, name, 'package.json'), 'utf8'))
          if (m.version) entry.version = m.version
          if (m.description) entry.desc = m.description
          entry.hasDshManifest = m.dsh !== undefined
        } catch (e) { /* manifest missing -> keep empty version */ }
        out.push(entry)
      }
    } catch (e) { /* profile package.json absent/malformed -> ignore */ }
    // Hot-mounted bundles: present in node_modules with a dsh manifest but
    // not declared in dependencies.
    try {
      const names = readdirSync(nmDir, { withFileTypes: true })
        .filter(function (d) { return d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('@') })
        .map(function (d) { return d.name })
      for (const name of names) {
        if (seen.has(name)) continue
        try {
          const m = JSON.parse(readFileSync(join(nmDir, name, 'package.json'), 'utf8'))
          if (m.dsh !== undefined) {
            out.push({ id: name, name: name, version: m.version || '', source: 'hot', sourceDetail: '热挂载', desc: m.description || '', hasDshManifest: true })
          }
        } catch (e) { /* not a dsh bundle -> ignore */ }
      }
    } catch (e) { /* node_modules unreadable -> ignore */ }
    return out
  }

  // Scan the marketplace downloads dir for plugin repos that are not yet
  // registered as tool groups here.
  downloadedPlugins() {
    const fs = this.ctx.get('fs')
    if (fs === undefined || !existsSync(DOWNLOAD_DIR)) return []
    const out = []
    try {
      const names = readdirSync(DOWNLOAD_DIR, { withFileTypes: true })
        .filter(function (d) { return d.isDirectory() })
        .map(function (d) { return d.name })
        .sort()
      for (const n of names) {
        const hasManifest = existsSync(join(DOWNLOAD_DIR, n, 'package.json')) || existsSync(join(DOWNLOAD_DIR, n, 'cordis.patch.yml'))
        out.push({
          id: 'dl-' + n,
          name: n,
          path: join(DOWNLOAD_DIR, n),
          hasManifest: hasManifest,
        })
      }
    } catch (e) { /* ignore */ }
    return out
  }

  // ---------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------
  stateOf(pluginId) {
    const v = this.states[pluginId]
    return v === undefined ? true : !!v
  }

  applyState(pluginId, enabled) {
    const entry = this.registrations.get(pluginId)
    if (!entry) return
    const tools = this.ctx.get('tools')
    for (const [name, def] of entry.defs) {
      const d = entry.disposers.get(name)
      if (!enabled && d) {
        try { d() } catch (e) { /* ignore */ }
        entry.disposers.delete(name)
      } else if (enabled && !d && tools !== undefined) {
        try { entry.disposers.set(name, tools.register(def)) } catch (e) { /* ignore */ }
      }
    }
  }
}

function loadPluginStates() {
  try {
    const raw = readFileSync(PLUGIN_STATES_FILE, 'utf8')
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object') return obj
  } catch (e) { /* absent or malformed -> empty */ }
  return {}
}

function loadDisabledBundles() {
  try {
    const raw = readFileSync(PLUGIN_DISABLE_FILE, 'utf8')
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object') return obj
  } catch (e) { /* absent or malformed -> empty */ }
  return {}
}

// ---------------------------------------------------------------------------
// MarketplaceService: plugin marketplace backed by the official
// awesome-dsh-plugin registry. Pure link index — nothing is written to disk.
//
// Data-source chain (each level falls back to the next):
//   1. live JSON: https://awesome-dsh-plugin.com/plugins.json — curated,
//      bilingual (en/zh descriptions + categories), refreshed daily by CI;
//      this is the exact source the official dsh-market app consumes.
//   2. GitHub README of awesome-dsh-plugin/awesome-dsh-plugin (markdown parse)
//   3. bundled local plugin-catalog.json
//
// `listPlugins` serves the catalog with search/filter. `downloadPlugin`
// clones a GitHub repo into ~/dsh-plugin-downloads/<name> so the user (or
// the agent) can read its source and fuse it into the local dsh setup.
// `listDownloads` shows what has already been downloaded.
// ---------------------------------------------------------------------------
const OFFICIAL_CATALOG_URL = 'https://awesome-dsh-plugin.com/plugins.json'

// Official JSON category ids -> legacy English labels used across catalog
// sources, so categories()/listPlugins() share one vocabulary.
const OFFICIAL_CATEGORY_EN = {
  ui: 'UI Enhancements',
  theme: 'Themes & Appearance',
  model: 'Models & Providers',
  session: 'Sessions & Messages',
  memory: 'Memory',
  tools: 'Tools & Capabilities',
  skill: 'Skills',
  workflow: 'Workflow & Automation',
  notify: 'Notifications & Integrations',
  dev: 'Development & Runtime',
  market: 'Plugin Markets & Managers',
  fun: 'Just for Fun',
}

const CATEGORY_LABELS = {
  'UI Enhancements': 'UI 增强',
  'Themes & Appearance': '主题外观',
  'Sessions & Messages': '会话消息',
  'Memory': '记忆',
  'Tools & Capabilities': '工具能力',
  'Skills': '技能',
  'Workflow & Automation': '工作流自动化',
  'Notifications & Integrations': '通知集成',
  'Models & Providers': '模型提供商',
  'Development & Runtime': '开发运行时',
  'Plugin Markets & Managers': '插件市场与管理',
  'Just for Fun': '趣味',
  'Other': '其他',
}

class MarketplaceService extends TypertRemoteService {
  static inject = ['tools', 'subagents', 'shell', 'fs']

  constructor(ctx) {
    // Register on the ROOT context so other bundles' host code (e.g. the
    // dsh-market host routes) can resolve `pluginMarketplace` for the
    // fusion-download workflow (download plugin source for agent fusion).
    super(ctx.root, 'pluginMarketplace')
    this.ctx = ctx
    // In-memory GitHub-fresh catalog: { at, list } — list is the merged
    // (GitHub + local translations) catalog; at is the fetch timestamp.
    this.ghCache = null
    this.ghCacheTtlMs = 5 * 60 * 1000 // 5 minutes
  }

  loadCatalog() {
    try {
      const raw = readFileSync(CATALOG_FILE, 'utf8')
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr
    } catch (e) { /* absent or malformed -> empty */ }
    return []
  }

  // Pull the live official registry JSON (the same source the official
  // dsh-market app consumes): structured entries with bilingual
  // descriptions, categories, star counts and install commands.
  async fetchOfficialCatalog(signal) {
    const shell = this.ctx.get('shell')
    let text = ''
    if (shell !== undefined) {
      const cmd = 'curl -sL --max-time 20 ' + JSON.stringify(OFFICIAL_CATALOG_URL)
      const run = await shell.run(shell.resolve({ command: cmd }))
      if (run.exitCode === 0 && run.stdout) {
        const out = String(run.stdout.text !== undefined ? run.stdout.text : run.stdout)
        if (out.trim()) text = out
      }
    }
    if (!text) {
      try {
        const res = await fetch(OFFICIAL_CATALOG_URL)
        if (res.ok) text = await res.text()
      } catch (e) { /* ignore */ }
    }
    if (!text) return null
    let data = null
    try { data = JSON.parse(text) } catch (e) { return null }
    const arr = Array.isArray(data && data.plugins) ? data.plugins : []
    if (arr.length === 0) return null
    const parsed = arr.map(function (p) {
      const desc = p && typeof p.description === 'object' ? p.description : {}
      const cat = p.category && OFFICIAL_CATEGORY_EN[p.category] ? OFFICIAL_CATEGORY_EN[p.category] : (p.category || '')
      return {
        n: p.name || '',
        u: p.url || '',
        d: typeof desc.en === 'string' ? desc.en : '',
        z: typeof desc.zh === 'string' ? desc.zh : '',
        c: cat,
        s: typeof p.stars === 'number' ? p.stars : 0,
        i: typeof p.install === 'string' ? p.install : '',
      }
    }).filter(function (p) { return p.n && p.u })
    if (parsed.length === 0) return null
    return parsed
  }

  // Pull the live awesome-dsh-plugin README from GitHub and parse it into
  // catalog entries, then merge with the local catalog so existing Chinese
  // translations (z) survive for entries GitHub also lists. Used as the
  // second source in the chain (after the official JSON).
  async fetchGitHubCatalog(signal) {
    const shell = this.ctx.get('shell')
    let text = ''
    if (shell !== undefined) {
      const cmd = 'curl -sL --max-time 20 -H "Accept: application/vnd.github.raw" '
        + JSON.stringify('https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin/readme')
      const run = await shell.run(shell.resolve({ command: cmd }))
      if (run.exitCode === 0 && run.stdout) {
        const out = String(run.stdout.text !== undefined ? run.stdout.text : run.stdout)
        if (out.trim()) text = out
      }
    }
    if (!text) {
      try {
        const res = await fetch('https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin/readme', { headers: { Accept: 'application/vnd.github.raw' } })
        if (res.ok) text = await res.text()
      } catch (e) { /* ignore */ }
    }
    if (!text) return null
    const parsed = []
    let currentCategory = ''
    for (const line of text.split('\n')) {
      const cat = /^### (.+)$/.exec(line)
      if (cat) { currentCategory = cat[1].trim(); continue }
      const m = /^- \[([^\]]+)\]\(([^)]+)\) - (.+)$/.exec(line)
      if (m) {
        parsed.push({ n: m[1], u: m[2], d: m[3].trim(), c: currentCategory })
      }
    }
    if (parsed.length === 0) return null
    // Merge: GitHub entries win; carry over local z (Chinese) for matching urls.
    const local = this.loadCatalog()
    const localByUrl = {}
    for (const p of local) localByUrl[p.u] = p
    for (const p of parsed) {
      const l = localByUrl[p.u]
      if (l && l.z) p.z = l.z
    }
    return parsed
  }

  // Resolve the catalog: live official JSON when available and not stale,
  // else the GitHub README parse, else the bundled local file. Pure link
  // index — nothing is written to disk.
  async resolveCatalog(signal) {
    const now = Date.now()
    if (this.ghCache && now - this.ghCache.at < this.ghCacheTtlMs) {
      return this.ghCache.list
    }
    let fresh = null
    try { fresh = await this.fetchOfficialCatalog(signal) } catch (e) { fresh = null }
    if (!fresh || fresh.length === 0) {
      try { fresh = await this.fetchGitHubCatalog(signal) } catch (e) { fresh = null }
    }
    if (fresh && fresh.length > 0) {
      this.ghCache = { at: now, list: fresh }
      return fresh
    }
    return this.loadCatalog()
  }

  // ---------------------------------------------------------------
  // RPC methods (strict manifest in lib/typert.host.js)
  // ---------------------------------------------------------------
  async listPlugins(query) {
    const q = (query && typeof query.q === 'string' ? query.q : '').trim().toLowerCase()
    const category = query && typeof query.category === 'string' ? query.category : ''
    const list = await this.resolveCatalog()
    const out = list.filter(function (p) {
      if (category) {
        const pCat = p.c || '__other__'
        if (pCat !== category) return false
      }
      if (!q) return true
      return (p.n || '').toLowerCase().indexOf(q) >= 0
        || (p.d || '').toLowerCase().indexOf(q) >= 0
        || (p.z || '').toLowerCase().indexOf(q) >= 0
    })
    return out.map(function (p) {
      return {
        name: p.n,
        url: p.u,
        desc: p.d,
        descZh: p.z || '',
        category: p.c,
        categoryLabel: CATEGORY_LABELS[p.c] || p.c,
        stars: typeof p.s === 'number' ? p.s : 0,
        install: p.i || '',
      }
    })
  }

  async categories() {
    const list = await this.resolveCatalog()
    const seen = {}
    const out = []
    for (const p of list) {
      const key = p.c || '__other__'
      if (seen[key]) continue
      seen[key] = true
      out.push({ id: key, label: CATEGORY_LABELS[p.c] || (p.c ? p.c : '其他'), count: 0 })
    }
    // count
    for (const p of list) {
      const key = p.c || '__other__'
      const hit = out.find(function (c) { return c.id === key })
      if (hit) hit.count++
    }
    return out
  }

  // Force-refresh the in-memory catalog (pure link index — no file writes).
  // Official JSON first, GitHub README second; falls back to the bundled
  // local catalog when both are unreachable.
  async refreshCatalog() {
    let fresh = null
    try { fresh = await this.fetchOfficialCatalog() } catch (e) { fresh = null }
    if (!fresh || fresh.length === 0) {
      fresh = await this.fetchGitHubCatalog()
    }
    if (!fresh || fresh.length === 0) throw new Error('无法拉取最新目录（官方站与 GitHub 均不可达）')
    this.ghCache = { at: Date.now(), list: fresh }
    return { total: fresh.length, fresh: fresh.length }
  }

  // Clone a GitHub repo (or download its zip) into DOWNLOAD_DIR/<name>.
  async downloadPlugin(url, name) {
    const shell = this.ctx.get('shell')
    if (shell === undefined) throw new Error('shell service is not mounted')
    const cleanUrl = String(url || '').trim()
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(cleanUrl)) {
      throw new Error('仅支持 GitHub 仓库链接')
    }
    const dirName = String(name || cleanUrl.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '')).replace(/[^A-Za-z0-9_.-]/g, '-') || 'plugin'
    const target = join(DOWNLOAD_DIR, dirName)
    const mk = await shell.run(shell.resolve({ command: 'mkdir -p ' + JSON.stringify(DOWNLOAD_DIR) }))
    if (mk.exitCode !== 0) throw new Error('mkdir failed: ' + (mk.stderr || ''))
    if (existsSync(target)) {
      // Update instead of re-clone.
      const pull = await shell.run(shell.resolve({ command: 'cd ' + JSON.stringify(target) + ' && git pull --quiet 2>&1 || true' }))
      return { path: target, updated: pull.exitCode === 0 }
    }
    const clone = await shell.run(shell.resolve({ command: 'git clone --depth 1 ' + JSON.stringify(cleanUrl) + ' ' + JSON.stringify(target) + ' 2>&1' }))
    if (clone.exitCode !== 0) {
      const errText = clone.stderr ? String(clone.stderr.text !== undefined ? clone.stderr.text : clone.stderr) : ''
      const outText = clone.stdout ? String(clone.stdout.text !== undefined ? clone.stdout.text : clone.stdout) : ''
      throw new Error('克隆失败: ' + (errText || outText || '').slice(0, 300))
    }
    return { path: target, updated: false }
  }

  // List previously downloaded plugin directories.
  async listDownloads() {
    const fs = this.ctx.get('fs')
    if (fs === undefined) return []
    try {
      if (!existsSync(DOWNLOAD_DIR)) return []
      const names = readdirSync(DOWNLOAD_DIR, { withFileTypes: true })
        .filter(function (d) { return d.isDirectory() })
        .map(function (d) { return d.name })
        .sort()
      return names.map(function (n) {
        const dir = join(DOWNLOAD_DIR, n)
        let files = 0
        try {
          const entries = readdirSync(dir, { recursive: true })
          files = Array.isArray(entries) ? entries.length : 0
        } catch (e) { /* ignore */ }
        return { name: n, path: dir, fileCount: files }
      })
    } catch (e) { /* ignore */ }
    return []
  }
}
