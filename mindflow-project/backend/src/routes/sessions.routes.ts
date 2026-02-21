/**
 * Sessions Routes
 * 会话管理 API：创建、查询、更新、工件列表
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import type {
  CreateSessionRequest,
  UpdateSessionRequest,
  Session,
  SessionSubstate,
} from '../types/session';
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
 * GET /api/sessions
 * 获取 Session 列表
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        orderBy: { updated_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.session.count(),
    ]);

    res.json({
      success: true,
      data: {
        sessions: sessions.map(mapPrismaSessionToSession),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions
 * 创建 Session
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, mode, initial_context }: CreateSessionRequest = req.body;

    if (!title || !mode) {
      return sendError(res, 400, 'BAD_REQUEST', '缺少必填字段: title, mode');
    }

    const session = await prisma.session.create({
      data: {
        title,
        mode,
        phase: '-1', // Brief 阶段
        substate: 'idle',
        pending_input: null,
        state_json: {
          context: initial_context || {},
          history: [],
        },
        brief_confirmed: false,
      },
    });

    logger.info(`Session 创建成功: ${session.id}`, { title, mode });

    res.status(201).json({
      success: true,
      data: {
        session: mapPrismaSessionToSession(session),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sessions/:sessionId
 * 获取 Session 详情
 */
router.get('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        artifacts: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', '会话不存在');
    }

    // 获取最新工件
    const latestArtifacts = {
      brief: session.artifacts.find((a: any) => a.kind === 'brief_card'),
      outline: session.artifacts.find((a: any) => a.kind === 'outline'),
      draft: session.artifacts.find((a: any) => a.kind === 'draft'),
      review: session.artifacts.find((a: any) => a.kind === 'review_report'),
    };

    res.json({
      success: true,
      data: {
        session: mapPrismaSessionToSession(session),
        latest_artifacts: {
          brief: latestArtifacts.brief
            ? mapPrismaArtifactToSummary(latestArtifacts.brief)
            : undefined,
          outline: latestArtifacts.outline
            ? mapPrismaArtifactToSummary(latestArtifacts.outline)
            : undefined,
          draft: latestArtifacts.draft
            ? mapPrismaArtifactToSummary(latestArtifacts.draft)
            : undefined,
          review: latestArtifacts.review
            ? mapPrismaArtifactToSummary(latestArtifacts.review)
            : undefined,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/sessions/:sessionId
 * 更新 Session
 */
router.patch('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const updates: UpdateSessionRequest = req.body;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', '会话不存在');
    }

    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.phase !== undefined) updateData.phase = updates.phase;
    if (updates.substate !== undefined) updateData.substate = updates.substate;
    if (updates.pending_input !== undefined) {
      updateData.pending_input = updates.pending_input;
    }
    if (updates.brief_confirmed !== undefined) {
      updateData.brief_confirmed = updates.brief_confirmed;
    }
    if (updates.state_json !== undefined) {
      updateData.state_json = {
        ...(session.state_json as object || {}),
        ...updates.state_json,
      };
    }

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: updateData,
    });

    logger.debug(`Session 更新: ${sessionId}`, updates);

    res.json({
      success: true,
      data: {
        session: mapPrismaSessionToSession(updatedSession),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sessions/:sessionId/artifacts
 * 获取会话的工件列表
 */
router.get('/:sessionId/artifacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const kind = req.query.kind as ArtifactKind | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    // 验证 session 存在
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', '会话不存在');
    }

    // 查询工件
    const where: any = { session_id: sessionId };
    if (kind) where.kind = kind;

    const [artifacts, total] = await Promise.all([
      prisma.artifact.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.artifact.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        artifacts: artifacts.map(mapPrismaArtifactToSummary),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:sessionId/artifacts
 * 创建工件（手动保存）
 */
router.post('/:sessionId/artifacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const { kind, title, content, meta_json, source_job_id } = req.body;

    if (!kind || !content) {
      return sendError(res, 400, 'BAD_REQUEST', '缺少必填字段: kind, content');
    }

    // 验证 session 存在
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return sendError(res, 404, 'SESSION_NOT_FOUND', '会话不存在');
    }

    // 计算版本号
    let version: number | null = null;
    if (kind === 'draft' || kind === 'review_report') {
      const latestArtifact = await prisma.artifact.findFirst({
        where: { session_id: sessionId, kind },
        orderBy: { version: 'desc' },
      });
      version = (latestArtifact?.version ?? 0) + 1;
    }

    const artifact = await prisma.artifact.create({
      data: {
        session_id: sessionId,
        kind,
        version,
        title: title || null,
        content,
        meta_json: meta_json || {},
        source_job_id: source_job_id || null,
      },
    });

    logger.info(`Artifact 创建成功: ${artifact.id}`, { sessionId, kind, version });

    res.status(201).json({
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
 * GET /api/sessions/:sessionId/artifacts/latest
 * 获取最新工件
 */
router.get('/:sessionId/artifacts/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const kind = req.query.kind as ArtifactKind;

    if (!kind) {
      return sendError(res, 400, 'BAD_REQUEST', '缺少参数: kind');
    }

    const artifact = await prisma.artifact.findFirst({
      where: { session_id: sessionId, kind },
      orderBy: { version: 'desc' },
    });

    res.json({
      success: true,
      data: {
        artifact: artifact
          ? {
              id: artifact.id,
              session_id: artifact.session_id,
              kind: artifact.kind,
              version: artifact.version,
              title: artifact.title,
              content: artifact.content,
              meta_json: artifact.meta_json,
              source_job_id: artifact.source_job_id,
              created_at: artifact.created_at,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== 辅助函数 ====================

function mapPrismaSessionToSession(prismaSession: any): Session {
  return {
    id: prismaSession.id,
    title: prismaSession.title,
    mode: prismaSession.mode,
    phase: prismaSession.phase,
    substate: prismaSession.substate as SessionSubstate,
    pending_input: prismaSession.pending_input,
    state_json: prismaSession.state_json,
    brief_confirmed: prismaSession.brief_confirmed,
    created_at: prismaSession.created_at,
    updated_at: prismaSession.updated_at,
  };
}

function mapPrismaArtifactToSummary(prismaArtifact: any) {
  return {
    artifact_id: prismaArtifact.id,
    kind: prismaArtifact.kind,
    version: prismaArtifact.version,
    title: prismaArtifact.title,
    created_at: prismaArtifact.created_at,
    source_job_id: prismaArtifact.source_job_id,
  };
}

export default router;
