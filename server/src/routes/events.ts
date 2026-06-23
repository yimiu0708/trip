import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { optionalAuthMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const ALLOWED = new Set([
  'app_session_start', 'lighting_submit', 'favorite_add', 'favorite_remove',
  'share_poster_generate', 'personality_test_submit', 'achievement_unlock',
  'recall_intro_view', 'recall_intro_start_click', 'recall_intro_skip_click',
  'recall_city_view', 'recall_city_exit_click', 'recall_city_select', 'recall_city_next_click',
  'recall_attraction_select', 'recall_confirm_modal_view', 'recall_time_precision_select',
  'recall_submit_success', 'recall_result_view', 'recall_continue_click', 'recall_view_map_click',
  'achievement_celebration_view', 'achievement_celebration_close',
  'achievement_celebration_continue', 'achievement_celebration_view_wall',
]);

router.post('/track', optionalAuthMiddleware, (req: AuthRequest, res) => {
  const eventName=String(req.body?.eventName||'');
  if(!ALLOWED.has(eventName))return res.status(400).json({error:'事件名称不在允许列表'});
  const properties=req.body?.properties && typeof req.body.properties==='object'?req.body.properties:{};
  const serialized=JSON.stringify(properties);
  if(serialized.length>8192)return res.status(400).json({error:'事件属性过大'});
  const eventId=String(req.body?.eventId||crypto.randomUUID()).slice(0,100);
  try{
    getDb().prepare(`INSERT INTO user_events (event_id,user_id,anonymous_id,event_name,event_category,page,source,action,session_id,properties_json,client_type,app_version,os,event_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      eventId,req.user?.id||null,String(req.body?.anonymousId||'').slice(0,100)||null,eventName,String(req.body?.eventCategory||'').slice(0,60)||null,String(req.body?.page||'').slice(0,120)||null,String(req.body?.source||'').slice(0,80)||null,String(req.body?.action||'').slice(0,80)||null,String(req.body?.sessionId||'').slice(0,100)||null,serialized,String(req.body?.clientType||'app').slice(0,20),String(req.body?.appVersion||'').slice(0,30)||null,String(req.body?.os||'').slice(0,30)||null,req.body?.eventTime||new Date().toISOString());
  }catch(error:any){if(String(error.message).includes('UNIQUE'))return res.json({success:true,deduplicated:true});throw error;}
  res.status(201).json({success:true,eventId});
});

export default router;
