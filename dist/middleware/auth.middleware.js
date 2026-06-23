"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'intel-hub-secret-change-in-production';
/**
 * 验证 Bearer JWT，将 user 信息注入 req.user
 * 未认证返回 401
 */
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: '未登录，请提供 Authorization: Bearer <token>' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({ error: 'Token 已过期，请重新登录' });
        }
        else {
            res.status(401).json({ error: 'Token 无效' });
        }
    }
}
/**
 * 检查 req.user.role 是否在允许列表中
 * 权限不足返回 403
 */
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: '未登录' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: '权限不足', required: roles, current: req.user.role });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.middleware.js.map