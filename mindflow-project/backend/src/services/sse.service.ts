/**
 * SSE Service
 * Server-Sent Events 管理：事件流创建、事件发送、历史事件查询
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import type { JobEvent, JobEventType, JobError } from '../types/job';

// 内存中的事件存储（用于 polling 兜底）
const jobEvents = new Map<string, Map<number, JobEvent>>();
const jobEmitters = new Map<string, EventEmitter>();

// 最大保留事件数
const MAX_EVENTS_PER_JOB = 1000;

/**
 * 创建或获取 Job 的事件流
 */
export function createEventStream(
  jobId: string,
  lastEventId?: number
): EventEmitter {
  // 如果已存在，返回现有 emitter
  if (jobEmitters.has(jobId)) {
    return jobEmitters.get(jobId)!;
  }

  // 创建新的 emitter
  const emitter = new EventEmitter();
  jobEmitters.set(jobId, emitter);

  // 初始化事件存储
  if (!jobEvents.has(jobId)) {
    jobEvents.set(jobId, new Map());
  }

  logger.debug(`SSE EventStream 创建: ${jobId}`);

  return emitter;
}

/**
 * 获取 Job 的事件存储
 */
function getJobEventStore(jobId: string): Map<number, JobEvent> {
  if (!jobEvents.has(jobId)) {
    jobEvents.set(jobId, new Map());
  }
  return jobEvents.get(jobId)!;
}

/**
 * 存储事件
 */
function storeEvent(jobId: string, event: JobEvent): void {
  const store = getJobEventStore(jobId);
  store.set(event.seq, event);

  // 清理旧事件，保留最新的 MAX_EVENTS_PER_JOB 个
  if (store.size > MAX_EVENTS_PER_JOB) {
    const keys = Array.from(store.keys()).sort((a, b) => a - b);
    const toDelete = keys.slice(0, store.size - MAX_EVENTS_PER_JOB);
    toDelete.forEach((key) => store.delete(key));
  }
}

/**
 * 发送 Job 开始事件
 */
export function emitStarted(
  jobId: string,
  sessionId: string,
  task: string,
  phase: string
): void {
  const emitter = jobEmitters.get(jobId);
  if (!emitter) {
    logger.warn(`尝试发送 started 事件但 emitter 不存在: ${jobId}`);
    return;
  }

  const data = {
    job_id: jobId,
    session_id: sessionId,
    task,
    phase,
    ts: Date.now(),
  };

  emitter.emit('started', data);

  logger.debug(`SSE started 事件: ${jobId}`);
}

/**
 * 发送文本增量事件
 */
export function emitDelta(
  jobId: string,
  seq: number,
  delta: string
): void {
  const emitter = jobEmitters.get(jobId);
  if (!emitter) {
    return;
  }

  const data = {
    job_id: jobId,
    seq,
    delta,
    ts: Date.now(),
  };

  // 存储事件
  storeEvent(jobId, {
    id: `${jobId}-${seq}`,
    job_id: jobId,
    seq,
    type: 'delta' as JobEventType,
    payload_json: { delta },
    created_at: new Date(),
  });

  emitter.emit('delta', data);
}

/**
 * 发送进度事件
 */
export function emitProgress(
  jobId: string,
  seq: number,
  step: string,
  percent: number
): void {
  const emitter = jobEmitters.get(jobId);
  if (!emitter) {
    return;
  }

  const data = {
    job_id: jobId,
    seq,
    step,
    percent,
    ts: Date.now(),
  };

  // 存储事件
  storeEvent(jobId, {
    id: `${jobId}-${seq}`,
    job_id: jobId,
    seq,
    type: 'progress' as JobEventType,
    payload_json: { step, percent },
    created_at: new Date(),
  });

  emitter.emit('progress', data);
}

/**
 * 发送错误事件
 */
export function emitError(
  jobId: string,
  seq: number,
  error: JobError
): void {
  const emitter = jobEmitters.get(jobId);
  if (!emitter) {
    return;
  }

  const data = {
    job_id: jobId,
    seq,
    retryable: error.retryable,
    code: error.code,
    message: error.message,
    ts: Date.now(),
  };

  // 存储事件
  storeEvent(jobId, {
    id: `${jobId}-${seq}`,
    job_id: jobId,
    seq,
    type: 'error' as JobEventType,
    payload_json: error,
    created_at: new Date(),
  });

  emitter.emit('error', data);
}

/**
 * 发送完成事件
 */
export function emitCompleted(
  jobId: string,
  seq: number,
  isFinal: boolean = true
): void {
  const emitter = jobEmitters.get(jobId);
  if (!emitter) {
    return;
  }

  const data = {
    job_id: jobId,
    seq,
    is_final: isFinal,
    ts: Date.now(),
  };

  // 存储事件
  storeEvent(jobId, {
    id: `${jobId}-${seq}`,
    job_id: jobId,
    seq,
    type: 'completed' as JobEventType,
    payload_json: { is_final: isFinal },
    created_at: new Date(),
  });

  emitter.emit('completed', data);

  // 完成后清理 emitter（保留事件存储供 polling 使用）
  setTimeout(() => {
    jobEmitters.delete(jobId);
    logger.debug(`SSE EventStream 清理: ${jobId}`);
  }, 60000); // 1 分钟后清理
}

/**
 * 获取指定序号之后的事件（用于 polling 兜底）
 */
export function getEventsAfter(
  jobId: string,
  afterSeq: number
): JobEvent[] {
  const store = getJobEventStore(jobId);
  const events: JobEvent[] = [];

  for (const [seq, event] of store.entries()) {
    if (seq > afterSeq) {
      events.push(event);
    }
  }

  // 按序号排序
  return events.sort((a, b) => a.seq - b.seq);
}

/**
 * 清理 Job 的所有事件数据
 */
export function cleanupJobEvents(jobId: string): void {
  jobEvents.delete(jobId);
  jobEmitters.delete(jobId);
  logger.debug(`Job 事件数据清理: ${jobId}`);
}

/**
 * 获取 SSE 格式的数据字符串
 */
export function formatSSE(event: string, id: string, data: object): string {
  return `event: ${event}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 获取 Job 的 EventEmitter
 */
export function getJobEmitter(jobId: string): EventEmitter | undefined {
  return jobEmitters.get(jobId);
}
