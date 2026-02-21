/**
 * 赛博编辑部路由
 * Phase 4.5: 6维度审计 + 4个审计智能体 + 主体性注入
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../utils/logger';
import * as cyberEditorialService from '../services/cyber-editorial.service';

const router: Router = Router();

/**
 * POST /api/cyber-editorial/audit
 * 6维度审计
 */
router.post('/audit', async (req: Request, res: Response) => {
  const { content, brief } = req.body;

  if (!content || !brief) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Content and brief are required' },
    });
  }

  try {
    const report = await cyberEditorialService.sixDimensionAudit(content, brief);

    res.json({
      success: true,
      data: { report },
    });
  } catch (error: any) {
    logger.error('Six dimension audit failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/cyber-editorial/agents
 * 4个审计智能体
 */
router.post('/agents', async (req: Request, res: Response) => {
  const { content, brief } = req.body;

  if (!content || !brief) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Content and brief are required' },
    });
  }

  try {
    const results = await cyberEditorialService.fourAgentsAudit(content, brief);

    res.json({
      success: true,
      data: { results },
    });
  } catch (error: any) {
    logger.error('Four agents audit failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/cyber-editorial/subjectivity
 * 主体性注入
 */
router.post('/subjectivity', async (req: Request, res: Response) => {
  const { content, authorProfile } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_CONTENT', message: 'Content is required' },
    });
  }

  try {
    const result = await cyberEditorialService.injectSubjectivity(content, authorProfile);

    res.json({
      success: true,
      data: { result },
    });
  } catch (error: any) {
    logger.error('Subjectivity injection failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/cyber-editorial/full-review
 * 完整审阅流程（6维度 + 4智能体）
 */
router.post('/full-review', async (req: Request, res: Response) => {
  const { content, brief, authorProfile } = req.body;

  if (!content || !brief) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'Content and brief are required' },
    });
  }

  try {
    // 并行执行审计
    const [sixDimensionReport, agentsResults] = await Promise.all([
      cyberEditorialService.sixDimensionAudit(content, brief),
      cyberEditorialService.fourAgentsAudit(content, brief),
    ]);

    // 可选：主体性注入
    let subjectivityResult = null;
    if (authorProfile) {
      subjectivityResult = await cyberEditorialService.injectSubjectivity(content, authorProfile);
    }

    res.json({
      success: true,
      data: {
        sixDimensionReport,
        agentsResults,
        subjectivityResult,
      },
    });
  } catch (error: any) {
    logger.error('Full review failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
