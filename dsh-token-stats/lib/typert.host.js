// Strict Host TYPERT manifest for dsh-token-stats. Consumed automatically by
// dsh-typert-loader, which reads the ./typert export and registers the strict
// invocation so the Typert Gateway dispatches /api/tokenStats/stats to the
// `stats` method on the registered "tokenStats" Service. Strict mode means the
// gateway needs no @Remote marker on the method.
import { z } from 'zod'

const modelUsageSchema = z.object({ model: z.string(), total: z.number() })

const dayCellSchema = z.object({
  date: z.string(),
  totalTokens: z.number(),
  turnCount: z.number(),
  toolCallCount: z.number(),
  level: z.number().int().min(0).max(4),
})

const statsSuccessSchema = z.object({
  rangeDays: z.number(),
  grandTotal: z.number(),
  sessions: z.number(),
  messages: z.number(),
  activeDays: z.number(),
  streak: z.number(),
  days: z.array(z.object({
    date: z.string(),
    key: z.string(),
    total: z.number(),
    turns: z.number(),
    models: z.array(modelUsageSchema),
  })),
  weeks: z.array(z.object({
    weekIndex: z.number(),
    days: z.array(dayCellSchema.nullable()),
  })),
  maxTokens: z.number(),
  models: z.array(z.object({ model: z.string(), total: z.number(), share: z.number() })),
})

const statsResultSchema = z.union([
  statsSuccessSchema,
  z.object({ error: z.string() }),
])

export const TYPERT = {
  package: 'dsh-token-stats',
  face: 'host',
  schemas: [],
  invocations: [
    {
      id: 'dsh-token-stats#tokenStats/stats',
      service: 'tokenStats',
      namespace: 'tokenStats',
      method: 'stats',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-token-stats#TokenStatsStatsResult', schema: statsResultSchema },
      sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
    },
  ],
  model: {
    services: [
      {
        description: 'Disk-backed token usage statistics over persisted Session logs.',
        summary: 'Token usage statistics service.',
        tags: [],
        jsDoc: 'Scans ~/.dsh/sessions/**/session.jsonl.zstd deterministically.',
        key: 'tokenStats',
        exportName: 'TokenStatsService',
        members: [
          {
            kind: 'method',
            name: 'stats',
            signature: 'stats(): Promise<TokenStatsStatsResult>',
            summary: 'Compute token usage dashboard data for the default 30-day overview.',
            jsDoc: 'Returns usage cards, a heatmap, a trend series, and model shares.',
          },
        ],
        types: [
          { name: 'TokenStatsStatsResult', declaration: 'export type TokenStatsStatsResult = { rangeDays; grandTotal; sessions; messages; activeDays; streak; days; weeks; maxTokens; models } | { error: string }' },
        ],
      },
    ],
    events: [],
    objects: [],
  },
}

export default TYPERT
