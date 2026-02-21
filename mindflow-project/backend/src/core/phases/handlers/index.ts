/**
 * Phase Handlers 统一导出
 * 所有 Phase 处理器的集中导出，便于 WorkflowEngine 注册
 */

// 论证模式 (Argument Mode) Handlers
export { BriefPhaseHandler } from './BriefPhaseHandler';
export { MaterialPhaseHandler } from './MaterialPhaseHandler';
export { PreAnglePhaseHandler } from './PreAnglePhaseHandler';
export { AutoSyncPhaseHandler } from './AutoSyncPhaseHandler';
export { AngleConfirmationPhaseHandler } from './AngleConfirmationPhaseHandler';
export { BreakthroughPhaseHandler } from './BreakthroughPhaseHandler';
export { DiscussionPhaseHandler } from './DiscussionPhaseHandler';
export { ConvergencePhaseHandler } from './ConvergencePhaseHandler';
export { DraftingPhaseHandler } from './DraftingPhaseHandler';
export { LightReviewPhaseHandler } from './LightReviewPhaseHandler';
export { AuditPhaseHandler } from './AuditPhaseHandler';
export { ImagesPhaseHandler } from './ImagesPhaseHandler';
export { PublishPhaseHandler } from './PublishPhaseHandler';
export { ViewpointPhaseHandler } from './ViewpointPhaseHandler';
export { RetroPhaseHandler } from './RetroPhaseHandler';

// 观察模式 (Observation Mode) Handlers
export { ObservationCollectionPhaseHandler } from './ObservationCollectionPhaseHandler';
export { ObservationJournalPhaseHandler } from './ObservationJournalPhaseHandler';

// Phase ID 到 Handler 类名的映射（用于动态注册）
export const PHASE_HANDLER_MAP: Record<string, string> = {
  '-1': 'BriefPhaseHandler',           // Brief: 写作简报
  '0': 'MaterialPhaseHandler',          // Material: 素材获取
  '0.5': 'PreAnglePhaseHandler',        // Pre-Angle: 预选题
  '0.8': 'AutoSyncPhaseHandler',        // Auto-Sync: 自动同步
  '1': 'AngleConfirmationPhaseHandler', // Angle Confirmation: 选题确认
  '1.5': 'BreakthroughPhaseHandler',    // Breakthrough: 切入点选择
  '2': 'DiscussionPhaseHandler',        // Discussion: 观点探讨
  '2-C': 'ObservationCollectionPhaseHandler', // Observation Collection: 观察片段收集
  '2-D': 'ObservationJournalPhaseHandler',    // Observation Journal: 观察随想整理
  '3': 'ConvergencePhaseHandler',       // Convergence: 观点收敛
  '4': 'DraftingPhaseHandler',          // Drafting: 草稿生成
  '4.3': 'LightReviewPhaseHandler',     // Light Review: 轻量审阅
  '4.5': 'AuditPhaseHandler',           // Audit: 深度审核
  '4.8': 'ImagesPhaseHandler',          // Images: 配图生成
  '5': 'PublishPhaseHandler',           // Publish: 发布
  '5.5': 'ViewpointPhaseHandler',       // Viewpoint: 观点提炼
  '6': 'RetroPhaseHandler'              // Retro: 发布后复盘
};

// Phase ID 列表（按执行顺序）
export const ARGUMENT_MODE_PHASES = ['-1', '0', '0.5', '0.8', '1', '1.5', '2', '3', '4', '4.3', '4.5', '4.8', '5', '5.5', '6'];
export const OBSERVATION_MODE_PHASES = ['-1', '0', '0.5', '0.8', '1', '1.5', '2', '2-C', '2-D', '4.3', '4.8', '5', '5.5', '6'];
export const OBSERVATION_JOURNAL_MODE_PHASES = ['-1', '0', '0.5', '0.8', '1', '2-C', '2-D', '4.3', '4.8', '5', '5.5', '6'];

// Phase 元数据
export interface PhaseMetadata {
  id: string;
  name: string;
  description: string;
  modes: ('argument' | 'observation' | 'observation_journal')[];
  skippable: boolean;
  requiresGating: boolean;
}

export const PHASE_METADATA: PhaseMetadata[] = [
  { id: '-1', name: 'Brief', description: '写作简报', modes: ['argument', 'observation', 'observation_journal'], skippable: false, requiresGating: false },
  { id: '0', name: 'Material', description: '素材获取', modes: ['argument', 'observation', 'observation_journal'], skippable: true, requiresGating: false },
  { id: '0.5', name: 'Pre-Angle', description: '预选题', modes: ['argument', 'observation', 'observation_journal'], skippable: true, requiresGating: false },
  { id: '0.8', name: 'Auto-Sync', description: '自动同步', modes: ['argument', 'observation', 'observation_journal'], skippable: true, requiresGating: false },
  { id: '1', name: 'Angle Confirmation', description: '选题确认', modes: ['argument', 'observation', 'observation_journal'], skippable: true, requiresGating: false },
  { id: '1.5', name: 'Breakthrough', description: '切入点选择', modes: ['argument', 'observation'], skippable: false, requiresGating: false },
  { id: '2', name: 'Discussion', description: '观点探讨', modes: ['argument'], skippable: false, requiresGating: false },
  { id: '2-C', name: 'Observation Collection', description: '观察片段收集', modes: ['observation', 'observation_journal'], skippable: false, requiresGating: false },
  { id: '2-D', name: 'Observation Journal', description: '观察随想整理', modes: ['observation', 'observation_journal'], skippable: false, requiresGating: false },
  { id: '3', name: 'Convergence', description: '观点收敛', modes: ['argument'], skippable: false, requiresGating: true },
  { id: '4', name: 'Drafting', description: '草稿生成', modes: ['argument'], skippable: false, requiresGating: true },
  { id: '4.3', name: 'Light Review', description: '轻量审阅', modes: ['argument', 'observation', 'observation_journal'], skippable: false, requiresGating: false },
  { id: '4.5', name: 'Audit', description: '深度审核', modes: ['argument'], skippable: false, requiresGating: true },
  { id: '4.8', name: 'Images', description: '配图生成', modes: ['argument', 'observation', 'observation_journal'], skippable: true, requiresGating: false },
  { id: '5', name: 'Publish', description: '发布', modes: ['argument', 'observation', 'observation_journal'], skippable: false, requiresGating: true },
  { id: '5.5', name: 'Viewpoint', description: '观点提炼', modes: ['argument', 'observation', 'observation_journal'], skippable: true, requiresGating: false },
  { id: '6', name: 'Retro', description: '发布后复盘', modes: ['argument', 'observation', 'observation_journal'], skippable: true, requiresGating: false }
];
