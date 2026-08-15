// Formal host half of dsh-filecard.
//
// One class plugin (the official service pattern): default-exported class
// extending TypertRemoteService. The Loader auto-instantiates it; the Typert
// Gateway dispatches /api/cardStore/storeFile to the `storeFile` method via
// the strict ./typert manifest (lib/typert.host.js).
//
// The constructor also registers the model tool describe_image through
// ctx.tools.register, so this single bundle row provides BOTH the browser
// card's file-storage RPC and the model's image recognition tool (direct
// mimo call - no subagent).
//
// Gates (user-approved):
//   1. describe_image only accepts paths under the uploads dir (only the
//      browser card writes there) - non-card paths are refused.
//   2. only image extensions (png/jpg/jpeg/webp/gif) trigger recognition.
//
// NOTE: runs directly in the Host Cordis loader (Node ESM) - no decorator
// syntax, no dynamic-plugin harness globals. Node globals (fetch, Buffer,
// btoa) ARE available here.
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { homedir } from 'node:os'
import { join } from 'node:path'

// --- Configuration (all overridable via environment) -----------------------
// Directory where the browser file card stores dropped files.
// Defaults to ~/uploads so the plugin works out of the box on any machine.
const UPLOAD_DIR = process.env.DSH_UPLOAD_DIR || join(homedir(), 'uploads')
// OpenAI-compatible endpoint used by describe_image (opencode.ai zen gateway).
const OPENCODE_BASE = process.env.DSH_OPENCODE_BASE || 'https://opencode.ai/zen/go/v1'
// Vision model used by describe_image.
const IMAGE_MODEL = process.env.DSH_IMAGE_MODEL || 'mimo-v2.5'
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif']
// Browser-like User-Agent: opencode.ai sits behind Cloudflare which refuses
// requests without a browser UA (the harness's own requests were blocked).
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function sanitizeName(name) {
  const base = String(name || 'file').replace(/[\u0000-\u001f/\\]/g, '_').trim().slice(-120)
  return (base === '' || base === '.' || base === '..') ? 'file' : base
}

function imageExtOf(filePath) {
  const dot = String(filePath).lastIndexOf('.')
  if (dot < 0) return undefined
  const ext = String(filePath).slice(dot + 1).toLowerCase()
  return IMAGE_EXTS.includes(ext) ? ext : undefined
}

