// Formal client half of dsh-navbar.
//
// Adds two additive UI pieces (no shipped UI is replaced):
//  1. A nav toggle button in the session header action row
//     (conversation.session.header.actions, id 'nav-toggle').
//  2. A right slide-out navigation panel in the frame overlay
//     (shell.overlay, id 'nav-panel') with four section entries
//     (自制插件 / 子代理 / MCP服务器 / 自动化) - skeleton placeholders
//     whose content will be filled in later.
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
      const toolRow = { display: 'flex', flexWrap: 'wrap', gap: 6 }
      const toolChip = function (entry) {
        const t = entry.name
        const on = tools.indexOf(t) >= 0
        return react.createElement('label', { key: t, title: entry.description || t, style: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid ' + (on ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'), borderRadius: 99, cursor: 'pointer', fontSize: 12, background: on ? 'rgba(76,141,255,.12)' : 'transparent', color: 'var(--dsw-alias-label-primary)' } },
          react.createElement('input', { type: 'checkbox', checked: on, style: { margin: 0 }, onChange: function () { toggleTool(t) } }),
          t,
        )
      }
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
          react.createElement('div', { style: toolRow }, toolOptions.length
            ? toolOptions.map(toolChip)
            : react.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, '加载工具列表中…')),
          toolOptions.length ? null : react.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 2 } }, '留空 = 不限制工具（子代理可用全部工具）'),
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

    function FeatureList(props) {
      const section = props.section
      const onEdit = props.onEdit
      const connection = props.connection
      const base = FEATURES[section] || []
      const [hostAssets, setHostAssets] = react.useState(null)
      const [tick, setTick] = react.useState(0)
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
      react.useEffect(function () {
        function onChange() { setTick(function (t) { return t + 1 }) }
        window.addEventListener('dsh-feature-toggle', onChange)
        return function () { window.removeEventListener('dsh-feature-toggle', onChange) }
      }, [])
      const items = (section === 'subagents' ? (hostAssets || loadSubagentAssets()) : base).slice().sort(function (a, b) {
        // System components (locked) go below switchable entries.
        return (a.locked ? 1 : 0) - (b.locked ? 1 : 0)
      })
      const headerBtn = section === 'subagents'
        ? react.createElement('button', {
            style: { width: '100%', marginBottom: 10, padding: '8px 12px', border: '1px dashed var(--dsw-alias-brand-primary)', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
            onClick: function () { onEdit(null) },
          }, '+ 新建子代理')
        : null
      if (!items.length) {
        const hints = {
          subagents: '暂无子代理资产。点上方「+ 新建子代理」创建第一个。',
          mcp: '暂无 MCP 服务器资产。需要时让智能体接入并登记，登记后这里会出现开关。',
          automation: '暂无自动化资产。需要时让智能体登记定时任务或自动化流程。',
          plugins: '暂无插件资产。',
        }
        return react.createElement('div', null,
          headerBtn,
          react.createElement('div', { className: 'dsh-nav-placeholder' }, hints[section] || '暂无条目'),
        )
      }
      return react.createElement('div', { className: 'dsh-plugins' },
        headerBtn,
        items.map(function (p) {
          const enabled = section === 'subagents' ? assetEnabled(p) : featureEnabled(section, p.id)
          const extra = section === 'subagents' && p.model ? '模型: ' + p.model + (p.prompt ? ' · ' + String(p.prompt).slice(0, 30) : '') : p.desc
          return react.createElement('div', { key: p.id, className: 'dsh-plugin-card' },
            react.createElement('div', { className: 'dsh-plugin-row' },
              react.createElement('div', { className: 'dsh-plugin-name' }, p.name),
              react.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                section === 'subagents'
                  ? react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', cursor: 'pointer', fontSize: 12 }, onClick: function () { onEdit(p) } }, '编辑')
                  : null,
                p.locked
                  ? react.createElement('span', { className: 'dsh-plugin-locked' }, '系统组件')
                  : react.createElement('button', {
                      className: 'dsh-switch' + (enabled ? ' on' : ''),
                      title: enabled ? '点击关闭' : '点击开启',
                      onClick: function () { setFeatureEnabled(section, p.id, !enabled) },
                    }),
              ),
            ),
            react.createElement('div', { className: 'dsh-plugin-desc' }, extra),
            react.createElement('span', { className: 'dsh-plugin-status' + (enabled ? ' ok' : ' off') }, enabled ? '已开启' : '已关闭'),
          )
        }),
      )
    }

    // --- Right slide-out panel ------------------------------------------------
    function NavPanel(props) {
      const snap = useNav()
      const [editAsset, setEditAsset] = react.useState(null)
      const [editingOn, setEditingOn] = react.useState(false)
      react.useEffect(function () {
        if (!snap.open) { setEditingOn(false); setEditAsset(null) }
      }, [snap.open])
      if (!snap.open) return null
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
