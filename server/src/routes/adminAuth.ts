import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { adminAuth, checkLoginLimit, clearLoginFailures, createAdminSession, recordLoginFailure, revokeAdminRefreshToken, rotateAdminSession, type AdminRequest, audit } from '../adminPlatform.js';

const router = Router();

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const key = `${req.ip}:${username.toLowerCase()}`;
  const retryAfter = checkLoginLimit(key);
  if (retryAfter) return res.status(429).json({ error: `登录尝试过多，请 ${Math.ceil(retryAfter / 60)} 分钟后重试`, retryAfter });
  const admin = getDb().prepare(`SELECT au.*, ar.code AS role_code, ar.name AS role_name, ar.permissions_json FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id WHERE au.username=?`).get(username) as any;
  if (!admin || admin.status !== 'active' || !bcrypt.compareSync(password, admin.password_hash)) {
    recordLoginFailure(key);
    return res.status(401).json({ error: '账号或密码错误' });
  }
  clearLoginFailures(key);
  getDb().prepare('UPDATE admin_users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').run(admin.id);
  const session = createAdminSession(admin);
  res.json({ ...session, admin: serialize(admin) });
});

router.post('/refresh', (req, res) => {
  const session = rotateAdminSession(String(req.body?.refreshToken || ''));
  if (!session) return res.status(401).json({ error: '刷新令牌已失效' });
  res.json(session);
});

router.post('/logout', (req, res) => {
  revokeAdminRefreshToken(String(req.body?.refreshToken || ''));
  res.json({ success: true });
});

router.get('/me', adminAuth, (req: AdminRequest, res) => {
  const admin = getDb().prepare(`SELECT au.*, ar.code AS role_code, ar.name AS role_name, ar.permissions_json FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id WHERE au.id=?`).get(req.admin!.id) as any;
  res.json(serialize(admin));
});

router.put('/password', adminAuth, (req: AdminRequest, res) => {
  const oldPassword = String(req.body?.oldPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 10 || newPassword.length > 72) return res.status(400).json({ error: '新密码需为 10-72 位' });
  const admin = getDb().prepare('SELECT * FROM admin_users WHERE id=?').get(req.admin!.id) as any;
  if (!bcrypt.compareSync(oldPassword, admin.password_hash)) return res.status(400).json({ error: '原密码错误' });
  getDb().prepare(`UPDATE admin_users SET password_hash=?,force_password_change=0,token_version=token_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(bcrypt.hashSync(newPassword, 12), admin.id);
  getDb().prepare(`UPDATE admin_refresh_tokens SET revoked_at=CURRENT_TIMESTAMP WHERE admin_user_id=? AND revoked_at IS NULL`).run(admin.id);
  audit(req, 'system', 'change_password', 'admin_user', admin.id);
  res.json({ success: true });
});

function serialize(admin: any) {
  return { id: admin.id, username: admin.username, displayName: admin.display_name, roleCode: admin.role_code, roleName: admin.role_name, permissions: JSON.parse(admin.permissions_json), forcePasswordChange: !!admin.force_password_change, lastLoginAt: admin.last_login_at };
}

export default router;
