import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface DiscussionMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  type?: 'question' | 'answer' | 'challenge' | 'support';
}

/**
 * Phase 2: Discussion
 * 观点探讨阶段 - 多轮对话，深化观点
 */
export class DiscussionPhaseHandler extends PhaseHandler {
  constructor() {
    super('2');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 获取当前子状态
    const currentSubstate = this.getFieldValue(state, 'discussionSubstate', 'await_input');

    switch (currentSubstate) {
      case 'await_input':
        return this.handleAwaitInput(context);
      case 'processing':
        return this.handleProcessing(context);
      case 'await_continue':
        return this.handleAwaitContinue(context);
      case 'ready_to_converge':
        return this.handleReadyToConverge(context);
      default:
        return this.handleAwaitInput(context);
    }
  }

  /**
   * 等待用户输入
   */
  private async handleAwaitInput(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 获取已有的讨论记录
    const discussionRecord = this.getFieldValue(state, 'discussion_messages', []);
    const roundCount = discussionRecord.length;

    // 如果是第一轮，给出初始提示
    if (roundCount === 0 && !input) {
      const selectedAngle = this.getFieldValue(state, 'selected_angle');
      const thesis = this.getFieldValue(state, 'thesis');

      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'discussion_input',
          `我们已选定切入点："${selectedAngle?.title}"\n\n` +
          `核心主张：${thesis}\n\n` +
          `现在让我们深入探讨这个观点。你可以：\n` +
          `1. 分享你的想法、案例或疑问\n` +
          `2. 提出反对意见\n` +
          `3. 要求我挑战你的观点\n` +
          `4. 随时说"收敛"进入下一阶段\n\n` +
          `请开始你的发言：`
        ),
        messages: ['等待用户开始讨论']
      };
    }

    // 如果没有输入，等待输入
    if (!input || !input.discussion_input) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'discussion_input',
          '请继续讨论，或输入"收敛"进入下一阶段：'
        )
      };
    }

    // 检查是否触发收敛
    const userInput = input.discussion_input;
    if (userInput.includes('收敛') || userInput.includes('进入下一阶段') || userInput.includes('结束讨论')) {
      this.setFieldValue(state, 'discussionSubstate', 'ready_to_converge');
      return this.handleReadyToConverge(context);
    }

    // 保存用户消息
    const userMessage: DiscussionMessage = {
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
      type: this.detectMessageType(userInput)
    };

    discussionRecord.push(userMessage);
    this.setFieldValue(state, 'discussion_messages', discussionRecord);

    // 进入处理状态
    this.setFieldValue(state, 'discussionSubstate', 'processing');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'ai_response',
        'ai_discussion_response',
        '正在思考回应...'
      ),
      messages: ['用户发言已记录，等待 AI 回应']
    };
  }

  /**
   * 处理 AI 回应
   */
  private async handleProcessing(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 这里应该调用 AI 服务生成回应
    // 暂时返回模拟回应
    const aiResponse = this.generateMockResponse(context);

    // 保存 AI 消息
    const discussionRecord = this.getFieldValue(state, 'discussion_messages', []);
    const aiMessage: DiscussionMessage = {
      role: 'ai',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      type: 'answer'
    };
    discussionRecord.push(aiMessage);
    this.setFieldValue(state, 'discussion_messages', discussionRecord);

    // 检查是否达到收敛条件（至少3轮对话）
    const userMessageCount = discussionRecord.filter((m: DiscussionMessage) => m.role === 'user').length;

    if (userMessageCount >= 3) {
      this.setFieldValue(state, 'discussionSubstate', 'ready_to_converge');
      return this.handleReadyToConverge(context);
    }

    // 进入等待继续状态
    this.setFieldValue(state, 'discussionSubstate', 'await_continue');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'continue_choice',
        `${aiResponse}\n\n---\n\n` +
        `已进行 ${userMessageCount} 轮对话。\n` +
        `你可以：\n` +
        `1. 继续讨论（输入你的想法）\n` +
        `2. 输入"收敛"进入下一阶段\n\n` +
        `你的选择：`
      ),
      messages: ['AI 回应已生成，等待用户继续']
    };
  }

  /**
   * 等待用户决定是否继续
   */
  private async handleAwaitContinue(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.continue_choice) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'continue_choice',
          '请继续讨论，或输入"收敛"进入下一阶段：'
        )
      };
    }

    const choice = input.continue_choice;

    if (choice.includes('收敛') || choice.includes('下一阶段') || choice.includes('结束')) {
      this.setFieldValue(state, 'discussionSubstate', 'ready_to_converge');
      return this.handleReadyToConverge(context);
    }

    // 用户选择继续讨论
    this.setFieldValue(state, 'discussionSubstate', 'await_input');
    return this.handleAwaitInput(context);
  }

  /**
   * 准备进入收敛阶段
   */
  private async handleReadyToConverge(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const discussionRecord = this.getFieldValue(state, 'discussion_messages', []);
    const userMessageCount = discussionRecord.filter((m: DiscussionMessage) => m.role === 'user').length;

    // 创建 discussion_record artifact
    const discussionArtifact = await this.createArtifact(
      context,
      'discussion_record',
      {
        messages: discussionRecord,
        round_count: userMessageCount,
        thesis: this.getFieldValue(state, 'thesis'),
        selected_angle: this.getFieldValue(state, 'selected_angle'),
        completed_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:2:completed');

    return {
      success: true,
      artifacts: [discussionArtifact],
      nextPhaseId: '3', // 进入 Convergence 阶段
      messages: [`讨论完成，共 ${userMessageCount} 轮对话，进入观点收敛阶段`]
    };
  }

  /**
   * 检测消息类型
   */
  private detectMessageType(content: string): DiscussionMessage['type'] {
    if (content.includes('?') || content.includes('？') || content.includes('为什么') || content.includes('怎么')) {
      return 'question';
    }
    if (content.includes('不同意') || content.includes('但是') || content.includes('反对') || content.includes('质疑')) {
      return 'challenge';
    }
    if (content.includes('同意') || content.includes('支持') || content.includes('赞同') || content.includes('确实')) {
      return 'support';
    }
    return 'answer';
  }

  /**
   * 生成模拟 AI 回应
   */
  private generateMockResponse(context: PhaseContext): string {
    const discussionRecord = this.getFieldValue(context.state, 'discussion_messages', []);
    const lastUserMessage = discussionRecord.filter((m: DiscussionMessage) => m.role === 'user').pop();

    if (!lastUserMessage) {
      return '请分享你的想法，我们可以从多个角度探讨这个观点。';
    }

    const responses = [
      '这是一个很有价值的观点。我想进一步追问：你能否举一个具体的例子来支撑这个看法？',
      '你提出了一个重要的角度。不过我想挑战一下：如果反过来想，会不会有不同的结论？',
      '我理解你的观点。让我们换个角度思考：对于不了解这个话题的读者来说，这个论证是否足够有说服力？',
      '这个观点很有启发性。我想知道：你有没有考虑过反方会怎么反驳这个观点？',
      '很好的观察！这让我想到：这个观点与你最初的核心主张之间是什么关系？'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }
}
