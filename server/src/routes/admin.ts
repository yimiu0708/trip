import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { adminAuth, audit, PERMISSIONS, randomTemporaryPassword, requirePermission, type AdminRequest, type Permission } from '../adminPlatform.js';

const router = Router();
router.use(adminAuth);

function paging(req: AdminRequest) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function json(value: string | null | undefined, fallback: any = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

router.get('/dashboard', requirePermission('dashboard.view'), (_req, res) => {
  const db = getDb();
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE status <> 'deleted') AS users,
      (SELECT COUNT(*) FROM users WHERE date(created_at)=date('now')) AS newUsers,
      (SELECT COUNT(*) FROM user_attractions) AS visits,
      (SELECT COUNT(DISTINCT attraction_id) FROM user_attractions) AS litAttractions,
      (SELECT COUNT(*) FROM user_favorites WHERE deleted_at IS NULL) AS favorites,
      (SELECT COUNT(*) FROM attractions WHERE status='approved') AS attractions,
      (SELECT COUNT(*) FROM attraction_submissions WHERE status IN ('pending','in_review')) AS pending,
      (SELECT COUNT(*) FROM attraction_import_batches WHERE status IN ('failed','partial_failed')) AS failedImports
  `).get() as any;
  const active = db.prepare(`SELECT
    COUNT(DISTINCT CASE WHEN created_at>=datetime('now','-1 day') THEN user_id END) AS dau,
    COUNT(DISTINCT CASE WHEN created_at>=datetime('now','-7 days') THEN user_id END) AS wau,
    COUNT(DISTINCT CASE WHEN created_at>=datetime('now','-30 days') THEN user_id END) AS mau
    FROM user_events WHERE user_id IS NOT NULL`).get();
  const trend = db.prepare(`WITH RECURSIVE days(d) AS (SELECT date('now','-6 days') UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<date('now'))
    SELECT d AS date,
      (SELECT COUNT(*) FROM users WHERE date(created_at)=d) AS newUsers,
      (SELECT COUNT(DISTINCT user_id) FROM user_events WHERE date(created_at)=d) AS activeUsers
    FROM days`).all();
  const todo = db.prepare(`SELECT id,source_type,status,created_at,json_extract(payload_json,'$.name') AS name FROM attraction_submissions WHERE status IN ('pending','in_review') ORDER BY created_at LIMIT 5`).all();
  const logs = db.prepare(`SELECT id,admin_username,module,action,target_id,created_at,result FROM admin_operation_logs ORDER BY id DESC LIMIT 6`).all();
  res.json({ totals: { ...totals, ...active }, trend, todo, logs });
});

router.get('/locations', requirePermission('attractions.view'), (_req, res) => {
  const db = getDb();
  res.json({
    provinces: db.prepare('SELECT id,name,code,region FROM provinces ORDER BY id').all(),
    cities: db.prepare('SELECT id,name,province_id,type FROM cities ORDER BY province_id,id').all(),
  });
});

router.get('/users', requirePermission('users.view'), (req: AdminRequest, res) => {
  const db = getDb();
  const { page, pageSize, offset } = paging(req);
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '');
  const where: string[] = [];
  const params: any[] = [];
  if (q) { where.push('(CAST(u.id AS TEXT)=? OR u.username LIKE ?)'); params.push(q, `%${q}%`); }
  if (status) { where.push('u.status=?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM users u ${clause}`).get(...params) as { c: number }).c;
  const items = db.prepare(`SELECT u.id,u.username,u.role,u.status,u.created_at,u.last_login_at,u.force_password_change,
      COUNT(DISTINCT ua.attraction_id) AS litAttractions,COUNT(ua.id) AS visits,
      (SELECT COUNT(*) FROM user_achievements x WHERE x.user_id=u.id) AS achievements,
      (SELECT COUNT(*) FROM user_favorites f WHERE f.user_id=u.id AND f.deleted_at IS NULL) AS favorites,
      (SELECT type_code FROM travel_personality_results p WHERE p.user_id=u.id) AS personality
    FROM users u LEFT JOIN user_attractions ua ON ua.user_id=u.id ${clause}
    GROUP BY u.id ORDER BY u.id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  res.json({ items, total, page, pageSize });
});

router.get('/users/:id', requirePermission('users.view'), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const user = db.prepare(`SELECT id,username,status,created_at,last_login_at,force_password_change,deleted_at,delete_reason FROM users WHERE id=?`).get(id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const stats = db.prepare(`SELECT COUNT(DISTINCT a.province_id) AS provinces,COUNT(DISTINCT a.city_id) AS cities,COUNT(DISTINCT ua.attraction_id) AS attractions,COUNT(ua.id) AS visits FROM user_attractions ua JOIN attractions a ON a.id=ua.attraction_id WHERE ua.user_id=?`).get(id);
  const records = db.prepare(`SELECT ua.id,a.name,ua.lit_at,ua.display_time_text FROM user_attractions ua JOIN attractions a ON a.id=ua.attraction_id WHERE ua.user_id=? ORDER BY ua.lit_at DESC LIMIT 50`).all(id);
  res.json({ user, stats, records });
});

router.put('/users/:id/status', requirePermission('users.manage'), (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const reason = String(req.body?.reason || '').trim();
  if (!['normal','disabled'].includes(status) || !reason) return res.status(400).json({ error: '状态或操作原因不合法' });
  const db = getDb();
  const before = db.prepare('SELECT id,username,status,token_version FROM users WHERE id=?').get(id) as any;
  if (!before) return res.status(404).json({ error: '用户不存在' });
  db.prepare(`UPDATE users SET status=?,token_version=token_version+1 WHERE id=? AND status<>'deleted'`).run(status, id);
  audit(req, 'users', status === 'disabled' ? 'disable' : 'enable', 'user', id, before, { status, reason });
  res.json({ success: true });
});

router.post('/users/:id/reset-password', requirePermission('users.manage'), (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const before = db.prepare('SELECT id,username,status FROM users WHERE id=?').get(id) as any;
  if (!before || before.status === 'deleted') return res.status(404).json({ error: '用户不存在' });
  const temporaryPassword = randomTemporaryPassword();
  db.prepare(`UPDATE users SET password_hash=?,force_password_change=1,token_version=token_version+1 WHERE id=?`).run(bcrypt.hashSync(temporaryPassword, 12), id);
  audit(req, 'users', 'reset_password', 'user', id, before, { forcePasswordChange: true });
  res.json({ success: true, temporaryPassword });
});

router.delete('/users/:id', requirePermission('users.manage'), (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: '必须填写删除原因' });
  const db = getDb();
  const before = db.prepare('SELECT id,username,status FROM users WHERE id=?').get(id) as any;
  if (!before) return res.status(404).json({ error: '用户不存在' });
  const anonymous = `deleted_${id}_${Date.now()}`;
  db.prepare(`UPDATE users SET username=?,status='deleted',deleted_at=CURRENT_TIMESTAMP,deleted_by=?,delete_reason=?,token_version=token_version+1 WHERE id=?`).run(anonymous, req.admin!.id, reason, id);
  audit(req, 'users', 'delete', 'user', id, before, { status: 'deleted', anonymized: true, reason });
  res.json({ success: true });
});

router.get('/attractions', requirePermission('attractions.view'), (req: AdminRequest, res) => {
  const { page, pageSize, offset } = paging(req);
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '');
  const params: any[] = [];
  const where: string[] = [];
  if (q) { where.push('(a.name LIKE ? OR a.pinyin LIKE ?)'); params.push(`%${q}%`,`%${q.toLowerCase()}%`); }
  if (status) { where.push('a.admin_status=?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM attractions a ${clause}`).get(...params) as { c: number }).c;
  const items = db.prepare(`SELECT a.id,a.name,a.aliases,a.level,a.pinyin,a.admin_status AS status,a.address,a.updated_at,p.name AS provinceName,c.name AS cityName,a.province_id AS provinceId,a.city_id AS cityId,
    GROUP_CONCAT(DISTINCT cat.name) AS categories
    FROM attractions a JOIN provinces p ON p.id=a.province_id JOIN cities c ON c.id=a.city_id
    LEFT JOIN attraction_tags t ON t.attraction_id=a.id LEFT JOIN categories cat ON cat.id=t.category_id
    ${clause} GROUP BY a.id ORDER BY a.id DESC LIMIT ? OFFSET ?`).all(...params,pageSize,offset);
  res.json({ items, total, page, pageSize });
});

