/**
 * Workflow Components 统一导出
 * 所有 Phase 组件的集中导出
 */

// 已实现的组件
export { BriefCard } from './BriefCard';
export { AngleSelector } from './AngleSelector';
export { ChatInterface } from './ChatInterface';
export { DraftViewer } from './DraftViewer';
export { AuditReport } from './AuditReport';

// 占位符组件（后续实现）
export {
  MaterialSelector,
  PreAngleSelector,
  AutoSync,
  AngleConfirmation,
  ObservationCollector,
  ObservationJournal,
  ConvergenceView,
  LightReview,
  ImageGenerator,
  PublishView,
  ViewpointExtractor,
  RetroView,
} from './PlaceholderComponent';

// 组件 Props 类型
export type {
  BriefCardProps,
  AngleSelectorProps,
  ChatInterfaceProps,
  DraftViewerProps,
  AuditReportProps,
  PhaseComponentBaseProps,
} from './types';
