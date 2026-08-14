// Formal client half of dsh-navbar.
//
// Adds two additive UI pieces (no shipped UI is replaced):
//  1. A nav toggle button in the session header action row
//     (conversation.session.header.actions, id 'nav-toggle').
//  2. A right slide-out navigation panel in the frame overlay
//     (shell.overlay, id 'nav-panel') with four section entries:
//     - 自制插件: enable/disable switches for feature bundles
//     - 子代理: subagent asset CRUD (run via run_subagent_asset)
//     - MCP服务器: MCP server registry with live mount/unmount
//     - 自动化: automation asset registry + live background jobs
//
// Shared open/active state lives in a tiny module store subscribed by both
// components, so the header button and the panel stay in sync.
window.__ModuleLoader__.load({
  id: 'dsh-navbar',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let react = require('react')

    const CSS = '.dsh-nav-toggle{border:1px solid var(--dsw-alias-border-l2);height:32px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:18px;justify-content:center;align-items:center;gap:4px;padding:6px 12px;font-size:13px;font-weight:400;line-height:20px;display:inline-flex}.dsh-nav-toggle:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsh-nav-toggle span,.dsh-nav-toggle svg{flex:none}.dsh-nav-toggle span{white-space:nowrap}.dsh-nav-toggle.on{background:var(--dsw-alias-brand-primary);color:#fff;border-color:var(--dsw-alias-brand-primary)}.dsh-nav-overlay{position:fixed;inset:0;z-index:9990;pointer-events:none}.dsh-nav-panel{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:85vw;box-sizing:border-box;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l1);box-shadow:-6px 0 24px rgba(0,0,0,.14);pointer-events:auto;display:flex;flex-direction:column;z-index:9991}.dsh-nav-head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}.dsh-nav-title{flex:1;font-size:16px;font-weight:700;color:var(--dsw-alias-label-primary)}.dsh-nav-close{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px}.dsh-nav-close:hover{background:var(--dsw-alias-bg-layer-1)}.dsh-nav-sections{display:flex;flex-direction:column;padding:8px;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1)}.dsh-nav-item{border:none;background:transparent;text-align:left;font-size:14px;color:var(--dsw-alias-label-primary);padding:10px 12px;border-radius:8px;cursor:pointer}.dsh-nav-item:hover{background:var(--dsw-alias-bg-layer-1)}.dsh-nav-item.on{background:var(--dsw-alias-brand-primary);color:#fff;font-weight:600}.dsh-nav-body{flex:1;overflow-y:auto;padding:16px}.dsh-nav-placeholder{color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;padding:40px 0;border:1px dashed var(--dsw-alias-border-l1);border-radius:10px}.dsh-plugins{display:flex;flex-direction:column;gap:10px}.dsh-plugin-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:12px 14px}.dsh-plugin-name{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:4px}.dsh-plugin-desc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5}.dsh-plugin-status{display:inline-block;margin-top:6px;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:99px;padding:2px 10px}.dsh-plugin-status.ok{color:#1a7f37;border-color:rgba(26,127,55,.4);background:rgba(26,127,55,.08)}.dsh-plugin-status.off{color:#e5484d;border-color:rgba(229,72,77,.4);background:rgba(229,72,77,.08)}.dsh-plugin-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.dsh-switch{position:relative;width:36px;height:20px;flex-shrink:0;border:none;border-radius:99px;background:var(--dsw-alias-border-l1);cursor:pointer;transition:background .15s ease;padding:0}.dsh-switch::after{content:\'\';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .15s ease}.dsh-switch.on{background:var(--dsw-alias-brand-primary)}.dsh-switch.on::after{left:18px}.dsh-switch.locked{opacity:.5;cursor:not-allowed}.dsh-plugin-locked{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:99px;padding:2px 10px}'

    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-navbar/navbar.css"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-navbar'
      tag.dataset.pluginCss = 'dsh-navbar/navbar.css'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }
    // Extra styles for the automation (background jobs) section.
    const CSS2 = '.dsh-nav-jobs{border-bottom:1px solid var(--dsw-alias-border-l1);padding:4px 0 12px;margin-bottom:8px}.dsh-nav-jobs-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary);padding:4px 8px}.dsh-job-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;font-size:12px}.dsh-job-row:hover{background:var(--dsw-alias-bg-layer-1)}.dsh-job-main{flex:1;min-width:0}.dsh-job-label{display:block;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsh-job-id{font-size:11px;color:var(--dsw-alias-label-secondary)}.dsh-job-status{padding:2px 8px;border-radius:99px;font-size:11px;flex:none}.dsh-job-status.st-running{background:rgba(76,141,255,.15);color:#4c8dff}.dsh-job-status.st-stopping{background:rgba(255,159,10,.15);color:#ff9f0a}.dsh-job-status.st-completed{background:rgba(52,199,89,.15);color:#34c759}.dsh-job-status.st-killed{background:rgba(255,95,87,.15);color:#ff5f57}.dsh-job-status.st-failed{background:rgba(255,95,87,.15);color:#ff5f57}.dsh-job-time{font-size:11px;color:var(--dsw-alias-label-secondary);flex:none}.dsh-job-kill{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-danger);border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;flex:none}'
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-navbar/navbar-jobs.css"]')) {
      const tag2 = document.createElement('style')
      tag2.dataset.plugin = 'dsh-navbar'
      tag2.dataset.pluginCss = 'dsh-navbar/navbar-jobs.css'
      tag2.textContent = CSS2
      document.head.appendChild(tag2)
    }

    // --- Feature registry + enable/disable state (shared via localStorage) ---
    // Other bundles (dsh-token-stats, dsh-filecard) read the same keys to
    // decide whether to register their UI. Keys: dsh.fn.<section>.<id> = '1'|'0'.
    // Subagent assets live in localStorage (created/edited from the panel):
    // dsh.subagents = [{ id, name, model, desc, prompt }]
    function loadSubagentAssets() {
      try {
        const raw = localStorage.getItem('dsh.subagents')
        if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr }
      } catch (e) {}
      return []
    }
    function saveSubagentAssets(assets) {
      try { localStorage.setItem('dsh.subagents', JSON.stringify(assets)) } catch (e) {}
    }
    // Host RPC helpers: the durable source is assets.json beside the bundle.
    function rpcCall(connection, method, args) {
      if (!connection || !connection.rpc || !connection.rpc.call) return Promise.resolve(null)
      return connection.rpc.call('/api', method, { args: args }).then(function (res) {
        // connection.rpc.call resolves to { ok, value } directly (same as
        // cardStore/storeFile) - NOT { result: { ok, value } }.
        if (res && res.ok) return res.value
        return null
      }).catch(function () { return null })
    }
    function syncAssetsToHost(connection, assets) {
      // Save each asset through the host RPC so they survive restarts.
      if (!connection || !assets) return
      for (const asset of assets) {
        rpcCall(connection, 'subagentAssets/saveAsset', { asset: asset })
      }
    }

    const FEATURES = {
      plugins: [
        { id: 'dsh-token-stats', name: 'dsh-token-stats', desc: '使用统计：会话视图内固定在「轨迹」之后的固态视图，Token 用量、热力图、趋势图与模型用量仪表盘。', locked: true },
        { id: 'dsh-filecard', name: 'dsh-filecard', desc: '文件卡片：输入框右端常驻卡片，拖入文件生成真实路径；附 describe_image 识图工具（mimo-v2.5 直连）。', locked: false },
        { id: 'dsh-navbar', name: 'dsh-navbar', desc: '导航栏：本右侧面板，聚合所有功能入口。', locked: true },
      ],
      subagents: [], // filled dynamically from localStorage in FeatureList
      mcp: [],
      automation: [],
    }
    function featureKey(section, id) { return 'dsh.fn.' + section + '.' + id }
    function featureEnabled(section, id) {
      try { return localStorage.getItem(featureKey(section, id)) !== '0' } catch (e) { return true }
    }
    function setFeatureEnabled(section, id, enabled) {
      try { localStorage.setItem(featureKey(section, id), enabled ? '1' : '0') } catch (e) {}
      // For subagent assets, enabled lives on the asset itself (synced to host).
      if (section === 'subagents') {
        const assets = loadSubagentAssets()
        for (let i = 0; i < assets.length; i++) {
          if (assets[i].id === id) { assets[i].enabled = enabled; break }
        }
        saveSubagentAssets(assets)
        if (window.__dshNavConnection) {
          rpcCall(window.__dshNavConnection, 'subagentAssets/saveAsset', { asset: assets.find(function (a) { return a.id === id }) })
        }
      }
      // Broadcast so other bundles (and this panel) react without a reload.
      window.dispatchEvent(new CustomEvent('dsh-feature-toggle', { detail: { section: section, id: id, enabled: enabled } }))
    }
    // Asset-level enabled check (default true).
    function assetEnabled(asset) {
      return asset.enabled !== false
    }

    // --- Tiny module store shared by the toggle and the panel ----------------
    const SECTIONS = [
      { id: 'plugins', label: '🧩 自制插件' },
      { id: 'subagents', label: '🤖 子代理' },
      { id: 'mcp', label: '🔌 MCP 服务器' },
      { id: 'automation', label: '⚙️ 自动化' },
    ]
    const navStore = {
      open: false,
      active: 'plugins',
      listeners: new Set(),
      emit() { for (const fn of this.listeners) fn() },
      toggle() { this.open = !this.open; this.emit() },
      setOpen(v) { if (this.open !== v) { this.open = v; this.emit() } },
      setActive(id) { if (this.active !== id) { this.active = id; this.emit() } },
      subscribe(fn) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } },
    }

    function useNav() {
      const [snap, setSnap] = react.useState({ open: navStore.open, active: navStore.active })
      react.useEffect(function () {
        return navStore.subscribe(function () {
          setSnap({ open: navStore.open, active: navStore.active })
        })
      }, [])
      return snap
    }

    // --- Header toggle button ------------------------------------------------
    function NavToggle() {
      const snap = useNav()
      return react.createElement('button', {
        className: 'dsh-nav-toggle' + (snap.open ? ' on' : ''),
        title: snap.open ? '收起导航栏' : '展开导航栏',
        onClick: function () { navStore.toggle() },
      }, snap.open ? '收起' : '🧭 导航')
    }

    // --- Feature list panel: each entry gets an enable/disable switch -------
    // dsh-navbar itself is locked (cannot be disabled from here).
    // --- Tool picker: dropdown grouped by MCP server / plugin (like the model select) ---
    function ToolPicker(props) {
      const options = props.options || []
      const selected = props.selected || []
      const onToggle = props.onToggle
      const [open, setOpen] = react.useState(false)
      function buildGroups() {
        const mcp = {}
        const others = []
        for (const o of options) {
          if (!o || !o.name) continue
          if (o.name.indexOf('mcp__') === 0) {
            const parts = o.name.split('__')
            const sub = parts.length > 1 && parts[1] ? parts[1] : 'other'
            if (!mcp[sub]) mcp[sub] = []
            mcp[sub].push(o)
          } else {
            others.push(o)
          }
        }
        const groups = []
        for (const k of Object.keys(mcp)) {
          groups.push({ id: 'mcp-' + k, name: 'MCP · ' + k + '（' + mcp[k].length + '）', items: mcp[k] })
        }
        if (others.length) groups.push({ id: 'builtin', name: '插件/内置（' + others.length + '）', items: others })
        return groups
      }
      const groups = buildGroups()
      const clearAll = function () {
        selected.slice().forEach(function (t) { onToggle(t) })
      }
      const pickerStyle = { padding: '6px 10px', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13 }
      return react.createElement('div', { style: { position: 'relative' } },
        open ? react.createElement('div', { onClick: function () { setOpen(false) }, style: { position: 'fixed', inset: 0, zIndex: 9992 } }) : null,
        react.createElement('button', {
          type: 'button',
          onClick: function () { setOpen(!open) },
          style: Object.assign({}, pickerStyle, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', width: '100%' }),
        },
          react.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected.length ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)' } },
            selected.length === 0 ? '全部工具（不限制）' : '已选 ' + selected.length + ' 个：' + selected.join('、')),
          react.createElement('span', null, open ? '▲' : '▼'),
        ),
        open ? react.createElement('div', { style: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.16)', zIndex: 9993, maxHeight: 260, overflowY: 'auto', padding: 8 } },
          groups.map(function (g) {
            return react.createElement('div', { key: g.id },
              react.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', fontWeight: 600, padding: '6px 4px 2px' } }, g.name),
              g.items.map(function (o) {
                const on = selected.indexOf(o.name) >= 0
                return react.createElement('label', { key: o.name, title: o.description || o.name, style: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--dsw-alias-label-primary)' } },
                  react.createElement('input', { type: 'checkbox', checked: on, style: { margin: 0 }, onChange: function () { onToggle(o.name) } }),
                  react.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, o.name),
                )
              }),
            )
          }),
          selected.length ? react.createElement('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l1)', marginTop: 4, paddingTop: 6, textAlign: 'center' } },
            react.createElement('button', { type: 'button', style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', cursor: 'pointer', fontSize: 12 }, onClick: clearAll }, '清空选择（不限制工具）'),
          ) : null,
        ) : null,
      )
    }

    // --- Subagent editor form (provider-grouped model picker + tools) --------
    // Tool options are loaded dynamically from the harness (listTools RPC).
    function SubagentForm(props) {
      const editing = props.editing // asset or null for new
      const connection = props.connection
      const [name, setName] = react.useState(editing ? editing.name : '')
      const [model, setModel] = react.useState(editing && editing.model ? editing.model : '')
      const [desc, setDesc] = react.useState(editing ? (editing.desc || '') : '')
      const [prompt, setPrompt] = react.useState(editing ? (editing.prompt || '') : '')
      const [tools, setTools] = react.useState(editing && Array.isArray(editing.tools) ? editing.tools : [])
      const [toolOptions, setToolOptions] = react.useState([])
      const [groups, setGroups] = react.useState([])
      // Hook at component top level (rules of hooks): current session id.
      const sessionSnap = props.useSessions
        ? props.useSessions(function (x) { return { current: x.current, items: x.items } })
        : undefined
      const firstItem = sessionSnap && sessionSnap.items && sessionSnap.items[0]
      const curSession = (sessionSnap && (sessionSnap.current || (firstItem && (firstItem.sessionId || firstItem.id)))) || undefined
      react.useEffect(function () {
        var alive = true
        var sessions = connection && connection.api && connection.api.sessions
        var sid = curSession || null
        rpcCall(connection, 'subagentAssets/listTools', {}).then(function (list) {
          if (alive && Array.isArray(list)) setToolOptions(list)
        })
        if (sessions && sid) {
          sessions.models({ sessionId: sid }).then(function (res) {
            // The sessions API returns { result: { ok, value } }.
            const result = res && res.result
            if (alive && result && result.ok && result.value && Array.isArray(result.value.groups)) {
              setGroups(result.value.groups)
            } else if (alive && result && !result.ok) {
              console.error('dsh-navbar: models load failed', result.error)
            }
          }).catch(function (e) { console.error('dsh-navbar: models load error', e) })
        }
        return function () { alive = false }
      }, [])
      const toggleTool = function (t) {
        setTools(function (cur) {
          return cur.indexOf(t) >= 0 ? cur.filter(function (x) { return x !== t }) : cur.concat([t])
        })
      }
      const save = function () {
        if (!name.trim()) return
        const assets = loadSubagentAssets()
        if (editing) {
          for (let i = 0; i < assets.length; i++) {
            if (assets[i].id === editing.id) {
              assets[i] = { id: editing.id, name: name.trim(), model: model || '', desc: desc.trim(), prompt: prompt.trim(), tools: tools.slice(), ...editing.enabled === undefined ? {} : { enabled: editing.enabled } }
              break
            }
          }
        } else {
          assets.push({ id: 'sub-' + Date.now().toString(36), name: name.trim(), model: model || '', desc: desc.trim(), prompt: prompt.trim(), tools: tools.slice(), enabled: true })
        }
        saveSubagentAssets(assets)
        syncAssetsToHost(props.connection, assets)
        window.dispatchEvent(new CustomEvent('dsh-feature-toggle', { detail: { section: 'subagents', id: 'assets', enabled: true } }))
        props.onClose()
      }
      const field = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }
      const label = { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }
      const input = { padding: '6px 10px', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13 }
      return react.createElement('div', null,
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '名称'),
          react.createElement('input', { style: input, value: name, placeholder: '子代理名称', onChange: function (e) { setName(e.target.value) } }),
        ),
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '模型（按提供商分组）'),
          react.createElement('select', { style: input, value: model, onChange: function (e) { setModel(e.target.value) } },
            react.createElement('option', { key: 'inherit', value: '' }, '继承默认'),
            groups.map(function (g) {
              return react.createElement('optgroup', { key: g.id, label: g.name || g.id },
                (g.models || []).map(function (md) {
                  return react.createElement('option', { key: g.id + '/' + md.id, value: md.id }, md.name || md.id)
                }),
              )
            }),
          ),
        ),
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '描述'),
          react.createElement('input', { style: input, value: desc, placeholder: '一句话描述', onChange: function (e) { setDesc(e.target.value) } }),
        ),
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '可用工具'),
          react.createElement(ToolPicker, { options: toolOptions, selected: tools, onToggle: toggleTool }),
          toolOptions.length ? null : react.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 2 } }, '加载工具列表中…'),
          react.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 2 } }, '留空 = 不限制工具（子代理可用全部工具）'),
          react.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 2 } }, '说明：此处列出全局注册的工具（MCP 服务器与插件提供）；内置工具（read / bash / glob 等）子代理始终可用，无需勾选。'),
        ),
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '系统提示词'),
          react.createElement('textarea', { style: Object.assign({}, input, { minHeight: 80, resize: 'vertical' }), value: prompt, placeholder: '子代理的角色与行为说明', onChange: function (e) { setPrompt(e.target.value) } }),
        ),
        react.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
          react.createElement('button', { style: { padding: '6px 14px', border: '1px solid var(--dsw-alias-border-l1)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }, onClick: props.onClose }, '取消'),
          react.createElement('button', { style: { padding: '6px 14px', border: 'none', background: 'var(--dsw-alias-brand-primary)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13 }, onClick: save }, '保存'),
        ),
      )
    }

    // --- MCP server editor form (form / JSON dual mode, like ZCode) ---------
    function McpForm(props) {
      const editing = props.editing // server or null for new
      const connection = props.connection
      const [mode, setMode] = react.useState('form')
      const [name, setName] = react.useState(editing ? (editing.name || '') : '')
      const [serverName, setServerName] = react.useState(editing ? (editing.serverName || '') : '')
      const [transport, setTransport] = react.useState(editing && editing.transport ? editing.transport : 'stdio')
      const [command, setCommand] = react.useState(editing ? (editing.command || '') : '')
      const [argsText, setArgsText] = react.useState(editing && Array.isArray(editing.args) ? editing.args.join(' ') : '')
      const [envText, setEnvText] = react.useState(editing && editing.env ? Object.keys(editing.env).map(function (k) { return k + '=' + editing.env[k] }).join('\n') : '')
      const [cwd, setCwd] = react.useState(editing ? (editing.cwd || '') : '')
      const [url, setUrl] = react.useState(editing ? (editing.url || '') : '')
      const [timeoutMs, setTimeoutMs] = react.useState(editing && editing.timeoutMs ? String(editing.timeoutMs) : '30000')
      const [jsonText, setJsonText] = react.useState('')
      const [error, setError] = react.useState('')
      const [busy, setBusy] = react.useState(false)
      const field = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }
      const label = { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }
      const input = { padding: '6px 10px', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13 }
      const modeBtn = function (m, text) {
        return react.createElement('button', {
          key: m,
          type: 'button',
          onClick: function () { setMode(m) },
          style: { padding: '4px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1)', cursor: 'pointer', fontSize: 12, background: mode === m ? 'var(--dsw-alias-brand-primary)' : 'transparent', color: mode === m ? '#fff' : 'var(--dsw-alias-label-primary)' },
        }, text)
      }
      // Parse JSON text in ZCode format:
      //   {"server-name": {"type": "stdio", "command": "...", "args": [...]}}
      // or {"mcpServers": {"server-name": {...}}} with optional headers/url.
      const parseJson = function (text) {
        let obj
        try { obj = JSON.parse(text) } catch (e) { throw new Error('JSON 解析失败: ' + (e && e.message ? e.message : e)) }
        if (obj && obj.mcpServers && typeof obj.mcpServers === 'object') obj = obj.mcpServers
        if (!obj || typeof obj !== 'object') throw new Error('JSON 顶层需为服务器对象')
        const keys = Object.keys(obj)
        if (!keys.length) throw new Error('JSON 中没有服务器')
        const first = keys[0]
        const conf = obj[first]
        if (!conf || typeof conf !== 'object') throw new Error('服务器配置需为对象')
        const isHttp = conf.transport === 'streamable-http' || conf.type === 'streamable-http' || conf.type === 'http'
        return {
          name: first,
          serverName: first,
          transport: isHttp ? 'streamable-http' : 'stdio',
          command: isHttp ? '' : String(conf.command || conf.cmd || ''),
          args: isHttp ? [] : (Array.isArray(conf.args) ? conf.args.map(String) : String(conf.args || '').split(' ').filter(Boolean)),
          env: conf.env && typeof conf.env === 'object' ? conf.env : {},
          cwd: String(conf.cwd || ''),
          url: isHttp ? String(conf.url || '') : '',
          headers: conf.headers && typeof conf.headers === 'object' ? conf.headers : {},
          timeoutMs: Number(conf.timeoutMs || conf.timeout || 30000),
        }
      }
      const save = function () {
        if (busy) return
        setError('')
        let payload
        if (mode === 'json') {
          try { payload = parseJson(jsonText) } catch (e) { setError(String(e && e.message ? e.message : e)); return }
        } else {
          if (!serverName.trim()) { setError('请填写服务器名称（serverName）'); return }
          if (transport === 'stdio' && !command.trim()) { setError('stdio 类型需要命令'); return }
          if (transport === 'streamable-http' && !url.trim()) { setError('streamable-http 类型需要 URL'); return }
          const env = {}
          envText.split('\n').map(function (l) { return l.trim() }).filter(Boolean).forEach(function (line) {
            const eq = line.indexOf('=')
            if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
            else env[line] = ''
          })
          payload = {
            name: name.trim() || serverName.trim(),
            serverName: serverName.trim(),
            transport: transport,
            command: command.trim(),
            args: argsText.split(' ').map(function (a) { return a.trim() }).filter(Boolean),
            env: env,
            cwd: cwd.trim(),
            url: url.trim(),
            headers: {},
            timeoutMs: Number(timeoutMs) || 30000,
          }
        }
        setBusy(true)
        rpcCall(connection, 'mcpServers/saveServer', { server: Object.assign({ id: editing ? editing.id : 'mcp-' + Date.now().toString(36), enabled: true }, payload) }).then(function (list) {
          if (Array.isArray(list)) {
            props.onSaved(list)
            props.onClose()
          } else {
            setError('保存失败：RPC 无响应（host 服务可能未加载）')
            setBusy(false)
          }
        }).catch(function (e) {
          setError(String(e && e.message ? e.message : e))
          setBusy(false)
        })
      }
      return react.createElement('div', null,
        react.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' } },
          react.createElement('span', { style: Object.assign({}, label, { flex: 1 }) }, editing ? '编辑 MCP 服务器' : '新建 MCP 服务器'),
          modeBtn('form', '表单'),
          modeBtn('json', 'JSON'),
        ),
        mode === 'json'
          ? react.createElement('div', { style: field },
              react.createElement('span', { style: label }, '完整配置'),
              react.createElement('textarea', { style: Object.assign({}, input, { minHeight: 180, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }), value: jsonText, placeholder: '{"my-server": {"type": "stdio", "command": "cmd", "args": []}}', onChange: function (e) { setJsonText(e.target.value) } }),
              react.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 2 } }, '支持直接粘贴 {"server-name": {...}} 或 {"mcpServers": {"server-name": {...}}}'),
            )
          : react.createElement('div', null,
              react.createElement('div', { style: { display: 'flex', gap: 10 } },
                react.createElement('div', { style: Object.assign({}, field, { flex: 1 }) },
                  react.createElement('span', { style: label }, '名称'),
                  react.createElement('input', { style: input, value: name, placeholder: '显示名称', onChange: function (e) { setName(e.target.value) } }),
                ),
                react.createElement('div', { style: Object.assign({}, field, { flex: 1 }) },
                  react.createElement('span', { style: label }, '服务器名（serverName）'),
                  react.createElement('input', { style: input, value: serverName, placeholder: 'my-mcp-server', onChange: function (e) { setServerName(e.target.value) } }),
                ),
              ),
              react.createElement('div', { style: field },
                react.createElement('span', { style: label }, '类型'),
                react.createElement('select', { style: input, value: transport, onChange: function (e) { setTransport(e.target.value) } },
                  react.createElement('option', { value: 'stdio' }, 'stdio（本地命令）'),
                  react.createElement('option', { value: 'streamable-http' }, 'streamable-http（HTTP URL）'),
                ),
              ),
              transport === 'stdio'
                ? react.createElement('div', null,
                    react.createElement('div', { style: field },
                      react.createElement('span', { style: label }, '命令'),
                      react.createElement('input', { style: input, value: command, placeholder: '如 npx 或 /path/to/mcp-server', onChange: function (e) { setCommand(e.target.value) } }),
                    ),
                    react.createElement('div', { style: field },
                      react.createElement('span', { style: label }, '参数（空格分隔）'),
                      react.createElement('input', { style: input, value: argsText, placeholder: '-y @modelcontextprotocol/server-memory', onChange: function (e) { setArgsText(e.target.value) } }),
                    ),
                    react.createElement('div', { style: field },
                      react.createElement('span', { style: label }, '工作目录（可选）'),
                      react.createElement('input', { style: input, value: cwd, placeholder: '留空 = 继承 dsh 启动目录', onChange: function (e) { setCwd(e.target.value) } }),
                    ),
                  )
                : react.createElement('div', { style: field },
                    react.createElement('span', { style: label }, 'URL'),
                    react.createElement('input', { style: input, value: url, placeholder: 'https://host/mcp', onChange: function (e) { setUrl(e.target.value) } }),
                  ),
              react.createElement('div', { style: field },
                react.createElement('span', { style: label }, '环境变量（可选，每行 KEY=VALUE）'),
                react.createElement('textarea', { style: Object.assign({}, input, { minHeight: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }), value: envText, placeholder: 'API_KEY=xxx', onChange: function (e) { setEnvText(e.target.value) } }),
              ),
              react.createElement('div', { style: field },
                react.createElement('span', { style: label }, '超时时间 MS'),
                react.createElement('input', { style: input, value: timeoutMs, placeholder: '30000', onChange: function (e) { setTimeoutMs(e.target.value) } }),
              ),
            ),
        error ? react.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-danger)', marginBottom: 8 } }, error) : null,
        react.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
          react.createElement('button', { style: { padding: '6px 14px', border: '1px solid var(--dsw-alias-border-l1)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }, onClick: props.onClose }, '取消'),
          react.createElement('button', { style: { padding: '6px 14px', border: 'none', background: 'var(--dsw-alias-brand-primary)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13 }, onClick: save }, busy ? '保存中…' : '添加'),
        ),
      )
    }

    // --- Automation asset editor form (name / desc / spec) -------------------
    function AssetForm(props) {
      const editing = props.editing // asset or null for new
      const connection = props.connection
      const [name, setName] = react.useState(editing ? (editing.name || '') : '')
      const [desc, setDesc] = react.useState(editing ? (editing.desc || '') : '')
      const [spec, setSpec] = react.useState(editing ? (editing.spec || '') : '')
      const [error, setError] = react.useState('')
      const [busy, setBusy] = react.useState(false)
      const field = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }
      const label = { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }
      const input = { padding: '6px 10px', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13 }
      const save = function () {
        if (busy) return
        if (!name.trim()) { setError('请填写名称'); return }
        setBusy(true)
        const asset = {
          id: editing ? editing.id : 'auto-' + Date.now().toString(36),
          name: name.trim(),
          desc: desc.trim(),
          spec: spec.trim(),
          enabled: editing && editing.enabled !== undefined ? editing.enabled : true,
        }
        rpcCall(connection, 'subagentAssets/saveAutomationAsset', { asset: asset }).then(function (list) {
          if (Array.isArray(list)) {
            window.dispatchEvent(new CustomEvent('dsh-feature-toggle', { detail: { section: 'automation', id: asset.id, enabled: true } }))
            props.onClose()
          } else {
            setError('保存失败：RPC 无响应（host 服务可能未加载）')
            setBusy(false)
          }
        }).catch(function (e) {
          setError(String(e && e.message ? e.message : e))
          setBusy(false)
        })
      }
      return react.createElement('div', null,
        react.createElement('div', { style: Object.assign({}, label, { marginBottom: 12 }) }, editing ? '编辑自动化' : '新建自动化'),
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '名称'),
          react.createElement('input', { style: input, value: name, placeholder: '自动化名称', onChange: function (e) { setName(e.target.value) } }),
        ),
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '描述'),
          react.createElement('input', { style: input, value: desc, placeholder: '一句话描述', onChange: function (e) { setDesc(e.target.value) } }),
        ),
        react.createElement('div', { style: field },
          react.createElement('span', { style: label }, '规格（触发方式 / 执行说明）'),
          react.createElement('textarea', { style: Object.assign({}, input, { minHeight: 80, resize: 'vertical' }), value: spec, placeholder: '例如：每日 09:00 汇总昨日 Token 用量并写入指定会话；或：当新消息包含 uploads/ 图片时自动识别', onChange: function (e) { setSpec(e.target.value) } }),
        ),
        error ? react.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-danger)', marginBottom: 8 } }, error) : null,
        react.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
          react.createElement('button', { style: { padding: '6px 14px', border: '1px solid var(--dsw-alias-border-l1)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }, onClick: props.onClose }, '取消'),
          react.createElement('button', { style: { padding: '6px 14px', border: 'none', background: 'var(--dsw-alias-brand-primary)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13 }, onClick: save }, busy ? '保存中…' : '保存'),
        ),
      )
    }

    function FeatureList(props) {
      const section = props.section
      const onEdit = props.onEdit
      const connection = props.connection
      const base = FEATURES[section] || []
      const [hostAssets, setHostAssets] = react.useState(null)
      const [hostMcp, setHostMcp] = react.useState(null)
      const [hostAuto, setHostAuto] = react.useState(null)
      const [jobs, setJobs] = react.useState([])
      const [tick, setTick] = react.useState(0)
      const refreshJobs = function () {
        rpcCall(connection, 'subagentAssets/listJobs', {}).then(function (list) {
          if (Array.isArray(list)) setJobs(list)
        })
      }
      // For subagents, load from the host (durable source) and migrate any
      // legacy localStorage-only assets into the host file.
      react.useEffect(function () {
        if (section !== 'subagents') return
        var alive = true
        function refresh() {
          rpcCall(connection, 'subagentAssets/listAssets', {}).then(function (hostList) {
            if (!alive) return
            var local = loadSubagentAssets()
            if (hostList && hostList.length) {
              // Merge: keep host as truth, but push local assets missing there.
              var byId = {}
              for (var i = 0; i < hostList.length; i++) byId[hostList[i].id] = true
              var missing = local.filter(function (a) { return !byId[a.id] })
              if (missing.length) syncAssetsToHost(connection, missing)
              setHostAssets(hostList)
            } else if (local.length) {
              // First run after upgrade: migrate localStorage assets to host.
              syncAssetsToHost(connection, local)
              setHostAssets(local)
            } else {
              setHostAssets([])
            }
          })
        }
        refresh()
        function onChange() { refresh() }
        window.addEventListener('dsh-feature-toggle', onChange)
        return function () { alive = false; window.removeEventListener('dsh-feature-toggle', onChange) }
      }, [section])
      // For MCP servers, load live list from the host (connected status etc).
      react.useEffect(function () {
        if (section !== 'mcp') return
        var alive = true
        function refresh() {
          rpcCall(connection, 'mcpServers/listServers', {}).then(function (list) {
            if (alive && Array.isArray(list)) setHostMcp(list)
          })
        }
        refresh()
        function onChange() { refresh() }
        window.addEventListener('dsh-feature-toggle', onChange)
        return function () { alive = false; window.removeEventListener('dsh-feature-toggle', onChange) }
      }, [section])
      // For automation, load the durable asset list from the host.
      react.useEffect(function () {
        if (section !== 'automation') return
        var alive = true
        function refresh() {
          rpcCall(connection, 'subagentAssets/listAutomationAssets', {}).then(function (list) {
            if (alive && Array.isArray(list)) setHostAuto(list)
          })
        }
        refresh()
        function onChange() { refresh() }
        window.addEventListener('dsh-feature-toggle', onChange)
        return function () { alive = false; window.removeEventListener('dsh-feature-toggle', onChange) }
      }, [section])
      // For automation, also poll live background jobs every 3 seconds.
      react.useEffect(function () {
        if (section !== 'automation') return
        refreshJobs()
        var iv = setInterval(refreshJobs, 3000)
        window.addEventListener('dsh-feature-toggle', refreshJobs)
        return function () { clearInterval(iv); window.removeEventListener('dsh-feature-toggle', refreshJobs) }
      }, [section])
      react.useEffect(function () {
        function onChange() { setTick(function (t) { return t + 1 }) }
        window.addEventListener('dsh-feature-toggle', onChange)
        return function () { window.removeEventListener('dsh-feature-toggle', onChange) }
      }, [])
      const items = (section === 'subagents' ? (hostAssets || loadSubagentAssets()) : section === 'mcp' ? (hostMcp || []) : section === 'automation' ? (hostAuto || []) : base).slice().sort(function (a, b) {
        // System components (locked) go below switchable entries.
        return (a.locked ? 1 : 0) - (b.locked ? 1 : 0)
      })
      const headerBtn = section === 'subagents' || section === 'mcp' || section === 'automation'
        ? react.createElement('button', {
            style: { width: '100%', marginBottom: 10, padding: '8px 12px', border: '1px dashed var(--dsw-alias-brand-primary)', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
            onClick: function () { onEdit(null) },
          }, section === 'mcp' ? '+ 新建 MCP 服务器' : section === 'automation' ? '+ 新建自动化' : '+ 新建子代理')
        : null
      const jobsBlock = section === 'automation'
        ? react.createElement('div', { key: 'jobs', className: 'dsh-nav-jobs' },
            react.createElement('div', { className: 'dsh-nav-jobs-title' }, '后台任务'),
            jobs.length === 0
              ? react.createElement('div', { className: 'dsh-nav-placeholder', style: { padding: '20px 0' } }, '暂无运行中的后台任务')
              : jobs.map(function (j) {
                  const statusTexts = { running: '运行中', stopping: '停止中', completed: '已完成', killed: '已终止', failed: '失败' }
                  const st = statusTexts[j.status] || j.status
                  const d = new Date(j.startedAt)
                  const time = (d.getHours() < 10 ? '0' + d.getHours() : d.getHours()) + ':' + (d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes())
                  return react.createElement('div', { key: j.id, className: 'dsh-job-row' },
                    react.createElement('div', { className: 'dsh-job-main' },
                      react.createElement('span', { className: 'dsh-job-label', title: j.detail || '' }, j.label),
                      react.createElement('span', { className: 'dsh-job-id' }, j.id + (j.ownerSession ? ' · ' + j.ownerSession : '')),
                    ),
                    react.createElement('span', { className: 'dsh-job-status st-' + j.status }, st),
                    react.createElement('span', { className: 'dsh-job-time' }, time),
                    (j.status === 'running' || j.status === 'stopping')
                      ? react.createElement('button', { className: 'dsh-job-kill', onClick: function () { rpcCall(connection, 'subagentAssets/killJob', { id: j.id }).then(function () { refreshJobs() }) } }, '终止')
                      : null,
                  )
                }),
          )
        : null
      if (!items.length) {
        const hints = {
          subagents: '暂无子代理资产。点上方「+ 新建子代理」创建第一个。',
          mcp: '暂无 MCP 服务器资产。点上方「+ 新建 MCP 服务器」创建第一个（保存后立即生效）。',
          automation: '暂无自动化资产。点上方「+ 新建自动化」登记第一个。',
          plugins: '暂无插件资产。',
        }
        return react.createElement('div', null,
          headerBtn,
          jobsBlock,
          react.createElement('div', { className: 'dsh-nav-placeholder' }, hints[section] || '暂无条目'),
        )
      }
      const statusText = function (p) {
        if (p.system) return '系统（cordis.patch.yml）'
        if (!p.enabled) return '已关闭'
        if (p.status === 'connected') return '已连接 · ' + p.toolCount + ' 个工具'
        if (p.status === 'connecting') return '连接中…'
        if (p.status === 'error') return '错误: ' + (p.error || 'unknown')
        return '未知状态'
      }
      const toggleMcp = function (p) {
        rpcCall(connection, 'mcpServers/saveServer', { server: Object.assign({}, p, { enabled: !p.enabled }) }).then(function (list) {
          if (Array.isArray(list)) setHostMcp(list)
        })
      }
      const deleteMcp = function (p) {
        if (window.confirm('确定删除 MCP 服务器「' + p.name + '」？此操作立即卸载并移除配置。')) {
          rpcCall(connection, 'mcpServers/deleteServer', { id: p.id }).then(function (list) {
            if (Array.isArray(list)) setHostMcp(list)
          })
        }
      }
      const toggleAuto = function (p) {
        const asset = { id: p.id, name: p.name, desc: p.desc || '', spec: p.spec || '', enabled: !assetEnabled(p) }
        rpcCall(connection, 'subagentAssets/saveAutomationAsset', { asset: asset }).then(function (list) {
          if (Array.isArray(list)) setHostAuto(list)
        })
      }
      const deleteAuto = function (p) {
        if (window.confirm('确定删除自动化「' + p.name + '」？')) {
          rpcCall(connection, 'subagentAssets/deleteAutomationAsset', { id: p.id }).then(function (list) {
            if (Array.isArray(list)) setHostAuto(list)
          })
        }
      }
      return react.createElement('div', { className: 'dsh-plugins' },
        headerBtn,
        jobsBlock,
        items.map(function (p) {
          const enabled = section === 'subagents' || section === 'automation' ? assetEnabled(p) : featureEnabled(section, p.id)
          let extra = p.desc
          if (section === 'subagents' && p.model) extra = '模型: ' + p.model + (p.prompt ? ' · ' + String(p.prompt).slice(0, 30) : '')
          if (section === 'mcp') extra = statusText(p)
          if (section === 'automation' && p.spec) extra = '规格: ' + p.spec
          const locked = !!p.locked || p.system
          return react.createElement('div', { key: p.id, className: 'dsh-plugin-card' },
            react.createElement('div', { className: 'dsh-plugin-row' },
              react.createElement('div', { className: 'dsh-plugin-name' }, p.name),
              react.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                section === 'subagents' || (section === 'mcp' && !p.system) || section === 'automation'
                  ? react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', cursor: 'pointer', fontSize: 12 }, onClick: function () { onEdit(p) } }, '编辑')
                  : null,
                section === 'mcp' && !p.system
                  ? react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-danger)', cursor: 'pointer', fontSize: 12 }, onClick: function () { deleteMcp(p) } }, '删除')
                  : null,
                section === 'automation'
                  ? react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-danger)', cursor: 'pointer', fontSize: 12 }, onClick: function () { deleteAuto(p) } }, '删除')
                  : null,
                locked
                  ? react.createElement('span', { className: 'dsh-plugin-locked' }, p.system ? '系统' : '系统组件')
                  : react.createElement('button', {
                      className: 'dsh-switch' + (enabled ? ' on' : ''),
                      title: enabled ? '点击关闭' : '点击开启',
                      onClick: function () {
                        if (section === 'mcp') toggleMcp(p)
                        else if (section === 'automation') toggleAuto(p)
                        else setFeatureEnabled(section, p.id, !enabled)
                      },
                    }),
              ),
            ),
            react.createElement('div', { className: 'dsh-plugin-desc' }, extra),
            react.createElement('span', { className: 'dsh-plugin-status' + (enabled ? ' ok' : ' off') }, section === 'mcp' ? statusText(p) : (enabled ? '已开启' : '已关闭')),
          )
        }),
      )
    }

    // --- Right slide-out panel ------------------------------------------------
    function NavPanel(props) {
      const snap = useNav()
      const [editAsset, setEditAsset] = react.useState(null)
      const [editingOn, setEditingOn] = react.useState(false)
      const [mcpList, setMcpList] = react.useState(null)
      react.useEffect(function () {
        if (!snap.open) { setEditingOn(false); setEditAsset(null) }
      }, [snap.open])
      react.useEffect(function () {
        // Switching sections while editing resets the editor state.
        setEditingOn(false); setEditAsset(null)
      }, [snap.active])
      if (!snap.open) return null
      const editingMcp = snap.active === 'mcp' && editingOn
      const editingAuto = snap.active === 'automation' && editingOn
      return react.createElement('div', {
        className: 'dsh-nav-overlay',
        onClick: function () { navStore.setOpen(false) },
      },
        react.createElement('div', { className: 'dsh-nav-panel', onClick: function (e) { e.stopPropagation() } },
          react.createElement('div', { className: 'dsh-nav-head' },
            react.createElement('span', { className: 'dsh-nav-title' }, '导航'),
            react.createElement('button', { className: 'dsh-nav-close', title: '收起', onClick: function () { navStore.setOpen(false) } }, '✕'),
          ),
          react.createElement('div', { className: 'dsh-nav-sections' },
            SECTIONS.map(function (sec) {
              return react.createElement('button', {
                key: sec.id,
                className: 'dsh-nav-item' + (snap.active === sec.id ? ' on' : ''),
                onClick: function () { navStore.setActive(sec.id) },
              }, sec.label)
            }),
          ),
          react.createElement('div', { className: 'dsh-nav-body' },
            snap.active === 'subagents' && editingOn
              ? react.createElement(SubagentForm, { editing: editAsset, connection: props.connection, useSessions: props.useSessions, onClose: function () { setEditingOn(false); setEditAsset(null) } })
              : editingMcp
                ? react.createElement(McpForm, {
                    editing: editAsset,
                    connection: props.connection,
                    onClose: function () { setEditingOn(false); setEditAsset(null) },
                    onSaved: function (list) { setMcpList(list) },
                  })
                : editingAuto
                  ? react.createElement(AssetForm, {
                      editing: editAsset,
                      connection: props.connection,
                      onClose: function () { setEditingOn(false); setEditAsset(null) },
                    })
                  : react.createElement(FeatureList, {
                    section: snap.active,
                    connection: props.connection,
                    onEdit: function (asset) { setEditAsset(asset); setEditingOn(true) },
                  }),
          ),
        ),
      )
    }

    const inject = ['slots', 'connection']
    function apply(ctx) {
      const slots = ctx.get('slots')
      const connection = ctx.get('connection')
      if (slots === undefined) return
      slots.inject('conversation.session.header.utilities', function () {
        return slots.register(
          { name: 'conversation.session.header.utilities', id: 'nav-toggle', order: -10, label: function () { return '导航' } },
          function () { return react.createElement(NavToggle) },
        )
      })
      slots.inject('shell.overlay', function () {
        return slots.register(
          { name: 'shell.overlay', id: 'nav-panel', order: 100, label: function () { return '导航面板' } },
          function (props) {
            try { window.__dshNavConnection = connection } catch (e) {}
            return react.createElement(NavPanel, Object.assign({}, props, { connection: connection }))
          },
        )
      })
    }
    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
