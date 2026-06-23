import { Router } from 'express';
import { optionalAuthMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getNextTripRecommendations } from '../utils/nextTripRecommendations.js';

const router = Router();

router.get('/next-trip', optionalAuthMiddleware, (req: AuthRequest, res) => {
  const source = ['home', 'completion', 'favorites', 'achievement'].includes(String(req.query.source))
    ? String(req.query.source)
    : 'home';
  const requestedLimit = Number(req.query.limit || (source === 'home' ? 2 : 3));
  const limit = Math.max(1, Math.min(3, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 2));
  const cityIds = String(req.query.cityIds || '').split(',').map(Number).filter(Number.isInteger);
  res.json({ items: getNextTripRecommendations(req.user?.id, source, limit, cityIds) });
});

export default router;
