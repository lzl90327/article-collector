/**
 * Job 类型定义
 * Phase1 重构后的 Job 模型
 */

/** Job 状态 */
export type JobStatus =
  | 'queued'      // 排队中
  | 'running'     // 执行中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled'   // 已取消
  | 'committed';  // 已固化

/** Job 任务类型 */
export type JobTask =
  | 'generate_brief'      // 生成 Brief
  | 'generate_outline'    // 生成大纲
  | 'generate_draft'      // 生成草稿
  | 'audit_draft';        // 审校草稿

/** Job 进度 */
export interface JobProgress {
  step: string;
  percent: number;
}

/** Job 错误 */
export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
}

/** Job */
export interface Job {
  id: string;
  session_id: string;
  phase: string;
  task: JobTask;
  status: JobStatus;
  seq: number;
  snapshot: string;
  progress_json: JobProgress | null;
  error_json: JobError | null;
  inputs_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** SSE 事件类型 */
export type JobEventType =
  | 'job.status'
  | 'job.started'
  | 'job.delta'
  | 'job.progress'
  | 'job.error'
  | 'job.completed';

/** Job 事件 */
export interface JobEvent {
  seq: number;
  type: JobEventType;
  payload_json: Record<string, unknown>;
  created_at: string;
}

/** 创建 Job 请求 */
export interface CreateJobRequest {
  session_id: string;
  task: JobTask;
  phase: string;
  inputs?: Record<string, unknown>;
}

/** 创建 Job 响应 */
export interface CreateJobResponse {
  success: boolean;
  data: {
    job: {
      job_id: string;
      status: JobStatus;
      seq: number;
    };
  };
}

/** 获取 Job 响应 */
export interface GetJobResponse {
  success: boolean;
  data: {
    job: {
      job_id: string;
      session_id: string;
      task: JobTask;
      status: JobStatus;
      seq: number;
      snapshot: string;
      progress: JobProgress | null;
      error: JobError | null;
      updated_at: string;
    };
  };
}

/** 固化 Job 请求 */
export interface CommitJobRequest {
  artifact_kind: 'brief_card' | 'outline' | 'draft' | 'review_report';
  mode: 'new_version' | 'overwrite';
  title?: string;
}

/** 固化 Job 响应 */
export interface CommitJobResponse {
  success: boolean;
  data: {
    artifact: {
      artifact_id: string;
      kind: string;
      version: number | null;
      title: string | null;
      created_at: string;
    };
  };
}

/** 取消 Job 响应 */
export interface CancelJobResponse {
  success: boolean;
  data: {
    success: boolean;
    job_id: string;
    status: 'cancelled';
  };
}

/** Polling 响应 */
export interface PollJobResponse {
  success: boolean;
  data: {
    job: {
      job_id: string;
      status: JobStatus;
      seq: number;
      updated_at: string;
    };
    events: Array<{
      seq: number;
      type: JobEventType;
      payload: Record<string, unknown>;
    }>;
  };
}

/** SSE 事件数据 */
export interface SSEEventData {
  job_id: string;
  status: JobStatus;
  seq: number;
  ts: number;
  delta?: string;
  snapshot?: string;
  step?: string;
  percent?: number;
  error?: JobError;
}
