/**
 * Artifact 类型定义
 * Phase1 重构后的 Artifact 模型
 */

/** Artifact 类型 */
export type ArtifactKind =
  | 'brief_card'    // Brief 卡片
  | 'outline'       // 大纲
  | 'draft'         // 草稿
  | 'review_report'; // 审校报告

/** Artifact 元数据 */
export interface ArtifactMeta {
  source_task: string;
  committed_at: string;
  word_count?: number;
  reading_time?: number;
}

/** Artifact */
export interface Artifact {
  id: string;
  session_id: string;
  kind: ArtifactKind;
  version: number | null;
  title: string | null;
  content: string;
  meta_json: ArtifactMeta;
  source_job_id: string;
  created_at: string;
}

/** 获取 Artifact 响应 */
export interface GetArtifactResponse {
  success: boolean;
  data: {
    artifact: {
      artifact_id: string;
      session_id: string;
      kind: ArtifactKind;
      version: number | null;
      title: string | null;
      content: string;
      meta: ArtifactMeta;
      source_job_id: string;
      created_at: string;
    };
  };
}

/** 回滚 Artifact 响应 */
export interface RollbackArtifactResponse {
  success: boolean;
  data: {
    artifact: {
      artifact_id: string;
      kind: ArtifactKind;
      version: number;
      title: string | null;
      created_at: string;
    };
  };
}

/** 差异对比项 */
export interface DiffItem {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

/** 获取 Artifact 差异响应 */
export interface GetArtifactDiffResponse {
  success: boolean;
  data: {
    diff: {
      from_version: number;
      to_version: number;
      items: DiffItem[];
    };
  };
}

/** Artifact 列表项 */
export interface ArtifactListItem {
  artifact_id: string;
  kind: ArtifactKind;
  version: number | null;
  title: string | null;
  created_at: string;
}

/** 按类型分组的 Artifacts */
export interface GroupedArtifacts {
  drafts: ArtifactListItem[];
  reviewReports: ArtifactListItem[];
}
