import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'travel-map-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: { id: number; username: string; role: string };
}

export function generateToken(userId: number, username: string, role: string): string {
  return jwt.sign({ id: userId, username, role }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { id: number; username: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: '登录已过期' });
    return;
  }

  req.user = payload;
  next();
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: '无权限' });
    return;
  }
  next();
}
