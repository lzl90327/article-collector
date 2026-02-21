/**
 * Artifact API
 */

import { request } from './index';
import type {
  Artifact,
  GetArtifactResponse,
  RollbackArtifactResponse,
  GetArtifactDiffResponse,
  ArtifactListItem,
  ArtifactKind,
} from '../types/artifact';

/**
 * 获取 Artifact
 */
export async function getArtifact(artifactId: string): Promise<Artifact> {
  const response = await request<GetArtifactResponse['data']>(
    `/artifacts/${artifactId}`
  );
  const artifact = response.artifact;
  return {
    id: artifact.artifact_id,
    session_id: artifact.session_id,
    kind: artifact.kind,
    version: artifact.version,
    title: artifact.title,
    content: artifact.content,
    meta_json: artifact.meta,
    source_job_id: artifact.source_job_id,
    created_at: artifact.created_at,
  };
}

/**
 * 回滚 Artifact
 */
export async function rollbackArtifact(
  artifactId: string
): Promise<RollbackArtifactResponse['data']['artifact']> {
  const response = await request<RollbackArtifactResponse['data']>(
    `/artifacts/${artifactId}/rollback`,
    {
      method: 'POST',
    }
  );
  return response.artifact;
}

/**
 * 获取 Artifact 差异
 */
export async function getArtifactDiff(
  artifactId: string
): Promise<GetArtifactDiffResponse['data']['diff']> {
  const response = await request<GetArtifactDiffResponse['data']>(
    `/artifacts/${artifactId}/diff`
  );
  return response.diff;
}

/**
 * 获取 Session 的所有 Artifacts
 */
export async function getSessionArtifacts(
  sessionId: string
): Promise<ArtifactListItem[]> {
  // 复用 sessions API
  const { getSessionArtifacts: getSessionArtifactsFromSessions } = await import('./sessions');
  const artifacts = await getSessionArtifactsFromSessions(sessionId);
  return artifacts.map(a => ({
    artifact_id: a.artifact_id,
    kind: a.kind as ArtifactKind,
    version: a.version,
    title: a.title,
    created_at: a.created_at,
  }));
}

/**
 * 获取 Session 的 Draft Artifacts
 */
export async function getSessionDrafts(
  sessionId: string
): Promise<ArtifactListItem[]> {
  const artifacts = await getSessionArtifacts(sessionId);
  return artifacts.filter((a) => a.kind === 'draft');
}

/**
 * 获取 Session 的 Review Report Artifacts
 */
export async function getSessionReviewReports(
  sessionId: string
): Promise<ArtifactListItem[]> {
  const artifacts = await getSessionArtifacts(sessionId);
  return artifacts.filter((a) => a.kind === 'review_report');
}
