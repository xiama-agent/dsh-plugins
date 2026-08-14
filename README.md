# dsh-plugins

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）社区插件合集。三个开箱即用的 feature bundle，为 DSH Web 界面添加使用统计、导航栏与文件卡片/识图能力。

| 插件 | 目录 | 功能 |
|---|---|---|
| **dsh-token-stats**（使用统计） | [`dsh-token-stats/`](dsh-token-stats/) | 会话视图新增「使用统计」标签页：Token 用量卡片、活跃热力图、按天趋势图、模型用量环形图 |
| **dsh-navbar**（导航栏） | [`dsh-navbar/`](dsh-navbar/) | 头部导航按钮 + 右侧滑出面板（自制插件 / 子代理 / MCP 服务器 / 自动化）：子代理资产管理、MCP 服务器实时挂载、后台任务监控 |
| **dsh-filecard**（文件卡片 + 识图） | [`dsh-filecard/`](dsh-filecard/) | 输入框右端常驻文件卡片：拖入/点击选择文件生成真实路径；`describe_image` 识图工具（直连视觉模型） |

## ✨ 功能详情

### dsh-token-stats（使用统计）

扫描 `~/.dsh/sessions/**/session.jsonl.zstd` 会话日志（zstd 解压 + 解析），在会话视图标签环中新增「使用统计」页：

- 6 张统计卡片：tokens 总量、会话数、消息数、活跃天数、连续活跃天数、最常用模型
- 最近一年活跃热力图（GitHub 风格贡献图）
- 按天 Token 堆叠趋势图（近 30 天）
- 模型用量环形图（含占比）
- 扫描结果缓存 5 分钟，客户端「刷新」按钮强制重扫

### dsh-navbar（导航栏）

- 会话头部新增「🧭 导航」按钮，点击展开右侧滑出面板
- 四个分区：🧩 自制插件 / 🤖 子代理 / 🔌 MCP 服务器 / ⚙️ 自动化
- **自制插件**：开关其他插件（`dsh-filecard` 等读取同一份开关状态，实时生效）
- **子代理**：资产创建 / 编辑 / 启停，持久化到 `assets.json`（可用 `DSH_NAVBAR_ASSETS_FILE` 重定向）；工具选择器按 MCP 服务器 / 插件分组；模型工具 `run_subagent_asset` 按资产定义（模型 + 系统提示词 + 工具白名单）直接拉起子代理执行任务
- **MCP 服务器**：持久化登记（`mcp-servers.json`）并**实时挂载**——保存/开启即通过 `ctx.plugin` 拉起 `@deepseek-ai/dsh-mcp-client` 实例，工具立刻生效，无需重启；支持 stdio 与 streamable-http 两种传输，表单 / JSON 双模式编辑；自动识别 `cordis.patch.yml` 里的系统 MCP 服务器（只读展示，不托管）
- **自动化**：资产登记（名称 / 描述 / 规格说明，持久化到 `automation-assets.json`）+ 实时后台任务列表（来自 `ctx.jobs`，3 秒轮询，可一键终止运行中的任务）

### dsh-filecard（文件卡片 + 识图）

- 输入框右端常驻卡片：拖入文件或点击选择，文件以 base64 上传到 Host，解码为真实磁盘路径并写入输入框草稿
- 模型工具 `describe_image`：读取上传目录下的图片（png/jpg/jpeg/webp/gif），直连 OpenAI 兼容视觉接口（默认 opencode.ai zen 网关 + mimo-v2.5）返回详细中文描述
- 安全门禁：只接受上传目录（默认 `~/uploads`）内的图片路径，拒绝任意文件读取

## 📦 安装

### 环境要求

- DSH Harness（`dsh` CLI，Node 22+）
- `python3` 与 `zstd`（token-stats 扫描会话日志用）
- 视觉识别可选：`OPENCODE_GO_API_KEY` 凭据（`dsh-credentials` 中配置），用于 `describe_image`

### 步骤

每个插件是一个独立 bundle 包，逐个安装：

