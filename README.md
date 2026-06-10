# 旅行足迹地图系统 🌍

> 用足迹丈量中国 —— 基于 PRD V1.1 的全栈 MVP 实现

## 项目简介

一个聚焦中国境内的旅行记录系统，核心以**中国地图点亮**为载体，通过标记 4A/5A 级景区帮助用户可视化旅行成就，激发探索欲望。

## 功能特性

### 地图展示与统计
- 🗺️ **交互式中国地图** — 基于 ECharts + GeoJSON 渲染 34 个省级行政区
- ✨ **省份点亮** — 一个省份内只要有一个景区被点亮，该省在地图上显示为绿色
- 📊 **实时统计** — 已点亮省份数、已点亮景区数、点亮率

### 省份景区浏览与点亮
- 🏔️ **景区列表** — 按 5A/4A 分组展示，组内按名称排序
- 🔍 **搜索与筛选** — 支持景区名称模糊搜索、分类筛选、等级筛选
- ✅ **批量点亮** — 多选景区后一键确认点亮

### 用户系统
- 👤 **注册/登录** — 用户名+密码，数据与账号绑定
- 🔒 **登录态保持** — JWT Token 本地存储

### 成就与进度系统
- 📈 **省份点亮进度** — 环形图按地理大区展示
- 🏷️ **分类点亮进度** — 横向进度条展示各分类完成情况
- 🏅 **成就墙** — 省份探索线(5级) + 景区达人线(10级) + 特殊彩蛋成就(8个)

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite + ECharts + React Router |
| 后端 | Node.js + Express 5 + TypeScript + better-sqlite3 |
| 地图 | 阿里云 DataV GeoJSON |

## 项目结构

```
.
├── client/                 # 前端 React SPA
│   ├── src/
│   │   ├── api/client.ts   # API 请求封装
│   │   ├── context/        # 认证上下文
│   │   ├── components/     # 公共组件
│   │   ├── pages/          # 页面（地图首页、省份详情、个人中心）
│   │   └── App.tsx         # 路由配置
│   └── dist/               # 构建输出
├── server/                 # 后端 API
│   ├── src/
│   │   ├── db.ts           # SQLite 数据库
│   │   ├── routes/         # API 路由
│   │   ├── utils/          # 成就计算
│   │   └── seed.ts         # 数据初始化
│   └── data/
│       ├── database.sqlite # 数据库文件
│       └── attractions.json # 景区种子数据
└── README.md
```

## 快速开始

### 1. 启动后端

```bash
cd server
npm install
npx tsx src/seed.ts    # 初始化数据（仅需执行一次）
npx tsx src/index.ts   # 启动服务（默认 3001 端口）
```

### 2. 启动前端（开发模式）

```bash
cd client
npm install
npm run dev            # 默认 5173 端口，已配置代理到后端
```

### 3. 生产部署

```bash
cd client && npm run build    # 构建前端到 client/dist
cd server && npx tsx src/index.ts   # 后端会自动 serve client/dist
```

## 默认数据

- **省份**: 34 个省级行政区（含港澳台）
- **景区**: 141 个 4A/5A 级景区（覆盖全部省份）
- **分类**: 10 个预置分类（山岳、湖泊、森林公园等）
- **成就**: 23 个成就徽章

## 后续规划

- [ ] 景区数据批量导入（Excel/CSV）
- [ ] 后台管理端（分类 CRUD、景区维护）
- [ ] 成就分享卡片生成
- [ ] 排行榜（预留接口）
- [ ] 扩展至全球地图
