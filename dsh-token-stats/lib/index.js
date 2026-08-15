// Formal host half of token-stats. Class plugin form (the official pattern):
// the Service subclass IS the plugin, default-exported; the Loader auto-
// instantiates and registers it. The Typert Gateway dispatches
// /api/tokenStats/stats to the `stats` method via the strict ./typert manifest
// (lib/typert.host.js) which dsh-typert-loader auto-registers.
//
// Client reaches it over the /api connection channel:
//   ctx.connection.rpc.call("/api", "tokenStats/stats", { args: { rangeDays } })
//   => { ok: true, value: <stats> }
//
// NOTE: runs directly in the Host Cordis loader (Node ESM) — no decorator
// syntax (Node 22 rejects it), no dynamic-plugin harness globals.
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = join(BUNDLE_DIR, 'token-stats-cache.json')

function dayKey(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// How long (ms) a completed scan is reused before rescanning. 5 minutes keeps
// tab switches instant while staying fresh enough for daily use; the client
// also caches the last payload so revisits render immediately.
const SCAN_TTL = 300000

// ---------------------------------------------------------------------------
// Live token projection — 移植自 @linxin666/dsh-live-stats (Apache-2.0)。
// 注册与官方同名的 `liveTokenUsage` 会话投影：ui-conversation 原生读取并
// 在会话状态行渲染实时估算（Input ~xK tok · Output ~y tok · TPS z tok/s），
// 效果与 live-stats 完全一致（客户端零改动，数据随流式事件实时折叠）。
// ---------------------------------------------------------------------------
function isSurfaceEvent(event) {
  return (event.type === 'user/message' || event.type === 'assistant/message' || event.type === 'tool/result') && event.surfaceOp !== undefined
}
function resolveEstimatorConfig(config) {
  const known = new Set(['charsPerToken', 'blockOverhead', 'roleOverhead'])
  for (const key of Object.keys(config)) if (!known.has(key)) throw new Error('live-stats: unknown config key "' + key + '"')
  const spec = {
    charsPerToken: config.charsPerToken ?? 4,
    blockOverhead: config.blockOverhead ?? 4,
    roleOverhead: config.roleOverhead ?? 4,
  }
  if (!Number.isFinite(spec.charsPerToken) || spec.charsPerToken <= 0) throw new Error('live-stats: charsPerToken must be a positive finite number')
  for (const key of ['blockOverhead', 'roleOverhead']) if (!Number.isInteger(spec[key]) || spec[key] < 0) throw new Error('live-stats: ' + key + ' must be a non-negative integer')
  return spec
}
function estimateTextBlockTokens(characters, spec) {
  return Math.ceil(characters / spec.charsPerToken) + spec.blockOverhead
}
function estimateToolCallBlockTokens(nameCharacters, argumentCharacters, spec) {
  return Math.ceil(nameCharacters / spec.charsPerToken) + Math.ceil(argumentCharacters / spec.charsPerToken) + spec.blockOverhead
}
const MAX_CONTENT_DEPTH = 128
function estimateContentBlocks(blocks, spec, depth) {
  let tokens = 0
  for (const block of blocks) switch (block.type) {
    case 'text':
    case 'reasoning':
      tokens += estimateTextBlockTokens(block.text.length, spec)
      break
    case 'tool-call':
      tokens += estimateToolCallBlockTokens(block.name.length, block.arguments.length, spec)
      break
    case 'tool-result':
      tokens += depth >= MAX_CONTENT_DEPTH ? spec.blockOverhead : estimateContentBlocks(block.content, spec, depth + 1) + spec.blockOverhead
      break
    default: tokens += spec.blockOverhead + Math.ceil(JSON.stringify(block).length / spec.charsPerToken)
  }
  return tokens
}
function estimateContentTokens(blocks, spec) {
  return estimateContentBlocks(blocks, spec, 0)
}
function estimateMessageTokens(message, spec) {
  return estimateContentTokens(message.content, spec) + spec.roleOverhead
}
function estimateHeaderTokens(header, spec) {
  if (header === undefined) return 0
  let tokens = 0
  if (header.system !== undefined) tokens += Math.ceil(header.system.length / spec.charsPerToken) + spec.roleOverhead
  if (header.tools !== undefined && header.tools.length > 0) tokens += Math.ceil(JSON.stringify(header.tools).length / spec.charsPerToken) + spec.blockOverhead
  return tokens
}
const zeroBuckets = () => ({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })
const bucketsFrom = (usage) => ({ uncachedInputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0 })
const addReplacing = (totals, previous, next) => ({
  uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
  outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
  cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
  cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens,
})
const projectionSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  estimated: z.boolean(),
  tokensPerSecond: z.number().nonnegative().optional(),
}).strict()
function surfaceMessage(event) {
  switch (event.type) {
    case 'user/message': return event.data
    case 'assistant/message':
    case 'tool/result': return event.data.message
  }
}
function applySurface(state, event, spec) {
  const tokens = estimateMessageTokens(surfaceMessage(event), spec)
  if (event.surfaceOp === 'append') {
    state.surface.set(event.seq, tokens)
    return { surface: state.surface, surfaceTokens: state.surfaceTokens + tokens }
  }
  const operation = event.surfaceOp
  if (!state.surface.has(operation.start) || !state.surface.has(operation.end) || operation.start > operation.end) throw new Error('live-stats: replace at seq ' + event.seq + ' has invalid current range ' + operation.start + '-' + operation.end)
  let removed = 0
  for (const [seq, nodeTokens] of state.surface) {
    if (seq < operation.start) continue
    if (seq > operation.end) break
    removed += nodeTokens
    state.surface.delete(seq)
  }
  state.surface.set(event.seq, tokens)
  return { surface: state.surface, surfaceTokens: state.surfaceTokens - removed + tokens }
}
function blockEstimate(block, spec) {
  switch (block.kind) {
    case 'text':
    case 'reasoning': return estimateTextBlockTokens(block.characters, spec)
    case 'tool-call': return estimateToolCallBlockTokens(block.nameCharacters, block.argumentCharacters, spec)
    case 'fixed': return block.tokens
  }
}
function writeBlock(active, index, previous, next, spec) {
  active.pricedTokens += blockEstimate(next, spec) - (previous === undefined ? 0 : blockEstimate(previous, spec))
  if (previous === undefined) active.pricedBlocks += 1
  active.blocks[index] = next
}
function applyOutputChunk(active, chunk, spec) {
  switch (chunk.type) {
    case 'text-delta': {
      if (chunk.text === '') return false
      const previous = active.blocks[chunk.index]
      writeBlock(active, chunk.index, previous, { kind: 'text', characters: (previous?.kind === 'text' ? previous.characters : 0) + chunk.text.length }, spec)
      return true
    }
    case 'reasoning-delta': {
      if (chunk.text === '') return false
      const previous = active.blocks[chunk.index]
      writeBlock(active, chunk.index, previous, { kind: 'reasoning', characters: (previous?.kind === 'reasoning' ? previous.characters : 0) + chunk.text.length }, spec)
      return true
    }
    case 'tool-call-delta': {
      if (chunk.name === undefined && chunk.argumentsDelta === '') return false
      const previous = active.blocks[chunk.index]
      writeBlock(active, chunk.index, previous, {
        kind: 'tool-call',
        nameCharacters: chunk.name?.length ?? (previous?.kind === 'tool-call' ? previous.nameCharacters : 0),
        argumentCharacters: (previous?.kind === 'tool-call' ? previous.argumentCharacters : 0) + chunk.argumentsDelta.length,
      }, spec)
      return true
    }
    case 'block-end': {
      const previous = active.blocks[chunk.index]
      writeBlock(active, chunk.index, previous, { kind: 'fixed', tokens: estimateContentTokens([chunk.block], spec) }, spec)
      return true
    }
    default: return false
  }
}
function rateOf(step) {
  if (step.firstOutputTime === undefined || step.latestOutputTime === undefined) return
  const elapsedMs = step.latestOutputTime - step.firstOutputTime
  if (elapsedMs <= 0 || step.buckets.outputTokens <= 0) return
  return step.buckets.outputTokens * 1000 / elapsedMs
}
function exactStep(step, usage, time) {
  return {
    ...step,
    buckets: bucketsFrom(usage),
    exact: true,
    blocks: [],
    pricedTokens: 0,
    pricedBlocks: 0,
    ...usage.outputTokens > 0 ? { firstOutputTime: step.firstOutputTime ?? time, latestOutputTime: time } : {},
  }
}
function projectionView(state) {
  const active = state.active
  const previous = active !== null && state.last?.turn === active.turn && state.last.step === active.step ? state.last : undefined
  const buckets = active === null ? state.settled : addReplacing(state.settled, previous?.buckets, active.buckets)
  const estimates = state.settledEstimates - (previous?.estimated === true ? 1 : 0) + (active !== null && !active.exact ? 1 : 0)
  const rate = active === null ? state.last?.tokensPerSecond : rateOf(active) ?? state.last?.tokensPerSecond
  return {
    ...buckets,
    estimated: estimates > 0,
    ...rate === undefined ? {} : { tokensPerSecond: rate },
  }
}
function createLiveTokenUsageProjectionDefinition(spec) {
  return {
    key: 'liveTokenUsage',
    schema: projectionSchema,
    init: () => ({ settled: zeroBuckets(), settledEstimates: 0, last: null, surface: new Map(), surfaceTokens: 0, header: undefined, active: null }),
    apply: (state, event) => {
      let next = state
      if (event.type === 'step/start') next = { ...next, active: { ...event.data, buckets: { ...zeroBuckets(), uncachedInputTokens: estimateHeaderTokens(state.header, spec) + state.surfaceTokens }, exact: false, blocks: [], pricedTokens: 0, pricedBlocks: 0 } }
      else if (event.type === 'request/header') next = { ...next, header: event.data.header, ...next.active === null ? {} : { active: { ...next.active, buckets: { ...next.active.buckets, uncachedInputTokens: estimateHeaderTokens(event.data.header, spec) + state.surfaceTokens } } } }
      else if (event.type === 'assistant/chunk' && next.active !== null) {
        const { chunk } = event.data
        if (chunk.type === 'usage') next = { ...next, active: exactStep(next.active, chunk.usage, event.time) }
        else if (!next.active.exact) {
          const active = { ...next.active }
          if (applyOutputChunk(active, chunk, spec)) {
            const tokens = active.pricedBlocks === 0 ? 0 : active.pricedTokens + spec.roleOverhead
            next = { ...next, active: { ...active, buckets: { ...active.buckets, outputTokens: tokens }, ...tokens > 0 ? { firstOutputTime: active.firstOutputTime ?? event.time, latestOutputTime: event.time } : {} } }
          }
        }
      } else if (event.type === 'assistant/message' && next.active !== null) next = { ...next, active: event.data.usage === undefined ? { ...next.active, ...next.active.buckets.outputTokens > 0 ? { latestOutputTime: event.time } : {} } : exactStep(next.active, event.data.usage, event.time) }
      else if (event.type === 'step/end' && next.active !== null) {
        const active = next.active
        const rate = rateOf(active)
        const previous = next.last?.turn === active.turn && next.last.step === active.step ? next.last : undefined
        next = {
          ...next,
          settled: addReplacing(next.settled, previous?.buckets, active.buckets),
          settledEstimates: next.settledEstimates - (previous?.estimated === true ? 1 : 0) + (!active.exact ? 1 : 0),
          last: { turn: active.turn, step: active.step, buckets: active.buckets, estimated: !active.exact, tokensPerSecond: rate ?? state.last?.tokensPerSecond },
          active: null,
        }
      } else if (event.type === 'turn/end' && event.data.reason.kind !== 'completed' && next.last?.turn === event.data.turn && next.last.estimated) next = { ...next, settled: addReplacing(next.settled, next.last.buckets, zeroBuckets()), settledEstimates: next.settledEstimates - 1, last: null }
      if (isSurfaceEvent(event)) next = { ...next, ...applySurface(next, event, spec) }
      return next
    },
    view: projectionView,
    stateVersion: 2,
  }
}

