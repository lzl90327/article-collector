/**
 * BasePhase - Phase 处理器抽象基类
 * 所有 Phase 处理器必须继承此类
 */

import type { Session, Artifact } from '@prisma/client';
import type { Job } from '../types/job';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/** Phase 上下文 */
export interface PhaseContext {
  session: Session;
  artifacts: Artifact[];
  job: Job;
  inputs: Record<string, any>;
}

/** Phase 执行结果 */
export interface PhaseResult {
  success: boolean;
  nextPhase?: string;
  nextSubstate?: string;
  pendingInput?: PendingInputDefinition | null;
  artifacts?: Partial<Artifact>[];
  messages?: PhaseMessage[];
  error?: string;
}

/** 待输入定义 */
export interface PendingInputDefinition {
  type: 'single_choice' | 'multi_choice' | 'text_input' | 'confirm';
  question: string;
  options?: Array<{ value: string; label: string }>;
  allow_custom?: boolean;
  placeholder?: string;
}

/** Phase 消息 */
export interface PhaseMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
  metadata?: Record<string, any>;
}

/** Phase 配置 */
export interface PhaseConfig {
  phaseId: string;
  name: string;
  description: string;
  requiredInputs?: string[];
  gatingRules?: GatingRule[];
}

/** 门控规则 */
export interface GatingRule {
  check: (context: PhaseContext) => boolean;
  errorMessage: string;
}

/**
 * Phase 处理器抽象基类
 */
export abstract class BasePhase {
  protected config: PhaseConfig;

  constructor(config: PhaseConfig) {
    this.config = config;
  }

  /**
   * 获取 Phase ID
   */
  getPhaseId(): string {
    return this.config.phaseId;
  }

  /**
   * 获取 Phase 名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 执行 Phase 主逻辑
   * 子类必须实现此方法
   */
  abstract execute(context: PhaseContext): Promise<PhaseResult>;

  /**
   * 验证输入参数
   */
  protected validateInputs(context: PhaseContext): { valid: boolean; error?: string } {
    if (!this.config.requiredInputs) {
      return { valid: true };
    }

    for (const input of this.config.requiredInputs) {
      if (!(input in context.inputs)) {
        return {
          valid: false,
          error: `Missing required input: ${input}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * 执行门控规则检查
   */
  protected checkGatingRules(context: PhaseContext): { passed: boolean; error?: string } {
    if (!this.config.gatingRules) {
      return { passed: true };
    }

    for (const rule of this.config.gatingRules) {
      if (!rule.check(context)) {
        return {
          passed: false,
          error: rule.errorMessage,
        };
      }
    }

    return { passed: true };
  }

  /**
   * 更新 Session 状态
   */
  protected async updateSessionState(
    sessionId: string,
    updates: {
      phase?: string;
      substate?: string;
      briefConfirmed?: boolean;
      pendingInputDef?: PendingInputDefinition | null;
      stateJson?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          ...(updates.phase && { phase: updates.phase }),
          ...(updates.substate && { substate: updates.substate }),
          ...(updates.briefConfirmed !== undefined && { brief_confirmed: updates.briefConfirmed }),
          ...(updates.pendingInputDef !== undefined && {
            pending_input: updates.pendingInputDef?.question || null,
          }),
          ...(updates.stateJson && { state_json: updates.stateJson }),
        },
      });
    } catch (error) {
      logger.error(`Failed to update session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * 创建 Artifact
   */
  protected async createArtifact(
    sessionId: string,
    data: {
      kind: string;
      title?: string;
      content: string;
      version?: number;
      metaJson?: Record<string, any>;
      sourceJobId?: string;
    }
  ): Promise<Artifact> {
    try {
      const artifact = await prisma.artifact.create({
        data: {
          session_id: sessionId,
          kind: data.kind,
          title: data.title,
          content: data.content,
          version: data.version,
          meta_json: data.metaJson || {},
          source_job_id: data.sourceJobId,
        },
      });
      return artifact;
    } catch (error) {
      logger.error(`Failed to create artifact for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * 获取最新的 Artifact
   */
  protected async getLatestArtifact(
    sessionId: string,
    kind: string
  ): Promise<Artifact | null> {
    try {
      const artifact = await prisma.artifact.findFirst({
        where: {
          session_id: sessionId,
          kind,
        },
        orderBy: {
          created_at: 'desc',
        },
      });
      return artifact;
    } catch (error) {
      logger.error(`Failed to get latest artifact for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * 构建成功结果
   */
  protected buildSuccessResult(result: Partial<PhaseResult> = {}): PhaseResult {
    return {
      success: true,
      ...result,
    };
  }

  /**
   * 构建失败结果
   */
  protected buildErrorResult(error: string): PhaseResult {
    return {
      success: false,
      error,
    };
  }

  /**
   * 记录 Phase 执行日志
   */
  protected logExecution(context: PhaseContext, message: string, data?: any): void {
    logger.info(`[Phase ${this.config.phaseId}] ${message}`, {
      sessionId: context.session.id,
      jobId: context.job.id,
      ...data,
    });
  }
}

/**
 * Phase 注册表
 */
export class PhaseRegistry {
  private static phases: Map<string, BasePhase> = new Map();

  /**
   * 注册 Phase
   */
  static register(phase: BasePhase): void {
    PhaseRegistry.phases.set(phase.getPhaseId(), phase);
    logger.info(`Phase registered: ${phase.getPhaseId()} - ${phase.getName()}`);
  }

  /**
   * 获取 Phase
   */
  static get(phaseId: string): BasePhase | undefined {
    return PhaseRegistry.phases.get(phaseId);
  }

  /**
   * 获取所有 Phase
   */
  static getAll(): BasePhase[] {
    return Array.from(PhaseRegistry.phases.values());
  }

  /**
   * 检查 Phase 是否存在
   */
  static has(phaseId: string): boolean {
    return PhaseRegistry.phases.has(phaseId);
  }
}
