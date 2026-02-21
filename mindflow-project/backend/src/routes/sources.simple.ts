/**
 * 素材路由 - 简化版（内存存储）
 */

import { Router } from 'express';
import { memoryStore } from '../server.simple';
import { logger } from '../utils/logger';

const router: Router = Router();

// 获取素材列表
router.get('/', (req, res) => {
  try {
    const sources = Array.from(memoryStore.sources.values());
    res.json({
      success: true,
      data: sources,
    });
  } catch (error: any) {
    logger.error('获取素材列表失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 同步素材
router.post('/sync', (req, res) => {
  try {
    // 模拟同步成功
    res.json({
      success: true,
      message: '同步成功',
      count: 0,
    });
  } catch (error: any) {
    logger.error('同步素材失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
