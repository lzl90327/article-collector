/**
 * Session 类型定义
 * Phase1 重构后的 Session 模型
 */

/** Session 模式 */
export type SessionMode = 'scratch' | 'reference';

/** Session 子状态 */
export type SessionSubstate =
  | 'collecting'      // 收集中
  | 'brief_pending'   // Brief 待确认
  | 'brief_confirmed' // Brief 已确认
  | 'outline_pending' // 大纲待确认
  | 'outline_confirmed' // 大纲已确认
  | 'draft_pending'   // 草稿待审校
  | 'completed';      // 已完成

/** Session 元数据 */
export interface SessionMeta {
  topic: string;
  style?: string;
  audience?: string;
  word_count?: number;
}

/** Session */
export interface Session {
  id: string;
  title: string;
  mode: SessionMode;
  phase: string;
  substate: SessionSubstate;
  brief_confirmed: boolean;
  meta_json: SessionMeta;
  pending_input_def_json: PendingInputDefinition | null;
  created_at: string;
  updated_at: string;
}

/** 待输入定义 */
export interface PendingInputDefinition {
  type: 'single_choice' | 'multi_choice' | 'text_input' | 'confirm';
  question: string;
  options?: Array<{ value: string; label: string }>;
  allow_custom?: boolean;
  placeholder?: string;
}

/** 创建 Session 请求 */
export interface CreateSessionRequest {
  title: string;
  mode: SessionMode;
  meta?: Partial<SessionMeta>;
}

/** 创建 Session 响应 */
export interface CreateSessionResponse {
  success: boolean;
  data: {
    session: Session;
  };
}

/** 获取 Session 响应 */
export interface GetSessionResponse {
  success: boolean;
  data: {
    session: Session;
  };
}

/** 更新 Session 请求 */
export interface UpdateSessionRequest {
  title?: string;
  phase?: string;
  substate?: SessionSubstate;
  brief_confirmed?: boolean;
  meta_json?: Partial<SessionMeta>;
  pending_input_def_json?: PendingInputDefinition | null;
}

/** 更新 Session 响应 */
export interface UpdateSessionResponse {
  success: boolean;
  data: {
    session: Session;
  };
}

/** Session 列表响应 */
export interface ListSessionsResponse {
  success: boolean;
  data: {
    sessions: Session[];
    total: number;
  };
}

/** Session 的 Artifacts 响应 */
export interface SessionArtifactsResponse {
  success: boolean;
  data: {
    artifacts: Array<{
      artifact_id: string;
      kind: string;
      version: number | null;
      title: string | null;
      created_at: string;
    }>;
  };
}
