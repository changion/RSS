import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'intel-hub-secret-change-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// 扩展 Express Request 类型
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
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录，请提供 Authorization: Bearer <token>' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token 已过期，请重新登录' });
    } else {
      res.status(401).json({ error: 'Token 无效' });
    }
  }
}

/**
 * 检查 req.user.role 是否在允许列表中
 * 权限不足返回 403
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
