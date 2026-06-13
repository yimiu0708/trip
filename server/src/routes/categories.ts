import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const categories = db
    .prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order, id')
    .all();
  res.json(categories);
});

export default router;
