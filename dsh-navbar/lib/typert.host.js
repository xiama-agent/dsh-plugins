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
            typeSymbol: 'dsh-navbar#McpServer',
            schema: mcpServerSchema,
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
    ],
    events: [],
    objects: [],
  },
}

export default TYPERT
