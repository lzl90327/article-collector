import { EventEmitter } from 'events';
import { PhaseLoader, PhaseConfig, PhaseTransition } from '../config/PhaseLoader';
import { ModeRouter, WritingMode, ModeDetectionResult } from '../mode/ModeRouter';
import { ArtifactManager } from '../artifact/ArtifactManager';
import { MemoryArtifactManager } from '../artifact/ArtifactManager.memory';
import { Artifact } from '../artifact/ArtifactManager';
import { GatingRules, GatingContext, GatingResult } from '../gating/GatingRules';
import { PhaseHandlerRegistry, phaseHandlerRegistry, registerAllPhaseHandlers } from '../phases';

export interface WorkflowState {
  id: string;
  currentPhaseId: string;
  mode: WritingMode;
  fields: Map<string, any>;
  artifacts: Map<string, string>;
  completedActions: Set<string>;
  pendingInput: PendingInput | null;
  metadata: WorkflowMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingInput {
  type: 'user_input' | 'ai_response' | 'external_data';
  field: string;
  prompt?: string;
  options?: any[];
  timeout?: number;
}

export interface WorkflowMetadata {
  title?: string;
  author?: string;
  tags?: string[];
  source?: string;
  version: number;
}

export interface PhaseExecutionResult {
  success: boolean;
  phaseId: string;
  artifacts: Artifact[];
  nextPhaseId?: string;
  pendingInput?: PendingInput;
  error?: string;
}

export interface TransitionRequest {
  targetPhaseId: string;
  force?: boolean;
  metadata?: Record<string, any>;
}

export class WorkflowEngine extends EventEmitter {
  private phaseLoader: PhaseLoader;
  private modeRouter: ModeRouter;
  private artifactManager: MemoryArtifactManager;
  private gatingRules: GatingRules;
  private phaseHandlerRegistry: PhaseHandlerRegistry;
  private states: Map<string, WorkflowState> = new Map();
  private currentState: WorkflowState | null = null;

  constructor(
    phaseLoader: PhaseLoader,
    modeRouter: ModeRouter,
    artifactManager: MemoryArtifactManager,
    gatingRules: GatingRules,
    handlerRegistry?: PhaseHandlerRegistry
  ) {
    super();
    this.phaseLoader = phaseLoader;
    this.modeRouter = modeRouter;
    this.artifactManager = artifactManager;
    this.gatingRules = gatingRules;
    this.phaseHandlerRegistry = handlerRegistry || phaseHandlerRegistry;

    this.setupPhaseLoaderListeners();
  }

  private setupPhaseLoaderListeners(): void {
    this.phaseLoader.on('phases:reloaded', () => {
      this.emit('engine:phases_reloaded');
    });

    this.phaseLoader.on('phase:updated', ({ phaseId }) => {
      this.emit('engine:phase_updated', { phaseId });
    });
  }

  async initialize(): Promise<void> {
    await this.phaseLoader.initialize();
    registerAllPhaseHandlers();
    this.emit('engine:initialized');
  }

