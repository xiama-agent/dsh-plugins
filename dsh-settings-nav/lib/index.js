// No-op host half of dsh-settings-nav.
//
// This bundle is CLIENT-ONLY by design: it registers two settings pages
// (🤖 子代理 / 🔌 MCP 服务器) that reuse the RPC endpoints already provided
// by dsh-navbar's host services (`subagentAssets/*`, `mcpServers/*`).
// Providing duplicate service keys here would crash the composition
// (Cordis rejects a second registration of the same service key in one
// isolate), so the host contributes nothing and the row exists only so the
// client module scanner picks up the bundle.
export default {
  apply() {},
}