export default class TokenStatsService extends TypertRemoteService {
  static inject = ['shell']

  constructor(ctx) {
    super(ctx, 'tokenStats')
    // Simple scan cache: reuse the last full scan for SCAN_TTL ms unless the
    // set of session logs changed. Reopening the settings page then is ~0ms
    // instead of rescanning every zstd file; a manual refresh or new logs
    // invalidate it.
    this._cache = null
    // Live usage projection (移植自 @linxin666/dsh-live-stats)：注册同名
    // liveTokenUsage，ui-conversation 会话状态行自动显示实时 Token/TPS。
    const sessionProjections = ctx.get('sessionProjections')
    if (sessionProjections !== undefined) {
      const spec = resolveEstimatorConfig({})
      ctx.effect(() => sessionProjections.register(createLiveTokenUsageProjectionDefinition(spec)))
    }
  }

  // Strict endpoint "tokenStats/stats" (see ./typert.host.js). No wired args:
  // the gateway invokes it with an empty args object, so this method takes no
  // parameters and defaults to the 30-day overview.
  // Cache-first stats: fresh in-memory scan -> instant; else disk cache ->
  // instant (stale) with a background rescan; else wait for one scan.
  // `stale` lets the client render immediately and refresh silently.
  async stats() {
    const shell = this.ctx.get('shell')
    const now = Date.now()
    if (this._cache && now - this._cache.at < SCAN_TTL) {
      return Object.assign({}, this._cache.view, { stale: false, cachedAt: this._cache.at })
    }
    const disk = this._readDiskCache()
    if (disk) {
      this._kickScan(shell)
      return Object.assign({}, disk.view, { stale: true, cachedAt: disk.at })
    }
    const view = await this._kickScan(shell)
    if (!view) return { error: '会话日志扫描失败' }
    return Object.assign({}, view, { stale: false, cachedAt: Date.now() })
  }

