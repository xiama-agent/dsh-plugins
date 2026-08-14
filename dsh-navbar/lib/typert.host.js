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
        ],
        types: [
          { name: 'SubagentAsset', declaration: 'export type SubagentAsset = { id: string; name: string; model: string; desc: string; prompt: string; tools: string[] }' },
          { name: 'SubagentAssets', declaration: 'export type SubagentAssets = SubagentAsset[]' },
          { name: 'SubagentAssetId', declaration: 'export type SubagentAssetId = string' },
          { name: 'ToolEntry', declaration: 'export type ToolEntry = { name: string; description: string }' },
          { name: 'ToolList', declaration: 'export type ToolList = ToolEntry[]' },
        ],
      },
    ],
    events: [],
    objects: [],
  },
}

export default TYPERT
