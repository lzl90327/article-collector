/**
 * 文章管理路由
 * Phase 3: 编辑器保存与同步
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { syncArticleToFeishu } from '../services/feishu.wiki';

const router: Router = Router();
const prisma = new PrismaClient();

// 保存文章（创建或更新）
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { id, title, content, status = 'draft', phase = '3' } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    let article;

    if (id) {
      // 更新现有文章
      article = await prisma.article.update({
        where: { id, userId },
        data: {
          title,
          content,
          status,
          phase,
          updatedAt: new Date(),
        },
      });
    } else {
      // 创建新文章
      article = await prisma.article.create({
        data: {
          title,
          content,
          status,
          phase,
          userId,
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: article.id,
        title: article.title,
        content: article.content,
        status: article.status,
        phase: article.phase,
        updatedAt: article.updatedAt,
      },
    });
  } catch (error) {
    console.error('Save article error:', error);
    res.status(500).json({ error: 'Failed to save article' });
  }
});

// 获取文章列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { status, page = '1', pageSize = '20' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = parseInt(pageSize as string);

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          phase: true,
          feishuWikiToken: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.article.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: articles,
        total,
        page: parseInt(page as string),
        pageSize: take,
        hasMore: skip + articles.length < total,
      },
    });
  } catch (error) {
    console.error('List articles error:', error);
    res.status(500).json({ error: 'Failed to list articles' });
  }
});

// 获取文章详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const article = await prisma.article.findFirst({
      where: { id, userId },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

// 同步文章到 Feishu
router.post('/:id/sync-feishu', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const article = await prisma.article.findFirst({
      where: { id, userId },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // 同步到 Feishu 知识库
    const result = await syncArticleToFeishu({
      title: article.title,
      content: article.content || '',
      wikiToken: article.feishuWikiToken || undefined,
    });

    // 更新文章的 Feishu token
    if (result.wikiToken && !article.feishuWikiToken) {
      await prisma.article.update({
        where: { id },
        data: { feishuWikiToken: result.wikiToken },
      });
    }

    res.json({
      success: true,
      data: {
        wikiToken: result.wikiToken,
        url: result.url,
      },
    });
  } catch (error) {
    console.error('Sync to Feishu error:', error);
    res.status(500).json({ error: 'Failed to sync to Feishu' });
  }
});

export default router;
