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
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import categoryRoutes from './routes/categories.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/provinces', provinceRoutes);
app.use('/api/attractions', attractionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// 生产环境：提供前端静态文件
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

initDb();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
