/**
 * 认证中间件导出
 * 兼容不同路由的导入方式
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        openid: string;
      };
    }
  }
}

/**
 * JWT 认证中间件
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      openid: decoded.openid,
    };

    next();
  } catch (error) {
    logger.error('认证失败', error);
    return res.status(401).json({ error: '认证失败' });
  }
}

// 兼容旧版导出
export const authMiddleware = authenticateToken;
export const optionalAuthMiddleware = authenticateToken;
