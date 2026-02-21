import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router: Router = Router();

// 获取同步状态
router.get('/status', async (req, res) => {
  try {
    const records = await prisma.syncRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 按类型分组，取最新的
    const status: Record<string, any> = {};
    for (const record of records) {
      if (!status[record.type]) {
        status[record.type] = {
          lastSyncAt: record.lastSyncAt,
          recordCount: record.recordCount,
          status: record.status,
          error: record.error,
        };
      }
    }

    res.json(status);
  } catch (error) {
    logger.error('获取同步状态失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

export default router;
