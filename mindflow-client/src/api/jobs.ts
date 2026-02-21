/**
 * Job API
 */

import { request, streamRequest } from './index';
import type {
  Job,
  JobStatus,
  CreateJobRequest,
  CreateJobResponse,
  GetJobResponse,
  CommitJobRequest,
  CommitJobResponse,
  CancelJobResponse,
  PollJobResponse,
  SSEEventData,
} from '../types/job';

/**
 * 创建 Job
 */
export async function createJob(
  data: CreateJobRequest
): Promise<CreateJobResponse['data']['job']> {
  const response = await request<CreateJobResponse['data']>('/jobs', {
    method: 'POST',
    data,
  });
  return response.job;
}

/**
 * 获取 Job 状态
 */
export async function getJob(
  jobId: string
): Promise<GetJobResponse['data']['job']> {
  const response = await request<GetJobResponse['data']>(`/jobs/${jobId}`);
  return response.job;
}

/**
 * 固化 Job 为 Artifact
 */
export async function commitJob(
  jobId: string,
  data: CommitJobRequest
): Promise<CommitJobResponse['data']['artifact']> {
  const response = await request<CommitJobResponse['data']>(
    `/jobs/${jobId}/commit`,
    {
      method: 'POST',
      data,
    }
  );
  return response.artifact;
}

/**
 * 取消 Job
 */
export async function cancelJob(
  jobId: string
): Promise<CancelJobResponse['data']> {
  const response = await request<CancelJobResponse['data']>(
    `/jobs/${jobId}/cancel`,
    {
      method: 'POST',
    }
  );
  return response;
}

/**
 * 订阅 Job SSE 流
 */
export function subscribeJobStream(
  jobId: string,
  callbacks: {
    onStatus?: (data: SSEEventData) => void;
    onStarted?: (data: SSEEventData) => void;
    onDelta?: (data: SSEEventData) => void;
    onProgress?: (data: SSEEventData) => void;
    onError?: (data: SSEEventData) => void;
    onCompleted?: (data: SSEEventData) => void;
    onConnectionError?: (error: Error) => void;
  }
): () => void {
  return streamRequest(
    `/jobs/${jobId}/stream`,
    (message) => {
      const { event, data } = message as { event: string; data: SSEEventData };

      switch (event) {
        case 'job.status':
          callbacks.onStatus?.(data);
          break;
        case 'job.started':
          callbacks.onStarted?.(data);
          break;
        case 'job.delta':
          callbacks.onDelta?.(data);
          break;
        case 'job.progress':
          callbacks.onProgress?.(data);
          break;
        case 'job.error':
          callbacks.onError?.(data);
          break;
        case 'job.completed':
          callbacks.onCompleted?.(data);
          break;
      }
    },
    callbacks.onConnectionError
  );
}

/**
 * Polling 获取 Job 更新
 */
export async function pollJob(
  jobId: string,
  afterSeq: number
): Promise<PollJobResponse['data']> {
  const response = await request<PollJobResponse['data']>(
    `/jobs/${jobId}/poll?afterSeq=${afterSeq}`
  );
  return response;
}

/**
 * 等待 Job 完成（轮询方式）
 */
export async function waitForJobCompletion(
  jobId: string,
  options: {
    interval?: number;
    timeout?: number;
    onProgress?: (status: JobStatus) => void;
  } = {}
): Promise<GetJobResponse['data']['job']> {
  const { interval = 1000, timeout = 300000, onProgress } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const job = await getJob(jobId);
        onProgress?.(job.status);

        if (job.status === 'completed') {
          resolve(job);
          return;
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
          reject(new Error(`Job ${job.status}`));
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('Job wait timeout'));
          return;
        }

        setTimeout(check, interval);
      } catch (error) {
        reject(error);
      }
    };

    check();
  });
}
