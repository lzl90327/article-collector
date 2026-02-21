/**
 * 配图生成路由
 * Phase 4.8: Apple Keynote 风格配图
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../utils/logger';
import * as imageGenerationService from '../services/image-generation.service';

const router: Router = Router();

/**
 * POST /api/images/generate
 * 生成单张配图
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { title, subtitle, config } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TITLE', message: 'Title is required' },
    });
  }

  try {
    const image = await imageGenerationService.generateImage({
      title,
      subtitle,
      config,
    });

    res.json({
      success: true,
      data: { image },
    });
  } catch (error: any) {
    logger.error('Generate image failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/images/generate-article
 * 批量生成文章配图
 */
router.post('/generate-article', async (req: Request, res: Response) => {
  const { sections } = req.body;

  if (!sections || !Array.isArray(sections)) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_SECTIONS', message: 'Sections array is required' },
    });
  }

  try {
    const images = await imageGenerationService.generateImagesForArticle(sections);

    res.json({
      success: true,
      data: {
        images,
        count: images.length,
      },
    });
  } catch (error: any) {
    logger.error('Generate article images failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/images/schemes
 * 获取配色方案
 */
router.get('/schemes', async (req: Request, res: Response) => {
  try {
    const schemes = imageGenerationService.getColorSchemes();

    res.json({
      success: true,
      data: { schemes },
    });
  } catch (error: any) {
    logger.error('Get color schemes failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/images/prompt
 * 生成配图提示词
 */
router.post('/prompt', async (req: Request, res: Response) => {
  const { title, style = 'minimal' } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TITLE', message: 'Title is required' },
    });
  }

  try {
    const prompt = imageGenerationService.generateImagePrompt(
      title,
      style as 'minimal' | 'abstract' | 'conceptual'
    );

    res.json({
      success: true,
      data: { prompt },
    });
  } catch (error: any) {
    logger.error('Generate image prompt failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
