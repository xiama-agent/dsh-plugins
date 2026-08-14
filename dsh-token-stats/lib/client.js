// Formal client half of token-stats. Browser module for DSH client UI, in the
// official __ModuleLoader__ format. Registers a view tab titled 使用统计 in the
// conversation view ring (conversation.view, next to chat/trajectory) and
// fetches data from the Host Remote over the /api connection channel:
//   ctx.connection.rpc.call("/api", "tokenStats/stats", { args: { rangeDays } })
//   => { ok: true, value: <stats> }
window.__ModuleLoader__.load({
  id: 'dsh-token-stats',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let react = require('react')

    const CSS = '.tstat-page{display:flex;flex-direction:column;gap:16px;padding:20px 24px;height:100%;overflow-y:auto;box-sizing:border-box}.tstat-head{display:flex;align-items:center;gap:12px}.tstat-title{font-size:22px;font-weight:700;color:var(--dsw-alias-label-primary);margin:0}.tstat-spacer{flex:1}.tstat-range-group{display:inline-flex;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.tstat-range-btn{border:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);padding:5px 14px;font-size:12px;cursor:pointer}.tstat-range-btn.on{background:var(--dsw-alias-brand-primary);color:#fff}.tstat-refresh{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 16px;font-size:14px;cursor:pointer}.tstat-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.tstat-stat-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px;min-width:0}.tstat-stat-label{font-size:14px;color:var(--dsw-alias-label-secondary);margin-bottom:6px}.tstat-stat-value{font-size:28px;font-weight:700;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tstat-stat-value.small{font-size:20px}.tstat-stat-sub{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:3px}.tstat-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:16px}.tstat-card-title{font-size:17px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0 0 8px}.tstat-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:12px;color:var(--dsw-alias-label-secondary);align-items:center}.tstat-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:middle}.tstat-heat{position:relative}.tstat-heat-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.tstat-heat-range{font-size:11px;color:var(--dsw-alias-label-secondary)}.tstat-heat-body{display:flex;gap:3px;overflow-x:auto;padding-bottom:4px}.tstat-heat-legend{display:flex;align-items:center;gap:4px;font-size:13px;color:var(--dsw-alias-label-secondary)}.tstat-heat-swatch{width:16px;height:16px;border-radius:2px}.tstat-heat-week{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.tstat-heat-cell{aspect-ratio:1;border-radius:3px;cursor:pointer;min-width:8px;width:100%}.tstat-weekday{display:flex;align-items:center;justify-content:flex-end;font-size:9px;color:var(--dsw-alias-label-secondary);width:24px;height:16px;margin-right:2px}.tstat-side{display:flex;gap:16px;align-items:stretch}.tstat-side-trend{flex:2;min-width:0}.tstat-side-model{flex:1;min-width:0;display:flex;flex-direction:column}.tstat-side-model .tstat-donut-wrap{flex-direction:column;align-items:center;gap:12px}.tstat-side-model .tstat-model-list{width:100%}.tstat-donut-wrap{display:flex;align-items:center;gap:24px;flex-wrap:wrap}.tstat-donut{position:relative;width:160px;height:160px;flex-shrink:0}.tstat-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}.tstat-donut-total{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary)}.tstat-donut-unit{font-size:11px;color:var(--dsw-alias-label-secondary)}.tstat-model-list{flex:1;min-width:0}.tstat-model-row{display:flex;align-items:center;gap:8px;padding:7px 0}.tstat-model-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;color:var(--dsw-alias-label-primary)}.tstat-model-tokens{font-size:14px;color:var(--dsw-alias-label-secondary)}.tstat-model-share{width:60px;text-align:right;font-size:14px;color:var(--dsw-alias-label-primary)}.tstat-loading{color:var(--dsw-alias-label-secondary);font-size:13px;padding:24px 0;text-align:center}.tstat-tip{position:fixed;z-index:9999;pointer-events:none;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--dsw-alias-label-primary);box-shadow:0 4px 16px rgba(0,0,0,.15);max-width:300px;line-height:1.6}.tstat-tip-row{display:flex;align-items:center;gap:8px;margin:1px 0}.tstat-tip-title{font-weight:600;margin-bottom:4px;font-size:14px}'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-token-stats/token-stats.css"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-token-stats'
      tag.dataset.pluginCss = 'dsh-token-stats/token-stats.css'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    const MODEL_COLORS = { 'deepseek-v4-flash': '#4c8dff', 'mimo-v2.5': '#34c759', 'deepseek-v4-pro': '#a78bfa' }
    const FALLBACK = ['#ff9f0a', '#ff5f57', '#00c2c7', '#ffd60a', '#bf5af2', '#5e5ce6']
    function colorOf(model, i) { return MODEL_COLORS[model] || FALLBACK[i % FALLBACK.length] }
    function fmt(n) { if (n >= 100000000) return (n / 100000000).toFixed(2) + '亿'; if (n >= 10000) return (n / 10000).toFixed(1) + '万'; return String(Math.round(n || 0)) }
    function pct(f) { return (f * 100).toFixed(1) + '%' }
    function Tip(p) {
      if (!p.tip) return null
      const ref = react.useRef(null)
      const [pos, setPos] = react.useState(null)
      react.useLayoutEffect(function () {
        if (ref.current) {
          const w = ref.current.offsetWidth
          const h = ref.current.offsetHeight
          // Tooltip sits ABOVE the cursor, with the cursor at ~2/3 of its
          // width (more to the left of the tooltip).
          let left = p.tip.x - Math.round(w * 2 / 3)
          let top = p.tip.y - h - 10
          const margin = 8
          if (left < margin) left = margin
          if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin
          if (top < margin) top = p.tip.y + 14 // flip below near the top edge
          setPos({ left: left, top: top })
        }
      }, [p.tip && p.tip.x, p.tip && p.tip.y])
      // Always render (so the ref exists for measuring); position updates
      // after the first layout pass.
      return react.createElement('div', {
        ref: ref,
        className: 'tstat-tip',
        style: pos ? { left: pos.left, top: pos.top } : { left: p.tip.x, top: p.tip.y },
      }, p.tip.content)
    }

    function StatCards(c) {
      const data = c.data, top = data.models && data.models[0]
      const cards = [
        { label: '🔥 tokens 用量', value: fmt(data.grandTotal) },
        { label: '💬 会话数量', value: data.sessions },
        { label: '✉️ 消息数量', value: data.messages },
        { label: '📅 活跃天数', value: data.activeDays },
        { label: '⚡ 当前连续天数', value: data.streak },
        { label: '📈 最常用模型', value: top ? top.model : '-', sub: top ? '占比 ' + pct(top.share) : '', title: top ? top.model : undefined, long: !!top },
      ]
      return react.createElement('div', { className: 'tstat-cards' }, cards.map(function (k) {
        return react.createElement('div', { key: k.label, className: 'tstat-stat-card' },
          react.createElement('div', { className: 'tstat-stat-label' }, k.label),
          react.createElement('div', { className: 'tstat-stat-value' + (k.long ? ' small' : ''), title: k.title }, k.value),
          k.sub ? react.createElement('div', { className: 'tstat-stat-sub' }, k.sub) : null)
      }))
    }

    // GitHub/ZCode-style contribution grid: fixed 52 columns x 7 rows, the
    // bottom-right cell is TODAY, dates roll forward day by day (new cell
    // appears at bottom-right, oldest falls off top-left). No month labels.
    const HEAT_COLS = 52
    const LEVEL_COLORS = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
    function fmtDate(key) { const p = key.split('-').map(Number); return p[1] + '月' + p[2] + '日' }
    function dayKeyOf(ts) {
      const d = new Date(ts)
      const p = (n) => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    }

    function Heatmap(p) {
      const days = p.days; const [tip, setTip] = react.useState(null)
      if (!days || !days.length) return null
      // Index the per-day payload by date key for O(1) lookup.
      const byKey = {}
      let maxTotal = 0
      for (const d of days) { byKey[d.key] = d; if (d.total > maxTotal) maxTotal = d.total }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      // The grid's last cell is today; the first cell is today - (52*7-1) days.
      const endTs = today.getTime()
      const totalDays = HEAT_COLS * 7
      const startTs = endTs - (totalDays - 1) * 86400000
      // Build columns; each column is one ISO-ish week starting Sunday.
      const columns = []
      for (let col = 0; col < HEAT_COLS; col++) {
        const cells = []
        for (let row = 0; row < 7; row++) {
          const ts = startTs + (col * 7 + row) * 86400000
          const key = dayKeyOf(ts)
          const rec = byKey[key]
          const total = rec ? rec.total : 0
          const level = total <= 0 ? 0 : maxTotal <= 0 ? 0 : Math.min(4, 1 + Math.floor((total / maxTotal) * 4))
          const d = new Date(ts)
          const label = (d.getMonth() + 1) + '月' + d.getDate() + '日'
          cells.push(react.createElement('div', {
            key: key,
            className: 'tstat-heat-cell',
            style: { background: LEVEL_COLORS[level] || LEVEL_COLORS[0] },
            onMouseMove: function (e) { setTip({ x: e.clientX, y: e.clientY, content: react.createElement('div', null, react.createElement('div', { className: 'tstat-tip-title' }, label), react.createElement('div', { className: 'tstat-tip-row' }, 'Tokens: ', fmt(total)), react.createElement('div', { className: 'tstat-tip-row' }, '轮数: ', rec ? (rec.turns || 0) : 0)) }) },
            onMouseLeave: function () { setTip(null) },
          }))
        }
        columns.push(react.createElement('div', { key: 'col' + col, className: 'tstat-heat-week' }, cells))
      }
      const swatches = LEVEL_COLORS.map(function (c) { return react.createElement('span', { key: c, className: 'tstat-heat-swatch', style: { background: c } }) })
      return react.createElement('div', { className: 'tstat-heat' },
        react.createElement('div', { className: 'tstat-heat-head' }, react.createElement('div', { className: 'tstat-heat-range' }, '最近一年活跃度'), react.createElement('div', { className: 'tstat-heat-legend' }, '较少', swatches, '较多')),
        react.createElement('div', { className: 'tstat-heat-body' }, columns),
        react.createElement(Tip, { tip: tip }))
    }

    function TrendChart(p) {
      const days = p.days; const [tip, setTip] = react.useState(null)
      if (!days || !days.length) return null
      const W = 560, H = 300, PL = 8, PR = 8, PT = 16, PB = 30
      const cw = (W - PL - PR) / days.length, bh = H - PT - PB, max = Math.max(1, ...days.map(function (dd) { return dd.total }))
      const modelSet = []; for (const dd of days) { for (const mm of dd.models) { if (modelSet.indexOf(mm.model) < 0) modelSet.push(mm.model) } }
      const grid = [0, 0.25, 0.5, 0.75, 1].map(function (f) { const y = PT + bh * (1 - f); return react.createElement('line', { key: 'g' + f, x1: PL, x2: W - PR, y1: y, y2: y, stroke: 'var(--dsw-alias-border-l1)', strokeDasharray: '4 4' }) })
      const bars = days.map(function (dd, i) {
        const x = PL + i * cw, bw = Math.min(48, cw * 0.6), bx = x + (cw - bw) / 2
        const ordered = dd.models.slice().sort(function (a, b) { return modelSet.indexOf(a.model) - modelSet.indexOf(b.model) })
        let acc = 0
        const segs = ordered.map(function (mm) { const h = bh * (mm.total / max); const r = react.createElement('rect', { key: mm.model + i, x: bx, y: PT + bh - acc - h, width: bw, height: Math.max(0.5, h), fill: colorOf(mm.model, modelSet.indexOf(mm.model)) }); acc += h; return r })
        const step = Math.max(1, Math.ceil(days.length / 6)), show = i % step === 0 || i === days.length - 1
        const label = show ? react.createElement('text', { key: 'l' + i, x: x + cw / 2, y: H - 10, textAnchor: 'middle', fontSize: 10, fill: 'var(--dsw-alias-label-secondary)' }, dd.date) : null
        const hit = react.createElement('rect', { key: 'hit' + i, x: x, y: PT, width: cw, height: bh, fill: 'transparent', onMouseMove: function (e) { setTip({ x: e.clientX, y: e.clientY, content: react.createElement('div', null, react.createElement('div', { className: 'tstat-tip-title' }, dd.date), dd.models.map(function (mm) { return react.createElement('div', { key: mm.model, className: 'tstat-tip-row' }, react.createElement('span', { className: 'tstat-dot', style: { background: colorOf(mm.model, modelSet.indexOf(mm.model)) } }), mm.model + '：' + fmt(mm.total) + ' tokens') }), react.createElement('div', { className: 'tstat-tip-total' }, '合计 ' + fmt(dd.total) + ' tokens')) }) }, onMouseLeave: function () { setTip(null) } })
        return react.createElement('g', { key: dd.key }, segs, label, hit)
      })
      const legend = modelSet.map(function (mm, i) { return react.createElement('span', { key: mm }, react.createElement('span', { className: 'tstat-dot', style: { background: colorOf(mm, i) } }), mm) })
      return react.createElement('div', null, react.createElement('div', { style: { position: 'relative', width: '60%', margin: '0 auto', aspectRatio: (W / H).toFixed(3) } }, react.createElement('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: '100%', style: { display: 'block' } }, grid, bars)), react.createElement('div', { className: 'tstat-legend' }, legend), react.createElement(Tip, { tip: tip }))
    }

    function DonutChart(c) {
      const models = c.models || [], total = c.total, R = 54, CX = 80, CY = 80, C = 2 * Math.PI * R
      let acc = 0
      const segs = models.map(function (mm, i) { const frac = mm.share || 0; const seg = react.createElement('circle', { key: mm.model, cx: CX, cy: CY, r: R, fill: 'none', stroke: colorOf(mm.model, i), strokeWidth: 15, strokeDasharray: (frac * C) + ' ' + C, strokeDashoffset: -acc * C }); acc += frac; return seg })
      const rows = models.map(function (mm, i) { return react.createElement('div', { key: mm.model, className: 'tstat-model-row' }, react.createElement('span', { className: 'tstat-dot', style: { background: colorOf(mm.model, i) } }), react.createElement('span', { className: 'tstat-model-name' }, mm.model), react.createElement('span', { className: 'tstat-model-tokens' }, fmt(mm.total) + ' tokens'), react.createElement('span', { className: 'tstat-model-share' }, pct(mm.share))) })
      return react.createElement('div', { className: 'tstat-donut-wrap' }, react.createElement('div', { className: 'tstat-donut' }, react.createElement('svg', { viewBox: '0 0 160 160', width: 160, height: 160 }, react.createElement('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'var(--dsw-alias-border-l1)', strokeWidth: 15 }), segs), react.createElement('div', { className: 'tstat-donut-center' }, react.createElement('div', { className: 'tstat-donut-total' }, fmt(total)), react.createElement('div', { className: 'tstat-donut-unit' }, 'tokens'))), react.createElement('div', { className: 'tstat-model-list' }, rows))
    }

    // Module-level payload cache: switching views re-renders the page, so keep
    // the last good payload and render it immediately while a background fetch
    // refreshes (host also caches scans for 5 minutes).
    let lastData = null

    function TokenStatsPage(props) {
      const connection = props.connection
      const [data, setData] = react.useState(lastData), [err, setErr] = react.useState(null), [tick, setTick] = react.useState(0), [loading, setLoading] = react.useState(false)
      react.useEffect(function () {
        let alive = true
        setLoading(true)
        ;(async function () {
          try {
            const full = await connection.rpc.call('/api', 'tokenStats/stats', { args: {} })
            if (alive) {
              if (full && full.ok && full.value && !full.value.error) { lastData = full.value; setData(full.value); setErr(null) }
              else { setErr((full && full.value && full.value.error) || (full && !full.ok ? (full.error && full.error.message) : 'no data')) }
              setLoading(false)
            }
          } catch (e) { if (alive) { console.error('token-stats 加载失败', e); setErr(String(e && e.message ? e.message : e)); setLoading(false) } }
        })()
        return function () { alive = false }
      }, [tick])
      const body = []
      if (data) {
        body.push(react.createElement(StatCards, { key: 'stats', data: data }))
        body.push(react.createElement('div', { key: 'heat', className: 'tstat-card' }, react.createElement('h3', { className: 'tstat-card-title' }, '活跃热力图'), react.createElement(Heatmap, { days: data.days })))
        // Side-by-side row: trend chart 2/3, model usage 1/3, equal height.
        body.push(react.createElement('div', { key: 'side', className: 'tstat-side' },
          react.createElement('div', { className: 'tstat-card tstat-side-trend' }, react.createElement('h3', { className: 'tstat-card-title' }, '按天 Token 趋势'), react.createElement(TrendChart, { days: data.days.slice(-30) })),
          react.createElement('div', { className: 'tstat-card tstat-side-model' }, react.createElement('h3', { className: 'tstat-card-title' }, '模型用量'), react.createElement(DonutChart, { models: data.models, total: data.grandTotal })),
        ))
      } else if (err) {
        body.push(react.createElement('div', { key: 'err', className: 'tstat-loading', style: { color: 'var(--dsw-alias-danger)' } }, '加载失败: ' + err))
      }
      return react.createElement('div', { className: 'tstat-page' },
        react.createElement('div', { className: 'tstat-head' }, react.createElement('h2', { className: 'tstat-title' }, '使用统计'), react.createElement('div', { className: 'tstat-spacer' }), react.createElement('button', { className: 'tstat-refresh', disabled: loading, onClick: function () { setTick(function (t) { return t + 1 }) } }, loading ? '加载中…' : '刷新')),
        loading && !data && !err ? react.createElement('div', { className: 'tstat-loading' }, '数据加载中…') : null, body)
    }

    const inject = ['slots', 'connection']
    function apply(ctx) {
      const slots = ctx.get('slots'), connection = ctx.get('connection')
      if (slots === undefined || connection === undefined) return
      slots.inject('conversation.view', function () {
        return slots.register({ name: 'conversation.view', id: 'stats', order: 20, label: function () { return '使用统计' } },
          function () { return react.createElement(TokenStatsPage, { connection: connection }) })
      })
    }
exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
