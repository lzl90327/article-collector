/**
 * Job Service
 * 轻量任务管理：创建、查询、状态更新、固化
 */

import { prisma } from '../lib/prisma';
import { AppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  Job,
  JobStatus,
  CreateJobRequest,
} from '../types/job';
import type { Artifact, ArtifactKind, ArtifactMeta } from '../types/artifact';

// 扩展 Prisma Job 类型
interface PrismaJob {
  id: string;
  session_id: string;
  phase: string;
  task: string;
  status: string;
  seq: number;
  snapshot: string;
  progress_json: any;
  error_json: any;
  inputs_json: any;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建 Job
 */
export async function createJob(data: CreateJobRequest): Promise<Job> {
  const { session_id, task, phase, inputs = {} } = data;

  // 检查 session 是否存在
  const session = await prisma.session.findUnique({
    where: { id: session_id },
  });

  if (!session) {
    throw new AppError('SESSION_NOT_FOUND', ErrorCode.STORAGE_NOT_FOUND);
  }

  // Brief 未确认时禁止生成大纲/草稿
  if (
    (task === 'generate_outline' || task === 'generate_draft') &&
    !session.brief_confirmed
  ) {
    throw new AppError(
      'BRIEF_NOT_CONFIRMED',
      ErrorCode.BRIEF_NOT_CONFIRMED,
      false,
      { current_phase: session.phase, required_action: 'confirm_brief' },
      409
    );
  }

  const job = await prisma.job.create({
    data: {
      session_id,
      task,
      phase,
      status: 'queued',
      seq: 0,
      snapshot: '',
      inputs_json: inputs,
    },
  });

  logger.info(`Job 创建成功: ${job.id}`, { session_id, task, phase });

  return mapPrismaJobToJob(job as PrismaJob);
}

/**
 * 获取 Job
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return null;
  }

  return mapPrismaJobToJob(job as PrismaJob);
}

/**
 * 更新 Job 状态
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new AppError('JOB_NOT_FOUND', ErrorCode.STORAGE_NOT_FOUND);
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status },
  });

  logger.debug(`Job 状态更新: ${jobId} -> ${status}`);
}

/**
 * 更新 Job Snapshot
 */
export async function updateJobSnapshot(
  jobId: string,
  seq: number,
  snapshot: string
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { seq, snapshot },
  });
}

/**
 * 更新 Job 进度
 */
export async function updateJobProgress(
  jobId: string,
  step: string,
  percent: number
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      progress_json: { step, percent },
    },
  });
}

/**
 * 更新 Job 错误
 */
export async function updateJobError(
  jobId: string,
  error: { code: string; message: string; retryable: boolean }
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      error_json: error,
    },
  });

  logger.error(`Job 执行失败: ${jobId}`, error);
}

/**
 * 固化为 Artifact
 */
export async function commitJob(
  jobId: string,
  kind: ArtifactKind,
  title?: string
): Promise<Artifact> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new AppError('JOB_NOT_FOUND', ErrorCode.STORAGE_NOT_FOUND);
  }

  if (job.status !== 'completed') {
    throw new AppError(
      'JOB_NOT_COMPLETED',
      ErrorCode.JOB_NOT_COMPLETED,
      false,
      { current_status: job.status },
      409
    );
  }

  // 计算版本号
  let version: number | null = null;
  if (kind === 'draft' || kind === 'review_report') {
    const latestArtifact = await prisma.artifact.findFirst({
      where: { session_id: job.session_id, kind },
      orderBy: { version: 'desc' },
    });
    version = (latestArtifact?.version ?? 0) + 1;
  }

  // 创建 Artifact
  const artifact = await prisma.artifact.create({
    data: {
      session_id: job.session_id,
      kind,
      version,
      title: title || null,
      content: job.snapshot,
      meta_json: {
        source_task: job.task,
        committed_at: new Date().toISOString(),
      },
      source_job_id: jobId,
    },
  });

  // 更新 Job 状态为 committed
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'committed' },
  });

  logger.info(`Job 固化成功: ${jobId} -> Artifact ${artifact.id}`, {
    kind,
    version,
  });

  return {
    id: artifact.id,
    session_id: artifact.session_id,
    kind: artifact.kind as ArtifactKind,
    version: artifact.version,
    title: artifact.title,
    content: artifact.content,
    meta_json: (artifact.meta_json || {}) as ArtifactMeta,
    source_job_id: artifact.source_job_id,
    created_at: artifact.created_at,
  };
}

/**
 * 取消 Job
 */
export async function cancelJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new AppError('JOB_NOT_FOUND', ErrorCode.STORAGE_NOT_FOUND);
  }

  if (job.status === 'committed' || job.status === 'cancelled') {
    throw new AppError(
      'JOB_CANNOT_CANCEL',
      ErrorCode.JOB_CANNOT_CANCEL,
      false,
      { current_status: job.status },
      409
    );
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'cancelled' },
  });

  logger.info(`Job 已取消: ${jobId}`);
}

/**
 * 获取 Session 的所有 Jobs
 */
export async function getJobsBySession(
  sessionId: string,
  limit: number = 20
): Promise<Job[]> {
  const jobs = await prisma.job.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return jobs.map((job: any) => mapPrismaJobToJob(job as PrismaJob));
}

/**
 * Prisma Job 转换为应用 Job
 */
function mapPrismaJobToJob(prismaJob: PrismaJob): Job {
  return {
    id: prismaJob.id,
    session_id: prismaJob.session_id,
    phase: prismaJob.phase,
    task: prismaJob.task as Job['task'],
    status: prismaJob.status as JobStatus,
    seq: prismaJob.seq,
    snapshot: prismaJob.snapshot,
    progress_json: prismaJob.progress_json,
    error_json: prismaJob.error_json,
    inputs_json: prismaJob.inputs_json,
    created_at: prismaJob.created_at,
    updated_at: prismaJob.updated_at,
  };
}
