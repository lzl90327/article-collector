/**
 * usePolling.ts
 * 轮询fallback机制Hook
 * 当SSE不可用时自动切换到Polling
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/** 轮询Hook返回类型 */
export interface UsePollingResult<T> {
  /** 当前数据 */
  data: T | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 开始轮询 */
  start: () => void;
  /** 停止轮询 */
  stop: () => void;
}

/** 轮询配置选项 */
export interface UsePollingOptions {
  /** 轮询间隔(毫秒)，默认3000ms */
  interval?: number;
  /** 是否立即开始 */
  immediate?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试间隔(毫秒) */
  retryInterval?: number;
}

/**
 * 轮询Hook
 * @param fetcher - 数据获取函数
 * @param options - 轮询配置选项
 * @returns 轮询状态和控制器
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions = {}
): UsePollingResult<T> {
  const {
    interval = 3000,
    immediate = false,
    maxRetries = 3,
    retryInterval = 1000,
  } = options;

  // 状态
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // 使用ref存储定时器和状态，避免闭包问题
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // 清理定时器
  const clearPollingTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 执行一次轮询
  const executePoll = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      
      if (!isMountedRef.current) return;

      setData(result);
      retryCountRef.current = 0; // 重置重试计数
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);

      // 重试逻辑
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.warn(`[usePolling] 轮询失败，第${retryCountRef.current}次重试:`, error.message);
        
        // 延迟后重试
        timerRef.current = setTimeout(() => {
          if (isRunningRef.current && isMountedRef.current) {
            executePoll();
          }
        }, retryInterval);
        return;
      } else {
        console.error('[usePolling] 轮询达到最大重试次数:', error.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }

    // 继续下一次轮询
    if (isRunningRef.current && isMountedRef.current) {
      timerRef.current = setTimeout(() => {
        executePoll();
      }, interval);
    }
  }, [fetcher, interval, maxRetries, retryInterval]);

  // 开始轮询
  const start = useCallback(() => {
    if (isRunningRef.current) return;
    
    isRunningRef.current = true;
    retryCountRef.current = 0;
    executePoll();
  }, [executePoll]);

  // 停止轮询
  const stop = useCallback(() => {
    isRunningRef.current = false;
    clearPollingTimer();
  }, [clearPollingTimer]);

  // 组件挂载时处理
  useEffect(() => {
    isMountedRef.current = true;

    // 如果配置了立即开始，则启动轮询
    if (immediate) {
      start();
    }

    // 清理函数
    return () => {
      isMountedRef.current = false;
      stop();
    };
  }, [immediate, start, stop]);

  return {
    data,
    loading,
    error,
    start,
    stop,
  };
}

export default usePolling;
