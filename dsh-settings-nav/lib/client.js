// Formal client half of dsh-settings-nav.
//
// CLIENT-ONLY bundle: registers two settings pages (sidebar 设置 → left nav)
// that reuse the RPC endpoints provided by dsh-navbar's host services:
//   - 🤖 子代理    -> settings.section id=subagents (order 16)
//   - 🔌 MCP 服务器 -> settings.section id=mcp-servers (order 17)
// Positioned between the shipped 插件 (order 15) and agent预设 (order 20)
// entries. Data is shared with the dsh-navbar panel (same host files).
//
// Wire notes:
//   - ctx.connection.rpc.call('/api', <ns>/<method>, { args }) resolves to the
//     gateway RESULT envelope directly: { ok, value } | { ok: false, error }.
//   - subagentAssets/saveAsset strict codec strips unknown fields, so the
//     subagent `enabled` flag lives in localStorage (key dsh.fn.subagents.<id>)
//     like the navbar panel; MCP server `enabled` is persisted host-side.
window.__ModuleLoader__.load({
  id: 'dsh-settings-nav',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let react = require('react')

    const CSS = '.dsn-page{display:flex;flex-direction:column;gap:12px;padding:20px 24px;height:100%;overflow-y:auto;box-sizing:border-box}.dsn-head{display:flex;align-items:center;gap:10px}.dsn-title{font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0}.dsn-spacer{flex:1}.dsn-newbtn{width:100%;margin-bottom:2px;padding:8px 12px;border:1px dashed var(--dsw-alias-brand-primary);background:transparent;color:var(--dsw-alias-brand-primary);border-radius:8px;cursor:pointer;font-size:13px}.dsh-nav-placeholder{color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;padding:40px 0;border:1px dashed var(--dsw-alias-border-l1);border-radius:10px}.dsh-plugins{display:flex;flex-direction:column;gap:10px}.dsh-plugin-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:12px 14px}.dsh-plugin-name{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:4px}.dsh-plugin-desc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5}.dsh-plugin-status{display:inline-block;margin-top:6px;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:99px;padding:2px 10px}.dsh-plugin-status.ok{color:#1a7f37;border-color:rgba(26,127,55,.4);background:rgba(26,127,55,.08)}.dsh-plugin-status.off{color:#e5484d;border-color:rgba(229,72,77,.4);background:rgba(229,72,77,.08)}.dsh-plugin-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.dsh-switch{position:relative;width:36px;height:20px;flex-shrink:0;border:none;border-radius:99px;background:var(--dsw-alias-border-l1);cursor:pointer;transition:background .15s ease;padding:0}.dsh-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .15s ease}.dsh-switch.on{background:var(--dsw-alias-brand-primary)}.dsh-switch.on::after{left:18px}.dsh-plugin-locked{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:99px;padding:2px 10px}'

    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-settings-nav/settings-nav.css"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-settings-nav'
      tag.dataset.pluginCss = 'dsh-settings-nav/settings-nav.css'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    // --- Host RPC helpers ---------------------------------------------------
    // connection.rpc.call resolves to the gateway RESULT envelope directly:
    // { ok: true, value } on success, { ok: false, error } on failure.
    function rpcCall(connection, method, args) {
      if (!connection || !connection.rpc || !connection.rpc.call) return Promise.resolve(null)
      return connection.rpc.call('/api', method, { args: args }).then(function (res) {
        if (res && res.ok) return res.value
        return null
      }).catch(function () { return null })
    }
    // Subagent assets share localStorage with the dsh-navbar panel.
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
    function syncAssetsToHost(connection, assets) {
      if (!connection || !assets) return
      for (const asset of assets) {
        rpcCall(connection, 'subagentAssets/saveAsset', { asset: asset })
      }
    }
    // The strict saveAsset codec strips `enabled`, so the subagent enabled
    // flag lives in localStorage (same keys as the navbar panel).
    function subEnabled(p) {
      try {
        const v = localStorage.getItem('dsh.fn.subagents.' + p.id)
        if (v !== null) return v !== '0'
      } catch (e) {}
      return p.enabled !== false
    }

    // --- Tool picker: dropdown grouped by MCP server / plugin --------------
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

    // --- Subagent editor form (provider-grouped model picker + tools) ------
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
            const result = res && res.result
            if (alive && result && result.ok && result.value && Array.isArray(result.value.groups)) {
              setGroups(result.value.groups)
            } else if (alive && result && !result.ok) {
              console.error('dsh-settings-nav: models load failed', result.error)
            }
          }).catch(function (e) { console.error('dsh-settings-nav: models load error', e) })
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

    // --- MCP server editor form (form / JSON dual mode) --------------------
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

    // --- 🤖 子代理 settings page -------------------------------------------
    function SubagentsPage(props) {
      const connection = props.connection
      const [hostAssets, setHostAssets] = react.useState(null)
      const [editing, setEditing] = react.useState(null)
      const [editingOn, setEditingOn] = react.useState(false)
      // Load from the host (durable source), migrating legacy localStorage
      // assets into the host file; also refresh on dsh-feature-toggle events
      // from the dsh-navbar panel so both UIs stay in sync.
      react.useEffect(function () {
        var alive = true
        function refresh() {
          rpcCall(connection, 'subagentAssets/listAssets', {}).then(function (hostList) {
            if (!alive) return
            var local = loadSubagentAssets()
            if (hostList && hostList.length) {
              var byId = {}
              for (var i = 0; i < hostList.length; i++) byId[hostList[i].id] = true
              var missing = local.filter(function (a) { return !byId[a.id] })
              if (missing.length) syncAssetsToHost(connection, missing)
              setHostAssets(hostList)
            } else if (local.length) {
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
      }, [connection])
      const items = (hostAssets || loadSubagentAssets()).slice().sort(function (a, b) {
        return (a.name || '').localeCompare(b.name || '')
      })
      const toggleSub = function (p) {
        const next = !subEnabled(p)
        try { localStorage.setItem('dsh.fn.subagents.' + p.id, next ? '1' : '0') } catch (e) {}
        const local = loadSubagentAssets()
        for (let i = 0; i < local.length; i++) {
          if (local[i].id === p.id) { local[i].enabled = next; break }
        }
        saveSubagentAssets(local)
        rpcCall(connection, 'subagentAssets/saveAsset', { asset: Object.assign({}, p, { enabled: next }) })
        setHostAssets(function (h) { return h ? h.slice() : h })
      }
      const deleteSub = function (p) {
        if (window.confirm('确定删除子代理「' + p.name + '」？')) {
          rpcCall(connection, 'subagentAssets/deleteAsset', { id: p.id }).then(function (list) {
            if (Array.isArray(list)) setHostAssets(list)
            const local = loadSubagentAssets().filter(function (a) { return a.id !== p.id })
            saveSubagentAssets(local)
          })
        }
      }
      return react.createElement('div', { className: 'dsn-page' },
        react.createElement('div', { className: 'dsn-head' },
          react.createElement('h2', { className: 'dsn-title' }, '子代理'),
          react.createElement('div', { className: 'dsn-spacer' }),
          react.createElement('button', { className: 'dsn-newbtn', style: { width: 'auto', marginBottom: 0, padding: '6px 14px' }, onClick: function () { setEditing(null); setEditingOn(true) } }, '+ 新建子代理'),
        ),
        editingOn
          ? react.createElement(SubagentForm, {
              editing: editing,
              connection: connection,
              useSessions: props.useSessions,
              onClose: function () { setEditingOn(false); setEditing(null) },
            })
          : items.length === 0
            ? react.createElement('div', { className: 'dsh-nav-placeholder' }, '暂无子代理资产。点右上角「+ 新建子代理」创建第一个。')
            : react.createElement('div', { className: 'dsh-plugins' }, items.map(function (p) {
                const enabled = subEnabled(p)
                const extra = p.model ? '模型: ' + p.model + (p.prompt ? ' · ' + String(p.prompt).slice(0, 30) : '') : (p.desc || '')
                return react.createElement('div', { key: p.id, className: 'dsh-plugin-card' },
                  react.createElement('div', { className: 'dsh-plugin-row' },
                    react.createElement('div', { className: 'dsh-plugin-name' }, p.name),
                    react.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                      react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', cursor: 'pointer', fontSize: 12 }, onClick: function () { setEditing(p); setEditingOn(true) } }, '编辑'),
                      react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-danger)', cursor: 'pointer', fontSize: 12 }, onClick: function () { deleteSub(p) } }, '删除'),
                      react.createElement('button', {
                        className: 'dsh-switch' + (enabled ? ' on' : ''),
                        title: enabled ? '点击关闭' : '点击开启',
                        onClick: function () { toggleSub(p) },
                      }),
                    ),
                  ),
                  react.createElement('div', { className: 'dsh-plugin-desc' }, extra),
                  react.createElement('span', { className: 'dsh-plugin-status' + (enabled ? ' ok' : ' off') }, enabled ? '已开启' : '已关闭'),
                )
              })),
      )
    }

    // --- 🔌 MCP 服务器 settings page ---------------------------------------
    function McpPage(props) {
      const connection = props.connection
      const [hostMcp, setHostMcp] = react.useState(null)
      const [editing, setEditing] = react.useState(null)
      const [editingOn, setEditingOn] = react.useState(false)
      react.useEffect(function () {
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
      }, [connection])
      const items = (hostMcp || []).slice().sort(function (a, b) {
        if (a.system !== b.system) return a.system ? 1 : -1
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
      })
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
      return react.createElement('div', { className: 'dsn-page' },
        react.createElement('div', { className: 'dsn-head' },
          react.createElement('h2', { className: 'dsn-title' }, 'MCP 服务器'),
          react.createElement('div', { className: 'dsn-spacer' }),
          react.createElement('button', { className: 'dsn-newbtn', style: { width: 'auto', marginBottom: 0, padding: '6px 14px' }, onClick: function () { setEditing(null); setEditingOn(true) } }, '+ 新建 MCP 服务器'),
        ),
        editingOn
          ? react.createElement(McpForm, {
              editing: editing,
              connection: connection,
              onClose: function () { setEditingOn(false); setEditing(null) },
              onSaved: function (list) { setHostMcp(list) },
            })
          : items.length === 0
            ? react.createElement('div', { className: 'dsh-nav-placeholder' }, '暂无 MCP 服务器资产。点右上角「+ 新建 MCP 服务器」创建第一个（保存后立即生效）。')
            : react.createElement('div', { className: 'dsh-plugins' }, items.map(function (p) {
                const enabled = p.enabled
                const locked = !!p.locked || p.system
                return react.createElement('div', { key: p.id, className: 'dsh-plugin-card' },
                  react.createElement('div', { className: 'dsh-plugin-row' },
                    react.createElement('div', { className: 'dsh-plugin-name' }, p.name),
                    react.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                      !p.system
                        ? react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', cursor: 'pointer', fontSize: 12 }, onClick: function () { setEditing(p); setEditingOn(true) } }, '编辑')
                        : null,
                      !p.system
                        ? react.createElement('button', { style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-danger)', cursor: 'pointer', fontSize: 12 }, onClick: function () { deleteMcp(p) } }, '删除')
                        : null,
                      locked
                        ? react.createElement('span', { className: 'dsh-plugin-locked' }, p.system ? '系统' : '系统组件')
                        : react.createElement('button', {
                            className: 'dsh-switch' + (enabled ? ' on' : ''),
                            title: enabled ? '点击关闭' : '点击开启',
                            onClick: function () { toggleMcp(p) },
                          }),
                    ),
                  ),
                  react.createElement('div', { className: 'dsh-plugin-desc' }, statusText(p)),
                  react.createElement('span', { className: 'dsh-plugin-status' + (enabled ? ' ok' : ' off') }, statusText(p)),
                )
              })),
      )
    }

    const inject = ['slots', 'connection']
    function apply(ctx) {
      const slots = ctx.get('slots')
      const connection = ctx.get('connection')
      if (slots === undefined || connection === undefined) return
      // 🤖 子代理 — between 插件 (order 15) and agent预设 (order 20).
      slots.inject('settings.section', function () {
        return slots.register(
          { name: 'settings.section', id: 'subagents', order: 16, label: function () { return '🤖 子代理' } },
          function (props) { return react.createElement(SubagentsPage, Object.assign({}, props, { connection: connection })) },
        )
      })
      // 🔌 MCP 服务器 — between 插件 (order 15) and agent预设 (order 20).
      slots.inject('settings.section', function () {
        return slots.register(
          { name: 'settings.section', id: 'mcp-servers', order: 17, label: function () { return '🔌 MCP 服务器' } },
          function (props) { return react.createElement(McpPage, Object.assign({}, props, { connection: connection })) },
        )
      })
    }
    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
