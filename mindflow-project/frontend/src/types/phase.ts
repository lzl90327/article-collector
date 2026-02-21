/**
 * Phase 系统类型定义
 * 与后端 Skill 配置对应的完整 Phase 类型系统
 */

// ============================================================================
// Phase ID 类型（与后端配置保持一致）
// ============================================================================

export type PhaseId = 
  | '-1'    // Brief: 写作简报
  | '0'     // Material: 素材获取
  | '0.5'   // Pre-Angle: 预选题
  | '0.8'   // Auto-Sync: 自动同步
  | '1'     // Angle Confirmation: 选题确认
  | '1.5'   // Breakthrough: 切入点选择
  | '2'     // Discussion: 观点探讨
  | '2-C'   // Observation Collection: 观察片段收集
  | '2-D'   // Observation Journal: 观察随想整理
  | '3'     // Convergence: 观点收敛
  | '4'     // Drafting: 草稿生成
  | '4.3'   // Light Review: 轻量审阅
  | '4.5'   // Audit: 深度审核
  | '4.8'   // Images: 配图生成
  | '5'     // Publish: 发布
  | '5.5'   // Viewpoint: 观点提炼
  | '6';    // Retro: 发布后复盘

// ============================================================================
// 写作模式类型
// ============================================================================

export type WritingMode = 'argument_mode' | 'observation_mode' | 'observation_journal_mode';

// ============================================================================
// Phase 配置类型（对应后端 PhaseConfig）
// ============================================================================

export interface PhaseConfig {
  phase: {
    id: number | string;
    name: string;
    name_cn: string;
    description: string;
    type: 'mandatory' | 'standard' | 'optional';
  };
  entry: {
    triggers: string[];
    condition: string;
  };
  exit: {
    condition: string;
    next_phase?: number | string;
  };
  fields: Record<string, FieldConfig>;
  interaction: InteractionConfig;
  model_config: ModelConfig;
  artifacts?: ArtifactConfig[];
  transitions?: PhaseTransition[];
}

export interface FieldConfig {
  name: string;
  description: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'boolean' | 'json';
  required?: boolean;
  options?: string[];
  default?: unknown;
}

export interface InteractionConfig {
  pending_input: PendingInputConfig | null;
  prompt_template: string;
  substates?: SubstateConfig[];
  actions: ActionConfig[];
}

export interface PendingInputConfig {
  type: 'user_input' | 'ai_response' | 'external_data';
  field: string;
  prompt?: string;
  options?: unknown[];
}

export interface SubstateConfig {
  id: string;
  name: string;
  condition: string;
  required_field: string;
  prompt: string;
}

export interface ActionConfig {
  id: string;
  name: string;
  type: 'confirm' | 'modify' | 'skip' | 'custom';
  handler?: string;
}

export interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
  json_mode: boolean;
}

export interface ArtifactConfig {
  type: string;
  description: string;
  aiGenerated: boolean;
}

export interface PhaseTransition {
  to: string;
  condition?: {
    type: 'field_equals' | 'action_completed' | 'artifact_exists';
    field?: string;
    value?: unknown;
    action?: string;
    artifactType?: string;
  };
}

// ============================================================================
// 工作流状态类型（更新版）
// ============================================================================

