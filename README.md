# intel-hub 情报订阅站

自动化情报采集与推送平台：定时从 RSS / 网页 / JSON 接口采集情报，经 DeepSeek AI 摘要处理后，通过飞书机器人与邮件推送，并提供 Web 客户端与 Admin 后台进行订阅管理与频道配置。

## 功能简介

- **自动采集**：支持 RSS、网页抓取（HTML 选择器 / JSON 接口）、APK 等多种来源，定时任务调度（node-cron）。
- **AI 处理**：调用 DeepSeek（OpenAI 兼容接口）对原始情报做摘要、去重、结构化输出。
- **多渠道推送**：飞书 Webhook 卡片推送（含串行队列与限频重试）、SMTP 邮件推送。
- **Web 客户端**：浏览日报、查看情报详情、管理个人订阅。
- **Admin 后台**：频道与采集规则配置、Prompt 模板管理、手动采集与处理、IP 白名单保护。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express + TypeScript |
| ORM / 数据库 | Prisma + SQLite |
| AI | DeepSeek（OpenAI SDK 兼容） |
| 前端 | Next.js (React) + TypeScript |
| 桌面壳 | Tauri (Rust) |
| 推送 | 飞书 Webhook、Nodemailer (SMTP) |
| 鉴权 | JWT + bcrypt |

## 目录结构

```
intel-hub/
├── src/                后端源码（Express + TypeScript）
│   ├── collectors/     采集器（rss / scrape html / scrape json / apk）
│   ├── services/       业务服务（AI 处理、推送、报表等）
│   ├── routes/         API 路由
│   ├── scheduler.ts    定时任务调度
│   └── index.ts        入口
├── prisma/             Prisma schema 与迁移
│   ├── schema.prisma
│   ├── migrations/     数据库迁移（已入库）
│   └── data/           SQLite 数据库存放目录（.db 不入库）
├── scripts/            运维与测试脚本
├── public/admin/       Admin 后台静态资源
├── web/                Next.js 前端（Web 客户端）
├── desktop/            Tauri 桌面壳（Rust）
└── docs/               文档（含 version-history.md 版本历史）
```

## 快速开始

### 1. 后端

```bash
# 安装依赖
npm install

# 配置环境变量：复制模板并填写真实密钥
cp .env.example .env
#   编辑 .env，填写 DEEPSEEK_API_KEY、FEISHU_WEBHOOK_URL、JWT_SECRET 等

# 初始化数据库（生成 client + 执行迁移）
npm run generate
npm run migrate

# 启动后端（开发模式，默认 http://localhost:3000）
npm run dev
```

### 2. 前端 Web

```bash
cd web
npm install

# 配置 API 地址
cp .env.example .env.local   # 若无 .env.example，新建并填写：
#   NEXT_PUBLIC_API_BASE=http://localhost:3000

npm run dev   # 默认 http://localhost:3001
```

### 3. 桌面壳（可选）

```bash
cd desktop
npm install
npm run tauri dev
```

## 环境变量说明

后端 `.env`（参考 `.env.example`）：

| 变量 | 说明 |
|---|---|
| `PORT` | 服务端口，默认 3000 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key，[获取地址](https://platform.deepseek.com) |
| `FEISHU_WEBHOOK_URL` | 飞书机器人 Webhook 地址（Admin 全局通知） |
| `ADMIN_IP_WHITELIST` | Admin 访问 IP 白名单，逗号分隔 |
| `DATABASE_URL` | SQLite 数据库路径，默认 `file:./data/intel-hub.db` |
| `JWT_SECRET` | JWT 签名密钥，**生产环境必须改为随机长字符串** |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 邮件推送 SMTP 配置 |
| `EMAIL_FROM` | 邮件发件人 |
| `CORS_ORIGIN` | CORS 允许来源，生产环境改为具体域名 |
| `NODE_ENV` | 运行环境 |
| `TZ` | 时区，默认 `Asia/Shanghai` |

前端 `web/.env.local`：

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_API_BASE` | 后端 API 基地址，如 `http://localhost:3000` |

> 注意：`.env` 与 `*.db` 已被 `.gitignore` 排除，**不会进入版本控制**。请勿提交任何真实密钥。

## 采集类型

| type | target | 说明 |
|---|---|---|
| `rss` | — | RSS / Atom 订阅源（rss-parser） |
| `scrape` | `html` | 网页 HTML 选择器抓取（cheerio），支持多页与相对日期过滤 |
| `scrape` | `json` | JSON 接口抓取，支持分页 |
| `apk` | — | APK 应用相关情报采集 |

## 版本历史

详见 [`docs/version-history.md`](docs/version-history.md)。
