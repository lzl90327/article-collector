/**
 * useSession.ts
 * Session状态管理Hook
 * 获取和管理Session状态
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSession,
  createSession as apiCreateSession,
  updateSession as apiUpdateSession,
} from '../api/sessions';
import type {
  Session,
  CreateSessionRequest,
  UpdateSessionRequest,
} from '../types/session';

/** useSession返回类型 */
export interface UseSessionResult {
  /** 当前Session */
  session: Session | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新Session数据 */
  refresh: () => Promise<void>;
  /** 更新Session */
  updateSession: (data: UpdateSessionRequest) => Promise<Session | null>;
  /** 创建新Session */
  createSession: (data: CreateSessionRequest) => Promise<Session | null>;
}

/**
 * Session状态管理Hook
 * @param sessionId - Session ID，可选，不提供则不加载
 * @returns Session状态和CRUD操作
 */
export function useSession(sessionId?: string): UseSessionResult {
  // 状态
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const isMountedRef = useRef<boolean>(true);
  const currentSessionIdRef = useRef<string | undefined>(sessionId);

  // 更新当前sessionId引用
  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  // 加载Session
  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getSession(sessionId);
      if (isMountedRef.current) {
        setSession(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('[useSession] 加载Session失败:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [sessionId]);

  // 刷新Session数据
  const refresh = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  // 更新Session
  const updateSession = useCallback(
    async (data: UpdateSessionRequest): Promise<Session | null> => {
      if (!sessionId) {
        console.warn('[useSession] 无法更新Session: sessionId未提供');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const updatedSession = await apiUpdateSession(sessionId, data);
        if (isMountedRef.current) {
          setSession(updatedSession);
        }
        return updatedSession;
      } catch (err) {
        if (isMountedRef.current) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          console.error('[useSession] 更新Session失败:', error);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [sessionId]
  );

  // 创建新Session
  const createSession = useCallback(
    async (data: CreateSessionRequest): Promise<Session | null> => {
      setLoading(true);
      setError(null);

      try {
        const newSession = await apiCreateSession(data);
        if (isMountedRef.current) {
          setSession(newSession);
        }
        return newSession;
      } catch (err) {
        if (isMountedRef.current) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          console.error('[useSession] 创建Session失败:', error);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // 监听sessionId变化，自动加载
  useEffect(() => {
    isMountedRef.current = true;

    if (sessionId) {
      loadSession();
    } else {
      setSession(null);
      setError(null);
    }

    // 清理函数
    return () => {
      isMountedRef.current = false;
    };
  }, [sessionId, loadSession]);

  return {
    session,
    loading,
    error,
    refresh,
    updateSession,
    createSession,
  };
}

export default useSession;
