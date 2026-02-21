import { EventEmitter } from 'events';

export interface ActionDefinition {
  key: string;
  label: string;
  description: string;
  condition?: string;
  confirm?: boolean;
  confirmMessage?: string;
  nextPhase?: string | number;
  nextSubstate?: string;
  handler?: (context: ActionContext) => Promise<ActionResult>;
}

export interface ActionContext {
  workflowId: string;
  phaseId: string;
  substate?: string;
  fields: Map<string, any>;
  artifacts: Map<string, string>;
  metadata?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  nextPhase?: string;
  nextSubstate?: string;
  fieldUpdates?: Record<string, any>;
  error?: string;
}

export class ActionRegistry extends EventEmitter {
  private actions: Map<string, ActionDefinition> = new Map();
  private phaseActions: Map<string, Set<string>> = new Map();

  register(action: ActionDefinition): void {
    this.actions.set(action.key, action);
    this.emit('action:registered', { key: action.key });
  }

  registerForPhase(phaseId: string, actionKeys: string[]): void {
    if (!this.phaseActions.has(phaseId)) {
      this.phaseActions.set(phaseId, new Set());
    }
    const phaseSet = this.phaseActions.get(phaseId)!;
    actionKeys.forEach(key => phaseSet.add(key));
  }

  get(key: string): ActionDefinition | undefined {
    return this.actions.get(key);
  }

  getForPhase(phaseId: string): ActionDefinition[] {
    const keys = this.phaseActions.get(phaseId);
    if (!keys) return [];
    return Array.from(keys)
      .map(key => this.actions.get(key))
      .filter((a): a is ActionDefinition => a !== undefined);
  }

  async execute(key: string, context: ActionContext): Promise<ActionResult> {
    const action = this.actions.get(key);
    if (!action) {
      return { success: false, error: `Action ${key} not found` };
    }

    this.emit('action:executing', { key, context });

    try {
      let result: ActionResult;
      if (action.handler) {
        result = await action.handler(context);
      } else {
        result = { success: true, message: `Action ${key} executed` };
      }

      this.emit('action:executed', { key, result });
      return result;
    } catch (error) {
      const result: ActionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.emit('action:failed', { key, error: result.error });
      return result;
    }
  }

  unregister(key: string): boolean {
    const existed = this.actions.delete(key);
    if (existed) {
      this.phaseActions.forEach(actions => actions.delete(key));
      this.emit('action:unregistered', { key });
    }
    return existed;
  }

  getAllActions(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  clear(): void {
    this.actions.clear();
    this.phaseActions.clear();
    this.emit('actions:cleared');
  }
}

export const actionRegistry = new ActionRegistry();
