/**
 * 发布后复盘 API 路由
 * Phase 6: Post-publish Retro Routes
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import {
  createRetroCard,
  getRetroCard,
  getRetroHistory,
  updateRetroCard,
  deleteRetroCard,
  analyzeObjections,
  generateNextHypothesis,
  formatRetroCardMarkdown,
  RetroCard,
} from '../services/retro.service';

const router = Router();

/**
 * POST /api/retro
 * 创建复盘卡片
 */
router.post('/', async (req, res) => {
  try {
    const {
      articleId,
      articleTitle,
      publishDate,
      metrics,
      top3Objections,
      keepItems,
      changeItems,
      nextHypothesis,
    } = req.body;

    if (!articleId || !articleTitle || !publishDate || !metrics) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：articleId, articleTitle, publishDate, metrics',
      });
    }

    const card = await createRetroCard({
      articleId,
      articleTitle,
      publishDate,
      metrics,
      top3Objections,
      keepItems,
      changeItems,
      nextHypothesis,
    });

    res.json({
      success: true,
      data: card,
    });
  } catch (error: any) {
    logger.error('Create retro card API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '创建复盘卡片失败',
    });
  }
});

/**
 * GET /api/retro/:articleId
 * 获取复盘卡片
 */
router.get('/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;

    const card = await getRetroCard(articleId);

    if (!card) {
      return res.status(404).json({
        success: false,
        error: '复盘卡片不存在',
      });
    }

    res.json({
      success: true,
      data: card,
    });
  } catch (error: any) {
    logger.error('Get retro card API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取复盘卡片失败',
    });
  }
});

/**
 * GET /api/retro
 * 获取复盘历史列表
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await getRetroHistory(limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    logger.error('Get retro history API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取复盘历史失败',
    });
  }
});

/**
 * PUT /api/retro/:articleId
 * 更新复盘卡片
 */
router.put('/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    const updateData = req.body;

    const card = await updateRetroCard(articleId, updateData);

    if (!card) {
      return res.status(404).json({
        success: false,
        error: '复盘卡片不存在',
      });
    }

    res.json({
      success: true,
      data: card,
    });
  } catch (error: any) {
    logger.error('Update retro card API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '更新复盘卡片失败',
    });
  }
});

/**
 * DELETE /api/retro/:articleId
 * 删除复盘卡片
 */
router.delete('/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;

    const success = await deleteRetroCard(articleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '复盘卡片不存在',
      });
    }

    res.json({
      success: true,
      message: '复盘卡片已删除',
    });
  } catch (error: any) {
    logger.error('Delete retro card API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '删除复盘卡片失败',
    });
  }
});

/**
 * POST /api/retro/analyze-objections
 * 分析反对意见
 */
router.post('/analyze-objections', async (req, res) => {
  try {
    const { comments, articleContent } = req.body;

    if (!Array.isArray(comments) || !articleContent) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：comments, articleContent',
      });
    }

    const objections = await analyzeObjections(comments, articleContent);

    res.json({
      success: true,
      data: objections,
    });
  } catch (error: any) {
    logger.error('Analyze objections API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '分析反对意见失败',
    });
  }
});

/**
 * POST /api/retro/generate-hypothesis
 * 生成下一篇假设
 */
router.post('/generate-hypothesis', async (req, res) => {
  try {
    const { retroCard } = req.body;

    if (!retroCard) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：retroCard',
      });
    }

    const hypothesis = await generateNextHypothesis(retroCard as RetroCard);

    res.json({
      success: true,
      data: { hypothesis },
    });
  } catch (error: any) {
    logger.error('Generate hypothesis API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成假设失败',
    });
  }
});

/**
 * GET /api/retro/:articleId/markdown
 * 获取复盘卡片 Markdown 格式
 */
router.get('/:articleId/markdown', async (req, res) => {
  try {
    const { articleId } = req.params;

    const card = await getRetroCard(articleId);

    if (!card) {
      return res.status(404).json({
        success: false,
        error: '复盘卡片不存在',
      });
    }

    const markdown = formatRetroCardMarkdown(card);

    res.setHeader('Content-Type', 'text/markdown');
    res.send(markdown);
  } catch (error: any) {
    logger.error('Get retro markdown API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取 Markdown 失败',
    });
  }
});

export default router;
