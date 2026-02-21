export {
  PhaseHandler,
  PhaseContext,
  PhaseHandlerResult,
  PhaseHandlerRegistry,
  phaseHandlerRegistry
} from './PhaseHandler';

export { BriefPhaseHandler } from './handlers/BriefPhaseHandler';
export { BreakthroughPhaseHandler } from './handlers/BreakthroughPhaseHandler';
export { DiscussionPhaseHandler } from './handlers/DiscussionPhaseHandler';
export { ObservationCollectionPhaseHandler } from './handlers/ObservationCollectionPhaseHandler';
export { ObservationJournalPhaseHandler } from './handlers/ObservationJournalPhaseHandler';
export { ConvergencePhaseHandler } from './handlers/ConvergencePhaseHandler';
export { DraftingPhaseHandler } from './handlers/DraftingPhaseHandler';
export { LightReviewPhaseHandler } from './handlers/LightReviewPhaseHandler';
export { AuditPhaseHandler } from './handlers/AuditPhaseHandler';
export { PublishPhaseHandler } from './handlers/PublishPhaseHandler';
export { ImagesPhaseHandler } from './handlers/ImagesPhaseHandler';
export { ViewpointPhaseHandler } from './handlers/ViewpointPhaseHandler';
export { RetroPhaseHandler } from './handlers/RetroPhaseHandler';
export { MaterialPhaseHandler } from './handlers/MaterialPhaseHandler';
export { PreAnglePhaseHandler } from './handlers/PreAnglePhaseHandler';
export { AutoSyncPhaseHandler } from './handlers/AutoSyncPhaseHandler';
export { AngleConfirmationPhaseHandler } from './handlers/AngleConfirmationPhaseHandler';

import { phaseHandlerRegistry } from './PhaseHandler';
import { BriefPhaseHandler } from './handlers/BriefPhaseHandler';
import { BreakthroughPhaseHandler } from './handlers/BreakthroughPhaseHandler';
import { DiscussionPhaseHandler } from './handlers/DiscussionPhaseHandler';
import { ObservationCollectionPhaseHandler } from './handlers/ObservationCollectionPhaseHandler';
import { ObservationJournalPhaseHandler } from './handlers/ObservationJournalPhaseHandler';
import { ConvergencePhaseHandler } from './handlers/ConvergencePhaseHandler';
import { DraftingPhaseHandler } from './handlers/DraftingPhaseHandler';
import { LightReviewPhaseHandler } from './handlers/LightReviewPhaseHandler';
import { AuditPhaseHandler } from './handlers/AuditPhaseHandler';
import { PublishPhaseHandler } from './handlers/PublishPhaseHandler';
import { ImagesPhaseHandler } from './handlers/ImagesPhaseHandler';
import { ViewpointPhaseHandler } from './handlers/ViewpointPhaseHandler';
import { RetroPhaseHandler } from './handlers/RetroPhaseHandler';
import { MaterialPhaseHandler } from './handlers/MaterialPhaseHandler';
import { PreAnglePhaseHandler } from './handlers/PreAnglePhaseHandler';
import { AutoSyncPhaseHandler } from './handlers/AutoSyncPhaseHandler';
import { AngleConfirmationPhaseHandler } from './handlers/AngleConfirmationPhaseHandler';

import { CyberEditorialService } from '../services/CyberEditorialService';
import { FeishuService } from '../services/FeishuService';
import { WeChatService } from '../services/WeChatService';

export interface ServiceConfig {
  cyberEditorial?: CyberEditorialService;
  feishu?: FeishuService;
  wechat?: WeChatService;
}

/**
 * 注册所有 Phase Handler
 * @param services 可选的服务配置
 */
export function registerAllPhaseHandlers(services?: ServiceConfig): void {
  // 前置阶段（可选）
  phaseHandlerRegistry.register('0', new MaterialPhaseHandler());
  phaseHandlerRegistry.register('0.5', new PreAnglePhaseHandler());
  phaseHandlerRegistry.register('0.8', new AutoSyncPhaseHandler());
  phaseHandlerRegistry.register('1', new AngleConfirmationPhaseHandler());

  // 核心阶段
  phaseHandlerRegistry.register('-1', new BriefPhaseHandler());
  phaseHandlerRegistry.register('1.5', new BreakthroughPhaseHandler());
  phaseHandlerRegistry.register('2', new DiscussionPhaseHandler());
  phaseHandlerRegistry.register('3', new ConvergencePhaseHandler());
  phaseHandlerRegistry.register('4', new DraftingPhaseHandler());

  // 双核模式 - 观察模式特有的 Phase
  phaseHandlerRegistry.register('2-C', new ObservationCollectionPhaseHandler());
  phaseHandlerRegistry.register('2-D', new ObservationJournalPhaseHandler());

  // 审阅与发布阶段
  phaseHandlerRegistry.register('4.3', new LightReviewPhaseHandler());
  
  // Audit Phase 使用赛博编辑部服务
  const auditHandler = new AuditPhaseHandler();
  if (services?.cyberEditorial) {
    auditHandler.setCyberEditorialService(services.cyberEditorial);
  }
  phaseHandlerRegistry.register('4.5', auditHandler);
  
  phaseHandlerRegistry.register('4.8', new ImagesPhaseHandler());
  
  // Publish Phase 使用飞书/微信服务
  const publishHandler = new PublishPhaseHandler();
  if (services?.feishu || services?.wechat) {
    publishHandler.setServices(services.feishu, services.wechat);
  }
  phaseHandlerRegistry.register('5', publishHandler);
  
  phaseHandlerRegistry.register('5.5', new ViewpointPhaseHandler());
  phaseHandlerRegistry.register('6', new RetroPhaseHandler());
}