router.post('/attractions', requirePermission('attractions.manage'), (req: AdminRequest, res) => {
  const payload = normalizeAttraction(req.body);
  const error = validateAttraction(payload);
  if (error) return res.status(400).json({ error });
  const duplicateCandidates = findDuplicates(payload);
  const result = getDb().prepare(`INSERT INTO attraction_submissions (source_type,submitter_admin_id,payload_json,duplicate_candidates_json) VALUES ('admin_manual',?,?,?)`).run(req.admin!.id, JSON.stringify(payload), JSON.stringify(duplicateCandidates));
  audit(req, 'attractions', 'submit_create', 'attraction_submission', Number(result.lastInsertRowid), null, payload);
  res.status(201).json({ id: result.lastInsertRowid, status: 'pending', duplicateCandidates });
});

router.put('/attractions/:id', requirePermission('attractions.manage'), (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const current = db.prepare('SELECT * FROM attractions WHERE id=?').get(id) as any;
  if (!current) return res.status(404).json({ error: '景区不存在' });
  const payload = normalizeAttraction({ ...current, ...req.body });
  const error = validateAttraction(payload);
  if (error) return res.status(400).json({ error });
  const result = db.prepare(`INSERT INTO attraction_submissions (source_type,submitter_admin_id,target_attraction_id,payload_json,duplicate_candidates_json) VALUES ('admin_revision',?,?,?,?)`).run(req.admin!.id,id,JSON.stringify(payload),JSON.stringify(findDuplicates(payload,id)));
  audit(req,'attractions','submit_revision','attraction_submission',Number(result.lastInsertRowid),current,payload);
  res.json({ submissionId: result.lastInsertRowid, status: 'pending' });
});

