import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth.middleware';
import { sendFeishuNotification } from '../services/feishu.service';

const router = Router();

// ─── 用户订阅接口 ──────────────────────────────────────────────────────────────

/**
 * POST /api/subscriptions
 * 提交订阅申请
 */
router.post('/', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, applyReason, customPrompt } = req.body as {
      channelId?: string;
      applyReason?: string;
      customPrompt?: string;
    };

    if (!channelId) {
      res.status(400).json({ error: 'channelId 不能为空' });
      return;
    }

    // 检查频道存在
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      res.status(404).json({ error: '频道不存在' });
      return;
    }

    const isPublic = channel.type === 'PUBLIC';

    // 私有频道必须填写申请理由
    if (!isPublic && (!applyReason || applyReason.trim().length === 0)) {
      res.status(400).json({ error: '申请理由不能为空' });
      return;
    }

    const resolvedReason = applyReason?.trim() || '直接订阅';

    // 检查是否已有申请（去重）
    const existing = await prisma.subscription.findUnique({
      where: { userId_channelId: { userId: req.user!.userId, channelId } },
    });
    if (existing) {
      if (existing.status === 'REJECTED') {
        // 允许重新申请
        const newStatus = isPublic ? 'ACTIVE' : 'PENDING';
        const updated = await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            applyReason: resolvedReason,
            customPrompt: customPrompt || null,
            status: newStatus,
            promptStatus: 'PENDING_REVIEW',
            adminNote: null,
            activatedAt: isPublic ? new Date() : null,
          },
          include: { channel: { select: { name: true } } },
        });
        res.json({ data: updated });
        return;
      }
      res.status(409).json({ error: '已有订阅申请，请勿重复提交', current: existing.status });
      return;
    }

    // 公开频道直接激活，私有频道进入待审批流程
    const status = isPublic ? 'ACTIVE' : 'PENDING';
    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user!.userId,
        channelId,
        applyReason: resolvedReason,
        customPrompt: customPrompt || null,
        status,
        promptStatus: 'PENDING_REVIEW',
        activatedAt: isPublic ? new Date() : null,
      },
      include: {
        channel: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    // 私有频道才触发飞书通知 Admin
    if (!isPublic) {
      const adminWebhook = process.env.FEISHU_WEBHOOK_URL;
      if (adminWebhook) {
        sendFeishuNotification(adminWebhook, {
          title: '新订阅申请',
          content: `用户：${subscription.user.email}\n频道：${subscription.channel.name}\n理由：${resolvedReason}`,
        }).catch((err) => console.error('[subscription] 飞书通知发送失败:', err));
      }
    }

    res.status(201).json({ data: subscription });
  } catch (err) {
    res.status(500).json({ error: '提交订阅申请失败', detail: String(err) });
  }
});

/**
 * GET /api/subscriptions/me
 * 获取当前用户的所有订阅及完整状态
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: req.user!.userId, channel: { status: 'ACTIVE' } },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: subscriptions });
  } catch (err) {
    res.status(500).json({ error: '获取订阅列表失败', detail: String(err) });
  }
});

/**
 * PATCH /api/subscriptions/:id/pause
 * 用户暂停自己的订阅
 */
router.patch('/:id/pause', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sub = await prisma.subscription.findUnique({ where: { id } });

    if (!sub) {
      res.status(404).json({ error: '订阅不存在' });
      return;
    }

    // 用户只能操作自己的订阅（ADMIN 可操作任意）
    if (req.user!.role !== 'ADMIN' && sub.userId !== req.user!.userId) {
      res.status(403).json({ error: '无权限操作此订阅' });
      return;
    }

    if (sub.status !== 'ACTIVE') {
      res.status(400).json({ error: '只能暂停状态为 ACTIVE 的订阅' });
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: 'PAUSED' },
    });

    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: '暂停订阅失败', detail: String(err) });
  }
});

/**
 * PATCH /api/subscriptions/:id/resume
 * 用户恢复自己的订阅
 */
router.patch(
  '/:id/resume',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sub = await prisma.subscription.findUnique({ where: { id } });

      if (!sub) {
        res.status(404).json({ error: '订阅不存在' });
        return;
      }

      if (req.user!.role !== 'ADMIN' && sub.userId !== req.user!.userId) {
        res.status(403).json({ error: '无权限操作此订阅' });
        return;
      }

      if (sub.status !== 'PAUSED') {
        res.status(400).json({ error: '只能恢复状态为 PAUSED 的订阅' });
        return;
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '恢复订阅失败', detail: String(err) });
    }
  },
);

// ─── Admin 订阅管理接口 ────────────────────────────────────────────────────────

/**
 * GET /api/subscriptions/admin/list (Admin)
 * 获取待审批订阅列表
 */
router.get(
  '/admin/list',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.query;
      const where: Record<string, unknown> = {};
      if (status && typeof status === 'string') {
        where.status = status;
      }

      const subscriptions = await prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          channel: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ data: subscriptions });
    } catch (err) {
      res.status(500).json({ error: '获取订阅列表失败', detail: String(err) });
    }
  },
);

/**
 * PATCH /api/subscriptions/admin/:id/approve (Admin)
 * 通过订阅申请
 */
router.patch(
  '/admin/:id/approve',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sub = await prisma.subscription.findUnique({
        where: { id },
        include: {
          user: { select: { email: true, feishuWebhook: true } },
          channel: { select: { name: true } },
        },
      });

      if (!sub) {
        res.status(404).json({ error: '订阅不存在' });
        return;
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });

      // 通知用户（如已绑定飞书）
      if (sub.user.feishuWebhook) {
        sendFeishuNotification(sub.user.feishuWebhook, {
          title: '订阅申请已通过',
          content: `您申请订阅的频道「${sub.channel.name}」已审批通过，现在可以接收日报了！`,
        }).catch((err) => console.error('[subscription] 用户通知失败:', err));
      }

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '审批失败', detail: String(err) });
    }
  },
);

/**
 * PATCH /api/subscriptions/admin/:id/reject (Admin)
 * 拒绝订阅申请
 */
router.patch(
  '/admin/:id/reject',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { adminNote } = req.body as { adminNote?: string };

      const sub = await prisma.subscription.findUnique({ where: { id } });
      if (!sub) {
        res.status(404).json({ error: '订阅不存在' });
        return;
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNote: adminNote || null,
        },
      });

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '拒绝失败', detail: String(err) });
    }
  },
);

/**
 * PATCH /api/subscriptions/admin/:id/pause (Admin)
 * Admin 暂停任意订阅
 */
router.patch(
  '/admin/:id/pause',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sub = await prisma.subscription.findUnique({ where: { id } });

      if (!sub) {
        res.status(404).json({ error: '订阅不存在' });
        return;
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: { status: 'PAUSED' },
      });

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '暂停失败', detail: String(err) });
    }
  },
);

/**
 * PATCH /api/subscriptions/admin/:id/resume (Admin)
 * Admin 恢复任意订阅
 */
router.patch(
  '/admin/:id/resume',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sub = await prisma.subscription.findUnique({ where: { id } });

      if (!sub) {
        res.status(404).json({ error: '订阅不存在' });
        return;
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '恢复失败', detail: String(err) });
    }
  },
);

export default router;
