/**
 * 资讯穿透路由
 * Phase 0.5: 多维溯源 + 强行链接
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../utils/logger';
import * as researchService from '../services/research.service';

const router: Router = Router();

/**
 * POST /api/research
 * 执行资讯穿透
 */
router.post('/', async (req: Request, res: Response) => {
  const { topic, materialSummary } = req.body;

  if (!topic) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOPIC', message: 'Topic is required' },
    });
  }

  try {
    const brief = await researchService.researchTopic(topic, materialSummary);

    res.json({
      success: true,
      data: { brief },
    });
  } catch (error: any) {
    logger.error('Research topic failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/research/claim-evidence
 * 生成 Claim-Evidence Table
 */
router.post('/claim-evidence', async (req: Request, res: Response) => {
  const { topic, brief } = req.body;

  if (!topic || !brief) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Topic and brief are required' },
    });
  }

  try {
    const table = await researchService.generateClaimEvidenceTable(topic, brief);

    res.json({
      success: true,
      data: { table },
    });
  } catch (error: any) {
    logger.error('Generate claim-evidence table failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
