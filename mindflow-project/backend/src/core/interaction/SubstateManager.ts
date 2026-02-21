import { EventEmitter } from 'events';

export interface SubstateDefinition {
  id: string;
  name: string;
  prompt: string;
  requiredField: string;
  transitions: SubstateTransition[];
}

export interface SubstateTransition {
  to: string;
  condition?: string;
  action?: string;
}

export interface SubstateContext {
  workflowId: string;
  phaseId: string;
  currentSubstate: string;
  fields: Map<string, any>;
  completedSubstates: Set<string>;
}

export class SubstateManager extends EventEmitter {
  private substates: Map<string, SubstateDefinition> = new Map();
  private phaseSubstates: Map<string, string[]> = new Map();

  register(substate: SubstateDefinition): void {
    this.substates.set(substate.id, substate);
    this.emit('substate:registered', { id: substate.id });
  }

  registerForPhase(phaseId: string, substateIds: string[]): void {
    this.phaseSubstates.set(phaseId, substateIds);
  }

  get(id: string): SubstateDefinition | undefined {
    return this.substates.get(id);
  }

  getForPhase(phaseId: string): SubstateDefinition[] {
    const ids = this.phaseSubstates.get(phaseId);
    if (!ids) return [];
    return ids
      .map(id => this.substates.get(id))
      .filter((s): s is SubstateDefinition => s !== undefined);
  }

  getNextSubstate(context: SubstateContext): SubstateDefinition | null {
    const phaseSubstates = this.getForPhase(context.phaseId);
    
    for (const substate of phaseSubstates) {
      if (!context.completedSubstates.has(substate.id)) {
        return substate;
      }
    }
    
    return null;
  }

  completeSubstate(context: SubstateContext, substateId: string): void {
    context.completedSubstates.add(substateId);
    this.emit('substate:completed', {
      workflowId: context.workflowId,
      phaseId: context.phaseId,
      substateId
    });
  }

  canTransition(context: SubstateContext, transition: SubstateTransition): boolean {
    if (!transition.condition) return true;
    
    // Simple condition evaluation
    const fieldMatch = transition.condition.match(/field:(\w+)/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      return context.fields.has(fieldName) && context.fields.get(fieldName) !== undefined;
    }
    
    return true;
  }

  getTransition(context: SubstateContext, action?: string): SubstateTransition | null {
    const currentSubstate = this.substates.get(context.currentSubstate);
    if (!currentSubstate) return null;

    for (const transition of currentSubstate.transitions) {
      if (action && transition.action === action) {
        return transition;
      }
      if (!action && this.canTransition(context, transition)) {
        return transition;
      }
    }

    return null;
  }

  resetPhaseSubstates(phaseId: string): void {
    this.emit('substate:reset', { phaseId });
  }

  clear(): void {
    this.substates.clear();
    this.phaseSubstates.clear();
    this.emit('substates:cleared');
  }
}

export const substateManager = new SubstateManager();
