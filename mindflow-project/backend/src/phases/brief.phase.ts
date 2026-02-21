/**
 * Brief Phase 处理器
 * Phase -1: 生成和确认写作Brief
 */

import { BasePhase, PhaseContext, PhaseResult, PhaseRegistry } from './base.phase';
import * as deepseekService from '../services/deepseek.service';
import { logger } from '../utils/logger';

/**
 * Brief Phase 配置
 */
const BRIEF_PHASE_CONFIG = {
  phaseId: '-1',
  name: 'Brief',
  description: '生成和确认写作Brief',
  requiredInputs: ['topic'],
  gatingRules: [
    {
      check: (context: PhaseContext) => !!context.inputs.topic?.trim(),
      errorMessage: 'Topic is required',
    },
  ],
};

/**
 * Brief Phase 处理器
 */
export class BriefPhase extends BasePhase {
  constructor() {
    super(BRIEF_PHASE_CONFIG);
  }

  /**
   * 执行 Brief Phase
   */
  async execute(context: PhaseContext): Promise<PhaseResult> {
    this.logExecution(context, 'Starting Brief generation');

    // 验证输入
    const validation = this.validateInputs(context);
    if (!validation.valid) {
      return this.buildErrorResult(validation.error || 'Invalid inputs');
    }

    // 门控检查
    const gating = this.checkGatingRules(context);
    if (!gating.passed) {
      return this.buildErrorResult(gating.error || 'Gating check failed');
    }

    const { topic, context: userContext } = context.inputs;

    try {
      // 调用 DeepSeek 生成 Brief
      const brief = await deepseekService.generateBrief(topic, userContext);

      // 创建 Brief Artifact
      const artifact = await this.createArtifact(context.session.id, {
        kind: 'brief_card',
        title: `Brief: ${topic}`,
        content: JSON.stringify(brief, null, 2),
        metaJson: {
          topic,
          generatedAt: new Date().toISOString(),
        },
        sourceJobId: context.job.id,
      });

      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '-1',
        substate: 'brief_pending',
        briefConfirmed: false,
        pendingInputDef: {
          type: 'confirm',
          question: '请确认Brief是否符合预期？',
        },
        stateJson: {
          ...((context.session.state_json as object) || {}),
          brief,
          topic,
        },
      });

      this.logExecution(context, 'Brief generated successfully', {
        artifactId: artifact.id,
      });

      return this.buildSuccessResult({
        nextPhase: '-1',
        nextSubstate: 'brief_pending',
        pendingInput: {
          type: 'confirm',
          question: '请确认Brief是否符合预期？',
        },
        artifacts: [artifact],
        messages: [
          {
            role: 'assistant',
            content: `已为您生成Brief：

**核心论点**：${brief.thesis}
**目标读者**：${brief.targetAudience}
**现有认知**：${brief.existingBelief}
**改变目标**：${brief.changeGoal}
**关键词**：${brief.keywords?.join(', ')}

请确认是否符合预期？`,
          },
        ],
      });
    } catch (error) {
      logger.error('Brief generation failed:', error);
      return this.buildErrorResult(`Brief generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * 确认 Brief
   */
  async confirmBrief(context: PhaseContext, confirmed: boolean): Promise<PhaseResult> {
    this.logExecution(context, `Brief confirmation: ${confirmed}`);

    if (!confirmed) {
      // 用户拒绝，返回重新生成
      await this.updateSessionState(context.session.id, {
        substate: 'collecting',
        pendingInputDef: {
          type: 'text_input',
          question: '请提供更多信息或修改建议：',
          placeholder: '例如：希望更关注某个方面、调整目标读者等',
        },
      });

      return this.buildSuccessResult({
        nextPhase: '-1',
        nextSubstate: 'collecting',
        pendingInput: {
          type: 'text_input',
          question: '请提供更多信息或修改建议：',
          placeholder: '例如：希望更关注某个方面、调整目标读者等',
        },
        messages: [
          {
            role: 'assistant',
            content: '请告诉我如何改进Brief，我会重新生成。',
          },
        ],
      });
    }

    // 用户确认，进入下一阶段
    await this.updateSessionState(context.session.id, {
      phase: '2',
      substate: 'idle',
      briefConfirmed: true,
      pendingInputDef: null,
    });

    return this.buildSuccessResult({
      nextPhase: '2',
      nextSubstate: 'idle',
      pendingInput: null,
      messages: [
        {
          role: 'assistant',
          content: 'Brief已确认！接下来进入讨论阶段，我会从不同角度提出问题来深化思考。',
        },
      ],
    });
  }
}

// 注册 Phase
PhaseRegistry.register(new BriefPhase());