router.put('/attractions/:id/status', requirePermission('attractions.publish'), (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const reason = String(req.body?.reason || '').trim();
  if (!['approved','offline'].includes(status) || !reason) return res.status(400).json({ error: '状态或原因不合法' });
  const db = getDb();
  const before = db.prepare('SELECT id,name,status,admin_status FROM attractions WHERE id=?').get(id) as any;
  if (!before) return res.status(404).json({ error: '景区不存在' });
  db.prepare(`UPDATE attractions SET status=?,admin_status=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=?`).run(status === 'approved' ? 'approved' : 'rejected',status,req.admin!.id,id);
  audit(req,'attractions',status === 'approved' ? 'publish' : 'offline','attraction',id,before,{status,reason});
  res.json({ success: true });
});

router.delete('/attractions/:id', requirePermission('attractions.delete'), (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const before = db.prepare('SELECT * FROM attractions WHERE id=?').get(id) as any;
  if (!before) return res.status(404).json({ error: '景区不存在' });
  const links = (db.prepare(`SELECT (SELECT COUNT(*) FROM user_attractions WHERE attraction_id=?)+(SELECT COUNT(*) FROM user_favorites WHERE target_type='attraction' AND target_id=?) AS c`).get(id,id) as { c:number }).c;
  if (links) return res.status(409).json({ error: '景区已有用户记录，只能下架' });
  db.prepare('DELETE FROM attraction_tags WHERE attraction_id=?').run(id);
  db.prepare('DELETE FROM attractions WHERE id=?').run(id);
  audit(req,'attractions','delete','attraction',id,before,null);
  res.json({ success:true });
});

router.get('/attractions/quality-check', requirePermission('attractions.view'), (_req, res) => {
  const db = getDb();
  const issues = db.prepare(`SELECT a.id,a.name,p.name AS provinceName,c.name AS cityName,
    TRIM((CASE WHEN a.pinyin IS NULL OR a.pinyin='' THEN '缺少拼音;' ELSE '' END)||(CASE WHEN NOT EXISTS(SELECT 1 FROM attraction_tags t WHERE t.attraction_id=a.id) THEN '缺少分类;' ELSE '' END)||(CASE WHEN a.level IS NULL THEN '缺少等级;' ELSE '' END),';') AS issue
    FROM attractions a LEFT JOIN provinces p ON p.id=a.province_id LEFT JOIN cities c ON c.id=a.city_id
    WHERE a.pinyin IS NULL OR a.pinyin='' OR a.level IS NULL OR NOT EXISTS(SELECT 1 FROM attraction_tags t WHERE t.attraction_id=a.id)
    ORDER BY a.id DESC LIMIT 200`).all();
  const duplicates = db.prepare(`SELECT name,province_id,COUNT(*) AS count,GROUP_CONCAT(id) AS ids FROM attractions GROUP BY name,province_id HAVING COUNT(*)>1`).all();
  res.json({ issues, duplicates, total: issues.length + duplicates.length });
});