  async createWorkflow(
    initialInput: string,
    mode?: WritingMode
  ): Promise<WorkflowState> {
    const detectedMode = mode || this.modeRouter.detectMode(initialInput).mode;
    const phases = this.modeRouter.getModePhases(detectedMode);
    const firstPhaseId = phases[0].toString();

    const state: WorkflowState = {
      id: this.generateId(),
      currentPhaseId: firstPhaseId,
      mode: detectedMode,
      fields: new Map(),
      artifacts: new Map(),
      completedActions: new Set(),
      pendingInput: null,
      metadata: {
        version: 1,
        source: initialInput.substring(0, 100)
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.states.set(state.id, state);
    this.currentState = state;

    this.emit('workflow:created', {
      workflowId: state.id,
      mode: detectedMode,
      initialPhase: firstPhaseId
    });

    return state;
  }

  async executePhase(
    workflowId: string,
    input?: any
  ): Promise<PhaseExecutionResult> {
    const state = this.states.get(workflowId);
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const phaseConfig = this.phaseLoader.getPhase(state.currentPhaseId);
    if (!phaseConfig) {
      throw new Error(`Phase ${state.currentPhaseId} not found`);
    }

    this.emit('phase:executing', {
      workflowId,
      phaseId: state.currentPhaseId,
      phaseName: phaseConfig.phase.name
    });

    try {
      const result = await this.runPhaseLogic(phaseConfig, state, input);

      state.updatedAt = new Date();
      this.states.set(workflowId, state);

      this.emit('phase:completed', {
        workflowId,
        phaseId: state.currentPhaseId,
        success: result.success
      });

      return result;
    } catch (error) {
      this.emit('phase:failed', {
        workflowId,
        phaseId: state.currentPhaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  private async runPhaseLogic(
    phaseConfig: PhaseConfig,
    state: WorkflowState,
    input?: any
  ): Promise<PhaseExecutionResult> {
    const phaseId = String(phaseConfig.phase.id);

    // 检查是否有专门的 PhaseHandler
    const handler = this.phaseHandlerRegistry.get(phaseId);

    if (handler) {
      // 使用专门的 Handler 处理
      handler.setConfig(phaseConfig);
      const handlerResult = await handler.execute({
        state,
        phaseConfig,
        artifactManager: this.artifactManager,
        input,
        metadata: state.metadata
      });

      // 转换 handler 结果为 engine 结果
      const result: PhaseExecutionResult = {
        success: handlerResult.success,
        phaseId,
        artifacts: handlerResult.artifacts,
        nextPhaseId: handlerResult.nextPhaseId,
        pendingInput: handlerResult.pendingInput,
        error: handlerResult.error
      };

      // 更新状态
      if (handlerResult.success) {
        for (const artifact of handlerResult.artifacts) {
          state.artifacts.set(artifact.type, artifact.id);
        }
        state.pendingInput = handlerResult.pendingInput || null;

        // 如果指定了下一阶段，自动转换
        if (handlerResult.nextPhaseId) {
          await this.transitionToPhase(state.id, handlerResult.nextPhaseId);
        }
      }

      return result;
    }

    // 使用默认逻辑处理
    const result: PhaseExecutionResult = {
      success: true,
      phaseId,
      artifacts: []
    };

    if (phaseConfig.interaction?.input_field && input !== undefined) {
      state.fields.set(phaseConfig.interaction.input_field, input);
    }

    if (phaseConfig.interaction?.substates && phaseConfig.interaction.substates.length > 0) {
      const currentSubstate = state.fields.get('currentSubstate') || 0;
      const substate = phaseConfig.interaction.substates[currentSubstate];

      // 检查 substate 是否为对象（而非字符串）
      if (substate && typeof substate === 'object' && !state.completedActions.has(`substate:${substate.id}`)) {
        result.pendingInput = {
          type: 'user_input',
          field: substate.required_field,
          prompt: substate.prompt
        };
        state.pendingInput = result.pendingInput;
        return result;
      }
    }

    if (phaseConfig.artifacts) {
      for (const artifactDef of phaseConfig.artifacts) {
        const artifact = await this.artifactManager.createArtifact(
          state.id,
          artifactDef.type,
          this.generateArtifactContent(artifactDef.type, state, input),
          'system',
          `Created in phase ${phaseId}`
        );
        result.artifacts.push(artifact);
        state.artifacts.set(artifactDef.type, artifact.id);
      }
    }

    if (phaseConfig.interaction?.auto_progress) {
      const nextPhase = this.determineNextPhase(phaseConfig, state);
      if (nextPhase) {
        result.nextPhaseId = nextPhase;
      }
    }

    state.completedActions.add(`phase:${phaseId}`);
    state.pendingInput = null;

    return result;
  }

  private generateArtifactContent(
    type: string,
    state: WorkflowState,
    input?: any
  ): any {
    switch (type) {
      case 'brief_card':
        return {
          rawInput: input,
          timestamp: new Date().toISOString(),
          mode: state.mode
        };
      case 'discussion_record':
        return {
          messages: [{
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
          }]
        };
      case 'draft_v1':
        return {
          content: input,
          version: 1,
          createdAt: new Date().toISOString()
        };
      default:
        return input || {};
    }
  }

  async requestTransition(
    workflowId: string,
    request: TransitionRequest
  ): Promise<{ allowed: boolean; result?: GatingResult }> {
    const state = this.states.get(workflowId);
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const gatingContext = this.buildGatingContext(state, request.targetPhaseId);
    const gatingResult = await this.gatingRules.validateTransition(
      state.currentPhaseId,
      request.targetPhaseId,
      gatingContext
    );

    if (!gatingResult.allowed && !request.force) {
      return { allowed: false, result: gatingResult };
    }

    await this.transitionToPhase(workflowId, request.targetPhaseId);
    return { allowed: true, result: gatingResult };
  }

  private async transitionToPhase(
    workflowId: string,
    targetPhaseId: string
  ): Promise<void> {
    const state = this.states.get(workflowId);
    if (!state) return;

    const previousPhaseId = state.currentPhaseId;
    state.currentPhaseId = targetPhaseId;
    state.updatedAt = new Date();

    this.states.set(workflowId, state);

    this.emit('phase:transitioned', {
      workflowId,
      fromPhase: previousPhaseId,
      toPhase: targetPhaseId
    });
  }

  private buildGatingContext(
    state: WorkflowState,
    targetPhaseId: string
  ): GatingContext {
    const artifacts = new Map<string, any>();
    for (const [type, artifactId] of state.artifacts) {
      artifacts.set(type, { id: artifactId, version: 1 });
    }

    return {
      currentPhaseId: state.currentPhaseId,
      targetPhaseId,
      artifacts,
      fields: state.fields,
      completedActions: state.completedActions,
      metadata: state.metadata
    };
  }

  private determineNextPhase(
    currentPhase: PhaseConfig,
    state: WorkflowState
  ): string | null {
    if (!currentPhase.transitions || currentPhase.transitions.length === 0) {
      return null;
    }

    for (const transition of currentPhase.transitions) {
      if (this.evaluateTransitionCondition(transition, state)) {
        return transition.to;
      }
    }

    return currentPhase.transitions[0]?.to || null;
  }

  private evaluateTransitionCondition(
    transition: PhaseTransition,
    state: WorkflowState
  ): boolean {
    if (!transition.condition) return true;

    switch (transition.condition.type) {
      case 'field_equals':
        return transition.condition.field !== undefined && 
               state.fields.get(transition.condition.field) === transition.condition.value;
      case 'action_completed':
        return transition.condition.action !== undefined && 
               state.completedActions.has(transition.condition.action);
      case 'artifact_exists':
        return transition.condition.artifactType !== undefined && 
               state.artifacts.has(transition.condition.artifactType);
      default:
        return true;
    }
  }

  async submitInput(
    workflowId: string,
    field: string,
    value: any
  ): Promise<void> {
    const state = this.states.get(workflowId);
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    state.fields.set(field, value);

    if (state.pendingInput && state.pendingInput.field === field) {
      state.pendingInput = null;
    }

    state.updatedAt = new Date();
    this.states.set(workflowId, state);

    this.emit('input:submitted', {
      workflowId,
      field,
      value
    });
  }

  async completeAction(
    workflowId: string,
    action: string
  ): Promise<void> {
    const state = this.states.get(workflowId);
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    state.completedActions.add(action);
    state.updatedAt = new Date();
    this.states.set(workflowId, state);

    this.emit('action:completed', {
      workflowId,
      action
    });
  }

  getState(workflowId: string): WorkflowState | null {
    return this.states.get(workflowId) || null;
  }

  getCurrentPhaseConfig(workflowId: string): PhaseConfig | null {
    const state = this.states.get(workflowId);
    if (!state) return null;
    return this.phaseLoader.getPhase(state.currentPhaseId) || null;
  }

  async getPhaseArtifacts(workflowId: string, phaseId?: string): Promise<Artifact[]> {
    const state = this.states.get(workflowId);
    if (!state) return [];

    return this.artifactManager.listArtifacts(workflowId);
  }

  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async hotReloadPhases(): Promise<void> {
    await this.phaseLoader.reloadAll();
    this.emit('engine:hot_reloaded');
  }

  getWorkflowStats(workflowId: string): {
    totalPhases: number;
    completedPhases: number;
    currentPhase: string;
    artifactCount: number;
  } | null {
    const state = this.states.get(workflowId);
    if (!state) return null;

    const phases = this.modeRouter.getModePhases(state.mode);
    const completedPhases = Array.from(state.completedActions)
      .filter(a => a.startsWith('phase:'))
      .length;

    return {
      totalPhases: phases.length,
      completedPhases,
      currentPhase: state.currentPhaseId,
      artifactCount: state.artifacts.size
    };
  }
}
