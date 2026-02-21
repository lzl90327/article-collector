/**
 * 简化版服务器 - 无数据库依赖
 * 用于测试阶段
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './utils/logger';

const app: Application = express();

app.use(cors());
app.use(express.json());

// 内存存储
export const memoryStore = {
  users: new Map(),
  articles: new Map(),
  sources: new Map(),
  ideas: new Map(),
  tasks: new Map(),
};

// 健康检查
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 导入简化版路由
import authSimpleRoutes from './routes/auth.simple';
import collectRoutes from './routes/collect.routes';

// 公开路由
app.use('/api/auth', authSimpleRoutes);
app.use('/api/collect', collectRoutes);

// 测试路由 - 获取内存数据
app.get('/api/debug/store', (req: Request, res: Response) => {
  res.json({
    users: Array.from(memoryStore.users.entries()),
    articles: Array.from(memoryStore.articles.entries()),
    sources: Array.from(memoryStore.sources.entries()),
  });
});

// 错误处理中间件
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 MindFlow Backend Server running on port ${PORT}`);
  logger.info('✅ 简化版服务器已启动（无数据库依赖）');
});

export default app;
