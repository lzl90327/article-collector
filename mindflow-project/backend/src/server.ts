import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { AppError } from './utils/errors';
import mindflowRoutes from './api/routes/mindflow';
import jobsRoutes from './routes/jobs.routes';
import sessionsRoutes from './routes/sessions.routes';
import artifactsRoutes from './routes/artifacts.routes';
import integrationsRoutes from './routes/integrations.routes';
import settingsRoutes from './routes/settings.routes';
import materialsRoutes from './routes/materials.routes';
import researchRoutes from './routes/research.routes';
import breakthroughRoutes from './routes/breakthrough.routes';
import cyberEditorialRoutes from './routes/cyber-editorial.routes';
import imagesRoutes from './routes/images.routes';
import weeklyDigestRoutes from './routes/weekly-digest.routes';
import retroRoutes from './routes/retro.routes';
import socraticRoutes from './routes/socratic.routes';
import sourcesRoutes from './routes/sources.routes';

// 新路由导入
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import authRoutes from './routes/auth.routes';
import feishuAuthRoutes from './routes/feishu.auth.routes';
import wikiRoutes from './routes/wiki.routes';
import newSourceRoutes from './routes/sources.routes';
import articleRoutes from './routes/articles.routes';
import ideaRoutes from './routes/ideas.routes';
import viewpointRoutes from './routes/viewpoints.routes';
import syncRoutes from './routes/sync.routes';
import skillRoutes from './routes/skill.routes';

// 定时任务调度器
import { scheduler } from './services/scheduler';

const app: Application = express();

app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 现有路由
app.use('/api/mindflow', mindflowRoutes);

// Phase1 新增路由
app.use('/api/jobs', jobsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/artifacts', artifactsRoutes);

// Phase2 新增路由
app.use('/api/integrations', integrationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/breakthrough', breakthroughRoutes);
app.use('/api/cyber-editorial', cyberEditorialRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/weekly-digest', weeklyDigestRoutes);
app.use('/api/retro', retroRoutes);
app.use('/api/socratic', socraticRoutes);
app.use('/api/sources', sourcesRoutes);

// 新 API 路由（Phase 1 基础设施）
// 公开路由（不需要认证）
app.use('/api/auth', authRoutes);
app.use('/api/auth/feishu', feishuAuthRoutes);

// 需要认证的路由（暂时移除认证，方便功能测试）
// TODO: 功能测试完成后恢复认证
// app.use('/api/v1/sources', authMiddleware, newSourceRoutes);
// app.use('/api/articles', authMiddleware, articleRoutes);
// app.use('/api/ideas', authMiddleware, ideaRoutes);
// app.use('/api/viewpoints', authMiddleware, viewpointRoutes);
// app.use('/api/sync', authMiddleware, syncRoutes);
// app.use('/api/skill', authMiddleware, skillRoutes);

// 临时：无需认证的路由
app.use('/api/v1/sources', newSourceRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/viewpoints', viewpointRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/skill', skillRoutes);
app.use('/api/wiki', wikiRoutes);

// 错误处理中间件
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    // 使用错误消息作为 code（更具可读性），同时保留错误码
    const errorCode = err.message || err.code;
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: err.userMessage,
        retryable: err.retryable,
        details: err.details,
      },
    });
  } else {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal Server Error',
        retryable: true,
      },
    });
  }
});

const PORT = process.env.PORT || 3001;

// 仅在非测试环境或明确启动时监听端口
if (process.env.NODE_ENV !== 'test' || process.env.START_SERVER === 'true') {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 MindFlow Backend Server running on port ${PORT}`);
    logger.info('📡 Phase1 API 已启用: /api/jobs, /api/sessions, /api/artifacts');
    logger.info('🔗 Phase2 API 已启用: /api/integrations');
    logger.info('📊 Phase 0.8 API 已启用: /api/weekly-digest (周度认知简报)');
    logger.info('📝 Phase 6 API 已启用: /api/retro (发布后复盘)');
    logger.info('❓ Phase 1.2 API 已启用: /api/socratic (苏格拉底式提问)');
    logger.info('🔐 新 API 已启用: /api/auth, /api/articles, /api/ideas, /api/viewpoints');
    
    // 启动定时任务调度器
    scheduler.start();
    logger.info('⏰ 定时任务调度器已启动');
  });
  
  // 优雅关闭
  process.on('SIGINT', () => {
    logger.info('正在关闭服务...');
    scheduler.stop();
    process.exit(0);
  });
}

export default app;
