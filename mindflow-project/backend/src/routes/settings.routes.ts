/**
 * 设置路由
 * Phase2: 存储设置、数据导入导出
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router: Router = Router();

// 当前用户ID（简化版，实际应从JWT获取）
const getCurrentUserId = (): string => 'user-001';

/**
 * GET /api/settings/storage
 * 获取存储配置
 */
router.get('/storage', async (req: Request, res: Response) => {
  try {
    // 返回存储配置
    const config = {
      provider: process.env.STORAGE_PROVIDER || 'local',
      local: {
        path: process.env.LOCAL_STORAGE_PATH || './data',
      },
      cloud: {
        enabled: !!process.env.CLOUD_STORAGE_URL,
        url: process.env.CLOUD_STORAGE_URL,
      },
    };

    res.json({
      success: true,
      data: { config },
    });
  } catch (error: any) {
    logger.error('Get storage settings failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/settings/storage
 * 更新存储配置
 */
router.post('/storage', async (req: Request, res: Response) => {
  const { provider, autoSync, syncInterval } = req.body;

  try {
    // 这里应该保存到用户配置表
    // 简化版直接返回成功
    res.json({
      success: true,
      data: {
        provider,
        autoSync,
        syncInterval,
        updated: true,
      },
    });
  } catch (error: any) {
    logger.error('Update storage settings failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/export
 * 导出数据
 */
router.post('/export', async (req: Request, res: Response) => {
  const { format, sessionIds } = req.body;

  try {
    const userId = getCurrentUserId();

    // 查询数据
    const where = sessionIds?.length > 0
      ? { id: { in: sessionIds } }
      : {};

    const sessions = await prisma.session.findMany({
      where,
      include: {
        artifacts: true,
      },
      orderBy: { created_at: 'desc' },
    });

    let exportData: any;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'json':
        exportData = JSON.stringify(sessions, null, 2);
        contentType = 'application/json';
        filename = `mindflow-export-${Date.now()}.json`;
        break;

      case 'markdown':
        exportData = sessions.map((s: any) => {
          const drafts = s.artifacts?.filter((a: any) => a.kind === 'draft') || [];
          const content = drafts.map((d: any) => d.content).join('\n\n---\n\n');
          return `# ${s.title}\n\n${content}`;
        }).join('\n\n---\n\n');
        contentType = 'text/markdown';
        filename = `mindflow-export-${Date.now()}.md`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FORMAT', message: 'Unsupported export format' },
        });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error: any) {
    logger.error('Export data failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: error.message },
    });
  }
});

/**
 * POST /api/import
 * 导入数据
 */
router.post('/import', async (req: Request, res: Response) => {
  const { format, data } = req.body;

  try {
    const userId = getCurrentUserId();
    let importedCount = 0;

    switch (format) {
      case 'json':
        const sessions = JSON.parse(data);
        for (const session of sessions) {
          await prisma.session.create({
            data: {
              title: session.title,
              mode: session.mode,
              phase: session.phase,
              substate: session.substate,
              brief_confirmed: session.brief_confirmed,
              state_json: session.state_json,
            },
          });
          importedCount++;
        }
        break;

      case 'markdown':
        // 简化版：将整个 markdown 作为一个 Session
        await prisma.session.create({
          data: {
            title: '导入的文章',
            mode: 'scratch',
            phase: '5',
            substate: 'completed',
            brief_confirmed: true,
            state_json: {},
          },
        });
        importedCount = 1;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FORMAT', message: 'Unsupported import format' },
        });
    }

    res.json({
      success: true,
      data: { importedCount },
    });
  } catch (error: any) {
    logger.error('Import data failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'IMPORT_FAILED', message: error.message },
    });
  }
});

/**
 * GET /api/settings/sync-logs
 * 获取同步日志
 */
router.get('/sync-logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.syncLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: {
        logs: logs.map((log: any) => ({
          id: log.id,
          action: log.action,
          target: log.target,
          status: log.status,
          createdAt: log.created_at,
          errorMessage: log.error_message,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Get sync logs failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
