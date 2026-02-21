/**
 * Session 类型定义
 * 对应 Skill 的 session，一篇文章/一次写作会话
 */

import { NextAction } from './job';

// ==================== Session 模式 ====================
export type SessionMode = 'argument' | 'observation';

// ==================== Session 子状态 ====================
export type SessionSubstate = 
  | 'idle'           // 空闲
  | 'await_confirm'  // 等待确认
  | 'await_select'   // 等待选择
  | 'await_free_text'; // 等待自由输入

// ==================== Pending Input 类型 ====================
export type PendingInputType = 
  | 'brief_fields'      // Brief 字段
  | 'revision_choice'   // 修订选择
  | 'publish_channel';  // 发布渠道

// ==================== Session 模型 ====================
export interface Session {
  id: string;
  title: string;
  mode: SessionMode;
  
  // Skill 状态机
  phase: string;                    // 当前阶段
  substate: SessionSubstate;        // 子状态
  pending_input: PendingInputType | null;
  
  // 状态存储
  state_json: SessionState;         // Skill 完整状态机
  brief_confirmed: boolean;         // Brief 是否已确认
  
  // 元数据
  created_at: Date;
  updated_at: Date;
}

// ==================== Session 状态 (Skill 状态机) ====================
export interface SessionState {
  // 当前阶段上下文
  context: Record<string, any>;
  
  // 对话历史
  history: ChatMessage[];
  
  // 当前待处理的输入定义
  pending_input_def?: PendingInputDefinition;
  
  // 下一步操作
  next_actions?: NextAction[];
  
  // 扩展字段
  [key: string]: any;
}

// ==================== 对话消息 ====================
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// ==================== 待输入定义 ====================
export interface PendingInputDefinition {
  type: 'confirm' | 'select' | 'free_text';
  prompt: string;
  
  // confirm 类型
  confirm_options?: {
    yes_label: string;
    no_label: string;
    modify_label?: string;
  };
  
  // select 类型
  select_options?: InputOption[];
  
  // free_text 类型
  free_text_config?: {
    placeholder: string;
    min_length?: number;
    max_length?: number;
    examples?: string[];
  };
  
  // 验证规则
  validation?: InputValidation;
}

// ==================== 输入选项 ====================
export interface InputOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

// ==================== 输入验证 ====================
export interface InputValidation {
  required: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  custom_validator?: string; // 自定义验证函数名
}

// ==================== API 请求/响应类型 ====================

// POST /api/sessions
export interface CreateSessionRequest {
  title: string;
  mode: SessionMode;
  initial_context?: Record<string, any>;
}

export interface CreateSessionResponse {
  session: Session;
}

// GET /api/sessions/:sessionId
export interface GetSessionResponse {
  session: Session;
  latest_artifacts: {
    brief?: ArtifactSummary;
    outline?: ArtifactSummary;
    draft?: ArtifactSummary;
    review?: ArtifactSummary;
  };
}

// PATCH /api/sessions/:sessionId
export interface UpdateSessionRequest {
  title?: string;
  phase?: string;
  substate?: SessionSubstate;
  pending_input?: PendingInputType | null;
  state_json?: Partial<SessionState>;
  brief_confirmed?: boolean;
}

export interface UpdateSessionResponse {
  session: Session;
}

// GET /api/sessions/:sessionId/next-actions
export interface GetNextActionsResponse {
  next_actions: NextAction[];
  context: {
    current_phase: string;
    substate: SessionSubstate;
    pending_input: PendingInputType | null;
    can_proceed: boolean;
    blockers?: string[];
  };
}

// POST /api/sessions/:sessionId/actions/:actionId
export interface ExecuteActionRequest {
  input?: string | string[] | Record<string, any>;
}

export interface ExecuteActionResponse {
  success: boolean;
  session: Session;
  new_job?: {
    job_id: string;
    task: string;
  };
}

// ==================== 会话列表 ====================
export interface ListSessionsRequest {
  mode?: SessionMode;
  phase?: string;
  limit?: number;
  offset?: number;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
  total: number;
}

export interface SessionSummary {
  id: string;
  title: string;
  mode: SessionMode;
  phase: string;
  substate: SessionSubstate;
  brief_confirmed: boolean;
  updated_at: Date;
  artifact_count: number;
}

// ==================== 会话统计 ====================
export interface SessionStats {
  total_sessions: number;
  by_mode: Record<SessionMode, number>;
  by_phase: Record<string, number>;
  recent_sessions: SessionSummary[];
}

// 引用 ArtifactSummary 避免循环依赖
interface ArtifactSummary {
  artifact_id: string;
  kind: string;
  version: number | null;
  title: string | null;
  created_at: Date;
  source_job_id: string | null;
}