export interface WorkflowState {
  id: string;
  currentPhaseId: PhaseId;
  mode: WritingMode;
  fields: Map<string, unknown>;
  artifacts: Map<string, string>;
  completedActions: Set<string>;
  pendingInput: PendingInput | null;
  metadata: WorkflowMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface PendingInput {
  type: 'user_input' | 'ai_response' | 'external_data';
  field: string;
  prompt?: string;
  options?: unknown[];
  timeout?: number;
}

export interface WorkflowMetadata {
  title?: string;
  author?: string;
  tags?: string[];
  source?: string;
  version: number;
}

// ============================================================================
// Phase 元数据
// ============================================================================

export interface PhaseMetadata {
  id: PhaseId;
  name: string;
  description: string;
  modes: WritingMode[];
  skippable: boolean;
  requiresGating: boolean;
  component?: string; // 对应前端组件名称
}

// ============================================================================
// Phase 执行结果
// ============================================================================

export interface PhaseExecutionResult {
  success: boolean;
  phaseId: PhaseId;
  artifacts: Artifact[];
  nextPhaseId?: PhaseId;
  pendingInput?: PendingInput;
  error?: string;
  messages?: string[];
}

export interface Artifact {
  id: string;
  type: string;
  workflowId: string;
  currentVersion: number;
  versions: ArtifactVersion[];
  metadata?: unknown;
}

export interface ArtifactVersion {
  version: number;
  content: unknown;
  createdAt: Date;
  createdBy: 'user' | 'ai' | 'system';
  changeSummary?: string;
}

// ============================================================================
// 组件映射配置
// ============================================================================

export interface PhaseComponentMapping {
  phaseId: PhaseId;
  component: string;
  skeleton?: string;
  props?: Record<string, unknown>;
}

// ============================================================================
// 门控规则相关类型
// ============================================================================

export interface GatingResult {
  allowed: boolean;
  violations?: GatingViolation[];
  warnings?: GatingWarning[];
}

export interface GatingViolation {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface GatingWarning {
  rule: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// 常量定义
// ============================================================================

export const ARGUMENT_MODE_PHASES: PhaseId[] = [
  '-1', '0', '0.5', '0.8', '1', '1.5', '2', '3', '4', '4.3', '4.5', '4.8', '5', '5.5', '6'
];

export const OBSERVATION_MODE_PHASES: PhaseId[] = [
  '-1', '0', '0.5', '0.8', '1', '1.5', '2', '2-C', '2-D', '4.3', '4.8', '5', '5.5', '6'
];

export const OBSERVATION_JOURNAL_MODE_PHASES: PhaseId[] = [
  '-1', '0', '0.5', '0.8', '1', '2-C', '2-D', '4.3', '4.8', '5', '5.5', '6'
];

export const PHASE_METADATA: PhaseMetadata[] = [
  { id: '-1', name: 'Brief', description: '写作简报', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: false, requiresGating: false, component: 'BriefCard' },
  { id: '0', name: 'Material', description: '素材获取', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: true, requiresGating: false, component: 'MaterialSelector' },
  { id: '0.5', name: 'Pre-Angle', description: '预选题', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: true, requiresGating: false, component: 'PreAngleSelector' },
  { id: '0.8', name: 'Auto-Sync', description: '自动同步', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: true, requiresGating: false, component: 'AutoSync' },
  { id: '1', name: 'Angle Confirmation', description: '选题确认', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: true, requiresGating: false, component: 'AngleConfirmation' },
  { id: '1.5', name: 'Breakthrough', description: '切入点选择', modes: ['argument_mode', 'observation_mode'], skippable: false, requiresGating: false, component: 'AngleSelector' },
  { id: '2', name: 'Discussion', description: '观点探讨', modes: ['argument_mode'], skippable: false, requiresGating: false, component: 'ChatInterface' },
  { id: '2-C', name: 'Observation Collection', description: '观察片段收集', modes: ['observation_mode', 'observation_journal_mode'], skippable: false, requiresGating: false, component: 'ObservationCollector' },
  { id: '2-D', name: 'Observation Journal', description: '观察随想整理', modes: ['observation_mode', 'observation_journal_mode'], skippable: false, requiresGating: false, component: 'ObservationJournal' },
  { id: '3', name: 'Convergence', description: '观点收敛', modes: ['argument_mode'], skippable: false, requiresGating: true, component: 'ConvergenceView' },
  { id: '4', name: 'Drafting', description: '草稿生成', modes: ['argument_mode'], skippable: false, requiresGating: true, component: 'DraftViewer' },
  { id: '4.3', name: 'Light Review', description: '轻量审阅', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: false, requiresGating: false, component: 'LightReview' },
  { id: '4.5', name: 'Audit', description: '深度审核', modes: ['argument_mode'], skippable: false, requiresGating: true, component: 'AuditReport' },
  { id: '4.8', name: 'Images', description: '配图生成', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: true, requiresGating: false, component: 'ImageGenerator' },
  { id: '5', name: 'Publish', description: '发布', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: false, requiresGating: true, component: 'PublishView' },
  { id: '5.5', name: 'Viewpoint', description: '观点提炼', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: true, requiresGating: false, component: 'ViewpointExtractor' },
  { id: '6', name: 'Retro', description: '发布后复盘', modes: ['argument_mode', 'observation_mode', 'observation_journal_mode'], skippable: true, requiresGating: false, component: 'RetroView' }
];

// ============================================================================
// 工具函数
// ============================================================================

export function getPhaseMetadata(phaseId: PhaseId): PhaseMetadata | undefined {
  return PHASE_METADATA.find(p => p.id === phaseId);
}

export function getPhasesForMode(mode: WritingMode): PhaseId[] {
  switch (mode) {
    case 'argument_mode':
      return ARGUMENT_MODE_PHASES;
    case 'observation_mode':
      return OBSERVATION_MODE_PHASES;
    case 'observation_journal_mode':
      return OBSERVATION_JOURNAL_MODE_PHASES;
    default:
      return ARGUMENT_MODE_PHASES;
  }
}

export function isPhaseSkippable(phaseId: PhaseId): boolean {
  const meta = getPhaseMetadata(phaseId);
  return meta?.skippable ?? false;
}

export function isPhaseAvailableInMode(phaseId: PhaseId, mode: WritingMode): boolean {
  const meta = getPhaseMetadata(phaseId);
  return meta?.modes.includes(mode) ?? false;
}
