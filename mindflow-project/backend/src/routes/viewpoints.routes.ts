import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { viewpointSync } from '../services/sync.viewpoints';
import { logger } from '../utils/logger';

const router: Router = Router();

// 获取观点列表
router.get('/', async (req, res) => {
  try {
    const { page = '1', pageSize = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const [viewpoints, total] = await Promise.all([
      prisma.viewpoint.findMany({
        skip,
        take: parseInt(pageSize as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.viewpoint.count(),
    ]);

    res.json({
      items: viewpoints,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      hasMore: skip + viewpoints.length < total,
    });
  } catch (error) {
    logger.error('获取观点列表失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 手动触发同步
router.post('/sync', async (req, res) => {
  try {
    const result = await viewpointSync.sync();
    res.json(result);
  } catch (error) {
    logger.error('同步观点失败', error);
    res.status(500).json({ error: '同步失败' });
  }
});

export default router;
