/**
 * Workflow Components 类型定义
 * 所有 Phase 组件的 Props 类型
 */

import { PhaseId, PhaseMetadata, PendingInput } from '../../../types/phase';

// ============================================================================
// 通用 Props 接口（所有组件都支持）
// ============================================================================

export interface PhaseComponentBaseProps {
  workflowId: string;
  phaseId: PhaseId;
  phaseMeta?: PhaseMetadata;
  fields: Map<string, unknown>;
  pendingInput?: PendingInput | null;
  loading?: boolean;
  onSubmitInput: (field: string, value: unknown) => void;
  onTriggerPhase: (targetPhase?: string) => void;
  onSendMessage?: (message: string) => void;
}

// ============================================================================
// 各组件特定 Props
// ============================================================================

export interface BriefCardProps extends PhaseComponentBaseProps {
  brief?: unknown;
}

export interface AngleSelectorProps extends PhaseComponentBaseProps {
  angles?: {
    mainstream: Array<{
      title: string;
      argument: string;
      score: { R: number; N: number; C: number };
    }>;
    contrarian: Array<{
      title: string;
      argument: string;
      score: { R: number; N: number; C: number };
    }>;
  };
}

export interface ChatInterfaceProps extends PhaseComponentBaseProps {
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
  }>;
}

export interface DraftViewerProps extends PhaseComponentBaseProps {
  draft?: string;
}

export interface AuditReportProps extends PhaseComponentBaseProps {
  report?: unknown;
}

// 其他组件的 Props（占位）
export interface MaterialSelectorProps extends PhaseComponentBaseProps {}
export interface PreAngleSelectorProps extends PhaseComponentBaseProps {}
export interface AutoSyncProps extends PhaseComponentBaseProps {}
export interface AngleConfirmationProps extends PhaseComponentBaseProps {}
export interface ObservationCollectorProps extends PhaseComponentBaseProps {}
export interface ObservationJournalProps extends PhaseComponentBaseProps {}
export interface ConvergenceViewProps extends PhaseComponentBaseProps {}
export interface LightReviewProps extends PhaseComponentBaseProps {}
export interface ImageGeneratorProps extends PhaseComponentBaseProps {}
export interface PublishViewProps extends PhaseComponentBaseProps {}
export interface ViewpointExtractorProps extends PhaseComponentBaseProps {}
export interface RetroViewProps extends PhaseComponentBaseProps {}
