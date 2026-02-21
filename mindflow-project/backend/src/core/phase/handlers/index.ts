import { PhaseConfig } from '../../config/PhaseLoader';
import { PhaseHandler } from '../PhaseHandler';
import { BriefPhaseHandler } from './BriefPhaseHandler';
import { MaterialPhaseHandler } from './MaterialPhaseHandler';

export * from './BriefPhaseHandler';
export * from './MaterialPhaseHandler';

// Define handler constructor type
type PhaseHandlerConstructor = new (config: PhaseConfig) => PhaseHandler;

export class PhaseHandlerFactory {
  private static handlers: Map<string, PhaseHandlerConstructor> = new Map();

  static initialize(): void {
    // Register all phase handlers
    this.handlers.set('-1', BriefPhaseHandler);
    this.handlers.set('0', MaterialPhaseHandler);
    // TODO: Add more phase handlers
    // this.handlers.set('0.5', BreakthroughPhaseHandler);
    // this.handlers.set('0.8', PreConvergencePhaseHandler);
    // this.handlers.set('1', AnglePhaseHandler);
    // this.handlers.set('1.5', DeepDivePhaseHandler);
    // this.handlers.set('2', DiscussionPhaseHandler);
    // this.handlers.set('2-C', ObservationPhaseHandler);
    // this.handlers.set('2-D', JournalPhaseHandler);
    // this.handlers.set('3', ConvergencePhaseHandler);
    // this.handlers.set('4', DraftPhaseHandler);
    // this.handlers.set('4.3', LightReviewPhaseHandler);
    // this.handlers.set('4.5', AuditPhaseHandler);
    // this.handlers.set('4.8', ImagesPhaseHandler);
    // this.handlers.set('5', PublishPhaseHandler);
    // this.handlers.set('5.5', ViewpointPhaseHandler);
    // this.handlers.set('6', RetroPhaseHandler);
  }

  static createHandler(phaseId: string | number, config: PhaseConfig): PhaseHandler {
    // Initialize if not already done
    if (this.handlers.size === 0) {
      this.initialize();
    }

    const HandlerClass = this.handlers.get(String(phaseId));
    
    if (HandlerClass) {
      return new HandlerClass(config);
    }

    // Fallback to generic handler if no specific handler exists
    const { GenericPhaseHandler } = require('../PhaseHandler');
    return new GenericPhaseHandler(config);
  }

  static registerHandler(
    phaseId: string | number, 
    handlerClass: PhaseHandlerConstructor
  ): void {
    this.handlers.set(String(phaseId), handlerClass);
  }

  static getRegisteredPhases(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Auto-initialize on import
PhaseHandlerFactory.initialize();
