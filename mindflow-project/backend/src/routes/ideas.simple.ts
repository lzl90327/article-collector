/**
 * 想法路由 - 简化版（内存存储）
 */

import { Router } from 'express';
import { memoryStore } from '../server.simple';
import { logger } from '../utils/logger';

const router: Router = Router();

// 获取想法列表
router.get('/', (req, res) => {
  try {
    const ideas = Array.from(memoryStore.ideas.values());
    res.json({
      success: true,
      data: ideas,
    });
  } catch (error: any) {
    logger.error('获取想法列表失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建想法
router.post('/', (req, res) => {
  try {
    const { content, tags } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: '内容不能为空',
      });
    }

    const idea = {
      id: `idea_${Date.now()}`,
      content,
      tags: tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryStore.ideas.set(idea.id, idea);

    res.json({
      success: true,
      data: idea,
    });
  } catch (error: any) {
    logger.error('创建想法失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
