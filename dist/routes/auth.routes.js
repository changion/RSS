"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const BCRYPT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'intel-hub-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 生成 JWT */
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
/**
 * POST /api/auth/register
 * 邮箱+密码注册，返回 JWT
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !EMAIL_REGEX.test(email)) {
            res.status(400).json({ error: '邮箱格式不正确' });
            return;
        }
        if (!password || password.length < 8) {
            res.status(400).json({ error: '密码至少 8 位' });
            return;
        }
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: '该邮箱已注册' });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(password, BCRYPT_ROUNDS);
        const user = await prisma_1.prisma.user.create({
            data: { email, passwordHash },
        });
        const token = signToken({ userId: user.id, email: user.email, role: user.role });
        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.displayName,
                createdAt: user.createdAt,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: '注册失败', detail: String(err) });
    }
});
/**
 * POST /api/auth/login
 * 邮箱+密码登录，返回 JWT（7天有效期）
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: '邮箱和密码不能为空' });
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: '邮箱或密码错误' });
            return;
        }
        if (user.status === 'SUSPENDED') {
            res.status(403).json({ error: '账号已停用，请联系管理员' });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: '邮箱或密码错误' });
            return;
        }
        const token = signToken({ userId: user.id, email: user.email, role: user.role });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.displayName,
                createdAt: user.createdAt,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: '登录失败', detail: String(err) });
    }
});
/**
 * POST /api/auth/change-password
 * 修改密码（需登录，供 P2-L06 个人设置页调用）
 */
router.post('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: '未登录' });
            return;
        }
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(authHeader.slice(7), JWT_SECRET);
        }
        catch {
            res.status(401).json({ error: 'Token 无效或已过期' });
            return;
        }
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            res.status(400).json({ error: '旧密码和新密码不能为空' });
            return;
        }
        if (newPassword.length < 8) {
            res.status(400).json({ error: '新密码至少 8 位' });
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            res.status(404).json({ error: '用户不存在' });
            return;
        }
        const valid = await bcrypt_1.default.compare(oldPassword, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: '旧密码错误' });
            return;
        }
        const newHash = await bcrypt_1.default.hash(newPassword, BCRYPT_ROUNDS);
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: '修改密码失败', detail: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map