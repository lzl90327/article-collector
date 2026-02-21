import { Router } from 'express';
import authRoutes from './auth.routes';
import sourceRoutes from './sources.routes';
import articleRoutes from './articles.routes';
import ideaRoutes from './ideas.routes';
import viewpointRoutes from './viewpoints.routes';
import syncRoutes from './sync.routes';
import skillRoutes from './skill.routes';
import reviewRoutes from './review.routes';

const router = Router();

// 认证相关
router.use('/auth', authRoutes);

// 素材管理
router.use('/sources', sourceRoutes);

// 文章管理
router.use('/articles', articleRoutes);

// 想法记录
router.use('/ideas', ideaRoutes);

// 观点库
router.use('/viewpoints', viewpointRoutes);

// 同步状态
router.use('/sync', syncRoutes);

// Skill 配置
router.use('/skill', skillRoutes);

// 审阅相关
router.use('/review', reviewRoutes);

export default router;
