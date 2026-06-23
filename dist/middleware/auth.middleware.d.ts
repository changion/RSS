import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
/**
 * 验证 Bearer JWT，将 user 信息注入 req.user
 * 未认证返回 401
 */
export declare function authenticateJWT(req: Request, res: Response, next: NextFunction): void;
/**
 * 检查 req.user.role 是否在允许列表中
 * 权限不足返回 403
 */
export declare function requireRole(roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map