router.get('/submissions', requirePermission('attractions.approve'), (req: AdminRequest, res) => {
  const { page,pageSize,offset } = paging(req);
  const status = String(req.query.status || '');
  const source = String(req.query.source || '');
  const where:string[]=[]; const params:any[]=[];
  if(status){where.push('s.status=?');params.push(status);} if(source){where.push('s.source_type=?');params.push(source);}
  const clause=where.length?`WHERE ${where.join(' AND ')}`:''; const db=getDb();
  const total=(db.prepare(`SELECT COUNT(*) c FROM attraction_submissions s ${clause}`).get(...params) as any).c;
  const rows=db.prepare(`SELECT s.*,au.username AS submitterName,ru.username AS reviewerName FROM attraction_submissions s LEFT JOIN admin_users au ON au.id=s.submitter_admin_id LEFT JOIN admin_users ru ON ru.id=s.reviewed_by ${clause} ORDER BY s.id DESC LIMIT ? OFFSET ?`).all(...params,pageSize,offset) as any[];
  res.json({items:rows.map(x=>({...x,payload:json(x.payload_json,{}),duplicateCandidates:json(x.duplicate_candidates_json,[])})),total,page,pageSize});
});

router.put('/submissions/:id/approve', requirePermission('attractions.approve'), (req:AdminRequest,res)=>{
  const id=Number(req.params.id); const db=getDb(); const submission=db.prepare(`SELECT * FROM attraction_submissions WHERE id=? AND status IN ('pending','in_review')`).get(id) as any;
  if(!submission)return res.status(409).json({error:'审批单不存在或已处理'}); const payload=json(submission.payload_json,{});
  const transaction=db.transaction(()=>{
    let attractionId=submission.target_attraction_id as number|undefined;
    if(attractionId){ updateAttraction(attractionId,payload,req.admin!.id); }
    else { attractionId=insertAttraction(payload,req.admin!.id); }
    db.prepare(`UPDATE attraction_submissions SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.admin!.id,String(req.body?.note||''),id);
    return attractionId;
  });
  try{const attractionId=transaction();audit(req,'attractions','approve','attraction_submission',id,submission,{attractionId});res.json({success:true,attractionId});}catch(error:any){res.status(409).json({error:error.message||'审批失败'});}
});

router.put('/submissions/:id/reject', requirePermission('attractions.approve'), (req:AdminRequest,res)=>{
  const note=String(req.body?.note||'').trim(); if(!note)return res.status(400).json({error:'必须填写驳回原因'});
  const result=getDb().prepare(`UPDATE attraction_submissions SET status='rejected',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','in_review')`).run(req.admin!.id,note,Number(req.params.id));
  if(!result.changes)return res.status(409).json({error:'审批单不存在或已处理'});audit(req,'attractions','reject','attraction_submission',Number(req.params.id),null,{note});res.json({success:true});
});

router.put('/submissions/:id/merge', requirePermission('attractions.approve'), (req:AdminRequest,res)=>{
  const targetId=Number(req.body?.targetId);const note=String(req.body?.note||'').trim();if(!targetId||!note)return res.status(400).json({error:'请选择合并景区并填写原因'});
  if(!getDb().prepare('SELECT 1 FROM attractions WHERE id=?').get(targetId))return res.status(404).json({error:'目标景区不存在'});
  const result=getDb().prepare(`UPDATE attraction_submissions SET status='merged',merge_target_id=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','in_review')`).run(targetId,req.admin!.id,note,Number(req.params.id));
  if(!result.changes)return res.status(409).json({error:'审批单不存在或已处理'});audit(req,'attractions','merge','attraction_submission',Number(req.params.id),null,{targetId,note});res.json({success:true});
});

router.post('/imports/preview', requirePermission('attractions.import'), (req:AdminRequest,res)=>{
  const fileName=String(req.body?.fileName||'import.xlsx').slice(0,180);const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
  if(!rows.length||rows.length>5000)return res.status(400).json({error:'导入文件需包含 1-5000 行数据'});
  const db=getDb();const validated=rows.map((row:any,index:number)=>{const payload=normalizeAttraction(row);const errors:string[]=[];const error=validateAttraction(payload);if(error)errors.push(error);const duplicates=findDuplicates(payload);return{rowNumber:index+2,payload,errors,duplicates};});
  const validRows=validated.filter((x:any)=>!x.errors.length).length;const duplicateRows=validated.filter((x:any)=>x.duplicates.length).length;
  const result=db.prepare(`INSERT INTO attraction_import_batches (file_name,uploaded_by,total_rows,valid_rows,failed_rows,duplicate_rows,status,rows_json) VALUES (?,?,?,?,?,?,'previewed',?)`).run(fileName,req.admin!.id,rows.length,validRows,rows.length-validRows,duplicateRows,JSON.stringify(validated));
  const insertError=db.prepare(`INSERT INTO attraction_import_errors (batch_id,row_number,row_json,errors_json) VALUES (?,?,?,?)`);validated.filter((x:any)=>x.errors.length).forEach((x:any)=>insertError.run(result.lastInsertRowid,x.rowNumber,JSON.stringify(x.payload),JSON.stringify(x.errors)));
  audit(req,'attractions','import_preview','import_batch',Number(result.lastInsertRowid),null,{fileName,totalRows:rows.length});res.json({batchId:result.lastInsertRowid,totalRows:rows.length,validRows,failedRows:rows.length-validRows,duplicateRows,rows:validated.slice(0,100)});
});

router.post('/imports/:id/confirm', requirePermission('attractions.import'), (req:AdminRequest,res)=>{
  const id=Number(req.params.id);const db=getDb();const batch=db.prepare(`SELECT * FROM attraction_import_batches WHERE id=? AND status='previewed'`).get(id) as any;if(!batch)return res.status(409).json({error:'导入批次不存在或已确认'});
  const rows=json(batch.rows_json,[]) as any[];const valid=rows.filter(x=>!x.errors.length);const transaction=db.transaction(()=>{const stmt=db.prepare(`INSERT INTO attraction_submissions (source_type,submitter_admin_id,import_batch_id,payload_json,duplicate_candidates_json) VALUES ('admin_import',?,?,?,?)`);valid.forEach(x=>stmt.run(req.admin!.id,id,JSON.stringify(x.payload),JSON.stringify(x.duplicates)));db.prepare(`UPDATE attraction_import_batches SET status=?,confirmed_at=CURRENT_TIMESTAMP WHERE id=?`).run(batch.failed_rows?'partial_failed':'completed',id);});transaction();audit(req,'attractions','import_confirm','import_batch',id,batch,{createdSubmissions:valid.length});res.json({success:true,createdSubmissions:valid.length});
});

router.get('/imports',requirePermission('attractions.import'),(_req,res)=>{res.json(getDb().prepare(`SELECT id,file_name AS fileName,total_rows AS totalRows,valid_rows AS validRows,failed_rows AS failedRows,duplicate_rows AS duplicateRows,status,created_at AS createdAt,confirmed_at AS confirmedAt FROM attraction_import_batches ORDER BY id DESC LIMIT 100`).all());});

router.get('/categories',requirePermission('categories.view'),(_req,res)=>{res.json(getDb().prepare(`SELECT c.id,c.name,c.sort_order AS sortOrder,c.status,COUNT(DISTINCT t.attraction_id) AS attractionCount FROM categories c LEFT JOIN attraction_tags t ON t.category_id=c.id GROUP BY c.id ORDER BY c.sort_order,c.id`).all());});
router.post('/categories',requirePermission('categories.manage'),(req:AdminRequest,res)=>{const name=String(req.body?.name||'').trim();if(!name)return res.status(400).json({error:'分类名称不能为空'});try{const result=getDb().prepare(`INSERT INTO categories (name,sort_order,status,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)`).run(name,Number(req.body?.sortOrder)||0,'active');audit(req,'categories','create','category',Number(result.lastInsertRowid),null,{name});res.status(201).json({id:result.lastInsertRowid});}catch{return res.status(409).json({error:'分类名称已存在'});}});
router.put('/categories/:id',requirePermission('categories.manage'),(req:AdminRequest,res)=>{const id=Number(req.params.id);const before=getDb().prepare('SELECT * FROM categories WHERE id=?').get(id) as any;if(!before)return res.status(404).json({error:'分类不存在'});const name=String(req.body?.name??before.name).trim();const status=String(req.body?.status??before.status);getDb().prepare(`UPDATE categories SET name=?,sort_order=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name,Number(req.body?.sortOrder??before.sort_order),status,id);audit(req,'categories','update','category',id,before,{name,status});res.json({success:true});});
router.delete('/categories/:id',requirePermission('categories.manage'),(req:AdminRequest,res)=>{const id=Number(req.params.id);const db=getDb();const before=db.prepare('SELECT * FROM categories WHERE id=?').get(id) as any;if(!before)return res.status(404).json({error:'分类不存在'});const count=(db.prepare('SELECT COUNT(*) c FROM attraction_tags WHERE category_id=?').get(id) as any).c;if(count)return res.status(409).json({error:'分类仍有关联景区，不能删除'});db.prepare('DELETE FROM categories WHERE id=?').run(id);audit(req,'categories','delete','category',id,before,null);res.json({success:true});});

router.get('/admin-users',requirePermission('admins.manage'),(_req,res)=>{res.json(getDb().prepare(`SELECT au.id,au.username,au.display_name AS displayName,au.status,au.force_password_change AS forcePasswordChange,au.last_login_at AS lastLoginAt,au.created_at AS createdAt,ar.code AS roleCode,ar.name AS roleName FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id ORDER BY au.id`).all());});
router.post('/admin-users',requirePermission('admins.manage'),(req:AdminRequest,res)=>{const username=String(req.body?.username||'').trim();const roleCode=String(req.body?.roleCode||'observer');if(!/^[a-zA-Z0-9_]{3,30}$/.test(username))return res.status(400).json({error:'账号需为 3-30 位字母、数字或下划线'});const role=getDb().prepare('SELECT id FROM admin_roles WHERE code=?').get(roleCode) as any;if(!role)return res.status(400).json({error:'角色不存在'});const password=randomTemporaryPassword();try{const result=getDb().prepare(`INSERT INTO admin_users (username,password_hash,display_name,role_id,force_password_change) VALUES (?,?,?,?,1)`).run(username,bcrypt.hashSync(password,12),String(req.body?.displayName||username),role.id);audit(req,'system','create_admin','admin_user',Number(result.lastInsertRowid),null,{username,roleCode});res.status(201).json({id:result.lastInsertRowid,temporaryPassword:password});}catch{return res.status(409).json({error:'管理员账号已存在'});}});
router.put('/admin-users/:id',requirePermission('admins.manage'),(req:AdminRequest,res)=>{const id=Number(req.params.id);const db=getDb();const before=db.prepare(`SELECT au.*,ar.code role_code FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id WHERE au.id=?`).get(id) as any;if(!before)return res.status(404).json({error:'管理员不存在'});const roleCode=String(req.body?.roleCode||before.role_code);const status=String(req.body?.status||before.status);if(id===req.admin!.id&&status==='disabled')return res.status(400).json({error:'不能禁用自己'});if(before.role_code==='super_admin'&&(roleCode!=='super_admin'||status==='disabled')){const count=(db.prepare(`SELECT COUNT(*) c FROM admin_users au JOIN admin_roles ar ON ar.id=au.role_id WHERE ar.code='super_admin' AND au.status='active'`).get() as any).c;if(count<=1)return res.status(409).json({error:'必须保留至少一名启用中的超级管理员'});}const role=db.prepare('SELECT id FROM admin_roles WHERE code=?').get(roleCode) as any;if(!role)return res.status(400).json({error:'角色不存在'});db.prepare(`UPDATE admin_users SET display_name=?,role_id=?,status=?,token_version=token_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(String(req.body?.displayName||before.display_name||before.username),role.id,status,id);audit(req,'system','update_admin','admin_user',id,before,{roleCode,status});res.json({success:true});});

router.get('/roles',requirePermission('roles.manage'),(_req,res)=>{const rows=getDb().prepare('SELECT * FROM admin_roles ORDER BY id').all() as any[];res.json({permissionCatalog:PERMISSIONS,items:rows.map(x=>({id:x.id,code:x.code,name:x.name,description:x.description,permissions:json(x.permissions_json,[]),immutable:x.code==='super_admin'}))});});
router.put('/roles/:id',requirePermission('roles.manage'),(req:AdminRequest,res)=>{const id=Number(req.params.id);const db=getDb();const role=db.prepare('SELECT * FROM admin_roles WHERE id=?').get(id) as any;if(!role)return res.status(404).json({error:'角色不存在'});if(role.code==='super_admin')return res.status(400).json({error:'超级管理员权限不可修改'});const permissions=Array.isArray(req.body?.permissions)?req.body.permissions.filter((x:any)=>PERMISSIONS.includes(x as Permission)):[];db.prepare(`UPDATE admin_roles SET permissions_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(JSON.stringify([...new Set(permissions)]),id);db.prepare(`UPDATE admin_users SET token_version=token_version+1 WHERE role_id=?`).run(id);audit(req,'system','update_role_permissions','admin_role',id,json(role.permissions_json,[]),permissions);res.json({success:true});});

router.get('/operation-logs',requirePermission('logs.view'),(req:AdminRequest,res)=>{const {page,pageSize,offset}=paging(req);const rows=getDb().prepare(`SELECT * FROM admin_operation_logs ORDER BY id DESC LIMIT ? OFFSET ?`).all(pageSize,offset);const total=(getDb().prepare('SELECT COUNT(*) c FROM admin_operation_logs').get() as any).c;res.json({items:rows,total,page,pageSize});});

function normalizeAttraction(input:any){const categoryIds=Array.isArray(input.categoryIds)?input.categoryIds.map(Number).filter(Number.isInteger):[];return{name:String(input.name||'').trim(),aliases:String(input.aliases||input.alias||'').trim(),provinceId:Number(input.provinceId||input.province_id),cityId:Number(input.cityId||input.city_id),level:String(input.level||'').toUpperCase(),categoryIds,address:String(input.address||'').trim(),description:String(input.description||'').trim(),coverUrl:String(input.coverUrl||input.cover_url||'').trim(),pinyin:String(input.pinyin||'').trim().toLowerCase()};}
function validateAttraction(p:any){if(!p.name)return'景区名称不能为空';if(!Number.isInteger(p.provinceId)||!Number.isInteger(p.cityId))return'省份和城市不能为空';const city=getDb().prepare('SELECT 1 FROM cities WHERE id=? AND province_id=?').get(p.cityId,p.provinceId);if(!city)return'城市不属于所选省份';if(!['4A','5A'].includes(p.level))return'景区等级必须为 4A 或 5A';if(!p.categoryIds.length)return'至少选择一个分类';const valid=(getDb().prepare(`SELECT COUNT(*) c FROM categories WHERE id IN (${p.categoryIds.map(()=>'?').join(',')}) AND status='active'`).get(...p.categoryIds) as any).c;if(valid!==p.categoryIds.length)return'存在无效或停用分类';return'';}
function findDuplicates(p:any,excludeId?:number){return getDb().prepare(`SELECT id,name,province_id AS provinceId,city_id AS cityId FROM attractions WHERE province_id=? AND city_id=? AND (name=? OR name LIKE ?) ${excludeId?'AND id<>?':''} LIMIT 10`).all(p.provinceId,p.cityId,p.name,`%${p.name}%`,...(excludeId?[excludeId]:[]));}
function insertAttraction(p:any,adminId:number){const db=getDb();const result=db.prepare(`INSERT INTO attractions (name,province_id,city_id,is_5a,is_4a,level,category_id,pinyin,created_by,status,admin_status,aliases,address,description,cover_url,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,'approved','approved',?,?,?,?,CURRENT_TIMESTAMP,?)`).run(p.name,p.provinceId,p.cityId,p.level==='5A'?1:0,p.level==='4A'?1:0,p.level,p.categoryIds[0],p.pinyin,adminId,p.aliases,p.address,p.description,p.coverUrl,adminId);const id=Number(result.lastInsertRowid);syncTags(id,p.categoryIds);return id;}
function updateAttraction(id:number,p:any,adminId:number){getDb().prepare(`UPDATE attractions SET name=?,province_id=?,city_id=?,is_5a=?,is_4a=?,level=?,category_id=?,pinyin=?,aliases=?,address=?,description=?,cover_url=?,status='approved',admin_status='approved',updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=?`).run(p.name,p.provinceId,p.cityId,p.level==='5A'?1:0,p.level==='4A'?1:0,p.level,p.categoryIds[0],p.pinyin,p.aliases,p.address,p.description,p.coverUrl,adminId,id);syncTags(id,p.categoryIds);}
function syncTags(id:number,categoryIds:number[]){const db=getDb();db.prepare('DELETE FROM attraction_tags WHERE attraction_id=?').run(id);const insert=db.prepare('INSERT INTO attraction_tags (attraction_id,category_id) VALUES (?,?)');categoryIds.forEach(x=>insert.run(id,x));}

export default router;
