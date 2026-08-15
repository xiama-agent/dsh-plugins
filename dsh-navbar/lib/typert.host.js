// Strict Host TYPERT manifest for dsh-navbar. Consumed by dsh-typert-loader:
// registers strict invocations so the Typert Gateway dispatches
// /api/subagentAssets/<method> to the methods on the "subagentAssets" Service.
import { z } from 'zod'

const assetSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.string(),
  desc: z.string(),
  prompt: z.string(),
  tools: z.array(z.string()),
})

const assetsSchema = z.array(assetSchema)
const toolEntrySchema = z.object({ name: z.string(), description: z.string() })
const toolListSchema = z.array(toolEntrySchema)

// --- MCP server registry -------------------------------------------
// Full server view returned by listServers (includes live runtime fields).
const mcpServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  serverName: z.string(),
  transport: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()),
  cwd: z.string(),
  url: z.string(),
  headers: z.record(z.string()),
  timeoutMs: z.number(),
  enabled: z.boolean(),
  status: z.string(),
  error: z.string(),
  toolCount: z.number(),
  system: z.boolean(),
})
const mcpServerListSchema = z.array(mcpServerSchema)

// --- Plugin tool registry (nav panel plugin switches) --------------------
const pluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  toolCount: z.number(),
  liveToolCount: z.number(),
  tools: z.array(z.string()),
  version: z.string(),
  source: z.string(),
  sourceDetail: z.string(),
  desc: z.string(),
  installed: z.boolean(),
  locked: z.boolean(),
  external: z.boolean(),
  pending: z.boolean().optional(),
  downloadPath: z.string().optional(),
})
const pluginListSchema = z.array(pluginSchema)

// --- Plugin marketplace (awesome-dsh-plugin catalog) ----------------------
const marketQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
})
const marketPluginSchema = z.object({
  name: z.string(),
  url: z.string(),
  desc: z.string(),
  descZh: z.string(),
  category: z.string(),
  categoryLabel: z.string(),
  stars: z.number(),
  install: z.string(),
})
const marketPluginListSchema = z.array(marketPluginSchema)
const marketCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number(),
})
const marketCategoryListSchema = z.array(marketCategorySchema)
const marketDownloadSchema = z.object({
  path: z.string(),
  updated: z.boolean(),
})
const marketDownloadEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  fileCount: z.number(),
})
const marketDownloadListSchema = z.array(marketDownloadEntrySchema)
const marketRefreshSchema = z.object({
  total: z.number(),
  fresh: z.number(),
})
// Input accepted by saveServer: only the writable config fields; runtime
// fields (status/error/toolCount/system) are optional and ignored on write.
const mcpServerInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  serverName: z.string(),
  transport: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().optional(),
  enabled: z.boolean().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  toolCount: z.number().optional(),
  system: z.boolean().optional(),
})

// --- Automation asset registry + live background jobs --------------------
const automationAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string(),
  spec: z.string(),
  enabled: z.boolean().optional(),
})
const automationAssetsSchema = z.array(automationAssetSchema)

const jobSnapshotSchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  status: z.enum(['running', 'stopping', 'completed', 'killed', 'failed']),
  detail: z.string(),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  ownerSession: z.string().optional(),
})
const jobListSchema = z.array(jobSnapshotSchema)
const killResultSchema = z.object({ result: z.enum(['requested', 'already-finished']) })

