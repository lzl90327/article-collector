/**
 * MindFlow Core Module
 * 核心模块统一导出
 */

// 配置管理
export {
  PhaseLoader,
  PhaseConfig,
  PhaseTransition,
  SkillManifest,
  TriggerConfig,
  ModeDetectionResult
} from './config/PhaseLoader';

// 模式路由
export { ModeRouter, WritingMode } from './mode/ModeRouter';

// 制品管理
export {
  ArtifactManager,
  Artifact,
  ArtifactVersion,
  ArtifactQuery
} from './artifact/ArtifactManager';

// 门控规则
export {
  GatingEnforcer,
  GatingResult,
  GatingViolation,
  GatingWarning,
  GatingContext
} from './gating/GatingEnforcer';

export { GatingRules } from './gating/GatingRules';

// Phase 处理器基类
export {
  PhaseHandler,
  PhaseContext,
  PhaseHandlerResult,
  PhaseHandlerRegistry,
  phaseHandlerRegistry
} from './phases/PhaseHandler';

// Phase 处理器实现
export {
  // Handler 类
  BriefPhaseHandler,
  MaterialPhaseHandler,
  PreAnglePhaseHandler,
  AutoSyncPhaseHandler,
  AngleConfirmationPhaseHandler,
  BreakthroughPhaseHandler,
  DiscussionPhaseHandler,
  ObservationCollectionPhaseHandler,
  ObservationJournalPhaseHandler,
  ConvergencePhaseHandler,
  DraftingPhaseHandler,
  LightReviewPhaseHandler,
  AuditPhaseHandler,
  ImagesPhaseHandler,
  PublishPhaseHandler,
  ViewpointPhaseHandler,
  RetroPhaseHandler,
  // 常量与映射
  PHASE_HANDLER_MAP,
  ARGUMENT_MODE_PHASES,
  OBSERVATION_MODE_PHASES,
  OBSERVATION_JOURNAL_MODE_PHASES,
  PHASE_METADATA,
  PhaseMetadata
} from './phases/handlers';

// Phase Handler 注册函数
export { registerAllPhaseHandlers, ServiceConfig } from './phases';

// 工作流引擎
export {
  WorkflowEngine,
  WorkflowState,
  PendingInput,
  WorkflowMetadata,
  PhaseExecutionResult,
  TransitionRequest
} from './engine/WorkflowEngine';

// 交互管理
export {
  PendingInputManager
} from './interaction/PendingInputManager';

export {
  SubstateManager,
  SubstateContext
} from './interaction/SubstateManager';

export {
  ActionRegistry,
  ActionContext
} from './interaction/ActionRegistry';

// 服务
export {
  DeepSeekService
} from './services/DeepSeekService';

export {
  FeishuService,
  FeishuConfig,
  FeishuDocument,
  FeishuMaterial,
  FeishuPublishResult
} from './services/FeishuService';

export {
  WeChatService,
  WeChatConfig,
  WeChatArticle,
  WeChatPublishResult
} from './services/WeChatService';

export {
  CyberEditorialService,
  AuditConfig,
  AuditCheck,
  AuditReport,
  BriefAlignment
} from './services/CyberEditorialService';

// 监控
export {
  MetricsCollector,
  WorkflowMetrics,
  PhaseMetrics
} from './monitoring/MetricsCollector';

// 事件总线
export {
  EventBus
} from './events';

// 依赖注入容器
export {
  ServiceContainer
} from './container/ServiceContainer';
