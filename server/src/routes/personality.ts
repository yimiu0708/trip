import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  buildPersonalityDescription,
  buildPersonalityTips,
  getDimensionLabels,
  getPersonalityDefinition,
} from '../utils/personalityCatalog.js';

const router = Router();
router.use(authMiddleware);

const QUESTION_DIMENSIONS: Record<string, readonly [string, string]> = {
  q1: ['J', 'P'], q2: ['J', 'P'], q3: ['J', 'P'],
  q4: ['F', 'L'], q5: ['F', 'L'], q6: ['F', 'L'],
  q7: ['N', 'C'], q8: ['N', 'C'], q9: ['N', 'C'],
  q10: ['S', 'A'], q11: ['S', 'A'], q12: ['S', 'A'],
};

interface AnswerInput { questionId?: string; value?: string }

router.get('/mine', (req: AuthRequest, res) => {
  const row = getPersonalityRow(req.user!.id);
  res.json(row ? serializeResult(row) : { hasResult: false });
});

router.post('/submit', (req: AuthRequest, res) => {
  const answers = Array.isArray(req.body?.answers) ? req.body.answers as AnswerInput[] : [];
  const normalized = validateAnswers(answers);
  if (!normalized) {
    res.status(400).json({ error: '请完成全部 12 道题后再提交' });
    return;
  }

  const counts: Record<string, number> = { J: 0, P: 0, F: 0, L: 0, N: 0, C: 0, S: 0, A: 0 };
  normalized.forEach((answer) => { counts[answer.value] += 1; });
  const code = `${counts.J > counts.P ? 'J' : 'P'}${counts.F > counts.L ? 'F' : 'L'}${counts.N > counts.C ? 'N' : 'C'}${counts.S > counts.A ? 'S' : 'A'}`;
  const definition = getPersonalityDefinition(code)!;
  const db = getDb();
  const userId = req.user!.id;
  const existing = getPersonalityRow(userId);

  db.prepare(`
    INSERT INTO travel_personality_results (
      user_id, type_code, type_name, dimension_decision, dimension_pace,
      dimension_interest, dimension_social, answers_json, retest_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      type_code = excluded.type_code,
      type_name = excluded.type_name,
      dimension_decision = excluded.dimension_decision,
      dimension_pace = excluded.dimension_pace,
      dimension_interest = excluded.dimension_interest,
      dimension_social = excluded.dimension_social,
      answers_json = excluded.answers_json,
      retest_count = travel_personality_results.retest_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, code, definition.name, code[0], code[1], code[2], code[3], JSON.stringify(normalized));

  const achievementIds = [120, code.includes('N') ? 123 : 124, code.includes('A') ? 125 : 126];
  if (existing) achievementIds.push(122);
  const newAchievements = unlockAchievements(userId, achievementIds);
  res.json({ success: true, result: serializeResult(getPersonalityRow(userId)!), newAchievements });
});

router.get('/share-card', (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const row = getPersonalityRow(userId);
  if (!row) {
    res.status(404).json({ error: '请先完成旅行人格测试' });
    return;
  }
  const db = getDb();
  db.prepare(`UPDATE travel_personality_results SET share_count = share_count + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(userId);
  const newAchievements = unlockAchievements(userId, [121]);
  const updatedRow = getPersonalityRow(userId)!;
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT a.province_id) AS litProvinces,
      COUNT(DISTINCT a.city_id) AS litCities,
      COUNT(DISTINCT ua.attraction_id) AS litAttractions
    FROM user_attractions ua
    JOIN attractions a ON a.id = ua.attraction_id AND a.status = 'approved'
    WHERE ua.user_id = ?
  `).get(userId);
  res.json({ ...serializeResult(updatedRow), stats, newAchievements });
});

interface PersonalityRow {
  type_code: string; type_name: string; created_at: string; updated_at: string;
  retest_count: number; share_count: number;
}

function getPersonalityRow(userId: number) {
  return getDb().prepare(`SELECT * FROM travel_personality_results WHERE user_id = ?`).get(userId) as PersonalityRow | undefined;
}

function serializeResult(row: PersonalityRow) {
  const definition = getPersonalityDefinition(row.type_code)!;
  return {
    hasResult: true,
    typeCode: row.type_code,
    typeName: definition.name,
    summary: definition.summary,
    dimensions: {
      decision: row.type_code[0], pace: row.type_code[1], interest: row.type_code[2], social: row.type_code[3],
    },
    dimensionLabels: getDimensionLabels(row.type_code),
    description: buildPersonalityDescription(row.type_code),
    travelTips: buildPersonalityTips(row.type_code),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retestCount: row.retest_count,
    shareCount: row.share_count,
  };
}

function validateAnswers(answers: AnswerInput[]) {
  if (answers.length !== 12) return null;
  const picked = new Map<string, string>();
  for (const answer of answers) {
    const questionId = String(answer.questionId || '').toLowerCase();
    const value = String(answer.value || '').toUpperCase();
    const allowed = QUESTION_DIMENSIONS[questionId];
    if (!allowed?.includes(value) || picked.has(questionId)) return null;
    picked.set(questionId, value);
  }
  if (Object.keys(QUESTION_DIMENSIONS).some((id) => !picked.has(id))) return null;
  return Object.keys(QUESTION_DIMENSIONS).map((questionId) => ({ questionId, value: picked.get(questionId)! }));
}

function unlockAchievements(userId: number, achievementIds: number[]) {
  const db = getDb();
  const uniqueIds = [...new Set(achievementIds)];
  const unlocked = new Set((db.prepare(`SELECT achievement_id FROM user_achievements WHERE user_id = ?`).all(userId) as { achievement_id: number }[]).map((row) => row.achievement_id));
  const insert = db.prepare(`INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)`);
  const result: { id: number; name: string }[] = [];
  uniqueIds.forEach((id) => {
    if (unlocked.has(id)) return;
    const achievement = db.prepare(`SELECT id, name FROM achievements WHERE id = ?`).get(id) as { id: number; name: string } | undefined;
    if (!achievement) return;
    insert.run(userId, id);
    result.push(achievement);
  });
  return result;
}

export default router;