function sniffMediaType(data) {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png'
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length >= 6 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return 'image/gif'
  if (data.length >= 12 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return 'image/webp'
  return undefined
}

// Whether the current MAIN model declares image input (kept for future use).
// Resolve the opencode-go API key through the credentials service.
async function opencodeApiKey(ctx) {
  const credentials = ctx.get('credentials')
  if (credentials === undefined) throw new Error('credentials service is not mounted')
  const resolved = await credentials.resolve(credentialRef('OPENCODE_GO_API_KEY'))
  if (resolved === undefined || !resolved.value) throw new Error('OPENCODE_GO_API_KEY is not configured')
  return resolved.value
}

// Call mimo-v2.5 (OpenAI-compatible chat/completions) with a browser UA.
async function describeWithMimo(ctx, data, mediaType, signal) {
  const key = await opencodeApiKey(ctx)
  const b64 = Buffer.from(data).toString('base64')
  const body = {
    model: IMAGE_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image in detail in Chinese. Mention colors, shapes, layout, and any text. Be precise and complete.' },
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${b64}` } },
      ],
    }],
    max_tokens: 4096,
  }
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    const res = await fetch(OPENCODE_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`opencode API ${res.status}: ${text.slice(0, 300)}`)
    }
    const json = await res.json()
    const content = json && json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content
      : ''
    if (typeof content !== 'string' || content.length === 0) throw new Error('mimo returned no description')
    return content
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

export default class FileCardService extends TypertRemoteService {
  static inject = ['tools', 'shell', 'fs']

  constructor(ctx) {
    super(ctx, 'cardStore')
    this.registerTools(ctx)
  }

  // ------------------------------------------------------------------
  // 1. Browser card RPC: store a dropped file as a real workspace path.
  //    The gateway resolves the two descriptor parameters (name,
  //    dataBase64) by wire name and applies them by POSITION, so the
  //    method signature must be (name, dataBase64).
  // ------------------------------------------------------------------
  async storeFile(name, dataBase64) {
    const ctx = this.ctx
    const shell = ctx.get('shell')
    const fs = ctx.get('fs')
    if (shell === undefined || fs === undefined) throw new Error('fs or shell service is not mounted')
    name = sanitizeName(name)
    dataBase64 = typeof dataBase64 === 'string' ? dataBase64 : ''
    if (dataBase64.length === 0) throw new Error('missing file data')
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64)) throw new Error('payload is not valid base64 text')
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const b64Path = UPLOAD_DIR + '/.' + stamp + '.b64'
    const finalPath = UPLOAD_DIR + '/' + stamp + '-' + name
    const mk = await shell.run(shell.resolve({ command: 'mkdir -p ' + JSON.stringify(UPLOAD_DIR) }))
    if (mk.exitCode !== 0) throw new Error('mkdir failed: ' + (mk.stderr || ''))
    const target = await fs.resolve(b64Path)
    await fs.writeText(target, dataBase64)
    const dec = await shell.run(shell.resolve({
      command: 'base64 -d ' + JSON.stringify(b64Path) + ' > ' + JSON.stringify(finalPath)
        + ' && rm -f ' + JSON.stringify(b64Path) + ' && echo OK',
    }))
    if (dec.exitCode !== 0) throw new Error('base64 decode failed: ' + (dec.stderr || ''))
    const info = await fs.stat(await fs.resolve(finalPath))
    return { path: finalPath, size: info ? info.size : 0 }
  }

  // ------------------------------------------------------------------
  // 2. Model tools.
  // ------------------------------------------------------------------
  registerTools(ctx) {
    const tools = ctx.get('tools')
    const attachments = ctx.get('attachments')
    const fs = ctx.get('fs')
    if (tools === undefined) return
    const self = this

    // -- describe_image: direct mimo call (Node fetch + browser UA) ----------
    if (fs !== undefined && attachments !== undefined) {
      const describeImageTool = defineTool({
        name: 'describe_image',
        description: '读取 ' + UPLOAD_DIR + ' 目录下的图片（png/jpg/webp/gif）并返回详细中文描述（颜色、形状、布局、任何文字/数字）。'
          + '【自动识别约定】当用户消息中出现 ' + UPLOAD_DIR + '/ 目录下的图片路径（png/jpg/jpeg/webp/gif）时，自动调用本工具识别，无需用户开口要求。'
          + '【门禁】仅限文件卡片拖入的 ' + UPLOAD_DIR + '/ 路径。',
        parameters: {
          file_path: { type: 'string', required: true, description: 'uploads/ 目录下的图片绝对路径。' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: { description: { type: 'string', required: true } },
          },
          render: (_a, v) => [{ type: 'text', text: v.description }],
        },
        isConcurrencySafe: () => true,
        async execute(args, exec) {
          if (!String(args.file_path).startsWith(UPLOAD_DIR + '/')) {
            throw new Error('仅支持识别通过文件卡片拖入的图片（路径须位于 ' + UPLOAD_DIR + ' 下）')
          }
          if (imageExtOf(args.file_path) === undefined) {
            throw new Error('仅支持识别图片文件（png/jpg/jpeg/webp/gif）')
          }
          const target = await fs.resolve(args.file_path)
          const info = await fs.stat(target, exec.signal)
          if (info === undefined) throw new Error('file not found: ' + args.file_path)
          const data = await fs.readBytes(target, exec.signal, attachments.imageLimits.maxImageBytes)
          const mediaType = sniffMediaType(data)
          if (mediaType === undefined) {
            throw new Error('not a supported image (png/jpeg/webp/gif): ' + args.file_path)
          }
          const description = await describeWithMimo(self.ctx, data, mediaType, exec.signal)
          return { description }
        },
      })
      // Register through the nav panel's plugin tool registry so the plugin
      // switch in the nav bar controls this tool LIVE (on = visible, off =
      // unregistered). Fall back to direct registration when the registry is
      // not mounted (e.g. dsh-navbar bundle absent).
      const tryRegister = function () {
        const pluginTools = ctx.get('pluginTools')
        if (pluginTools === undefined) return false
        try {
          pluginTools.registerPluginTools('dsh-filecard', [describeImageTool])
          return true
        } catch (e) { return false }
      }
      if (!tryRegister()) {
        // dsh-navbar may load after this bundle (profile bundle order puts
        // dsh-filecard before dsh-navbar): wait for the pluginTools service
        // to appear, then register through it. If it never appears, register
        // directly so describe_image still works standalone. Node timers are
        // available in the host bundle (no timer service dependency needed).
        let attempts = 0
        const iv = setInterval(function () {
          attempts++
          if (tryRegister()) clearInterval(iv)
          else if (attempts > 40) { clearInterval(iv); tools.register(describeImageTool) }
        }, 250)
        // Clean up the retry timer when this plugin unloads.
        try { ctx.effect(function () { return function () { clearInterval(iv) } }) } catch (e) { /* ctx already disposed */ }
      }
    }
  }
}
