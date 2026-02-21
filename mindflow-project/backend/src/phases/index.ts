/**
 * Phase 处理器入口
 * 导出所有 Phase 处理器
 */

// 导入所有 Phase（自动注册）
import './base.phase';
import './brief.phase';
import './discussion.phase';
import './convergence.phase';
import './drafting.phase';
import './audit.phase';
import './publish.phase';

// 导出类型
export * from './base.phase';

// 导出具体 Phase 类（如果需要单独使用）
export { BriefPhase } from './brief.phase';
export { DiscussionPhase } from './discussion.phase';
export { ConvergencePhase } from './convergence.phase';
export { DraftingPhase } from './drafting.phase';
export { AuditPhase } from './audit.phase';
export { PublishPhase } from './publish.phase';
