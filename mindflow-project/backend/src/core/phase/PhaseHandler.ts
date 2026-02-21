import { EventEmitter } from 'events';
import { PhaseConfig } from '../config/PhaseLoader';
import { artifactManager, ArtifactVersion } from '../artifact/ArtifactManager';
import { gatingEnforcer, GatingResult } from '../gating/GatingEnforcer';

export interface PhaseContext {
  workflowId: string;
  userId: string;
  input?: string;
  artifacts: Map<string, any>;
  metadata?: any;
}

export interface PhaseOutput {
  success: boolean;
  phaseId: string;
  artifacts?: Record<string, any>;
  messages: PhaseMessage[];
  nextPhase?: string;
  uiState?: UIState;
  error?: string;
}

export interface PhaseMessage {
  role: 'system' | 'user' | 'assistant' | 'opponent';
  content: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'suggestion';
  metadata?: any;
}

export interface UIState {
  component: string;
  props: any;
  actions: UIAction[];
}

export interface UIAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

export interface ActionRequest {
  actionId: string;
  payload?: any;
}

export abstract class PhaseHandler extends EventEmitter {
  protected config: PhaseConfig;

  constructor(config: PhaseConfig) {
    super();
    this.config = config;
  }

  get phaseId(): string {
    return String(this.config.phase.id);
  }

  get phaseName(): string {
    return this.config.phase.name_cn || this.config.phase.name;
  }

  abstract execute(context: PhaseContext, action?: ActionRequest): Promise<PhaseOutput>;

  protected async checkEntryGating(workflowId: string, fromPhase?: string): Promise<GatingResult> {
    // For now, return allowed - actual gating logic will be implemented
    return {
      allowed: true,
      violations: [],
      warnings: []
    };
  }

  protected async checkExitGating(workflowId: string, toPhase?: string): Promise<GatingResult> {
    // For now, return allowed - actual gating logic will be implemented
    return {
      allowed: true,
      violations: [],
      warnings: []
    };
  }

  protected async loadArtifacts(workflowId: string, types: string[]): Promise<Map<string, any>> {
    const artifacts = new Map<string, any>();
    
    for (const type of types) {
      const artifact = await artifactManager.getLatestVersion(workflowId, type);
      if (artifact) {
        artifacts.set(type, artifact.content);
      }
    }
    
    return artifacts;
  }

  protected async saveArtifact(
    workflowId: string,
    type: string,
    content: any,
    createdBy: 'user' | 'ai' | 'system' = 'system',
    changeSummary?: string
  ): Promise<ArtifactVersion> {
    const artifact = await artifactManager.createArtifact(
      workflowId,
      type,
      content,
      createdBy,
      changeSummary
    );
    
    this.emit('artifact:saved', { workflowId, type, version: artifact.currentVersion });
    
    return artifact.versions[artifact.versions.length - 1];
  }

  protected buildUIState(data: any, availableActions: string[]): UIState {
    const actions: UIAction[] = [];
    
    for (const actionId of availableActions) {
      const actionDef = this.config.interaction.actions.find((a: any) => a.key === actionId);
      if (actionDef) {
        actions.push({
          id: actionId,
          label: actionDef.label,
          type: 'primary', // Default style
          disabled: false
        });
      }
    }

    return {
      component: 'PhaseComponent', // Generic component name
      props: {
        phaseId: this.config.phase.id,
        phaseName: this.phaseName,
        description: this.config.phase.description,
        ...data
      },
      actions
    };
  }

  protected createSuccessOutput(
    artifacts: Record<string, any>,
    messages: PhaseMessage[],
    nextPhase?: string,
    uiState?: UIState
  ): PhaseOutput {
    return {
      success: true,
      phaseId: this.phaseId,
      artifacts,
      messages,
      nextPhase,
      uiState
    };
  }

  protected createErrorOutput(error: string, messages: PhaseMessage[] = []): PhaseOutput {
    return {
      success: false,
      phaseId: this.phaseId,
      messages: [
        ...messages,
        {
          role: 'system',
          content: error,
          type: 'error'
        }
      ],
      error
    };
  }

  protected createGatingViolationOutput(gatingResult: GatingResult): PhaseOutput {
    const messages: PhaseMessage[] = [
      {
        role: 'system',
        content: `无法进入阶段 "${this.phaseName}" - 以下条件未满足：`,
        type: 'error'
      },
      ...gatingResult.violations.map(v => ({
        role: 'system' as const,
        content: `• ${v.message}`,
        type: 'error' as const
      })),
      ...gatingResult.warnings.map(w => ({
        role: 'system' as const,
        content: `• ${w.message}${w.suggestion ? ` (${w.suggestion})` : ''}`,
        type: 'warning' as const
      }))
    ];

    return {
      success: false,
      phaseId: this.phaseId,
      messages,
      error: 'Gating conditions not met'
    };
  }

  protected getModelConfig(purpose: string): any {
    return this.config.model_config;
  }

  protected shouldAutoTransition(): boolean {
    return this.config.interaction.auto_progress === true;
  }

  protected getNextPhase(actionId?: string): string | undefined {
    if (actionId) {
      const action = this.config.interaction.actions.find((a: any) => a.key === actionId);
      if (action?.next_phase) {
        return String(action.next_phase);
      }
    }
    if (this.config.exit.next_phase !== null && this.config.exit.next_phase !== undefined) {
      return String(this.config.exit.next_phase);
    }
    return undefined;
  }
}

export class GenericPhaseHandler extends PhaseHandler {
  async execute(context: PhaseContext, action?: ActionRequest): Promise<PhaseOutput> {
    try {
      const entryCheck = await this.checkEntryGating(context.workflowId);
      if (!entryCheck.allowed) {
        return this.createGatingViolationOutput(entryCheck);
      }

      let result: any = {};
      
      if (action) {
        result = await this.handleAction(action, context);
      } else {
        result = await this.handleInitialEntry(context);
      }

      const messages: PhaseMessage[] = result.messages || [{
        role: 'assistant',
        content: result.content || this.config.interaction.prompt_template,
        type: 'info'
      }];

      const availableActions = this.config.interaction.actions.map((a: any) => a.key);
      const uiState = this.buildUIState(result, availableActions);

      return this.createSuccessOutput(
        result.artifacts || {},
        messages,
        this.getNextPhase(action?.actionId),
        uiState
      );

    } catch (error) {
      return this.createErrorOutput(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  private async handleInitialEntry(context: PhaseContext): Promise<any> {
    return {
      content: this.config.interaction.prompt_template,
      messages: [{
        role: 'assistant',
        content: this.config.interaction.prompt_template,
        type: 'info'
      }]
    };
  }

  private async handleAction(action: ActionRequest, context: PhaseContext): Promise<any> {
    const actionDef = this.config.interaction.actions.find((a: any) => a.key === action.actionId);
    
    if (!actionDef) {
      throw new Error(`Unknown action: ${action.actionId}`);
    }

    return { 
      content: `Action ${action.actionId} processed`,
      artifacts: action.payload
    };
  }
}
