# Codex API Configure

一个使用 Rust + Tauri + React + Tailwind + shadcn/ui 风格组件构建的跨平台本地配置工具，用于快速写入 Codex 和 Claude Code 的 API 中转配置。

GitHub: https://github.com/nas-tool/codex-api-configure

## 功能

- 一键配置 Codex API 中转地址和 API Key
- 支持 macOS 和 Windows
- 自动创建配置目录
- 默认启动读取本地现有配置
- `config.toml`、`auth.json`、`settings.json` 支持手动编辑
- 手动编辑后写入会二次确认
- TOML / JSON 写入前校验格式
- 支持 Codex Responses WebSocket 配置
- 支持 Claude Code `settings.json`
- 支持复制 Windows CMD 环境变量命令

## 配置位置

Codex:

- macOS: `~/.codex/config.toml`
- macOS: `~/.codex/auth.json`
- Windows: `%userprofile%\.codex\config.toml`
- Windows: `%userprofile%\.codex\auth.json`

Claude Code:

- macOS: `~/.claude/settings.json`
- Windows: `%userprofile%\.claude\settings.json`

## 开发

安装依赖:

```bash
pnpm install
```

启动开发版:

```bash
pnpm tauri dev
```

前端构建:

```bash
pnpm run build
```

Rust 测试:

```bash
cd src-tauri
cargo test
```

打包:

```bash
pnpm tauri build
```

## GitHub Actions

仓库包含自动打包 workflow:

- macOS x86_64: `.dmg`
- macOS arm64: `.dmg`
- Windows x86_64: `.exe`
- Windows arm64: `.exe`

推送到 `main`、推送 `v*` 标签，或手动运行 workflow 都会触发打包，安装包会上传到 GitHub Actions artifacts。

## 推广

Codex API 中转 1x 倍率，Plus 号池，响应快，满血 5.5 中转，主打便宜稳定不掺水，长期运行不跑路。

另外有低价 Plus 账号质保首登，需要的可以看下:

https://pay.ldxp.cn/shop/EGQSQTKD

## 作者

Haoyu Wang

https://wanghaoyu.com.cn
