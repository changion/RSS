import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// ─── 当前用户接口 ──────────────────────────────────────────────────────────────

/**
 * GET /api/users/me
 * 获取当前用户信息
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        feishuWebhook: true,
        emailAddress: true,
        emailNotify: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    res.json({ data: user });
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败', detail: String(err) });
  }
});

/**
 * PUT /api/users/me
 * 更新当前用户基本信息（displayName）
 */
router.put('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const { displayName } = req.body as { displayName?: string };

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { displayName: displayName ?? undefined },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        feishuWebhook: true,
        emailAddress: true,
        emailNotify: true,
        status: true,
        updatedAt: true,
      },
    });

    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: '更新用户信息失败', detail: String(err) });
  }
});

/**
 * PUT /api/users/me/push-channels
 * 绑定推送渠道（飞书 Webhook / 邮箱通知）
 */
router.put(
  '/me/push-channels',
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { feishuWebhook, emailAddress, emailNotify } = req.body as {
        feishuWebhook?: string;
        emailAddress?: string;
        emailNotify?: boolean;
      };

      // 校验 feishuWebhook 格式
      if (feishuWebhook !== undefined && feishuWebhook !== null && feishuWebhook !== '') {
        if (!feishuWebhook.startsWith('https://')) {
          res.status(400).json({ error: 'feishuWebhook 必须以 https:// 开头' });
          return;
        }
      }

      const updates: Record<string, unknown> = {};
      if (feishuWebhook !== undefined) updates.feishuWebhook = feishuWebhook || null;
      if (emailAddress !== undefined) updates.emailAddress = emailAddress || null;
      if (typeof emailNotify === 'boolean') updates.emailNotify = emailNotify;

      const updated = await prisma.user.update({
        where: { id: req.user!.userId },
        data: updates,
        select: {
          id: true,
          feishuWebhook: true,
          emailAddress: true,
          emailNotify: true,
          updatedAt: true,
        },
      });

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '更新推送渠道失败', detail: String(err) });
    }
  },
);

// ─── Admin 用户管理接口 ────────────────────────────────────────────────────────

/**
 * GET /api/users (Admin)
 * 获取用户列表（需 ADMIN 角色）
 */
router.get(
  '/',
  authenticateJWT,
  requireRole(['ADMIN']),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          status: true,
          emailNotify: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { subscriptions: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ data: users });
    } catch (err) {
      res.status(500).json({ error: '获取用户列表失败', detail: String(err) });
    }
  },
);

/**
 * PATCH /api/users/:id/status (Admin)
 * 停用/恢复用户（需 ADMIN 角色）
 */
router.patch(
  '/:id/status',
  authenticateJWT,
  requireRole(['ADMIN']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status?: string };

      const validStatuses = ['ACTIVE', 'SUSPENDED'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ error: `status 必须是 ${validStatuses.join('/')} 之一` });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        res.status(404).json({ error: '用户不存在' });
        return;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { status },
        select: { id: true, email: true, role: true, status: true, updatedAt: true },
      });

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '更新用户状态失败', detail: String(err) });
    }
  },
);

export default router;
