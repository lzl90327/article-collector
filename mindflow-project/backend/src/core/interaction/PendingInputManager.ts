import { EventEmitter } from 'events';

export interface PendingInputDefinition {
  id: string;
  type: 'user_input' | 'ai_response' | 'external_data';
  field: string;
  prompt?: string;
  options?: InputOption[];
  validation?: InputValidation;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface InputOption {
  value: string;
  label: string;
  description?: string;
}

export interface InputValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: (value: any) => boolean | string;
}

export interface PendingInputContext {
  workflowId: string;
  phaseId: string;
  substate?: string;
}

export class PendingInputManager extends EventEmitter {
  private pendingInputs: Map<string, PendingInputDefinition> = new Map();
  private workflowInputs: Map<string, string[]> = new Map();

  register(input: PendingInputDefinition): void {
    this.pendingInputs.set(input.id, input);
    this.emit('input:registered', { id: input.id });
  }

  setPending(context: PendingInputContext, inputId: string): void {
    const key = this.getWorkflowKey(context.workflowId);
    if (!this.workflowInputs.has(key)) {
      this.workflowInputs.set(key, []);
    }
    this.workflowInputs.get(key)!.push(inputId);
    
    this.emit('input:pending', {
      workflowId: context.workflowId,
      phaseId: context.phaseId,
      inputId
    });
  }

  get(id: string): PendingInputDefinition | undefined {
    return this.pendingInputs.get(id);
  }

  getPendingForWorkflow(workflowId: string): PendingInputDefinition | null {
    const key = this.getWorkflowKey(workflowId);
    const inputIds = this.workflowInputs.get(key);
    if (!inputIds || inputIds.length === 0) return null;
    
    const lastInputId = inputIds[inputIds.length - 1];
    return this.pendingInputs.get(lastInputId) || null;
  }

  resolve(context: PendingInputContext, field: string, value: any): { valid: boolean; error?: string } {
    const pending = this.getPendingForWorkflow(context.workflowId);
    if (!pending) {
      return { valid: false, error: 'No pending input' };
    }

    if (pending.field !== field) {
      return { valid: false, error: `Expected field ${pending.field}, got ${field}` };
    }

    // Validate
    if (pending.validation) {
      const validation = this.validate(value, pending.validation);
      if (!validation.valid) {
        return validation;
      }
    }

    // Remove from pending
    const key = this.getWorkflowKey(context.workflowId);
    const inputIds = this.workflowInputs.get(key);
    if (inputIds) {
      const index = inputIds.indexOf(pending.id);
      if (index > -1) {
        inputIds.splice(index, 1);
      }
    }

    this.emit('input:resolved', {
      workflowId: context.workflowId,
      phaseId: context.phaseId,
      field,
      value
    });

    return { valid: true };
  }

  private validate(value: any, validation: InputValidation): { valid: boolean; error?: string } {
    if (validation.required && (value === undefined || value === null || value === '')) {
      return { valid: false, error: 'This field is required' };
    }

    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        return { valid: false, error: `Minimum length is ${validation.minLength}` };
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return { valid: false, error: `Maximum length is ${validation.maxLength}` };
      }
      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        return { valid: false, error: 'Invalid format' };
      }
    }

    if (validation.custom) {
      const result = validation.custom(value);
      if (result !== true) {
        return { valid: false, error: typeof result === 'string' ? result : 'Validation failed' };
      }
    }

    return { valid: true };
  }

  clearWorkflow(workflowId: string): void {
    const key = this.getWorkflowKey(workflowId);
    this.workflowInputs.delete(key);
    this.emit('input:cleared', { workflowId });
  }

  private getWorkflowKey(workflowId: string): string {
    return `workflow:${workflowId}`;
  }

  clear(): void {
    this.pendingInputs.clear();
    this.workflowInputs.clear();
    this.emit('inputs:cleared');
  }
}

export const pendingInputManager = new PendingInputManager();
