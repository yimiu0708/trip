import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'travel-map-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: { id: number; username: string; role: string; tokenVersion: number; forcePasswordChange: boolean };
}

export function generateToken(userId: number, username: string, role: string, tokenVersion = 0): string {
  return jwt.sign({ id: userId, username, role, tokenVersion, kind: 'app' }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { id: number; username: string; role: string; tokenVersion?: number; kind?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string; tokenVersion?: number; kind?: string };
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
  const user = getDb().prepare(`SELECT id,username,role,status,token_version,force_password_change FROM users WHERE id=?`).get(payload.id) as any;
  if (!user || user.status !== 'normal' || user.token_version !== (payload.tokenVersion || 0)) {
    res.status(401).json({ error: user?.status === 'disabled' ? '账号已被禁用' : '登录已失效' });
    return;
  }
  req.user = { id: user.id, username: user.username, role: user.role, tokenVersion: user.token_version, forcePasswordChange: !!user.force_password_change };
  if (req.user.forcePasswordChange && req.originalUrl !== '/api/auth/password') {
    res.status(403).json({ error: '请先修改临时密码', code: 'PASSWORD_CHANGE_REQUIRED' });
    return;
  }
  next();
}

export function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyToken(authHeader.slice(7));
    if (payload) {
      const user = getDb().prepare(`SELECT id,username,role,status,token_version,force_password_change FROM users WHERE id=?`).get(payload.id) as any;
      if (user?.status === 'normal' && user.token_version === (payload.tokenVersion || 0)) {
        req.user = { id: user.id, username: user.username, role: user.role, tokenVersion: user.token_version, forcePasswordChange: !!user.force_password_change };
      }
    }
  }
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