  // One full scan, shared across concurrent callers; updates memory + disk
  // cache when done. Returns the built view or null on failure.
  _kickScan(shell) {
    if (!this._scanning) {
      this._scanning = (async () => {
        try {
          const raw = shell
            ? await this.scanAll(shell)
            : { byDay: new Map(), byModel: new Map(), sessionCount: 0, messageCount: 0, grandTotal: 0, toolByDay: new Map() }
          const view = this.buildView(raw)
          const at = Date.now()
          this._cache = { at, view }
          this._writeDiskCache(view, at)
          return view
        } catch (e) {
          console.error('[token-stats] scan failed:', e && e.message ? e.message : e)
          return null
        } finally {
          this._scanning = null
        }
      })()
    }
    return this._scanning
  }

  // raw scan result -> view model (pure; also reused by the disk cache).
  buildView(stats) {
    const rangeDays = 365
    const byDay = stats.byDay, toolByDay = stats.toolByDay
    const dates = Array.from(byDay.keys()).sort()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayKey = dates.length ? dates[dates.length - 1] : dayKey(today.getTime())
    const startKey = dates.length ? dates[0] : todayKey
    const maxTokens = Math.max(1, ...[...byDay.values()].map((d) => d.total))
    const sy = startKey.split('-').map(Number), ey = todayKey.split('-').map(Number)
    const startMs = new Date(sy[0], sy[1] - 1, sy[2]).getTime()
    const endMs = new Date(ey[0], ey[1] - 1, ey[2]).getTime()
    const dayList = []
    for (let t = startMs; t <= endMs; t += 86400000) {
      const key = dayKey(t)
      const rec = byDay.get(key)
      const total = rec ? rec.total : 0
      const turnCount = rec ? rec.turns.size : 0
      const toolCallCount = toolByDay.get(key) || 0
      const ratio = maxTokens ? total / maxTokens : 0
      let level = 0
      if (total > 0) level = ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4
      dayList.push({ date: key, totalTokens: total, turnCount, toolCallCount, level })
    }
    const firstDow = new Date(sy[0], sy[1] - 1, sy[2]).getDay()
    const weeks = []
    for (let i = 0; i < dayList.length; i++) {
      const col = Math.floor((i + firstDow) / 7)
      const row = (i + firstDow) % 7
      if (!weeks[col]) weeks[col] = new Array(7).fill(null)
      weeks[col][row] = dayList[i]
    }
    const weekArr = weeks.map((days, idx) => ({ weekIndex: idx, days }))
    const days = []
    for (let i = rangeDays - 1; i >= 0; i--) {
      const ts = Date.now() - i * 86400000
      const key = dayKey(ts)
      const rec = byDay.get(key)
      const d = new Date(ts)
      const models = rec ? Array.from(rec.byModel.entries()).map(([model, total]) => ({ model, total })) : []
      days.push({ date: (d.getMonth() + 1) + '月' + d.getDate() + '日', key, total: rec ? rec.total : 0, turns: rec ? rec.turns.size : 0, models })
    }
    const models = Array.from(stats.byModel.entries())
      .map(([model, total]) => ({ model, total, share: stats.grandTotal ? total / stats.grandTotal : 0 }))
      .sort((a, b) => b.total - a.total)
    function streak() {
      const used = new Set(byDay.keys())
      let count = 0
      const d = new Date()
      if (!used.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1)
      while (used.has(dayKey(d.getTime()))) { count++; d.setDate(d.getDate() - 1) }
      return count
    }
    return {
      rangeDays,
      grandTotal: stats.grandTotal,
      sessions: stats.sessionCount,
      messages: stats.messageCount,
      activeDays: byDay.size,
      streak: streak(),
      days,
      weeks: weekArr,
      maxTokens,
      models,
    }
  }

