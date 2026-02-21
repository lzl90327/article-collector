/**
 * 工作流类型定义
 * 定义 MindFlow 工作流的完整数据结构和类型
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 工作流阶段 */
export type WorkflowPhase = -1 | 1.5 | 2 | 3 | 4 | 4.5 | 5;

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system';

/** 角度类型 */
export type AngleType = 'mainstream' | 'contrarian';

// ============================================================================
// 消息相关类型
// ============================================================================

/** 聊天消息 */
export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

/** 过滤后的消息（用于显示） */
export interface DisplayMessage extends Message {
  id: string;
}

// ============================================================================
// Brief 相关类型
// ============================================================================

/** 写作简报 */
export interface Brief {
  /** 核心主张 */
  thesis: string;
  /** 目标读者 */
  target_audience: string;
  /** 读者现状 */
  existing_belief: string;
  /** 改变目标 */
  change_goal: string;
  /** 关键词 */
  keywords?: string[];
  /** 文章长度 */
  length?: string;
  /** 语气风格 */
  tone?: string;
}

// ============================================================================
// 角度选择相关类型
// ============================================================================

/** 角度评分 */
export interface AngleScore {
  /** 相关性 (Relevance) */
  R: number;
  /** 新颖性 (Novelty) */
  N: number;
  /** 可信度 (Credibility) */
  C: number;
}

/** 写作角度 */
export interface Angle {
  /** 角度标题 */
  title: string;
  /** 论证内容 */
  argument: string;
  /** 评分 */
  score: AngleScore;
}

/** 角度选择数据 */
export interface AnglesData {
  /** 主流派角度 */
  mainstream: Angle[];
  /** 异见派角度 */
  contrarian: Angle[];
}

/** 角度选择结果 */
export interface AngleSelectionResult {
  /** 选中的角度标题列表 */
  selectedAngles: string[];
  /** 补充想法 */
  thoughts: string;
}

// ============================================================================
// 审计报告相关类型
// ============================================================================

/** 审计报告 */
export interface AuditReport {
  /** 审计员角色 */
  auditor_role: string;
  /** 评分 (0-10) */
  score: number;
  /** 批评意见 */
  criticisms: string[];
  /** 改进建议 */
  suggestions: string[];
}

/** 审计报告数据（可能是单个或数组） */
export type AuditReportData = AuditReport | AuditReport[];

// ============================================================================
// 工作流上下文类型
// ============================================================================

/** 工作流上下文 */
export interface WorkflowContext {
  /** 写作简报 */
  brief?: Brief;
  /** 可选角度 */
  angles?: AnglesData;
  /** 选中的角度 */
  selectedAngle?: string;
  /** 文章草稿 */
  draft?: string;
  /** 审计报告 */
  auditReport?: AuditReportData;
  /** 审计报告列表（兼容旧数据） */
  auditReports?: AuditReportData;
  /** 其他动态字段 */
  [key: string]: unknown;
}

// ============================================================================
// 工作流状态类型
// ============================================================================

/** 工作流状态 */
export interface WorkflowState {
  /** 工作流 ID */
  workflowId: string;
  /** 当前阶段 */
  currentPhase: WorkflowPhase;
  /** 上下文数据 */
  context: WorkflowContext;
  /** 聊天历史 */
  history: Message[];
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

/** 简化版工作流状态（用于组件） */
export interface WorkflowStateSummary {
  workflowId: string;
  currentPhase: WorkflowPhase;
  hasBrief: boolean;
  hasAngles: boolean;
  hasSelectedAngle: boolean;
  hasDraft: boolean;
  hasAuditReport: boolean;
  messageCount: number;
}

// ============================================================================
// 组件 Props 类型
// ============================================================================

/** BriefCard 组件 Props */
export interface BriefCardProps {
  data: Brief;
  onConfirm: (updatedData: Brief) => void;
  loading?: boolean;
}

/** AngleSelector 组件 Props */
export interface AngleSelectorProps {
  data: AnglesData;
  onConfirm: (result: AngleSelectionResult) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

/** ChatInterface 组件 Props */
export interface ChatInterfaceProps {
  history: Message[];
  selectedAngle?: string;
  onSend: (message: string) => Promise<void>;
  loading?: boolean;
  onDone?: () => void;
}

/** DraftViewer 组件 Props */
export interface DraftViewerProps {
  draft: string;
  onConfirm: () => void;
  onBack?: () => void;
  loading?: boolean;
}

/** AuditReport 组件 Props */
export interface AuditReportComponentProps {
  report: AuditReportData;
  onConfirm: () => void;
  loading?: boolean;
}

// ============================================================================
// 错误类型
// ============================================================================

/** API 错误 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** 工作流错误 */
export interface WorkflowError {
  phase: WorkflowPhase;
  operation: string;
  error: ApiError;
  recoverable: boolean;
}

// ============================================================================
// 工具类型
// ============================================================================

/** 可空类型 */
export type Nullable<T> = T | null | undefined;

/** API 响应包装 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/** 分页数据 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
