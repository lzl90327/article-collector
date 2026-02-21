/**
 * 苏格拉底式提问 API 路由
 * Phase 1.2: Socratic Questioning Routes
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import {
  createSocraticSession,
  getSession,
  getCurrentQuestion,
  answerAndProgress,
  endSession,
  getSessionSummary,
  switchToPingPong,
  getActiveSessions,
  SocraticSession,
} from '../services/socratic.service';

const router = Router();

/**
 * POST /api/socratic/sessions
 * 创建苏格拉底式提问会话
 */
router.post('/sessions', async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({
        success: false,
        error: '请提供探讨主题（topic）',
      });
    }

    const session = await createSocraticSession(topic);

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        topic: session.topic,
        currentQuestion: session.questions[0],
        message: '苏格拉底式提问会话已创建，从澄清性问题开始',
      },
    });
  } catch (error: any) {
    logger.error('Create Socratic session API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '创建会话失败',
    });
  }
});

/**
 * GET /api/socratic/sessions/active
 * 获取活跃会话列表
 */
router.get('/sessions/active', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const sessions = await getActiveSessions(limit);

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    logger.error('Get active Socratic sessions API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取活跃会话失败',
    });
  }
});

/**
 * GET /api/socratic/sessions/:sessionId
 * 获取会话详情
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: '会话不存在',
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    logger.error('Get Socratic session API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取会话失败',
    });
  }
});

/**
 * GET /api/socratic/sessions/:sessionId/current
 * 获取当前问题
 */
router.get('/sessions/:sessionId/current', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const question = await getCurrentQuestion(sessionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: '没有活跃的问题，会话可能已结束',
      });
    }

    res.json({
      success: true,
      data: question,
    });
  } catch (error: any) {
    logger.error('Get current question API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取当前问题失败',
    });
  }
});

/**
 * POST /api/socratic/sessions/:sessionId/answer
 * 回答问题并获取下一个问题
 */
router.post('/sessions/:sessionId/answer', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answer } = req.body;

    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({
        success: false,
        error: '请提供回答（answer）',
      });
    }

    const result = await answerAndProgress(sessionId, answer);

    if (!result.session) {
      return res.status(404).json({
        success: false,
        error: '会话不存在或已结束',
      });
    }

    if (!result.nextQuestion) {
      // 会话已结束
      return res.json({
        success: true,
        data: {
          session: result.session,
          completed: true,
          message: '苏格拉底式提问已完成，达到最大深度（6层）',
        },
      });
    }

    res.json({
      success: true,
      data: {
        session: result.session,
        nextQuestion: result.nextQuestion,
        progress: `${result.session.currentDepth}/6`,
      },
    });
  } catch (error: any) {
    logger.error('Answer and progress API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '提交回答失败',
    });
  }
});

/**
 * POST /api/socratic/sessions/:sessionId/end
 * 结束会话
 */
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const success = await endSession(sessionId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '会话不存在',
      });
    }

    res.json({
      success: true,
      message: '会话已结束',
    });
  } catch (error: any) {
    logger.error('End Socratic session API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '结束会话失败',
    });
  }
});

/**
 * GET /api/socratic/sessions/:sessionId/summary
 * 获取会话摘要
 */
router.get('/sessions/:sessionId/summary', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const summary = await getSessionSummary(sessionId);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: '会话不存在',
      });
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logger.error('Get session summary API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取摘要失败',
    });
  }
});

/**
 * POST /api/socratic/sessions/:sessionId/switch-to-pingpong
 * 切换到乒乓球模式
 */
router.post('/sessions/:sessionId/switch-to-pingpong', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await switchToPingPong(sessionId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.summary,
      });
    }

    res.json({
      success: true,
      data: result,
      message: '已切换到乒乓球探讨模式',
    });
  } catch (error: any) {
    logger.error('Switch to ping-pong API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '切换模式失败',
    });
  }
});

export default router;
