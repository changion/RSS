"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminIPWhitelist = adminIPWhitelist;
/**
 * Admin IP 白名单中间件
 * 从 ADMIN_IP_WHITELIST 环境变量读取允许的 IP 列表（逗号分隔）
 * 未在白名单中的请求返回 403
 */
function adminIPWhitelist(req, res, next) {
    const envWhitelist = process.env.ADMIN_IP_WHITELIST || '';
    const defaultAllowed = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    const allowedIPs = new Set([
        ...defaultAllowed,
        ...envWhitelist
            .split(',')
            .map((ip) => ip.trim())
            .filter(Boolean),
    ]);
    // 从请求中提取真实 IP（兼容代理场景）
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIP = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]?.trim()) ||
        req.socket.remoteAddress ||
        '';
    if (allowedIPs.has(clientIP)) {
        next();
        return;
    }
    console.warn(`[adminIPWhitelist] 拒绝访问 — IP: ${clientIP}, Path: ${req.path}`);
    res.status(403).json({ error: 'Forbidden', message: 'IP not in admin whitelist' });
}
//# sourceMappingURL=adminIPWhitelist.js.map