# 情报订阅站 — 桌面客户端

基于 Tauri 2 + Next.js Web 端构建的 macOS 桌面应用。

## 前置条件

1. 安装 Rust：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. 安装 Tauri CLI：`npm install -g @tauri-apps/cli`
3. macOS 需要 Xcode Command Line Tools：`xcode-select --install`

## 开发模式

```bash
# 1. 启动后端（intel-hub 根目录）
npm run dev

# 2. 启动 Web 端（web/ 目录，端口 3001）
npm run dev -- -p 3001

# 3. 启动 Tauri 开发模式（desktop/ 目录）
cd desktop
npm install
npm run dev
```

## 打包（内测版，跳过公证）

```bash
# 在 desktop/ 目录
npm run build:unsigned
# 输出位于 src-tauri/target/release/bundle/dmg/
```

## 生产打包说明

- Bundle ID：`com.intel-hub.app`
- 窗口尺寸：1280×800（最小 900×600）
- API 请求：Tauri WebView 内 fetch 代理到 http://localhost:3000（后端）
- 内测阶段跳过 Apple 公证（--no-bundle 跳过签名）
- 正式发布需配置 Apple Developer 证书和 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD` 等环境变量
