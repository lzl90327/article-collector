/**
 * Discussion Phase 处理器
 * Phase 2: 多角度讨论
 */

import { BasePhase, PhaseContext, PhaseResult, PhaseRegistry } from './base.phase';
import * as deepseekService from '../services/deepseek.service';
import { logger } from '../utils/logger';

/**
 * Discussion Phase 配置
 */
const DISCUSSION_PHASE_CONFIG = {
  phaseId: '2',
  name: 'Discussion',
  description: '多角度讨论，深化思考',
  requiredInputs: [],
  gatingRules: [
    {
      check: (context: PhaseContext) => {
        const state = context.session.state_json as any;
        return !!state?.brief;
      },
      errorMessage: 'Brief must be confirmed before discussion',
    },
  ],
};

/**
 * Discussion Phase 处理器
 */
export class DiscussionPhase extends BasePhase {
  constructor() {
    super(DISCUSSION_PHASE_CONFIG);
  }

  /**
   * 执行 Discussion Phase
   */
  async execute(context: PhaseContext): Promise<PhaseResult> {
    this.logExecution(context, 'Starting Discussion phase');

    // 门控检查
    const gating = this.checkGatingRules(context);
    if (!gating.passed) {
      return this.buildErrorResult(gating.error || 'Gating check failed');
    }

    const state = context.session.state_json as any;
    const brief = state.brief;

    try {
      // 获取已有的讨论记录
      const discussions = state.discussions || [];

      // 如果已有3个讨论，进入下一阶段
      if (discussions.length >= 3) {
        await this.updateSessionState(context.session.id, {
          phase: '3',
          substate: 'idle',
          pendingInputDef: null,
        });

        return this.buildSuccessResult({
          nextPhase: '3',
          nextSubstate: 'idle',
          pendingInput: null,
          messages: [
            {
              role: 'assistant',
              content: '讨论阶段完成！接下来进入收敛阶段，整合讨论成果。',
            },
          ],
        });
      }

      // 生成新的讨论问题
      const questions = await deepseekService.generateDebateQuestions(brief, 3);
      const nextQuestion = questions[discussions.length];

      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '2',
        substate: 'await_free_text',
        pendingInputDef: {
          type: 'text_input',
          question: nextQuestion.question,
          placeholder: '请分享您的想法...',
        },
        stateJson: {
          ...state,
          currentQuestion: nextQuestion,
          pendingQuestions: questions.slice(discussions.length + 1),
        },
      });

      this.logExecution(context, 'Discussion question generated', {
        questionId: nextQuestion.id,
        question: nextQuestion.question,
      });

      return this.buildSuccessResult({
        nextPhase: '2',
        nextSubstate: 'await_free_text',
        pendingInput: {
          type: 'text_input',
          question: nextQuestion.question,
          placeholder: '请分享您的想法...',
        },
        messages: [
          {
            role: 'assistant',
            content: `**讨论角度 ${discussions.length + 1}/3**：${nextQuestion.angle}

${nextQuestion.question}`,
          },
        ],
      });
    } catch (error) {
      logger.error('Discussion phase failed:', error);
      return this.buildErrorResult(`Discussion phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * 处理用户回答
   */
  async handleAnswer(context: PhaseContext, answer: string): Promise<PhaseResult> {
    this.logExecution(context, 'Handling discussion answer');

    const state = context.session.state_json as any;
    const currentQuestion = state.currentQuestion;

    if (!currentQuestion) {
      return this.buildErrorResult('No pending question');
    }

    // 保存讨论记录
    const discussions = state.discussions || [];
    discussions.push({
      question: currentQuestion.question,
      answer,
      angle: currentQuestion.angle,
      timestamp: new Date().toISOString(),
    });

    // 更新 Session 状态
    await this.updateSessionState(context.session.id, {
      stateJson: {
        ...state,
        discussions,
        currentQuestion: null,
      },
    });

    // 继续下一个问题
    return this.execute(context);
  }
}

// 注册 Phase
PhaseRegistry.register(new DiscussionPhase());
