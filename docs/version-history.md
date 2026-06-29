# intel-hub 版本变更记录

## v2.3.4（build 9）｜2026-06-23 ［开发中］

- [性能] web/next.config.ts 增加 turbopack.root 锁定监听根目录为 web/，避免 Turbopack 监听上层后端 node_modules，修复本地启动内存暴涨致系统卡死

## v2.3.3（build 8）｜2026-06-12 ［开发中］

- [功能] Web UI 视觉重设计 v2：阴影分层卡片、飞书蓝选中态、情报条目独立卡片，去除线框风格
- [Bug] 修复日报详情页「日报不存在」：Next.js 16 await params，客户端改用 useParams 读取 id
- [功能] 情报条目输出格式统一为「### 标题 / 摘要： / 原文： / 时间：YYYY-MM-DD」，块间 --- 分隔
- [功能] 飞书卡片 lark_md 将「原文：URL」转为可点击 Markdown 链接
- [功能] Web 前端 processedContent 渲染时原文链接可点击
- [配置] Admin 通用/竞品 Prompt 模板同步新格式说明

## v2.3.2（build 7）｜2026-06-12 ［开发中］

- [功能] scrape 采集器支持多页抓取（maxPages）、相对日期过滤（maxAgeHours），html 自动 ?page=N、json 自动 pn=N 翻页
- [配置] 「出海」频道 collectRule 恢复双源并开启分页：扬帆 maxPages=2 + 白鲸 maxPages=3，均限近 24h

## v2.3.1（build 6）｜2026-06-10 ［开发中］

- [Bug] Admin 手动采集后自动触发 AI 处理，修复仅有 rawItems、前端显示「生成中」的问题
- [Bug] 飞书 Webhook 推送增加串行队列（1.5s 间隔）及限频重试，修复 code 11232 frequency limited
- [Bug] GET /api/reports 校验 channelId 订阅权限，无订阅时返回 403

## v2.3.0（build 5）｜2026-06-10 ［开发中］

- [功能] 新增网页抓取采集类型（type: scrape）：支持 html 选择器模式（cheerio）和 json 接口模式两种 target，单 target 失败不影响其他
- [功能] Admin UI「网页抓取」模板按钮改为新版 scrape 格式（原 url_scrape 格式未实现，已废弃）
- [配置] 新增依赖 cheerio
- [配置] 「出海」频道 collectRule 改为 scrape 类型：扬帆出海（html 模式）+ 白鲸出海（json 接口模式），移除 3 个已失效的 wewe-rss 源（出海小达人无替代渠道，放弃）

## v2.2.0（build 4）｜2026-06-08 ［开发中］

- [功能] UI 架构重构为 Discord 风格：左侧频道导航（240px）+ 分区块布局
- [功能] 侧边栏新增「我的频道」区块，动态加载已激活/暂停订阅，点击直达 /channels/[id]
- [功能] 侧边栏新增「＋ 发现频道」按钮，弹出浮层面板替代旧的全页面导航
- [功能] 新建 DiscoverPanel 组件：公开频道列表、一键订阅、实时更新侧边栏
- [功能] 公开频道（type=PUBLIC）订阅免审批，直接激活（status:ACTIVE），私有频道保持原审批流
- [功能] 后端订阅接口 applyReason 改为可选，公开频道默认填「直接订阅」
- [功能] 新建 ChannelContext，实现侧边栏与发现面板的订阅状态同步
- [功能] /channels 页改为重定向至首页，入口统一收敛至左侧「＋ 发现频道」

## v2.1.0（build 3）｜2026-06-08 ［开发中］

- [功能] 新增 ChannelRequest 表，支持用户提交自定义频道需求申请
- [功能] 后端新增 `/api/channel-requests` 路由：提交需求、查看我的需求、Admin 审批/拒绝
- [功能] Admin 后台新增「需求申请」Tab：表格展示+行展开详情+批准(可关联频道)+拒绝
- [功能] Web 前端新增提交需求表单页（/requests）和我的需求列表页（/requests/my）
- [功能] 频道订阅页底部新增「提交订阅需求」入口
- [功能] 侧边栏新增「我的需求」导航项
- [配置] Prisma 迁移 20260608_add_channel_request

## v2.0.0（build 2）｜2026-06-08 ［开发中］

- [功能] 新增 User 和 Subscription 数据模型，支持多用户体系
- [功能] 用户注册/登录/修改密码 API（JWT + bcrypt）
- [功能] JWT 中间件及角色权限控制（ADMIN/USER）
- [功能] 用户个人信息管理 API（GET/PUT /api/users/me）
- [功能] 推送渠道自助绑定（飞书 Webhook / 邮箱）
- [功能] 订阅申请/审批/暂停/恢复全流程 API
- [功能] 多用户个性化日报生成（按订阅频道聚合）
- [功能] 用户自定义 Prompt（需 Admin 审批后生效）
- [功能] 飞书推送用户化改造（按用户 Webhook 推送，未绑定记 SKIPPED）
- [功能] Nodemailer 邮件推送服务（HTML 模板）
- [功能] Admin 界面新增「用户管理」和「订阅审批」Tab
- [功能] Next.js Web 用户端（登录/注册/频道订阅/日报阅读/个人设置）
- [功能] Tauri 桌面客户端配置（macOS dmg 打包）
- [配置] Docker Compose 新增 web 服务（Next.js，端口 3001）
- [配置] 环境变量新增 JWT_SECRET、SMTP_*、CORS_ORIGIN

## v1.0.0（build 1）｜2026-06-08 ［已发布 ✅］

- [功能] RSS/Atom 采集（多 URL 并发，失败降级）
- [功能] APK 版本监控采集器
- [功能] SHA-256 去重（链接+标题+日期）
- [功能] Claude/DeepSeek AI 处理（频道级 Prompt，异步队列限流）
- [功能] 飞书 Webhook 日报推送（富文本卡片格式）
- [功能] Admin 后台（频道 CRUD、手动触发、推送日志）
- [配置] node-cron 定时任务（02:00 采集，08:00 推送）
- [配置] SQLite 数据库（Channel/DailyReport/PushLog）