```bash
# 克隆本仓库
git clone https://github.com/<your-name>/dsh-plugins.git
cd dsh-plugins

# 安装到 web profile（每个插件一次）
dsh plugin --profile web add dsh-token-stats
dsh plugin --profile web add dsh-navbar
dsh plugin --profile web add dsh-filecard

# 重启 DSH Web，使其加载新 bundle
dsh web
```

> 依赖说明：插件的 peer 依赖（`@deepseek-ai/cordis`、`@deepseek-ai/dsh-typert-protocol`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-mcp-client` 等）由 DSH 安装提供，不在公开 npm 上。若 bundle 位于 node_modules 树之外导致裸说明符解析失败，可在 bundle 内建 `node_modules/` 软链指向 DSH profile（`~/.dsh/profiles/node_modules`）或 dsh 安装目录（`<dsh>/node_modules`）。

### 卸载

```bash
dsh plugin --profile web remove dsh-token-stats
dsh plugin --profile web remove dsh-navbar
dsh plugin --profile web remove dsh-filecard
```

## ⚙️ 配置（环境变量）

| 变量 | 默认值 | 插件 | 说明 |
|---|---|---|---|
| `DSH_UPLOAD_DIR` | `~/uploads` | dsh-filecard | 文件卡片存储目录（也是 `describe_image` 的读取白名单） |
| `DSH_OPENCODE_BASE` | `https://opencode.ai/zen/go/v1` | dsh-filecard | OpenAI 兼容识图 API 地址 |
| `DSH_IMAGE_MODEL` | `mimo-v2.5` | dsh-filecard | 识图使用的视觉模型 |
| `DSH_NAVBAR_ASSETS_FILE` | bundle 目录下的 `assets.json` | dsh-navbar | 子代理资产持久化文件位置 |
| `DSH_NAVBAR_MCP_FILE` | bundle 目录下的 `mcp-servers.json` | dsh-navbar | MCP 服务器登记文件位置（bundle 只读时建议指向用户数据目录） |
| `DSH_NAVBAR_AUTOMATION_FILE` | bundle 目录下的 `automation-assets.json` | dsh-navbar | 自动化资产登记文件位置 |

## 📁 目录结构

```
dsh-plugins/
├── dsh-token-stats/          # 使用统计
│   ├── package.json          # bundle 元信息（dsh.bundle / dsh.client）
│   ├── cordis.patch.yml      # 组合层补丁（注册插件行）
│   └── lib/
│       ├── index.js          # Host：TokenStatsService（TypertRemoteService）
│       ├── typert.host.js    # Host TYPERT 严格清单（zod）
│       └── client.js         # Client：使用统计标签页（React）
├── dsh-navbar/               # 导航栏
│   └── lib/
│       ├── index.js          # Host：SubagentAssetsService + McpServersService + run_subagent_asset 工具
│       ├── typert.host.js    # Host TYPERT 严格清单（subagentAssets / mcpServers 两个服务）
│       ├── client.js         # Client：导航按钮 + 滑出面板（四分区）
│       ├── assets.example.json       # 子代理资产格式示例
│       └── mcp-servers.example.json  # MCP 服务器登记格式示例（stdio / streamable-http）
│   # 运行时数据（不入库）：assets.json / mcp-servers.json / automation-assets.json
└── dsh-filecard/             # 文件卡片 + 识图
    └── lib/
        ├── index.js          # Host：FileCardService + describe_image 工具
        ├── typert.host.js    # Host TYPERT 严格清单
        └── client.js         # Client：输入框文件卡片
```

插件遵循 DSH 官方 feature bundle 形态：`package.json` 带 `dsh.bundle.patch` 指向 `cordis.patch.yml`，Host 端为默认导出的 `TypertRemoteService` 子类（经 `typert.host.js` 严格清单自动注册网关端点），Client 端为 `__ModuleLoader__` 格式浏览器模块（经 `ctx.connection.rpc.call('/api', ...)` 直连网关）。

## 🤝 贡献

欢迎提交 PR 或 Issue：新插件、Bug 修复、翻译、截图补充等。提交前请确认不包含个人运行数据（`assets.json` 等运行时状态已 gitignore）。

## 📄 许可证

[MIT](LICENSE)
