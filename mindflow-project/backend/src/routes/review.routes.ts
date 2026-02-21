/**
 * 赛博编辑部审阅路由
 * Phase 4.5: 7 智能体审阅流程
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router: Router = Router();
const prisma = new PrismaClient();

// 审阅状态
enum ReviewStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 提交审阅
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { articleId, content, title } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!articleId || !content) {
      return res.status(400).json({ error: 'Article ID and content are required' });
    }

    // 检查文章是否存在
    const article = await prisma.article.findFirst({
      where: { id: articleId, userId },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // 创建审阅记录
    const review = await prisma.reviewReport.create({
      data: {
        articleId,
        userId,
        status: ReviewStatus.PROCESSING,
        content,
        title,
        // 初始化 7 个智能体的审阅结果
        agentReviews: {
          create: [
            { agentName: 'logicJudge', model: 'deepseek-reasoner', status: 'pending' },
            { agentName: 'emotionDetector', model: 'gpt-4', status: 'pending' },
            { agentName: 'subjectivity', model: 'claude-3', status: 'pending' },
            { agentName: 'structure', model: 'gpt-4', status: 'pending' },
            { agentName: 'style', model: 'claude-3', status: 'pending' },
            { agentName: 'factCheck', model: 'deepseek-chat', status: 'pending' },
            { agentName: 'audience', model: 'gpt-4', status: 'pending' },
          ],
        },
      },
      include: {
        agentReviews: true,
      },
    });

    // TODO: 触发 Coze Skill 进行审阅
    // 这里应该调用 Coze API 或发送到消息队列

    res.json({
      success: true,
      data: {
        reviewId: review.id,
        status: review.status,
        message: '审阅已提交，正在处理中...',
      },
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// 获取审阅报告
router.get('/report/:articleId', authenticateToken, async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 获取最新的审阅报告
    const review = await prisma.reviewReport.findFirst({
      where: { articleId, userId },
      orderBy: { createdAt: 'desc' },
      include: {
        agentReviews: true,
        consolidatedSuggestions: true,
      },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review report not found' });
    }

    // 格式化响应
    const agentReviews: Record<string, any> = {};
    review.agentReviews.forEach((agent) => {
      agentReviews[agent.agentName] = {
        agentName: agent.agentName,
        model: agent.model,
        status: agent.status,
        issues: agent.issues || [],
        summary: agent.summary,
        error: agent.error,
      };
    });

    res.json({
      success: true,
      data: {
        reviewId: review.id,
        status: review.status,
        createdAt: review.createdAt,
        completedAt: review.completedAt,
        consolidated: {
          summary: review.consolidatedSummary,
          suggestions: review.consolidatedSuggestions,
        },
        agents: agentReviews,
      },
    });
  } catch (error) {
    console.error('Get review report error:', error);
    res.status(500).json({ error: 'Failed to get review report' });
  }
});

// 应用审阅建议
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { articleId, reviewId, action, selectedSuggestions } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const review = await prisma.reviewReport.findFirst({
      where: { id: reviewId, articleId, userId },
      include: {
        consolidatedSuggestions: true,
      },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // 获取文章
    const article = await prisma.article.findFirst({
      where: { id: articleId, userId },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    let newContent = article.content || '';

    if (action === 'accept_all') {
      // 应用所有建议
      for (const suggestion of review.consolidatedSuggestions) {
        if (suggestion.type === 'replace' && newContent) {
          newContent = newContent.replace(suggestion.original, suggestion.replacement);
        }
      }
    } else if (action === 'selective' && selectedSuggestions) {
      // 应用选中的建议
      const suggestionsToApply = review.consolidatedSuggestions.filter(
        (s) => selectedSuggestions.includes(s.id)
      );
      for (const suggestion of suggestionsToApply) {
        if (suggestion.type === 'replace' && newContent) {
          newContent = newContent.replace(suggestion.original, suggestion.replacement);
        }
      }
    }

    // 更新文章内容
    await prisma.article.update({
      where: { id: articleId },
      data: {
        content: newContent,
        updatedAt: new Date(),
      },
    });

    // 记录用户操作
    await prisma.reviewReport.update({
      where: { id: reviewId },
      data: {
        userAction: action,
        appliedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        message: action === 'reject_all' ? '已拒绝所有建议' : '建议已应用',
        content: newContent,
      },
    });
  } catch (error) {
    console.error('Apply review suggestions error:', error);
    res.status(500).json({ error: 'Failed to apply suggestions' });
  }
});

// 获取审阅状态
router.get('/status/:reviewId', authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const review = await prisma.reviewReport.findFirst({
      where: { id: reviewId, userId },
      include: {
        agentReviews: true,
      },
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // 计算进度
    const totalAgents = review.agentReviews.length;
    const completedAgents = review.agentReviews.filter(
      (a) => a.status === 'completed' || a.status === 'error'
    ).length;
    const progress = Math.round((completedAgents / totalAgents) * 100);

    res.json({
      success: true,
      data: {
        reviewId: review.id,
        status: review.status,
        progress,
        completedAgents,
        totalAgents,
      },
    });
  } catch (error) {
    console.error('Get review status error:', error);
    res.status(500).json({ error: 'Failed to get review status' });
  }
});

export default router;
