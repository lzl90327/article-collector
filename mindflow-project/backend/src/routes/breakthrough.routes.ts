/**
 * 破题路由
 * Phase 1.5: 对抗式枚举 + R/N/C评分 + 冷门案例搜索
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../utils/logger';
import * as breakthroughService from '../services/breakthrough.service';

const router: Router = Router();

/**
 * POST /api/breakthrough/debate
 * 执行对抗式枚举
 */
router.post('/debate', async (req: Request, res: Response) => {
  const { topic, round = 1, keyword } = req.body;

  if (!topic) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOPIC', message: 'Topic is required' },
    });
  }

  try {
    const result = await breakthroughService.debateEnumeration(
      topic,
      parseInt(round as string, 10),
      keyword
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Debate enumeration failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/breakthrough/keyword
 * 获取随机碰撞关键词
 */
router.get('/keyword', async (req: Request, res: Response) => {
  try {
    const keyword = breakthroughService.getCollisionKeyword();

    res.json({
      success: true,
      data: { keyword },
    });
  } catch (error: any) {
    logger.error('Get collision keyword failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/breakthrough/cold-case
 * 搜索冷门案例
 */
router.post('/cold-case', async (req: Request, res: Response) => {
  const { point, attitude } = req.body;

  if (!point || !attitude) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Point and attitude are required' },
    });
  }

  try {
    const coldCase = await breakthroughService.searchColdCase(point, attitude);

    res.json({
      success: true,
      data: { coldCase },
    });
  } catch (error: any) {
    logger.error('Search cold case failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
