/**
 * Job 类型定义
 * 轻量任务系统：状态 + seq + snapshot + 错误
 */

// ==================== Job 状态 ====================
export type JobStatus = 
  | 'queued'      // 队列中，等待执行
  | 'running'     // 执行中
  | 'paused'      // 暂停
  | 'failed'      // 失败
  | 'completed'   // 完成，待 commit
  | 'committed'   // 已固化为 Artifact
  | 'cancelled';  // 已取消

// ==================== Job 任务类型 ====================
export type JobTask = 
  | 'generate_brief'      // 生成 Brief (Phase -1)
  | 'generate_outline'    // 生成大纲
  | 'generate_draft'      // 生成草稿 (Phase 4)
  | 'audit_draft'         // 审核草稿 (Phase 4.5)
  | 'review'              // 审阅
  | 'rewrite_paragraph'   // 段落重写
  | 'publish_dry_run'     // 发布预演
  | 'publish';            // 正式发布

// ==================== Job 事件类型 ====================
export type JobEventType = 
  | 'delta'       // 文本增量
  | 'progress'    // 进度更新
  | 'error'       // 错误
  | 'completed';  // 完成

// ==================== Job 模型 ====================
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
  inputs_json: JobInputs;
  created_at: Date;
  updated_at: Date;
}

// ==================== Job 进度 ====================
export interface JobProgress {
  step: string;       // 当前步骤名称
  percent: number;    // 进度百分比 0-1
}

// ==================== Job 错误 ====================
export interface JobError {
  code: string;       // 错误码
  message: string;    // 错误信息
  retryable: boolean; // 是否可重试
}

// ==================== Job 输入参数 ====================
export interface JobInputs {
  // 生成类任务
  brief_artifact_id?: string;
  outline_artifact_id?: string;
  style_preset?: string;
  
  // 重写类任务
  paragraph_index?: number;
  original_text?: string;
  instruction?: string;
  
  // 发布类任务
  artifact_id?: string;
  preset_id?: string;
  channels?: string[];
  
  // 扩展字段
  [key: string]: any;
}

// ==================== Job 事件 ====================
export interface JobEvent {
  id: string;
  job_id: string;
  seq: number;
  type: JobEventType;
  payload_json: JobEventPayload;
  created_at: Date;
}

// ==================== Job 事件载荷 ====================
export type JobEventPayload = 
  | JobDeltaPayload
  | JobProgressPayload
  | JobErrorPayload
  | JobCompletedPayload;

export interface JobDeltaPayload {
  delta: string;  // 文本增量
}

export interface JobProgressPayload {
  step: string;
  percent: number;
}

export interface JobErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
}

export interface JobCompletedPayload {
  is_final: boolean;
}

// ==================== API 请求/响应类型 ====================

// POST /api/jobs
export interface CreateJobRequest {
  session_id: string;
  task: JobTask;
  phase: string;
  inputs?: JobInputs;
}

export interface CreateJobResponse {
  job: {
    job_id: string;
    status: JobStatus;
    seq: number;
  };
}

// GET /api/jobs/:jobId
export interface GetJobResponse {
  job: {
    job_id: string;
    session_id: string;
    task: JobTask;
    status: JobStatus;
    seq: number;
    snapshot: string;
    progress: JobProgress | null;
    error: JobError | null;
    updated_at: Date;
  };
}

// POST /api/jobs/:jobId/commit
export interface CommitJobRequest {
  artifact_kind: 'draft' | 'review_report' | 'outline' | 'brief_card';
  mode: 'new_version';
  title?: string;
}

export interface CommitJobResponse {
  artifact: {
    artifact_id: string;
    kind: string;
    version: number | null;
    title: string | null;
    created_at: Date;
  };
}

// POST /api/jobs/:jobId/cancel
export interface CancelJobResponse {
  success: boolean;
  job_id: string;
  status: JobStatus;
}

// GET /api/jobs/:jobId/poll
export interface PollJobRequest {
  afterSeq: number;
}

export interface PollJobResponse {
  job: {
    job_id: string;
    status: JobStatus;
    seq: number;
    updated_at: Date;
  };
  events: PollEvent[];
}

export interface PollEvent {
  seq: number;
  type: JobEventType;
  payload: JobEventPayload;
}

// ==================== SSE 事件类型 ====================

export interface SSEEvent {
  event: string;
  id: string;
  data: string;
}

// job.started
export interface JobStartedEvent {
  job_id: string;
  session_id: string;
  task: JobTask;
  phase: string;
  ts: number;
}

// job.delta
export interface JobDeltaEvent {
  job_id: string;
  seq: number;
  delta: string;
  ts: number;
}

// job.progress
export interface JobProgressEvent {
  job_id: string;
  seq: number;
  step: string;
  percent: number;
  ts: number;
}

// job.error
export interface JobErrorEvent {
  job_id: string;
  seq: number;
  retryable: boolean;
  code: string;
  message: string;
  ts: number;
}

// job.completed
export interface JobCompletedEvent {
  job_id: string;
  seq: number;
  is_final: boolean;
  ts: number;
}

// session.state (可选)
export interface SessionStateEvent {
  session_id: string;
  phase: string;
  substate: string;
  pending_input: string | null;
  next_actions: NextAction[];
  ts: number;
}

export interface NextAction {
  id: string;
  label: string;
  primary: boolean;
}
