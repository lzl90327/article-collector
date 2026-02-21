/**
 * 素材路由
 * Phase 0: 素材获取
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../utils/logger';
import * as materialsService from '../services/feishu.materials.service';

const router: Router = Router();

/**
 * GET /api/materials
 * 获取素材列表
 */
router.get('/', async (req: Request, res: Response) => {
  const { limit = '10', days } = req.query;

  try {
    const materials = await materialsService.getMaterials(
      parseInt(limit as string, 10),
      days ? parseInt(days as string, 10) : undefined
    );

    res.json({
      success: true,
      data: {
        materials,
        total: materials.length,
      },
    });
  } catch (error: any) {
    logger.error('Get materials failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/materials/search
 * 搜索素材
 */
router.get('/search', async (req: Request, res: Response) => {
  const { keyword, limit = '10' } = req.query;

  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_KEYWORD', message: 'Keyword is required' },
    });
  }

  try {
    const materials = await materialsService.searchMaterials(
      keyword,
      parseInt(limit as string, 10)
    );

    res.json({
      success: true,
      data: {
        materials,
        total: materials.length,
      },
    });
  } catch (error: any) {
    logger.error('Search materials failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/materials/:id
 * 获取素材详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const material = await materialsService.getMaterialDetail(id);

    if (!material) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Material not found' },
      });
    }

    res.json({
      success: true,
      data: { material },
    });
  } catch (error: any) {
    logger.error('Get material detail failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/materials
 * 保存素材（存播客/存文章）
 */
router.post('/', async (req: Request, res: Response) => {
  const { title, author, source, summary, originalUrl } = req.body;

  if (!title || !author || !source || !summary) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'Title, author, source, summary are required' },
    });
  }

  try {
    const material = await materialsService.saveMaterial({
      title,
      author,
      source,
      summary,
      originalUrl,
    });

    res.json({
      success: true,
      data: { material },
    });
  } catch (error: any) {
    logger.error('Save material failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
