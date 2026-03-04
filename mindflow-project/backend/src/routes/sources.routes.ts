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

    // 将 tags 和 viewpoints 从 JSON 字符串解析为数组
    const parsedSources = sources.map((source: any) => ({
      ...source,
      tags: source.tags ? JSON.parse(source.tags) : [],
      viewpoints: source.viewpoints ? JSON.parse(source.viewpoints) : [],
    }));

    res.json({
      items: parsedSources,
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
    logger.info(`[API] 获取素材详情: id=${id}`);

    const source = await prisma.source.findUnique({
      where: { id },
    });

    if (!source) {
      logger.warn(`[API] 素材不存在: id=${id}`);
      return res.status(404).json({ error: '素材不存在' });
    }

    logger.info(`[API] 找到素材: id=${id}, aiStatus=${source.aiStatus}, wikiToken=${source.feishuWikiToken}`);

    // 如果 AI 状态是 pending 或 failed，触发异步 AI 处理
    if ((source.aiStatus === 'pending' || source.aiStatus === 'failed') && source.feishuWikiToken) {
      logger.info(`[API] 素材 ${id} AI 状态为 ${source.aiStatus}，触发异步处理`);
      // 异步触发，不等待结果
      import('../services/ai.processor').then(({ processSourceAI }) => {
        logger.info(`[API] 开始调用 processSourceAI: id=${id}`);
        processSourceAI(id, source.feishuWikiToken!).catch(error => {
          logger.error(`[API] 异步 AI 处理失败: ${id}`, error);
        });
      }).catch(error => {
        logger.error(`[API] 导入 ai.processor 失败: ${id}`, error);
      });
    } else {
      logger.info(`[API] 素材 ${id} 不需要 AI 处理: aiStatus=${source.aiStatus}, hasWikiToken=${!!source.feishuWikiToken}`);
    }

    // 将 tags 和 viewpoints 从 JSON 字符串解析为数组
    const parsedSource = {
      ...source,
      tags: source.tags ? JSON.parse(source.tags) : [],
      viewpoints: source.viewpoints ? JSON.parse(source.viewpoints) : [],
    };

    res.json(parsedSource);
  } catch (error) {
    logger.error('[API] 获取素材详情失败', error);
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

// 手动触发同步 - 从飞书知识库同步到本地
router.post('/sync', async (req, res) => {
  try {
    // 检查飞书配置是否完整
    const feishuAppId = process.env.FEISHU_APP_ID;
    const feishuAppSecret = process.env.FEISHU_APP_SECRET;

    if (!feishuAppId || !feishuAppSecret) {
      logger.warn('飞书配置不完整，返回模拟同步结果');
      return res.json({
        success: true,
        count: 0,
        message: '飞书未配置，返回模拟同步结果',
        items: [],
      });
    }

    // 获取用户ID
    const userId = req.headers['x-user-id'] as string || 'test_user_123';

    // 调用新的从飞书同步方法，传入 userId
    const result = await sourceSync.syncFromFeishu(userId);
    res.json({
      success: true,
      count: result.count,
      items: result.items,
      message: result.error || `成功同步 ${result.count} 个素材`,
    });
  } catch (error: any) {
    logger.error('同步素材失败', error);
    res.json({
      success: false,
      count: 0,
      items: [],
      error: error.message || '同步失败',
      message: '同步失败，请检查飞书配置',
    });
  }
});

export default router;
