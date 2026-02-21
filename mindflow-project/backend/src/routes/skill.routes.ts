import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router: Router = Router();

// 获取当前 Skill 配置
router.get('/config', async (req, res) => {
  try {
    const config = await prisma.skillConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      return res.status(404).json({ error: '未找到 Skill 配置' });
    }

    res.json({
      version: config.version,
      name: config.name,
      config: config.config,
    });
  } catch (error) {
    logger.error('获取 Skill 配置失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取版本历史
router.get('/versions', async (req, res) => {
  try {
    const versions = await prisma.skillConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json(versions);
  } catch (error) {
    logger.error('获取版本历史失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取版本对比
router.get('/compare', async (req, res) => {
  try {
    const { v1, v2 } = req.query;

    const [config1, config2] = await Promise.all([
      prisma.skillConfig.findFirst({ where: { version: v1 as string } }),
      prisma.skillConfig.findFirst({ where: { version: v2 as string } }),
    ]);

    if (!config1 || !config2) {
      return res.status(404).json({ error: '版本不存在' });
    }

    // 简单的对比逻辑
    const differences = compareConfigs(config1.config, config2.config);

    res.json({
      v1: config1.version,
      v2: config2.version,
      differences,
    });
  } catch (error) {
    logger.error('对比版本失败', error);
    res.status(500).json({ error: '对比失败' });
  }
});

function compareConfigs(c1: any, c2: any): any[] {
  const diffs: any[] = [];
  // 对比 phases
  if (JSON.stringify(c1.phases) !== JSON.stringify(c2.phases)) {
    diffs.push({ type: 'phases', description: 'Phase 配置有变更' });
  }
  // 对比 prompts
  if (JSON.stringify(c1.prompts) !== JSON.stringify(c2.prompts)) {
    diffs.push({ type: 'prompts', description: 'Prompt 配置有变更' });
  }
  return diffs;
}

export default router;
