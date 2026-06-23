import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './db.js';

export const PERMISSIONS = [
  'dashboard.view', 'users.view', 'users.manage', 'attractions.view', 'attractions.manage',
  'attractions.publish', 'attractions.delete', 'attractions.import', 'attractions.approve',
  'categories.view', 'categories.manage', 'admins.manage', 'roles.manage', 'logs.view', 'events.view',
] as const;

export type Permission = typeof PERMISSIONS[number];

export interface AdminRequest extends Request {
  admin?: { id: number; username: string; roleCode: string; permissions: string[]; tokenVersion: number };
}

const ACCESS_SECRET = process.env.ADMIN_JWT_SECRET || `${process.env.JWT_SECRET || 'travel-map'}-admin-change-in-production`;
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

function addColumn(table: string, name: string, definition: string) {
  const db = getDb();
  const exists = db.prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = ?`).get(table, name);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

export function initAdminPlatform() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      permissions_json TEXT NOT NULL DEFAULT '[]',
      is_system INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
      token_version INTEGER NOT NULL DEFAULT 0,
      force_password_change INTEGER NOT NULL DEFAULT 0,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER,
      admin_username TEXT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      before_json TEXT,
      after_json TEXT,
      ip TEXT,
      result TEXT NOT NULL DEFAULT 'success',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attraction_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL CHECK(source_type IN ('admin_manual','admin_import','user_submission','admin_revision')),
      submitter_user_id INTEGER,
      submitter_admin_id INTEGER,
      import_batch_id INTEGER,
      target_attraction_id INTEGER,
      payload_json TEXT NOT NULL,
      duplicate_candidates_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_review','approved','rejected','merged')),
      reviewed_by INTEGER,
      reviewed_at TIMESTAMP,
      review_note TEXT,
      merge_target_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attraction_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      valid_rows INTEGER NOT NULL DEFAULT 0,
      failed_rows INTEGER NOT NULL DEFAULT 0,
      duplicate_rows INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'previewed',
      rows_json TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attraction_import_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      row_number INTEGER NOT NULL,
      row_json TEXT NOT NULL,
      errors_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      user_id INTEGER,
      anonymous_id TEXT,
      event_name TEXT NOT NULL,
      event_category TEXT,
      page TEXT,
      source TEXT,
      action TEXT,
      session_id TEXT,
      properties_json TEXT NOT NULL DEFAULT '{}',
      client_type TEXT NOT NULL DEFAULT 'app',
      app_version TEXT,
      os TEXT,
      event_time TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_operation_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON attraction_submissions(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_name_time ON user_events(event_name, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_user_time ON user_events(user_id, created_at DESC);
  `);

  addColumn('users', 'status', "TEXT NOT NULL DEFAULT 'normal'");
  addColumn('users', 'deleted_at', 'TIMESTAMP');
  addColumn('users', 'deleted_by', 'INTEGER');
  addColumn('users', 'delete_reason', 'TEXT');
  addColumn('users', 'token_version', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'force_password_change', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'last_login_at', 'TIMESTAMP');
  addColumn('categories', 'status', "TEXT NOT NULL DEFAULT 'active'");
  addColumn('categories', 'updated_at', 'TIMESTAMP');
  addColumn('attractions', 'admin_status', "TEXT NOT NULL DEFAULT 'approved'");
  addColumn('attractions', 'aliases', 'TEXT');
  addColumn('attractions', 'address', 'TEXT');
  addColumn('attractions', 'description', 'TEXT');
  addColumn('attractions', 'cover_url', 'TEXT');
  addColumn('attractions', 'updated_at', 'TIMESTAMP');
  addColumn('attractions', 'updated_by', 'INTEGER');

  const defaults: Array<[string, string, string[]]> = [
    ['super_admin', '超级管理员', [...PERMISSIONS]],
    ['content_admin', '内容管理员', ['dashboard.view','users.view','attractions.view','attractions.manage','attractions.publish','attractions.import','attractions.approve','categories.view','categories.manage']],
    ['operation_admin', '运营管理员', ['dashboard.view','users.view','users.manage','attractions.view','categories.view','logs.view','events.view']],
    ['observer', '只读观察员', ['dashboard.view','users.view','attractions.view','categories.view']],
  ];
  const seedRole = db.prepare(`INSERT INTO admin_roles (code,name,description,permissions_json) VALUES (?,?,?,?) ON CONFLICT(code) DO NOTHING`);
  defaults.forEach(([code, name, permissions]) => seedRole.run(code, name, `${name}固定角色`, JSON.stringify(permissions)));

  const count = (db.prepare('SELECT COUNT(*) AS c FROM admin_users').get() as { c: number }).c;
  if (!count) {
    if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_BOOTSTRAP_USERNAME || !process.env.ADMIN_BOOTSTRAP_PASSWORD)) {
      throw new Error('Production requires ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD');
    }
    const username = process.env.ADMIN_BOOTSTRAP_USERNAME || 'superadmin';
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'ChangeMe123!';
    const role = db.prepare("SELECT id FROM admin_roles WHERE code='super_admin'").get() as { id: number };
    db.prepare(`INSERT INTO admin_users (username,password_hash,display_name,role_id,force_password_change) VALUES (?,?,?,?,1)`)
      .run(username, bcrypt.hashSync(password, 12), '初始超级管理员', role.id);
    if (process.env.NODE_ENV !== 'production') console.log(`Admin bootstrap account: ${username} / ${password}`);
  }
}

