/**
 * useJobStream.ts
 * Job流式数据管理Hook
 * 管理Job的SSE流式连接，自动降级到Polling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeJobStream, pollJob, getJob } from '../api/jobs';
import type { Job, JobStatus, SSEEventData, JobEventType } from '../types/job';

/** Job事件 */
export interface JobStreamEvent {
  /** 事件类型 */
  type: JobEventType;
  /** 事件数据 */
  data: SSEEventData;
  /** 事件时间戳 */
  timestamp: number;
}

/** useJobStream返回类型 */
export interface UseJobStreamResult {
  /** 当前Job状态 */
  job: Job | null;
  /** 累积的事件列表 */
  events: JobStreamEvent[];
  /** 是否正在加载/连接中 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 手动重连 */
  reconnect: () => void;
  /** 是否使用Polling模式 */
  isPolling: boolean;
}

/** 连接模式 */
type ConnectionMode = 'sse' | 'polling' | 'idle';

/**
 * Job流式数据管理Hook
 * @param jobId - Job ID，为null时不连接
 * @returns Job流状态和控制器
 */
export function useJobStream(jobId: string | null): UseJobStreamResult {
  // 状态
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<JobStreamEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Refs
  const modeRef = useRef<ConnectionMode>('idle');
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const reconnectAttemptRef = useRef<number>(0);
  const maxReconnectAttempts = 3;

  // 清理函数
  const cleanup = useCallback(() => {
    // 清理SSE订阅
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    // 清理轮询定时器
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    modeRef.current = 'idle';
  }, []);

  // 添加事件到列表
  const addEvent = useCallback((type: JobEventType, data: SSEEventData) => {
    if (!isMountedRef.current) return;

    const event: JobStreamEvent = {
      type,
      data,
      timestamp: Date.now(),
    };

    setEvents(prev => [...prev, event]);
    lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);

    // 更新Job状态
    setJob(prevJob => {
      if (!prevJob) return null;
      return {
        ...prevJob,
        status: data.status,
        seq: data.seq,
        snapshot: data.snapshot || prevJob.snapshot,
      };
    });
  }, []);

  // 轮询获取更新
  const pollForUpdates = useCallback(async () => {
    if (!jobId || !isMountedRef.current || modeRef.current !== 'polling') return;

    try {
      const response = await pollJob(jobId, lastSeqRef.current);

      if (!isMountedRef.current) return;

      // 处理事件
      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          addEvent(event.type, {
            job_id: response.job.job_id,
            status: response.job.status,
            seq: event.seq,
            ts: Date.now(),
            ...event.payload,
          });
        }
      }

      // 更新Job状态
      setJob(prevJob => {
        if (!prevJob) return null;
        return {
          ...prevJob,
          status: response.job.status,
          seq: response.job.seq,
        };
      });

      // 如果Job已完成或失败，停止轮询
      if (response.job.status === 'completed' || 
          response.job.status === 'failed' ||
          response.job.status === 'cancelled') {
        return;
      }

      // 继续轮询
      if (modeRef.current === 'polling' && isMountedRef.current) {
        pollTimerRef.current = setTimeout(() => {
          pollForUpdates();
        }, 2000);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('[useJobStream] 轮询失败:', err);
      // 轮询失败不立即停止，继续尝试
      if (modeRef.current === 'polling' && isMountedRef.current) {
        pollTimerRef.current = setTimeout(() => {
          pollForUpdates();
        }, 5000);
      }
    }
  }, [jobId, addEvent]);

  // 切换到Polling模式
  const switchToPolling = useCallback(() => {
    console.log('[useJobStream] 切换到Polling模式');
    cleanup();
    modeRef.current = 'polling';
    setIsPolling(true);
    pollForUpdates();
  }, [cleanup, pollForUpdates]);

  // 连接SSE
  const connectSSE = useCallback(() => {
    if (!jobId) return;

    console.log('[useJobStream] 尝试SSE连接');
    modeRef.current = 'sse';
    setIsPolling(false);
    setLoading(true);
    setError(null);

    // 先获取初始Job状态
    getJob(jobId)
      .then(initialJob => {
        if (!isMountedRef.current) return;
        setJob(initialJob);
        lastSeqRef.current = initialJob.seq;
      })
      .catch(err => {
        console.error('[useJobStream] 获取初始Job状态失败:', err);
      });

    // 订阅SSE
    const unsubscribe = subscribeJobStream(jobId, {
      onStatus: (data) => addEvent('job.status', data),
      onStarted: (data) => addEvent('job.started', data),
      onDelta: (data) => addEvent('job.delta', data),
      onProgress: (data) => addEvent('job.progress', data),
      onError: (data) => addEvent('job.error', data),
      onCompleted: (data) => {
        addEvent('job.completed', data);
        // Job完成，自动清理
        cleanup();
      },
      onConnectionError: (err) => {
        console.error('[useJobStream] SSE连接错误:', err);
        
        if (!isMountedRef.current) return;

        reconnectAttemptRef.current++;
        
        if (reconnectAttemptRef.current <= maxReconnectAttempts) {
          console.log(`[useJobStream] SSE重连尝试 ${reconnectAttemptRef.current}/${maxReconnectAttempts}`);
          // 延迟后重连
          setTimeout(() => {
            if (isMountedRef.current && modeRef.current === 'sse') {
              cleanup();
              connectSSE();
            }
          }, 1000 * reconnectAttemptRef.current);
        } else {
          // 超过最大重试次数，切换到Polling
          setError(new Error('SSE连接失败，切换到轮询模式'));
          switchToPolling();
        }
      },
    });

    unsubscribeRef.current = unsubscribe;
    setLoading(false);
  }, [jobId, addEvent, cleanup, switchToPolling]);

  // 手动重连
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    cleanup();
    setEvents([]);
    setError(null);
    if (jobId) {
      connectSSE();
    }
  }, [jobId, cleanup, connectSSE]);

  // 监听jobId变化
  useEffect(() => {
    isMountedRef.current = true;

    if (!jobId) {
      cleanup();
      setJob(null);
      setEvents([]);
      setError(null);
      return;
    }

    // 重置状态
    setEvents([]);
    setError(null);
    reconnectAttemptRef.current = 0;
    lastSeqRef.current = 0;

    // 开始SSE连接
    connectSSE();

    // 清理函数
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [jobId, cleanup, connectSSE]);

  return {
    job,
    events,
    loading,
    error,
    reconnect,
    isPolling,
  };
}

export default useJobStream;
