"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const prisma_1 = require("./lib/prisma");
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const channel_request_routes_1 = __importDefault(require("./routes/channel-request.routes"));
const scheduler_1 = require("./scheduler");
const adminIPWhitelist_1 = require("./middleware/adminIPWhitelist");
const auth_middleware_1 = require("./middleware/auth.middleware");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// ─── 中间件 ───────────────────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// 允许跨域（开发阶段 Web/桌面端需要）
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (_req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
});
// ─── 健康检查 ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─── 公开 API 路由 ────────────────────────────────────────────────────────────
// 认证路由（无需 JWT）
app.use('/api/auth', auth_routes_1.default);
// 用户路由（内部已有 authenticateJWT）
app.use('/api/users', user_routes_1.default);
// 订阅路由（内部已有 authenticateJWT）
app.use('/api/subscriptions', subscription_routes_1.default);
// 频道需求申请路由（内部已有 authenticateJWT）
app.use('/api/channel-requests', channel_request_routes_1.default);
// ─── 公共频道目录（P2-L03） ───────────────────────────────────────────────────
/**
 * GET /api/channels
 * 返回 type=PUBLIC 且 status=ACTIVE 的频道列表（无需登录）
 */
app.get('/api/channels', async (_req, res) => {
    try {
        const channels = await prisma_1.prisma.channel.findMany({
            where: { type: 'PUBLIC', status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                description: true,
                type: true,
                collectFrequency: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ data: channels });
    }
    catch (err) {
        res.status(500).json({ error: '获取频道列表失败', detail: String(err) });
    }
});
// ─── 日报 API（P2-L04/L05） ───────────────────────────────────────────────────
/**
 * GET /api/reports
 * 获取当前用户的日报列表（分页）
 * Query: page, limit, date, channelId
 */
app.get('/api/reports', auth_middleware_1.authenticateJWT, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
        const skip = (page - 1) * limit;
        const { date, channelId } = req.query;
        // 获取用户的 ACTIVE 订阅频道
        const activeSubs = await prisma_1.prisma.subscription.findMany({
            where: { userId: req.user.userId, status: 'ACTIVE' },
            select: { channelId: true },
        });
        const allowedChannelIds = activeSubs.map((s) => s.channelId);
        const where = {
            channelId: { in: allowedChannelIds },
            OR: [{ userId: req.user.userId }, { userId: null }],
        };
        if (date && typeof date === 'string') {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                const end = new Date(start.getTime() + 86400000);
                where.reportDate = { gte: start, lt: end };
            }
        }
        if (channelId && typeof channelId === 'string') {
            where.channelId = channelId;
        }
        const [total, reports] = await Promise.all([
            prisma_1.prisma.dailyReport.count({ where }),
            prisma_1.prisma.dailyReport.findMany({
                where,
                select: {
                    id: true,
                    channelId: true,
                    userId: true,
                    reportDate: true,
                    itemCount: true,
                    aiModel: true,
                    processingMs: true,
                    createdAt: true,
                    channel: { select: { name: true } },
                },
                orderBy: { reportDate: 'desc' },
                skip,
                take: limit,
            }),
        ]);
        res.json({
            data: reports,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        res.status(500).json({ error: '获取日报列表失败', detail: String(err) });
    }
});
/**
 * GET /api/reports/:id
 * 获取日报详情（需有权限的频道）
 */
app.get('/api/reports/:id', auth_middleware_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const report = await prisma_1.prisma.dailyReport.findUnique({
            where: { id },
            include: { channel: { select: { name: true } } },
        });
        if (!report) {
            res.status(404).json({ error: '日报不存在' });
            return;
        }
        // 权限校验：用户必须对该频道有 ACTIVE 订阅
        if (req.user.role !== 'ADMIN') {
            const sub = await prisma_1.prisma.subscription.findFirst({
                where: {
                    userId: req.user.userId,
                    channelId: report.channelId,
                    status: 'ACTIVE',
                },
            });
            if (!sub) {
                res.status(403).json({ error: '无权访问此日报' });
                return;
            }
        }
        res.json({ data: report });
    }
    catch (err) {
        res.status(500).json({ error: '获取日报详情失败', detail: String(err) });
    }
});
// ─── Admin 路由（IP 白名单 + ADMIN 角色双重保护） ───────────────────────────────
// 静态文件：/admin → public/admin/
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'admin')));
// Admin API 路由（IP 白名单）
app.use('/admin', adminIPWhitelist_1.adminIPWhitelist, admin_routes_1.default);
// Admin 用户管理（IP 白名单 + JWT + ADMIN 角色）
app.use('/admin/api/users', adminIPWhitelist_1.adminIPWhitelist, auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)(['ADMIN']), user_routes_1.default);
// Admin 订阅管理（IP 白名单 + JWT + ADMIN 角色）
// 注意：subscription.routes 内部 admin 路由已有 requireRole 保护
app.use('/admin/api/subscriptions', adminIPWhitelist_1.adminIPWhitelist, auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)(['ADMIN']), subscription_routes_1.default);
// Admin 频道需求管理（IP 白名单 + JWT + ADMIN 角色）
app.use('/admin/api/channel-requests', adminIPWhitelist_1.adminIPWhitelist, auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)(['ADMIN']), channel_request_routes_1.default);
// ─── 启动 ─────────────────────────────────────────────────────────────────────
async function bootstrap() {
    try {
        await prisma_1.prisma.$connect();
        console.log('[bootstrap] 数据库连接成功');
        (0, scheduler_1.initScheduler)();
        app.listen(PORT, () => {
            console.log(`[bootstrap] 服务启动 — http://localhost:${PORT}`);
            console.log(`[bootstrap] Admin 后台 — http://localhost:${PORT}/admin`);
        });
    }
    catch (err) {
        console.error('[bootstrap] 启动失败:', err);
        process.exit(1);
    }
}
process.on('SIGTERM', async () => {
    console.log('[bootstrap] 收到 SIGTERM，正在关闭...');
    await prisma_1.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('[bootstrap] 收到 SIGINT，正在关闭...');
    await prisma_1.prisma.$disconnect();
    process.exit(0);
});
bootstrap();
//# sourceMappingURL=index.js.map