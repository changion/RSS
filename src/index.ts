import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { prisma } from './lib/prisma';
import adminRouter from './routes/admin.routes';
import authRouter from './routes/auth.routes';
import userRouter from './routes/user.routes';
import subscriptionRouter from './routes/subscription.routes';
import channelRequestRouter from './routes/channel-request.routes';
import { initScheduler } from './scheduler';
import { adminIPWhitelist } from './middleware/adminIPWhitelist';
import { authenticateJWT } from './middleware/auth.middleware';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── 中间件 ───────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/auth', authRouter);

// 用户路由（内部已有 authenticateJWT）
app.use('/api/users', userRouter);

// 订阅路由（内部已有 authenticateJWT）
app.use('/api/subscriptions', subscriptionRouter);

// 频道需求申请路由（内部已有 authenticateJWT）
app.use('/api/channel-requests', channelRequestRouter);

// ─── 公共频道目录（P2-L03） ───────────────────────────────────────────────────

/**
 * GET /api/channels
 * 返回 type=PUBLIC 且 status=ACTIVE 的频道列表（无需登录）
 */
app.get('/api/channels', async (_req: Request, res: Response) => {
  try {
    const channels = await prisma.channel.findMany({
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
  } catch (err) {
    res.status(500).json({ error: '获取频道列表失败', detail: String(err) });
  }
});

// ─── 日报 API（P2-L04/L05） ───────────────────────────────────────────────────

/**
 * GET /api/reports
 * 获取当前用户的日报列表（分页）
 * Query: page, limit, date, channelId
 */
app.get('/api/reports', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const skip = (page - 1) * limit;

    const { date, channelId } = req.query;

    // 获取用户的 ACTIVE 订阅频道
    const activeSubs = await prisma.subscription.findMany({
      where: { userId: req.user!.userId, status: 'ACTIVE' },
      select: { channelId: true },
    });
    const allowedChannelIds = activeSubs.map((s) => s.channelId);

    const where: Record<string, unknown> = {
      channelId: { in: allowedChannelIds },
      OR: [{ userId: req.user!.userId }, { userId: null }],
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
      if (!allowedChannelIds.includes(channelId)) {
        res.status(403).json({ error: '无权访问此频道日报' });
        return;
      }
      where.channelId = channelId;
    }

    if (allowedChannelIds.length === 0) {
      res.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
      return;
    }

    const [total, reports] = await Promise.all([
      prisma.dailyReport.count({ where }),
      prisma.dailyReport.findMany({
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
  } catch (err) {
    res.status(500).json({ error: '获取日报列表失败', detail: String(err) });
  }
});

/**
 * GET /api/reports/:id
 * 获取日报详情（需有权限的频道）
 */
app.get('/api/reports/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const report = await prisma.dailyReport.findUnique({
      where: { id },
      include: { channel: { select: { name: true } } },
    });

    if (!report) {
      res.status(404).json({ error: '日报不存在' });
      return;
    }

    // 权限校验：用户必须对该频道有 ACTIVE 订阅
    if (req.user!.role !== 'ADMIN') {
      const sub = await prisma.subscription.findFirst({
        where: {
          userId: req.user!.userId,
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
  } catch (err) {
    res.status(500).json({ error: '获取日报详情失败', detail: String(err) });
  }
});

// ─── Admin 路由（IP 白名单 + ADMIN 角色双重保护） ───────────────────────────────

// 静态文件：/admin → public/admin/
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));

// Admin API 路由（IP 白名单）
app.use('/admin', adminIPWhitelist, adminRouter);

// Admin 用户管理 → 已移至 admin.routes.ts（仅 IP 白名单，无需 JWT）

// Admin 订阅管理（仅 IP 白名单）
app.use('/admin/api/subscriptions', adminIPWhitelist, subscriptionRouter);

// Admin 频道需求管理（仅 IP 白名单）
app.use('/admin/api/channel-requests', adminIPWhitelist, channelRequestRouter);

// ─── 启动 ─────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[bootstrap] 数据库连接成功');

    initScheduler();

    app.listen(PORT, () => {
      console.log(`[bootstrap] 服务启动 — http://localhost:${PORT}`);
      console.log(`[bootstrap] Admin 后台 — http://localhost:${PORT}/admin`);
    });
  } catch (err) {
    console.error('[bootstrap] 启动失败:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('[bootstrap] 收到 SIGTERM，正在关闭...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[bootstrap] 收到 SIGINT，正在关闭...');
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
