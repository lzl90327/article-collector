/**
 * Artifacts Routes
 * 工件管理 API：详情查询、回滚
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import type { ArtifactKind } from '../types/artifact';

const router: Router = Router();

// 辅助函数：发送错误响应
function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      retryable: false,
    },
  });
}

/**
 * GET /api/artifacts/:artifactId
 * 获取工件详情
 */
router.get('/:artifactId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { artifactId } = req.params;

    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) {
      return sendError(res, 404, 'ARTIFACT_NOT_FOUND', '工件不存在');
    }

    res.json({
      success: true,
      data: {
        artifact: {
          id: artifact.id,
          session_id: artifact.session_id,
          kind: artifact.kind,
          version: artifact.version,
          title: artifact.title,
          content: artifact.content,
          meta_json: artifact.meta_json,
          source_job_id: artifact.source_job_id,
          created_at: artifact.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/artifacts/:artifactId/rollback
 * 回滚工件（创建新版本指向旧内容）
 */
router.post('/:artifactId/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { artifactId } = req.params;
    const { title } = req.body;

    // 获取原工件
    const originalArtifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!originalArtifact) {
      return sendError(res, 404, 'ARTIFACT_NOT_FOUND', '工件不存在');
    }

    // 计算新版本号
    const kind = originalArtifact.kind as ArtifactKind;
    let version: number | null = null;
    if (kind === 'draft' || kind === 'review_report') {
      const latestArtifact = await prisma.artifact.findFirst({
        where: { session_id: originalArtifact.session_id, kind },
        orderBy: { version: 'desc' },
      });
      version = (latestArtifact?.version ?? 0) + 1;
    }

    // 创建新工件（回滚版本）
    const newArtifact = await prisma.artifact.create({
      data: {
        session_id: originalArtifact.session_id,
        kind: originalArtifact.kind,
        version,
        title: title || originalArtifact.title,
        content: originalArtifact.content,
        meta_json: {
          ...originalArtifact.meta_json,
          rollback_from: artifactId,
          rollback_at: new Date().toISOString(),
        },
        source_job_id: originalArtifact.source_job_id,
      },
    });

    logger.info(`Artifact 回滚成功: ${artifactId} -> ${newArtifact.id}`, {
      kind,
      version,
    });

    res.json({
      success: true,
      data: {
        artifact: {
          id: newArtifact.id,
          session_id: newArtifact.session_id,
          kind: newArtifact.kind,
          version: newArtifact.version,
          title: newArtifact.title,
          content: newArtifact.content,
          meta_json: newArtifact.meta_json,
          source_job_id: newArtifact.source_job_id,
          created_at: newArtifact.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/artifacts/:artifactId/diff
 * 对比两个工件版本（简化版）
 */
router.get('/:artifactId/diff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { artifactId } = req.params;
    const compareArtifactId = req.query.compare as string;

    if (!compareArtifactId) {
      return sendError(res, 400, 'BAD_REQUEST', '缺少参数: compare');
    }

    const [baseArtifact, compareArtifact] = await Promise.all([
      prisma.artifact.findUnique({ where: { id: artifactId } }),
      prisma.artifact.findUnique({ where: { id: compareArtifactId } }),
    ]);

    if (!baseArtifact || !compareArtifact) {
      return sendError(res, 404, 'ARTIFACT_NOT_FOUND', '工件不存在');
    }

    // 简单段落对比（按 \n\n 分段）
    const baseParagraphs = baseArtifact.content.split('\n\n');
    const compareParagraphs = compareArtifact.content.split('\n\n');

    const diff = [];
    const maxLen = Math.max(baseParagraphs.length, compareParagraphs.length);

    for (let i = 0; i < maxLen; i++) {
      const baseText = baseParagraphs[i];
      const compareText = compareParagraphs[i];

      if (baseText === undefined) {
        diff.push({
          index: i,
          type: 'added',
          compare_text: compareText,
        });
      } else if (compareText === undefined) {
        diff.push({
          index: i,
          type: 'removed',
          base_text: baseText,
        });
      } else if (baseText === compareText) {
        diff.push({
          index: i,
          type: 'unchanged',
          base_text: baseText,
          compare_text: compareText,
        });
      } else {
        diff.push({
          index: i,
          type: 'modified',
          base_text: baseText,
          compare_text: compareText,
        });
      }
    }

    res.json({
      success: true,
      data: {
        base: {
          artifact_id: baseArtifact.id,
          kind: baseArtifact.kind,
          version: baseArtifact.version,
          title: baseArtifact.title,
          created_at: baseArtifact.created_at,
        },
        compare: {
          artifact_id: compareArtifact.id,
          kind: compareArtifact.kind,
          version: compareArtifact.version,
          title: compareArtifact.title,
          created_at: compareArtifact.created_at,
        },
        diff,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
