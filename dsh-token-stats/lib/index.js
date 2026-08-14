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

function dayKey(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// How long (ms) a completed scan is reused before rescanning. 5 minutes keeps
// tab switches instant while staying fresh enough for daily use; the client
// also caches the last payload so revisits render immediately.
const SCAN_TTL = 300000

export default class TokenStatsService extends TypertRemoteService {
  static inject = ['shell']

  constructor(ctx) {
    super(ctx, 'tokenStats')
    // Simple scan cache: reuse the last full scan for SCAN_TTL ms unless the
    // set of session logs changed. Reopening the settings page then is ~0ms
    // instead of rescanning every zstd file; a manual refresh or new logs
    // invalidate it.
    this._cache = null
  }

  // Strict endpoint "tokenStats/stats" (see ./typert.host.js). No wired args:
  // the gateway invokes it with an empty args object, so this method takes no
  // parameters and defaults to the 30-day overview.
  async stats() {
    const rangeDays = 365
    const shell = this.ctx.get('shell')
    let stats
    if (shell) {
      stats = await this.scanned(shell)
    } else {
      stats = { byDay: new Map(), byModel: new Map(), sessionCount: 0, messageCount: 0, grandTotal: 0, toolByDay: new Map() }
    }
    if (stats.error) return stats
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

  // Cache-aware scan: scans once, then serves the cached result for SCAN_TTL
  // ms, invalidating early when the set of session log files changes (new
  // sessions/chats) or when forced (the client's 刷新 button clears the TTL).
  async scanned(shell) {
    const now = Date.now()
    const cache = this._cache
    const fileKey = await this.sessionFileKey(shell)
    if (cache && cache.key === fileKey && now - cache.at < SCAN_TTL) {
      return cache.stats
    }
    const stats = await this.scanAll(shell)
    this._cache = { key: fileKey, at: now, stats }
    return stats
  }

  // The glob set of session log files, joined, used as the cache key so a new
  // chat (a new log file) triggers a rescan even inside the TTL.
  async sessionFileKey(shell) {
    const cmd = "python3 -c \"import glob,os;print('|'.join(sorted(glob.glob(os.path.expanduser('~/.dsh/sessions/*/*/session.jsonl.zstd')))))\""
    const spec = shell.resolve({ command: cmd, timeoutMs: 10000, stdoutMaxBytes: 1024 * 1024 })
    const run = await shell.run(spec)
    return ((run.stdout && run.stdout.text) || '').trim().split('\n').pop() || ''
  }

  // Expire the cache immediately (called by an RPC exposed for the client's
  // refresh button if desired). Not part of the strict manifest for now.
  clearCache() {
    this._cache = null
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
