import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth.middleware';
import { sendFeishuNotification } from '../services/feishu.service';

const router = Router();

const VALID_CONTENT_TYPES = ['RSS', 'APK', 'WEBSITE', 'RANKING', 'AD', 'SOCIAL', 'OTHER'];

// ─── 用户侧接口 ────────────────────────────────────────────────────────────────

/**
 * POST /api/channel-requests
 * 提交自定义频道需求申请（需登录）
 */
router.post('/', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, contentType, sourceHint, customPrompt } = req.body as {
      title?: string;
      description?: string;
      contentType?: string;
      sourceHint?: string;
      customPrompt?: string;
    };

    if (!title || title.trim().length === 0) {
      res.status(400).json({ error: '需求标题不能为空' });
      return;
    }

    if (!description || description.trim().length === 0) {
      res.status(400).json({ error: '详细描述不能为空' });
      return;
    }

    if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
      res.status(400).json({
        error: `内容类型无效，允许值：${VALID_CONTENT_TYPES.join(' / ')}`,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });

    const channelRequest = await prisma.channelRequest.create({
      data: {
        userId: req.user!.userId,
        title: title.trim(),
        description: description.trim(),
        contentType,
        sourceHint: sourceHint?.trim() || null,
        customPrompt: customPrompt?.trim() || null,
        status: 'PENDING',
      },
    });

    // 飞书通知 Admin
    const adminWebhook = process.env.FEISHU_WEBHOOK_URL;
    if (adminWebhook) {
      sendFeishuNotification(adminWebhook, {
        title: '新频道需求申请',
        content: [
          `用户：${user?.email || req.user!.userId}`,
          `标题：${channelRequest.title}`,
          `类型：${contentType}`,
          `描述：${channelRequest.description.slice(0, 200)}${channelRequest.description.length > 200 ? '...' : ''}`,
          sourceHint ? `来源线索：${sourceHint}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      }).catch((err) => console.error('[channel-request] 飞书通知发送失败:', err));
    }

    res.status(201).json({ data: channelRequest });
  } catch (err) {
    res.status(500).json({ error: '提交需求申请失败', detail: String(err) });
  }
});

/**
 * GET /api/channel-requests/me
 * 获取当前用户提交的需求申请列表
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await prisma.channelRequest.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: requests });
  } catch (err) {
    res.status(500).json({ error: '获取需求列表失败', detail: String(err) });
  }
});

// ─── Admin 侧接口 ──────────────────────────────────────────────────────────────

/**
 * GET /api/channel-requests/admin/list (Admin)
 * 查看所有需求申请
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

      const requests = await prisma.channelRequest.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ data: requests });
    } catch (err) {
      res.status(500).json({ error: '获取需求申请列表失败', detail: String(err) });
    }
  },
);

/**
 * PATCH /api/channel-requests/admin/:id/approve (Admin)
 * 批准需求申请，可选关联已创建的频道
 */
router.patch(
  '/admin/:id/approve',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { adminNote, channelId } = req.body as {
        adminNote?: string;
        channelId?: string;
      };

      const channelRequest = await prisma.channelRequest.findUnique({
        where: { id },
        include: { user: { select: { email: true, feishuWebhook: true } } },
      });

      if (!channelRequest) {
        res.status(404).json({ error: '需求申请不存在' });
        return;
      }

      // 验证 channelId 是否存在（若提供）
      if (channelId) {
        const channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel) {
          res.status(404).json({ error: '关联频道不存在' });
          return;
        }
      }

      const updated = await prisma.channelRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminNote: adminNote?.trim() || null,
          channelId: channelId || null,
        },
      });

      // 若提供了 channelId，自动为该用户创建 ACTIVE 订阅
      if (channelId) {
        const existing = await prisma.subscription.findUnique({
          where: {
            userId_channelId: { userId: channelRequest.userId, channelId },
          },
        });
        if (!existing) {
          await prisma.subscription.create({
            data: {
              userId: channelRequest.userId,
              channelId,
              applyReason: `需求申请批准自动开通：${channelRequest.title}`,
              status: 'ACTIVE',
              promptStatus: channelRequest.customPrompt ? 'PENDING_REVIEW' : 'PENDING_REVIEW',
              customPrompt: channelRequest.customPrompt || null,
              activatedAt: new Date(),
            },
          });
        }
      }

      // 通知用户（如已绑定飞书）
      if (channelRequest.user.feishuWebhook) {
        const channelInfo = channelId ? '，频道已为您开通，很快将收到日报' : '';
        sendFeishuNotification(channelRequest.user.feishuWebhook, {
          title: '频道需求申请已批准',
          content: `您提交的需求「${channelRequest.title}」已审批通过${channelInfo}。${adminNote ? `\n备注：${adminNote}` : ''}`,
        }).catch((err) => console.error('[channel-request] 用户通知失败:', err));
      }

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '批准操作失败', detail: String(err) });
    }
  },
);

/**
 * PATCH /api/channel-requests/admin/:id/reject (Admin)
 * 拒绝需求申请
 */
router.patch(
  '/admin/:id/reject',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { adminNote } = req.body as { adminNote?: string };

      const channelRequest = await prisma.channelRequest.findUnique({
        where: { id },
        include: { user: { select: { feishuWebhook: true } } },
      });

      if (!channelRequest) {
        res.status(404).json({ error: '需求申请不存在' });
        return;
      }

      const updated = await prisma.channelRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNote: adminNote?.trim() || null,
        },
      });

      // 通知用户（如已绑定飞书）
      if (channelRequest.user.feishuWebhook) {
        sendFeishuNotification(channelRequest.user.feishuWebhook, {
          title: '频道需求申请未通过',
          content: `您提交的需求「${channelRequest.title}」暂时无法满足。${adminNote ? `\n原因：${adminNote}` : ''}`,
        }).catch((err) => console.error('[channel-request] 用户通知失败:', err));
      }

      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: '拒绝操作失败', detail: String(err) });
    }
  },
);

export default router;