export const TYPERT = {
  package: 'dsh-navbar',
  face: 'host',
  schemas: [],
  invocations: [
    {
      id: 'dsh-navbar#subagentAssets/listAssets',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'listAssets',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#SubagentAssets', schema: assetsSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/listTools',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'listTools',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#ToolList', schema: toolListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/saveAsset',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'saveAsset',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'asset',
          wire: 'asset',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#SubagentAsset',
            schema: assetSchema,
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#SubagentAssets', schema: assetsSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/deleteAsset',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'deleteAsset',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'id',
          wire: 'id',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#SubagentAssetId',
            schema: z.string(),
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#SubagentAssets', schema: assetsSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#mcpServers/listServers',
      service: 'mcpServers',
      namespace: 'mcpServers',
      method: 'listServers',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#McpServerList', schema: mcpServerListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#mcpServers/saveServer',
      service: 'mcpServers',
      namespace: 'mcpServers',
      method: 'saveServer',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'server',
          wire: 'server',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#McpServerInput',
            schema: mcpServerInputSchema,
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#McpServerList', schema: mcpServerListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#mcpServers/deleteServer',
      service: 'mcpServers',
      namespace: 'mcpServers',
      method: 'deleteServer',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'id',
          wire: 'id',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#McpServerId',
            schema: z.string(),
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#McpServerList', schema: mcpServerListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#pluginTools/listPlugins',
      service: 'pluginTools',
      namespace: 'pluginTools',
      method: 'listPlugins',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#PluginList', schema: pluginListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#pluginTools/setPluginEnabled',
      service: 'pluginTools',
      namespace: 'pluginTools',
      method: 'setPluginEnabled',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'pluginId',
          wire: 'pluginId',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#PluginId',
            schema: z.string(),
          },
        },
        {
          name: 'enabled',
          wire: 'enabled',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#PluginEnabled',
            schema: z.boolean(),
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#PluginList', schema: pluginListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#pluginMarketplace/listPlugins',
      service: 'pluginMarketplace',
      namespace: 'pluginMarketplace',
      method: 'listPlugins',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'query',
          wire: 'query',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#MarketQuery',
            schema: marketQuerySchema,
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#MarketPluginList', schema: marketPluginListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#pluginMarketplace/categories',
      service: 'pluginMarketplace',
      namespace: 'pluginMarketplace',
      method: 'categories',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#MarketCategories', schema: marketCategoryListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#pluginMarketplace/downloadPlugin',
      service: 'pluginMarketplace',
      namespace: 'pluginMarketplace',
      method: 'downloadPlugin',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'url',
          wire: 'url',
          source: 'json',
          codec: { mode: 'strict', typeSymbol: 'dsh-navbar#MarketUrl', schema: z.string() },
        },
        {
          name: 'name',
          wire: 'name',
          source: 'json',
          codec: { mode: 'strict', typeSymbol: 'dsh-navbar#MarketName', schema: z.string() },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#MarketDownload', schema: marketDownloadSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#pluginMarketplace/listDownloads',
      service: 'pluginMarketplace',
      namespace: 'pluginMarketplace',
      method: 'listDownloads',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#MarketDownloads', schema: marketDownloadListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#pluginMarketplace/refreshCatalog',
      service: 'pluginMarketplace',
      namespace: 'pluginMarketplace',
      method: 'refreshCatalog',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#MarketRefresh', schema: marketRefreshSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/listAutomationAssets',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'listAutomationAssets',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#AutomationAssets', schema: automationAssetsSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/saveAutomationAsset',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'saveAutomationAsset',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'asset',
          wire: 'asset',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#AutomationAsset',
            schema: automationAssetSchema,
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#AutomationAssets', schema: automationAssetsSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/deleteAutomationAsset',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'deleteAutomationAsset',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'id',
          wire: 'id',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#AutomationAssetId',
            schema: z.string(),
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#AutomationAssets', schema: automationAssetsSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/listJobs',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'listJobs',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#JobList', schema: jobListSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
    {
      id: 'dsh-navbar#subagentAssets/killJob',
      service: 'subagentAssets',
      namespace: 'subagentAssets',
      method: 'killJob',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'id',
          wire: 'id',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-navbar#JobId',
            schema: z.string(),
          },
        },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-navbar#KillJobResult', schema: killResultSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
  ],
  model: {
    services: [
      {
        description: 'Durable subagent asset registry used by the nav panel and the run_subagent_asset tool.',
        summary: 'Subagent asset registry service.',
        tags: [],
        jsDoc: 'Persists assets to assets.json beside the bundle.',
        key: 'subagentAssets',
        exportName: 'SubagentAssetsService',
        members: [
          {
            kind: 'method',
            name: 'listAssets',
            signature: 'listAssets(): Promise<SubagentAssets>',
            summary: 'List all saved subagent assets.',
            jsDoc: 'Returns the durable asset array.',
          },
          {
            kind: 'method',
            name: 'saveAsset',
            signature: 'saveAsset(asset: SubagentAsset): Promise<SubagentAssets>',
            summary: 'Create or update one subagent asset.',
            jsDoc: 'Persists and returns the full asset array.',
          },
          {
            kind: 'method',
            name: 'deleteAsset',
            signature: 'deleteAsset(id: string): Promise<SubagentAssets>',
            summary: 'Delete one subagent asset by id.',
            jsDoc: 'Persists and returns the remaining asset array.',
          },
          {
            kind: 'method',
            name: 'listTools',
            signature: 'listTools(): Promise<ToolList>',
            summary: 'List every tool currently registered in the harness.',
            jsDoc: 'Returns [{ name, description }] for the asset tool picker.',
          },
          {
            kind: 'method',
            name: 'listAutomationAssets',
            signature: 'listAutomationAssets(): Promise<AutomationAssets>',
            summary: 'List all saved automation assets.',
            jsDoc: 'Returns the durable automation asset array (name/desc/spec/enabled).',
          },
          {
            kind: 'method',
            name: 'saveAutomationAsset',
            signature: 'saveAutomationAsset(asset: AutomationAsset): Promise<AutomationAssets>',
            summary: 'Create or update one automation asset.',
            jsDoc: 'Persists and returns the full automation asset array.',
          },
          {
            kind: 'method',
            name: 'deleteAutomationAsset',
            signature: 'deleteAutomationAsset(id: string): Promise<AutomationAssets>',
            summary: 'Delete one automation asset by id.',
            jsDoc: 'Persists and returns the remaining automation asset array.',
          },
          {
            kind: 'method',
            name: 'listJobs',
            signature: 'listJobs(): Promise<JobList>',
            summary: 'List background jobs visible to this caller (unowned jobs).',
            jsDoc: 'Reads ctx.jobs snapshots and maps them to minimal JSON.',
          },
          {
            kind: 'method',
            name: 'killJob',
            signature: 'killJob(id: string): Promise<KillJobResult>',
            summary: 'Request cancellation of one background job.',
            jsDoc: 'Returns { result: "requested" | "already-finished" }.',
          },
        ],
        types: [
          { name: 'SubagentAsset', declaration: 'export type SubagentAsset = { id: string; name: string; model: string; desc: string; prompt: string; tools: string[] }' },
          { name: 'SubagentAssets', declaration: 'export type SubagentAssets = SubagentAsset[]' },
          { name: 'SubagentAssetId', declaration: 'export type SubagentAssetId = string' },
          { name: 'ToolEntry', declaration: 'export type ToolEntry = { name: string; description: string }' },
          { name: 'ToolList', declaration: 'export type ToolList = ToolEntry[]' },
          { name: 'AutomationAsset', declaration: 'export type AutomationAsset = { id: string; name: string; desc: string; spec: string; enabled?: boolean }' },
          { name: 'AutomationAssets', declaration: 'export type AutomationAssets = AutomationAsset[]' },
          { name: 'AutomationAssetId', declaration: 'export type AutomationAssetId = string' },
          { name: 'JobSnapshot', declaration: 'export type JobSnapshot = { id: string; kind: string; label: string; status: "running" | "stopping" | "completed" | "killed" | "failed"; detail: string; startedAt: number; finishedAt?: number; ownerSession?: string }' },
          { name: 'JobList', declaration: 'export type JobList = JobSnapshot[]' },
          { name: 'JobId', declaration: 'export type JobId = string' },
          { name: 'KillJobResult', declaration: 'export type KillJobResult = { result: "requested" | "already-finished" }' },
        ],
      },
      {
        description: 'Durable MCP server registry with live plugin mounting (save = immediately connected).',
        summary: 'MCP server registry service.',
        tags: [],
        jsDoc: 'Persists servers to mcp-servers.json beside the bundle and mounts each enabled one as a live mcp-client plugin instance.',
        key: 'mcpServers',
        exportName: 'McpServersService',
        members: [
          {
            kind: 'method',
            name: 'listServers',
            signature: 'listServers(): Promise<McpServerList>',
            summary: 'List all MCP servers with live connection status.',
            jsDoc: 'Returns persisted user servers plus read-only system servers detected from live mcp__ namespaces.',
          },
          {
            kind: 'method',
            name: 'saveServer',
            signature: 'saveServer(server: McpServer): Promise<McpServerList>',
            summary: 'Create or update one MCP server and apply it live.',
            jsDoc: 'Persists, then mounts or re-mounts the mcp-client fiber so tools appear immediately.',
          },
          {
            kind: 'method',
            name: 'deleteServer',
            signature: 'deleteServer(id: string): Promise<McpServerList>',
            summary: 'Delete one managed MCP server and unmount it.',
            jsDoc: 'Persists the remaining list and disposes the live fiber.',
          },
        ],
        types: [
          { name: 'McpServer', declaration: 'export type McpServer = { id: string; name: string; serverName: string; transport: string; command: string; args: string[]; env: Record<string,string>; cwd: string; url: string; headers: Record<string,string>; timeoutMs: number; enabled: boolean; status: string; error: string; toolCount: number; system: boolean }' },
          { name: 'McpServerList', declaration: 'export type McpServerList = McpServer[]' },
          { name: 'McpServerId', declaration: 'export type McpServerId = string' },
        ],
      },
      {
        description: 'Central plugin tool registry with live enable switches (nav panel plugin toggles).',
        summary: 'Plugin tool registry service.',
        tags: [],
        jsDoc: 'Feature bundles register their model tools here; setPluginEnabled registers/unregisters them immediately.',
        key: 'pluginTools',
        exportName: 'PluginToolsService',
        members: [
          {
            kind: 'method',
            name: 'listPlugins',
            signature: 'listPlugins(): Promise<PluginList>',
            summary: 'List registered plugin tool groups with live switch state.',
            jsDoc: 'Returns [{ id, name, enabled, toolCount, liveToolCount, tools }].',
          },
          {
            kind: 'method',
            name: 'setPluginEnabled',
            signature: 'setPluginEnabled(pluginId: PluginId, enabled: PluginEnabled): Promise<PluginList>',
            summary: 'Enable or disable one plugin\u2019s tools immediately.',
            jsDoc: 'Persists the state and registers/unregisters the plugin\u2019s tools right now.',
          },
        ],
        types: [
          { name: 'Plugin', declaration: 'export type Plugin = { id: string; name: string; enabled: boolean; toolCount: number; liveToolCount: number; tools: string[] }' },
          { name: 'PluginList', declaration: 'export type PluginList = Plugin[]' },
          { name: 'PluginId', declaration: 'export type PluginId = string' },
          { name: 'PluginEnabled', declaration: 'export type PluginEnabled = boolean' },
        ],
      },
      {
        description: 'Plugin marketplace backed by the awesome-dsh-plugin catalog (search/filter/download).',
        summary: 'Plugin marketplace service.',
        tags: [],
        jsDoc: 'Serves the bundled plugin catalog with search/filter; clones GitHub repos into ~/dsh-plugin-downloads.',
        key: 'pluginMarketplace',
        exportName: 'MarketplaceService',
        members: [
          {
            kind: 'method',
            name: 'listPlugins',
            signature: 'listPlugins(query: MarketQuery): Promise<MarketPluginList>',
            summary: 'List marketplace plugins with optional search and category filter.',
            jsDoc: 'query = { q?, category? }. Returns [{ name, url, desc, category, categoryLabel }].',
          },
          {
            kind: 'method',
            name: 'categories',
            signature: 'categories(): Promise<MarketCategories>',
            summary: 'List marketplace categories with plugin counts.',
            jsDoc: 'Returns [{ id, label, count }].',
          },
          {
            kind: 'method',
            name: 'downloadPlugin',
            signature: 'downloadPlugin(url: MarketUrl, name: MarketName): Promise<MarketDownload>',
            summary: 'Clone a GitHub plugin repo into the downloads directory.',
            jsDoc: 'Clones into ~/dsh-plugin-downloads/<name>; updates when already present.',
          },
          {
            kind: 'method',
            name: 'listDownloads',
            signature: 'listDownloads(): Promise<MarketDownloads>',
            summary: 'List previously downloaded plugin directories.',
            jsDoc: 'Returns [{ name, path, fileCount }].',
          },
          {
            kind: 'method',
            name: 'refreshCatalog',
            signature: 'refreshCatalog(): Promise<MarketRefresh>',
            summary: 'Pull the latest plugin catalog from the GitHub awesome list.',
            jsDoc: 'Fetches the awesome-dsh-plugin README, re-parses it, and merges with the local catalog.',
          },
        ],
        types: [
          { name: 'MarketQuery', declaration: 'export type MarketQuery = { q?: string; category?: string }' },
          { name: 'MarketPlugin', declaration: 'export type MarketPlugin = { name: string; url: string; desc: string; category: string; categoryLabel: string }' },
          { name: 'MarketPluginList', declaration: 'export type MarketPluginList = MarketPlugin[]' },
          { name: 'MarketCategory', declaration: 'export type MarketCategory = { id: string; label: string; count: number }' },
          { name: 'MarketCategories', declaration: 'export type MarketCategories = MarketCategory[]' },
          { name: 'MarketUrl', declaration: 'export type MarketUrl = string' },
          { name: 'MarketName', declaration: 'export type MarketName = string' },
          { name: 'MarketDownload', declaration: 'export type MarketDownload = { path: string; updated: boolean }' },
          { name: 'MarketDownloadEntry', declaration: 'export type MarketDownloadEntry = { name: string; path: string; fileCount: number }' },
          { name: 'MarketDownloads', declaration: 'export type MarketDownloads = MarketDownloadEntry[]' },
        ],
      },
    ],
    events: [],
    objects: [],
  },
}

export default TYPERT