  _readDiskCache() {
    try {
      const raw = readFileSync(CACHE_FILE, 'utf8')
      const obj = JSON.parse(raw)
      if (obj && obj.view && typeof obj.at === 'number') return { view: obj.view, at: obj.at }
    } catch (e) { /* absent or malformed */ }
    return null
  }

  _writeDiskCache(view, at) {
    try {
      mkdirSync(dirname(CACHE_FILE), { recursive: true })
      writeFileSync(CACHE_FILE, JSON.stringify({ at, view }), 'utf8')
    } catch (e) { /* best effort */ }
  }

  async scanAll(shell) {
    const result = { byDay: new Map(), byModel: new Map(), sessionCount: 0, messageCount: 0, grandTotal: 0, toolByDay: new Map() }
    const scanCmd = `python3 <<'PYEND'\nimport json, glob, subprocess, os, datetime\nsessions_dir = os.path.expanduser('~/.dsh/sessions')\nfiles = glob.glob(os.path.join(sessions_dir, '*', '*', 'session.jsonl.zstd'))\nmsg = 0\nsessions = set()\nfor f in files:\n    sid = os.path.basename(os.path.dirname(f)).split('session-')[-1]\n    sessions.add(sid)\n    try:\n        raw = subprocess.run(['zstd', '-d', '-c', f], capture_output=True).stdout\n    except Exception:\n        continue\n    for line in raw.decode('utf-8', 'replace').splitlines():\n        try:\n            ev = json.loads(line)\n        except Exception:\n            continue\n        t = ev.get('type')\n        ts = ev.get('time') or 0\n        day = datetime.datetime.fromtimestamp(ts / 1000).strftime('%Y-%m-%d')\n        if t == 'user/message':\n            msg += 1\n        elif t == 'assistant/message':\n            usage = ev.get('data', {}).get('usage')\n            src = (ev.get('data', {}).get('message', {}).get('source') or {}) or {}\n            model = src.get('model') or 'unknown'\n            turn = ev.get('data', {}).get('turn')\n            if usage:\n                total = (usage.get('inputTokens') or 0) + (usage.get('outputTokens') or 0) + (usage.get('cacheReadTokens') or 0) + (usage.get('cacheWriteTokens') or 0)\n                print(json.dumps({'kind': 'usage', 'day': day, 'model': model, 'total': total, 'turn': turn}))\n        elif t == 'tool/call':\n            print(json.dumps({'kind': 'tool', 'day': day}))\nprint('__META__' + json.dumps({'msg': msg, 'sessions': len(sessions)}))\nPYEND`
    const spec = shell.resolve({ command: scanCmd, timeoutMs: 30000, stdoutMaxBytes: 50 * 1024 * 1024 })
    const run = await shell.run(spec)
    const outText = (run.stdout && run.stdout.text) || ''
    for (const line of outText.split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (t.startsWith('__META__')) {
        try { const m = JSON.parse(t.replace('__META__', '')); result.messageCount = m.msg || 0; result.sessionCount = m.sessions || 0 } catch (e) {}
        continue
      }
      try {
        const d = JSON.parse(t)
        if (d.kind === 'tool') { result.toolByDay.set(d.day, (result.toolByDay.get(d.day) || 0) + 1); continue }
        if (d.kind === 'msg') continue
        result.grandTotal += d.total
        let bd = result.byDay.get(d.day)
        if (!bd) { bd = { total: 0, byModel: new Map(), turns: new Set() }; result.byDay.set(d.day, bd) }
        bd.total += d.total
        if (d.turn !== null && d.turn !== undefined) bd.turns.add(String(d.turn))
        bd.byModel.set(d.model, (bd.byModel.get(d.model) || 0) + d.total)
        result.byModel.set(d.model, (result.byModel.get(d.model) || 0) + d.total)
      } catch (e) {}
    }
    return result
  }
}
