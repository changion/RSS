import { Request, Response, NextFunction } from 'express';
/**
 * Admin IP 白名单中间件
 * 从 ADMIN_IP_WHITELIST 环境变量读取允许的 IP 列表（逗号分隔）
 * 未在白名单中的请求返回 403
 */
export declare function adminIPWhitelist(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=adminIPWhitelist.d.ts.map