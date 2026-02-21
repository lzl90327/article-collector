/**
 * Artifact 类型定义
 * 版本化存储：draft/review 必须递增版本，不覆盖历史
 */

// ==================== Artifact 类型 ====================
export type ArtifactKind = 
  | 'brief_card'      // Brief 卡片
  | 'outline'         // 大纲
  | 'draft'           // 草稿
  | 'review_report'   // 审阅报告
  | 'publish_record'; // 发布记录

// ==================== Artifact 模型 ====================
export interface Artifact {
  id: string;
  session_id: string;
  kind: ArtifactKind;
  version: number | null;  // draft/review 必填；brief/outline 可为 null
  title: string | null;
  content: string;         // Markdown 格式
  meta_json: ArtifactMeta;
  source_job_id: string | null;
  created_at: Date;
}

// ==================== Artifact 元数据 ====================
export interface ArtifactMeta {
  // 通用字段
  word_count?: number;
  reading_time?: number;
  
  // Brief 特有
  angle?: string;
  target_audience?: string;
  key_points?: string[];
  
  // Outline 特有
  sections?: OutlineSection[];
  
  // Draft 特有
  style?: string;
  
  // Review 特有
  review_summary?: string;
  suggestions?: ReviewSuggestion[];
  
  // Publish 特有
  channels?: string[];
  external_ids?: Record<string, string>; // {feishu: "rec_xxx", wechat_mp: "draft_xxx"}
  
  // 扩展字段
  [key: string]: any;
}

// ==================== 大纲段落 ====================
export interface OutlineSection {
  id: string;
  title: string;
  key_points: string[];
  order: number;
}

// ==================== 审阅建议 ====================
export interface ReviewSuggestion {
  id: string;
  type: 'structure' | 'content' | 'style' | 'grammar';
  severity: 'high' | 'medium' | 'low';
  location?: string;      // 位置描述
  original?: string;      // 原文
  suggestion: string;     // 建议
  reason?: string;        // 原因
}

// ==================== API 请求/响应类型 ====================

// GET /api/sessions/:sessionId/artifacts
export interface ListArtifactsRequest {
  kind?: ArtifactKind;
  limit?: number;
  offset?: number;
}

export interface ListArtifactsResponse {
  artifacts: ArtifactSummary[];
  total: number;
}

export interface ArtifactSummary {
  artifact_id: string;
  kind: ArtifactKind;
  version: number | null;
  title: string | null;
  created_at: Date;
  source_job_id: string | null;
}

// GET /api/sessions/:sessionId/artifacts/latest
export interface GetLatestArtifactRequest {
  kind: ArtifactKind;
}

export interface GetLatestArtifactResponse {
  artifact: Artifact | null;
}

// POST /api/sessions/:sessionId/artifacts
export interface CreateArtifactRequest {
  kind: ArtifactKind;
  title?: string;
  content: string;
  meta_json?: ArtifactMeta;
  source_job_id?: string;
}

export interface CreateArtifactResponse {
  artifact: Artifact;
}

// GET /api/artifacts/:artifactId
export interface GetArtifactResponse {
  artifact: Artifact;
}

// POST /api/artifacts/:artifactId/rollback
export interface RollbackArtifactRequest {
  title?: string;
}

export interface RollbackArtifactResponse {
  artifact: Artifact;  // 新创建的 artifact，指向旧 content
}

// ==================== 版本对比 ====================
export interface DiffArtifactsRequest {
  base_artifact_id: string;
  compare_artifact_id: string;
}

export interface DiffArtifactsResponse {
  base: ArtifactSummary;
  compare: ArtifactSummary;
  diff: ParagraphDiff[];
}

export interface ParagraphDiff {
  index: number;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  base_text?: string;
  compare_text?: string;
}

// ==================== 工件库筛选 ====================
export interface ArtifactFilter {
  kinds?: ArtifactKind[];
  date_from?: Date;
  date_to?: Date;
  search?: string;
}

// ==================== 工件统计 ====================
export interface ArtifactStats {
  total_count: number;
  by_kind: Record<ArtifactKind, number>;
  latest_draft: ArtifactSummary | null;
  latest_review: ArtifactSummary | null;
}
