/**
 * Drafting Phase 处理器
 * Phase 4: 生成文章草稿
 */

import { BasePhase, PhaseContext, PhaseResult, PhaseRegistry } from './base.phase';
import * as deepseekService from '../services/deepseek.service';
import { logger } from '../utils/logger';

/**
 * Drafting Phase 配置
 */
const DRAFTING_PHASE_CONFIG = {
  phaseId: '4',
  name: 'Drafting',
  description: '生成文章草稿',
  requiredInputs: [],
  gatingRules: [
    {
      check: (context: PhaseContext) => {
        const state = context.session.state_json as any;
        return !!state?.brief && !!state?.discussions && state.discussions.length >= 3;
      },
      errorMessage: 'Must complete Brief and Discussion phases before drafting',
    },
  ],
};

/**
 * Drafting Phase 处理器
 */
export class DraftingPhase extends BasePhase {
  constructor() {
    super(DRAFTING_PHASE_CONFIG);
  }

  /**
   * 执行 Drafting Phase
   */
  async execute(context: PhaseContext): Promise<PhaseResult> {
    this.logExecution(context, 'Starting Drafting phase');

    // 门控检查
    const gating = this.checkGatingRules(context);
    if (!gating.passed) {
      return this.buildErrorResult(gating.error || 'Gating check failed');
    }

    const state = context.session.state_json as any;
    const brief = state.brief;
    const discussions = state.discussions || [];

    try {
      // 更新 Session 状态为生成中
      await this.updateSessionState(context.session.id, {
        phase: '4',
        substate: 'generating',
        pendingInputDef: null,
      });

      // 生成草稿（非流式，用于Job执行）
      const draftContent = await deepseekService.generateDraft(brief, discussions);

      // 创建 Draft Artifact
      const artifact = await this.createArtifact(context.session.id, {
        kind: 'draft',
        title: `草稿: ${brief.thesis}`,
        content: draftContent,
        version: 1,
        metaJson: {
          generatedAt: new Date().toISOString(),
          wordCount: draftContent.length,
        },
        sourceJobId: context.job.id,
      });

      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '4',
        substate: 'draft_pending',
        pendingInputDef: {
          type: 'confirm',
          question: '草稿已生成，是否进入审核阶段？',
        },
        stateJson: {
          ...state,
          draftGenerated: true,
          draftVersion: 1,
        },
      });

      this.logExecution(context, 'Draft generated successfully', {
        artifactId: artifact.id,
        wordCount: draftContent.length,
      });

      return this.buildSuccessResult({
        nextPhase: '4',
        nextSubstate: 'draft_pending',
        pendingInput: {
          type: 'confirm',
          question: '草稿已生成，是否进入审核阶段？',
        },
        artifacts: [artifact],
        messages: [
          {
            role: 'assistant',
            content: `草稿已生成完成！

**文章标题**：${brief.thesis}
**字数**：${draftContent.length}

草稿已保存，您可以：
1. 查看草稿内容
2. 进入审核阶段获取改进建议
3. 继续编辑完善`,
          },
        ],
      });
    } catch (error) {
      logger.error('Drafting phase failed:', error);
      return this.buildErrorResult(`Drafting phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * 流式生成草稿
   */
  async executeStreaming(
    context: PhaseContext,
    callbacks: {
      onChunk: (chunk: string) => void;
      onComplete: (artifact: any) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void> {
    this.logExecution(context, 'Starting streaming draft generation');

    const state = context.session.state_json as any;
    const brief = state.brief;
    const discussions = state.discussions || [];

    try {
      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '4',
        substate: 'generating',
      });

      let fullContent = '';

      // 流式生成
      await deepseekService.generateDraft(brief, discussions, {
        onChunk: (chunk) => {
          fullContent += chunk;
          callbacks.onChunk(chunk);
        },
        onComplete: async () => {
          try {
            // 创建 Artifact
            const artifact = await this.createArtifact(context.session.id, {
              kind: 'draft',
              title: `草稿: ${brief.thesis}`,
              content: fullContent,
              version: 1,
              metaJson: {
                generatedAt: new Date().toISOString(),
                wordCount: fullContent.length,
              },
              sourceJobId: context.job.id,
            });

            // 更新 Session 状态
            await this.updateSessionState(context.session.id, {
              phase: '4',
              substate: 'draft_pending',
              pendingInputDef: {
                type: 'confirm',
                question: '草稿已生成，是否进入审核阶段？',
              },
              stateJson: {
                ...state,
                draftGenerated: true,
                draftVersion: 1,
              },
            });

            callbacks.onComplete(artifact);
          } catch (error) {
            callbacks.onError(error as Error);
          }
        },
        onError: callbacks.onError,
      });
    } catch (error) {
      logger.error('Streaming draft generation failed:', error);
      callbacks.onError(error as Error);
    }
  }
}

// 注册 Phase
PhaseRegistry.register(new DraftingPhase());
