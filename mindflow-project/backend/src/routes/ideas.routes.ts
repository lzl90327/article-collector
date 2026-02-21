import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { feishuBitable } from '../services/feishu.bitable';
import { feishuConfig } from '../config/feishu';
import { logger } from '../utils/logger';

const router: Router = Router();

// 获取想法列表
router.get('/', async (req, res) => {
  try {
    const { userId } = req.user as any;
    const { page = '1', pageSize = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const [ideas, total] = await Promise.all([
      prisma.idea.findMany({
        where: { userId },
        skip,
        take: parseInt(pageSize as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.idea.count({ where: { userId } }),
    ]);

    res.json({
      items: ideas,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      hasMore: skip + ideas.length < total,
    });
  } catch (error) {
    logger.error('获取想法列表失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 创建想法
router.post('/', async (req, res) => {
  try {
    const { userId } = req.user as any;
    const { content, type, audioUrl } = req.body;

    // 先保存到本地
    const idea = await prisma.idea.create({
      data: {
        content,
        type,
        audioUrl,
        userId,
        synced: false,
      },
    });

    // 尝试同步到飞书
    try {
      await feishuBitable.createRecord(
        feishuConfig.bitable.ideasToken,
        'tblLpXgnhfxuaJYh',
        {
          '想法': content,
          '类型': type,
          '用户ID': userId,
          '创建时间': new Date().toISOString(),
        }
      );

      // 更新同步状态
      await prisma.idea.update({
        where: { id: idea.id },
        data: { synced: true },
      });
    } catch (syncError) {
      logger.error('同步想法到飞书失败', syncError);
      // 不影响返回，稍后由定时任务重试
    }

    res.json(idea);
  } catch (error) {
    logger.error('创建想法失败', error);
    res.status(500).json({ error: '创建失败' });
  }
});

export default router;
