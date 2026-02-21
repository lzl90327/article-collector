import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sourceSync } from '../services/sync.sources';
import { logger } from '../utils/logger';

const router: Router = Router();

// 获取素材列表
router.get('/', async (req, res) => {
  try {
    const { type, page = '1', pageSize = '20' } = req.query;

    const where: any = {};
    if (type) where.type = type;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const [sources, total] = await Promise.all([
      prisma.source.findMany({
        where,
        skip,
        take: parseInt(pageSize as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.source.count({ where }),
    ]);

    res.json({
      items: sources,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      hasMore: skip + sources.length < total,
    });
  } catch (error) {
    logger.error('获取素材列表失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取素材详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const source = await prisma.source.findUnique({
      where: { id },
    });

    if (!source) {
      return res.status(404).json({ error: '素材不存在' });
    }

    res.json(source);
  } catch (error) {
    logger.error('获取素材详情失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 添加素材（从小程序）
router.post('/', async (req, res) => {
  try {
    const { title, url, type, tags, summary } = req.body;

    // 这里可以调用飞书 API 直接添加到多维表格
    // 暂时先保存到本地数据库
    const source = await prisma.source.create({
      data: {
        title,
        url,
        type,
        tags,
        summary,
      },
    });

    res.json(source);
  } catch (error) {
    logger.error('添加素材失败', error);
    res.status(500).json({ error: '添加失败' });
  }
});

// 手动触发同步
router.post('/sync', async (req, res) => {
  try {
    const result = await sourceSync.sync();
    res.json(result);
  } catch (error) {
    logger.error('同步素材失败', error);
    res.status(500).json({ error: '同步失败' });
  }
});

export default router;
