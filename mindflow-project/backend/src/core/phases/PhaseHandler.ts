import { PhaseConfig } from '../config/PhaseLoader';
import { WorkflowState, PhaseExecutionResult, PendingInput } from '../engine/WorkflowEngine';
import { ArtifactManager, Artifact } from '../artifact/ArtifactManager';
import { MemoryArtifactManager } from '../artifact/ArtifactManager.memory';

export interface PhaseContext {
  state: WorkflowState;
  phaseConfig: PhaseConfig;
  artifactManager: ArtifactManager | MemoryArtifactManager;
  input?: any;
  metadata?: Record<string, any>;
}

export interface PhaseHandlerResult {
  success: boolean;
  artifacts: Artifact[];
  pendingInput?: PendingInput;
  nextPhaseId?: string;
  error?: string;
  messages?: string[];
}

export abstract class PhaseHandler {
  protected phaseId: string;
  protected phaseConfig: PhaseConfig | null = null;

  constructor(phaseId: string) {
    this.phaseId = phaseId;
  }

  /**
   * 设置 Phase 配置
   */
  setConfig(config: PhaseConfig): void {
    this.phaseConfig = config;
  }

  /**
   * 执行 Phase 逻辑
   */
  abstract execute(context: PhaseContext): Promise<PhaseHandlerResult>;

  /**
   * 验证输入数据
   */
  protected validateInput(input: any, fields: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, config] of Object.entries(fields)) {
      if (config.required && (!input || input[key] === undefined || input[key] === null)) {
        errors.push(`缺少必填字段: ${config.name || key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 创建 Artifact
   */
  protected async createArtifact(
    context: PhaseContext,
    type: string,
    content: any,
    aiGenerated: boolean = false
  ): Promise<Artifact> {
    return context.artifactManager.createArtifact(
      context.state.id,
      type,
      content,
      aiGenerated ? 'ai' : 'user',
      `Created in phase ${this.phaseId}`
    );
  }

  /**
   * 获取或创建字段值
   */
  protected getFieldValue(state: WorkflowState, field: string, defaultValue?: any): any {
    return state.fields.get(field) ?? defaultValue;
  }

  /**
   * 设置字段值
   */
  protected setFieldValue(state: WorkflowState, field: string, value: any): void {
    state.fields.set(field, value);
  }

  /**
   * 检查 Action 是否已完成
   */
  protected isActionCompleted(state: WorkflowState, action: string): boolean {
    return state.completedActions.has(action);
  }

  /**
   * 标记 Action 完成
   */
  protected completeAction(state: WorkflowState, action: string): void {
    state.completedActions.add(action);
  }

  /**
   * 生成 PendingInput
   */
  protected createPendingInput(
    type: 'user_input' | 'ai_response' | 'external_data',
    field: string,
    prompt?: string,
    options?: any[]
  ): PendingInput {
    return {
      type,
      field,
      prompt,
      options,
      timeout: 300000 // 5分钟超时
    };
  }

  /**
   * 格式化错误响应
   */
  protected errorResult(error: string): PhaseHandlerResult {
    return {
      success: false,
      artifacts: [],
      error
    };
  }

  /**
   * 格式化成功响应
   */
  protected successResult(
    artifacts: Artifact[] = [],
    messages?: string[]
  ): PhaseHandlerResult {
    return {
      success: true,
      artifacts,
      messages
    };
  }
}

/**
 * Phase Handler 注册表
 */
export class PhaseHandlerRegistry {
  private handlers: Map<string, PhaseHandler> = new Map();

  register(phaseId: string, handler: PhaseHandler): void {
    this.handlers.set(phaseId, handler);
  }

  get(phaseId: string): PhaseHandler | undefined {
    return this.handlers.get(phaseId);
  }

  has(phaseId: string): boolean {
    return this.handlers.has(phaseId);
  }

  unregister(phaseId: string): boolean {
    return this.handlers.delete(phaseId);
  }

  getAllHandlers(): Map<string, PhaseHandler> {
    return new Map(this.handlers);
  }
}

// 导出全局注册表实例
export const phaseHandlerRegistry = new PhaseHandlerRegistry();
