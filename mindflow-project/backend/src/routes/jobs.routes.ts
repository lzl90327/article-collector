/**
 * Jobs Routes
 * Job 管理 API：创建、查询、固化、取消、SSE 流、Polling 兜底
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import {
  createJob,
  getJob,
  commitJob,
  cancelJob,
} from '../services/job.service';
import {
  createEventStream,
  getEventsAfter,
  formatSSE,
  getJobEmitter,
} from '../services/sse.service';
import { startJob } from '../services/job.runner';
import type { CreateJobRequest, CommitJobRequest } from '../types/job';

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
 * POST /api/jobs
 * 创建 Job
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: CreateJobRequest = req.body;

    // 验证必填字段
    if (!data.session_id || !data.task || !data.phase) {
      return sendError(res, 400, 'BAD_REQUEST', '缺少必填字段: session_id, task, phase');
    }

    // 创建 Job
    const job = await createJob(data);

    // 异步启动 Job 执行（不等待完成）
    startJob(job).catch((error) => {
      logger.error(`Job 启动失败: ${job.id}`, error);
    });

    res.status(201).json({
      success: true,
      data: {
        job: {
          job_id: job.id,
          status: job.status,
          seq: job.seq,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jobs/:jobId
 * 查询 Job 状态
 */
router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job 不存在');
    }

    res.json({
      success: true,
      data: {
        job: {
          job_id: job.id,
          session_id: job.session_id,
          task: job.task,
          status: job.status,
          seq: job.seq,
          snapshot: job.snapshot,
          progress: job.progress_json,
          error: job.error_json,
          updated_at: job.updated_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/jobs/:jobId/commit
 * 固化为 Artifact
 */
router.post('/:jobId/commit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const { artifact_kind, mode, title }: CommitJobRequest = req.body;

    if (!artifact_kind || !mode) {
      return sendError(res, 400, 'BAD_REQUEST', '缺少必填字段: artifact_kind, mode');
    }

    const artifact = await commitJob(jobId, artifact_kind, title);

    res.json({
      success: true,
      data: {
        artifact: {
          artifact_id: artifact.id,
          kind: artifact.kind,
          version: artifact.version,
          title: artifact.title,
          created_at: artifact.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/jobs/:jobId/cancel
 * 取消 Job
 */
router.post('/:jobId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    await cancelJob(jobId);

    res.json({
      success: true,
      data: {
        success: true,
        job_id: jobId,
        status: 'cancelled',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jobs/:jobId/stream
 * SSE 事件流（主通道）
 */
router.get('/:jobId/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const lastEventId = req.headers['last-event-id']
      ? parseInt(req.headers['last-event-id'] as string, 10)
      : undefined;

    // 获取 Job
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job 不存在');
    }

    // 设置 SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 创建事件流
    const emitter = createEventStream(jobId, lastEventId);

    // 发送初始状态
    res.write(
      formatSSE('job.status', '0', {
        job_id: jobId,
        status: job.status,
        seq: job.seq,
        ts: Date.now(),
      })
    );

    // 监听事件
    const handleStarted = (data: any) => {
      res.write(formatSSE('job.started', String(data.seq || 1), data));
    };

    const handleDelta = (data: any) => {
      res.write(formatSSE('job.delta', String(data.seq), data));
    };

    const handleProgress = (data: any) => {
      res.write(formatSSE('job.progress', String(data.seq), data));
    };

    const handleError = (data: any) => {
      res.write(formatSSE('job.error', String(data.seq), data));
    };

    const handleCompleted = (data: any) => {
      res.write(formatSSE('job.completed', String(data.seq), data));
      // 完成后关闭连接
      setTimeout(() => {
        res.end();
      }, 1000);
    };

    emitter.on('started', handleStarted);
    emitter.on('delta', handleDelta);
    emitter.on('progress', handleProgress);
    emitter.on('error', handleError);
    emitter.on('completed', handleCompleted);

    // 清理函数
    req.on('close', () => {
      emitter.off('started', handleStarted);
      emitter.off('delta', handleDelta);
      emitter.off('progress', handleProgress);
      emitter.off('error', handleError);
      emitter.off('completed', handleCompleted);
      logger.debug(`SSE 连接关闭: ${jobId}`);
    });

    logger.debug(`SSE 连接建立: ${jobId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jobs/:jobId/poll
 * Polling 兜底（SSE 不可用时）
 */
router.get('/:jobId/poll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const afterSeq = parseInt(req.query.afterSeq as string, 10) || 0;

    // 获取 Job
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, 404, 'JOB_NOT_FOUND', 'Job 不存在');
    }

    // 获取事件
    const events = getEventsAfter(jobId, afterSeq);

    res.json({
      success: true,
      data: {
        job: {
          job_id: job.id,
          status: job.status,
          seq: job.seq,
          updated_at: job.updated_at,
        },
        events: events.map((e) => ({
          seq: e.seq,
          type: e.type,
          payload: e.payload_json,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