function hashToken(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }

export function createAdminSession(admin: { id: number; username: string; token_version: number }) {
  const accessToken = jwt.sign({ sub: admin.id, username: admin.username, tokenVersion: admin.token_version, kind: 'admin' }, ACCESS_SECRET, { expiresIn: '30m' });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  getDb().prepare(`INSERT INTO admin_refresh_tokens (admin_user_id,token_hash,expires_at) VALUES (?,?,datetime('now','+7 days'))`)
    .run(admin.id, hashToken(refreshToken));
  return { accessToken, refreshToken, expiresIn: 1800 };
}

export function rotateAdminSession(refreshToken: string) {
  const db = getDb();
  const token = db.prepare(`SELECT * FROM admin_refresh_tokens WHERE token_hash=? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`).get(hashToken(refreshToken)) as any;
  if (!token) return null;
  const admin = db.prepare(`SELECT * FROM admin_users WHERE id=? AND status='active'`).get(token.admin_user_id) as any;
  if (!admin) return null;
  db.prepare('UPDATE admin_refresh_tokens SET revoked_at=CURRENT_TIMESTAMP WHERE id=?').run(token.id);
  return createAdminSession(admin);
}

export function revokeAdminRefreshToken(refreshToken: string) {
  getDb().prepare('UPDATE admin_refresh_tokens SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?').run(hashToken(refreshToken));
}

export function checkLoginLimit(key: string) {
  const item = loginAttempts.get(key);
  return item && item.blockedUntil > Date.now() ? Math.ceil((item.blockedUntil - Date.now()) / 1000) : 0;
}

export function recordLoginFailure(key: string) {
  const current = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  current.count += 1;
  if (current.count >= 5) { current.blockedUntil = Date.now() + 15 * 60_000; current.count = 0; }
  loginAttempts.set(key, current);
}

export function clearLoginFailures(key: string) { loginAttempts.delete(key); }

export function adminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: '管理员未登录' });
  try {
    const payload = jwt.verify(header.slice(7), ACCESS_SECRET) as any;
    if (payload.kind !== 'admin') return res.status(401).json({ error: '无效的管理员令牌' });
    const row = getDb().prepare(`SELECT au.*, ar.code AS role_code, ar.permissions_json FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id WHERE au.id=? AND au.status='active'`).get(Number(payload.sub)) as any;
    if (!row || row.token_version !== payload.tokenVersion) return res.status(401).json({ error: '管理员登录已失效' });
    req.admin = { id: row.id, username: row.username, roleCode: row.role_code, permissions: JSON.parse(row.permissions_json), tokenVersion: row.token_version };
    next();
  } catch { return res.status(401).json({ error: '管理员登录已过期' }); }
}

export function requirePermission(permission: Permission) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin?.permissions.includes(permission)) return res.status(403).json({ error: '无此操作权限' });
    next();
  };
}

export function audit(req: AdminRequest, module: string, action: string, targetType?: string, targetId?: string | number, before?: unknown, after?: unknown, result = 'success') {
  getDb().prepare(`INSERT INTO admin_operation_logs (admin_user_id,admin_username,module,action,target_type,target_id,before_json,after_json,ip,result) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.admin?.id || null, req.admin?.username || null, module, action, targetType || null, targetId == null ? null : String(targetId), before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), req.ip || null, result);
}

export function randomTemporaryPassword() {
  return `Sj!${crypto.randomBytes(8).toString('base64url').slice(0, 10)}`;
}
