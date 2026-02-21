/**
 * Session API
 */

import { request } from './index';
import type {
  Session,
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  ListSessionsResponse,
  SessionArtifactsResponse,
} from '../types/session';

/**
 * 创建 Session
 */
export async function createSession(
  data: CreateSessionRequest
): Promise<Session> {
  const response = await request<CreateSessionResponse['data']>('/sessions', {
    method: 'POST',
    data,
  });
  return response.session;
}

/**
 * 获取 Session 列表
 */
export async function listSessions(): Promise<Session[]> {
  const response = await request<ListSessionsResponse['data']>('/sessions');
  return response.sessions;
}

/**
 * 获取单个 Session
 */
export async function getSession(sessionId: string): Promise<Session> {
  const response = await request<GetSessionResponse['data']>(
    `/sessions/${sessionId}`
  );
  return response.session;
}

/**
 * 更新 Session
 */
export async function updateSession(
  sessionId: string,
  data: UpdateSessionRequest
): Promise<Session> {
  const response = await request<UpdateSessionResponse['data']>(
    `/sessions/${sessionId}`,
    {
      method: 'PATCH',
      data,
    }
  );
  return response.session;
}

/**
 * 获取 Session 的 Artifacts
 */
export async function getSessionArtifacts(
  sessionId: string
): Promise<SessionArtifactsResponse['data']['artifacts']> {
  const response = await request<SessionArtifactsResponse['data']>(
    `/sessions/${sessionId}/artifacts`
  );
  return response.artifacts;
}
