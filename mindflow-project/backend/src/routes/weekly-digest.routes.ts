/**
 * 周度认知简报 API 路由
 * Phase 0.8: Weekly Cognitive Digest Routes
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import {
  generateWeeklyDigest,
  getLatestWeeklyDigest,
  getWeeklyDigestHistory,
  selectDeepDiveMaterials,
  WeeklyDigest,
} from '../services/weekly-digest.service';

const router = Router();

/**
 * POST /api/weekly-digest/generate
 * 生成周度认知简报
 */
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { days = 7 } = req.body;

    logger.info(`Generating weekly digest for user ${userId}`);

    // 启动异步生成（实际应用中可能需要使用 Job 队列）
    const digest = await generateWeeklyDigest(userId, days);

    res.json({
      success: true,
      data: digest,
    });
  } catch (error: any) {
    logger.error('Generate weekly digest API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成周报失败',
    });
  }
});

/**
 * GET /api/weekly-digest/latest
 * 获取最新周报
 */
router.get('/latest', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';

    const digest = await getLatestWeeklyDigest(userId);

    if (!digest) {
      return res.status(404).json({
        success: false,
        error: '未找到周报',
      });
    }

    res.json({
      success: true,
      data: digest,
    });
  } catch (error: any) {
    logger.error('Get latest weekly digest API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取周报失败',
    });
  }
});

/**
 * GET /api/weekly-digest/history
 * 获取周报历史列表
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await getWeeklyDigestHistory(userId, limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    logger.error('Get weekly digest history API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取周报历史失败',
    });
  }
});

/**
 * GET /api/weekly-digest/:id
 * 获取指定周报详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 这里可以实现从数据库获取指定 ID 的周报
    // 简化版：返回最新周报
    const userId = req.user?.id || 'anonymous';
    const digest = await getLatestWeeklyDigest(userId);

    if (!digest || digest.id !== id) {
      return res.status(404).json({
        success: false,
        error: '周报不存在',
      });
    }

    res.json({
      success: true,
      data: digest,
    });
  } catch (error: any) {
    logger.error('Get weekly digest by id API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取周报失败',
    });
  }
});

/**
 * POST /api/weekly-digest/:id/select
 * 选择深挖素材
 */
router.post('/:id/select', async (req, res) => {
  try {
    const { id } = req.params;
    const { indices } = req.body; // 素材序号列表，如 [1, 3]

    if (!Array.isArray(indices) || indices.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要选择的素材序号',
      });
    }

    const result = await selectDeepDiveMaterials(id, indices);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    res.json({
      success: true,
      data: {
        selected: result.selected,
        message: result.message,
      },
    });
  } catch (error: any) {
    logger.error('Select deep dive materials API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '选择素材失败',
    });
  }
});

/**
 * POST /api/weekly-digest/:id/deep-dive
 * 对选中的素材启动深挖流程
 * 这将触发 Phase 0.5 (资讯穿透) + Phase 1.5 (破题)
 */
router.post('/:id/deep-dive', async (req, res) => {
  try {
    const { id } = req.params;
    const { materialIndex } = req.body; // 素材序号，如 1

    if (!materialIndex || typeof materialIndex !== 'number') {
      return res.status(400).json({
        success: false,
        error: '请提供素材序号',
      });
    }

    // 获取周报和选中的素材
    const result = await selectDeepDiveMaterials(id, [materialIndex]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    const selectedMaterial = result.selected[0];

    // 创建新的 Session 用于深挖流程
    // 这里可以启动 Phase 0.5 -> Phase 1.5 的工作流
    // 简化版：返回素材信息，前端可以引导用户进入探讨流程

    res.json({
      success: true,
      data: {
        message: `已选择素材「${selectedMaterial.title}」进行深挖`,
        material: selectedMaterial,
        nextSteps: [
          'Phase 0.5: 资讯穿透（多维溯源 + 强行链接）',
          'Phase 1.5: 破题（对抗式枚举 + R/N/C 评分）',
        ],
        // 可以返回一个新建的 session_id
        sessionId: null, // 实际实现中创建新 session
      },
    });
  } catch (error: any) {
    logger.error('Deep dive API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '启动深挖流程失败',
    });
  }
});

export default router;
