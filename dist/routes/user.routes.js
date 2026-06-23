"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ─── 当前用户接口 ──────────────────────────────────────────────────────────────
/**
 * GET /api/users/me
 * 获取当前用户信息
 */
router.get('/me', auth_middleware_1.authenticateJWT, async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
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
    }
    catch (err) {
        res.status(500).json({ error: '获取用户信息失败', detail: String(err) });
    }
});
/**
 * PUT /api/users/me
 * 更新当前用户基本信息（displayName）
 */
router.put('/me', auth_middleware_1.authenticateJWT, async (req, res) => {
    try {
        const { displayName } = req.body;
        const updated = await prisma_1.prisma.user.update({
            where: { id: req.user.userId },
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
    }
    catch (err) {
        res.status(500).json({ error: '更新用户信息失败', detail: String(err) });
    }
});
/**
 * PUT /api/users/me/push-channels
 * 绑定推送渠道（飞书 Webhook / 邮箱通知）
 */
router.put('/me/push-channels', auth_middleware_1.authenticateJWT, async (req, res) => {
    try {
        const { feishuWebhook, emailAddress, emailNotify } = req.body;
        // 校验 feishuWebhook 格式
        if (feishuWebhook !== undefined && feishuWebhook !== null && feishuWebhook !== '') {
            if (!feishuWebhook.startsWith('https://')) {
                res.status(400).json({ error: 'feishuWebhook 必须以 https:// 开头' });
                return;
            }
        }
        const updates = {};
        if (feishuWebhook !== undefined)
            updates.feishuWebhook = feishuWebhook || null;
        if (emailAddress !== undefined)
            updates.emailAddress = emailAddress || null;
        if (typeof emailNotify === 'boolean')
            updates.emailNotify = emailNotify;
        const updated = await prisma_1.prisma.user.update({
            where: { id: req.user.userId },
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
    }
    catch (err) {
        res.status(500).json({ error: '更新推送渠道失败', detail: String(err) });
    }
});
// ─── Admin 用户管理接口 ────────────────────────────────────────────────────────
/**
 * GET /api/users (Admin)
 * 获取用户列表（需 ADMIN 角色）
 */
router.get('/', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)(['ADMIN']), async (_req, res) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
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
    }
    catch (err) {
        res.status(500).json({ error: '获取用户列表失败', detail: String(err) });
    }
});
/**
 * PATCH /api/users/:id/status (Admin)
 * 停用/恢复用户（需 ADMIN 角色）
 */
router.patch('/:id/status', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['ACTIVE', 'SUSPENDED'];
        if (!status || !validStatuses.includes(status)) {
            res.status(400).json({ error: `status 必须是 ${validStatuses.join('/')} 之一` });
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!user) {
            res.status(404).json({ error: '用户不存在' });
            return;
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id },
            data: { status },
            select: { id: true, email: true, role: true, status: true, updatedAt: true },
        });
        res.json({ data: updated });
    }
    catch (err) {
        res.status(500).json({ error: '更新用户状态失败', detail: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=user.routes.js.map