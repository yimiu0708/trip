import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import provinceRoutes from './routes/provinces.js';
import attractionRoutes from './routes/attractions.js';
import achievementRoutes from './routes/achievements.js';
import categoryRoutes from './routes/categories.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import recallRoutes from './routes/recall.js';
import personalityRoutes from './routes/personality.js';
import favoriteRoutes from './routes/favorites.js';
import recommendationRoutes from './routes/recommendations.js';
import adminAuthRoutes from './routes/adminAuth.js';
import eventRoutes from './routes/events.js';
import { initAdminPlatform } from './adminPlatform.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin is not allowed'));
  },
}));
app.use(express.json());

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/provinces', provinceRoutes);
app.use('/api/attractions', attractionRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/recall', recallRoutes);
app.use('/api/personality', personalityRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/recommendations', recommendationRoutes);

// 生产环境：提供前端静态文件
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

initDb();
initAdminPlatform();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
