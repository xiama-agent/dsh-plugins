// Formal client half of dsh-filecard. Browser module in the official
// __ModuleLoader__ format. Registers a small always-visible card at the right
// end of the composer tool row (conversation.input.right). Dragging a file
// onto it (or clicking it) sends the file bytes as base64 TEXT to the Host
// Remote over the /api connection channel:
//   ctx.connection.rpc.call("/api", "cardStore/storeFile", { args: { name, dataBase64 } })
//   => { ok: true, value: { path, size } }
// The returned absolute path is appended to the composer draft, so the user
// sends a pure text path; DeepSeek then auto-recognizes images via the
// describe_image_subagent tool.
window.__ModuleLoader__.load({
  id: 'dsh-filecard',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let react = require('react')

    const CSS = '.dsh-filecard{position:relative;height:100%;width:25%;min-width:130px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px dashed var(--dsw-alias-border-l1);border-radius:8px;cursor:pointer;overflow:hidden;transition:background .15s ease,border-color .15s ease}.dsh-filecard.fc-drag{background:rgba(46,160,67,.18);border-color:rgba(46,160,67,.8)}.dsh-filecard .fc-err{color:var(--dsw-alias-danger);font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'

    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-filecard/filecard.css"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-filecard'
      tag.dataset.pluginCss = 'dsh-filecard/filecard.css'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function FileCard(props) {
      const inputActions = props.inputActions
      const input = props.input
      const [busy, setBusy] = react.useState(false)
      const [error, setError] = react.useState('')
      const [drag, setDrag] = react.useState(false)

      const storeFile = (file) => {
        if (file == null) return
        setBusy(true)
        setError('')
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            const dataUrl = String(reader.result)
            const comma = dataUrl.indexOf(',')
            const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
            const res = await props.connection.rpc.call('/api', 'cardStore/storeFile', {
              args: { name: file.name, dataBase64: base64 },
            })
            if (!res || !res.ok) {
              throw new Error((res && res.error && res.error.message) || 'store failed')
            }
            const path = String(res.value.path)
            const draft = input ? String(input.draft || '') : ''
            inputActions.setDraft(draft.length === 0 ? path : draft + '\n' + path)
          } catch (e) {
            setError(String(e && e.message ? e.message : e))
          } finally {
            setBusy(false)
          }
        }
        reader.onerror = () => { setBusy(false); setError('read failed') }
        reader.readAsDataURL(file)
      }

      const onDrop = (e) => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
        if (f) storeFile(f)
      }

      return react.createElement('div', {
        className: 'dsh-filecard' + (drag ? ' fc-drag' : ''),
        onClick: () => {
          const inputEl = document.createElement('input')
          inputEl.type = 'file'
          inputEl.accept = '*/*'
          inputEl.style.display = 'none'
          inputEl.onchange = () => { const f = inputEl.files && inputEl.files[0]; if (f) storeFile(f); inputEl.remove() }
          document.body.appendChild(inputEl)
          inputEl.click()
        },
        onDragOver: (e) => { e.preventDefault(); setDrag(true) },
        onDragLeave: () => setDrag(false),
        onDrop,
      },
        react.createElement('span', null, busy ? '处理中…' : '🖼 拖文件到这里'),
        error === '' ? null : react.createElement('span', { className: 'fc-err' }, error),
      )
    }

    // Feature switch (shared with dsh-navbar): disabled => card not registered;
    // toggling while running unregisters/registers live.
    const FEATURE_KEY = 'dsh.fn.plugins.dsh-filecard'
    function featureEnabled() {
      try { return localStorage.getItem(FEATURE_KEY) !== '0' } catch (e) { return true }
    }
    const inject = ['slots', 'connection']
    function apply(ctx) {
      const slots = ctx.get('slots')
      const connection = ctx.get('connection')
      if (slots === undefined || connection === undefined) return
      let disposed = null
      function sync() {
        if (disposed) { disposed(); disposed = null }
        if (!featureEnabled()) return
        disposed = slots.inject('conversation.input.right', function () {
          return slots.register(
            { name: 'conversation.input.right', id: 'file-card', order: 100, label: function () { return 'File' } },
            function (props) { return react.createElement(FileCard, { connection: connection, ...props }) },
          )
        })
      }
      sync()
      window.addEventListener('dsh-feature-toggle', function (e) {
        if (e.detail && e.detail.id === 'dsh-filecard') sync()
      })
      ctx.effect(function () {
        return function () {
          if (disposed) { disposed(); disposed = null }
        }
      })
    }
    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
