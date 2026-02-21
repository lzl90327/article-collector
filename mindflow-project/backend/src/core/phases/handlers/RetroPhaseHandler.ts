import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface RetroMetrics {
  readCount?: number;
  likeCount?: number;
  shareCount?: number;
  commentCount?: number;
}

/**
 * Phase 6: Retro
 * 发布后复盘阶段 - 回顾写作过程和发布效果
 */
export class RetroPhaseHandler extends PhaseHandler {
  constructor() {
    super('6');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'retroSubstate', 'collecting');

    switch (currentSubstate) {
      case 'collecting':
        return this.handleCollecting(context);
      case 'await_input':
        return this.handleAwaitInput(context);
      case 'completed':
        return this.handleCompleted(context);
      default:
        return this.handleCollecting(context);
    }
  }

  /**
   * 收集复盘信息
   */
  private async handleCollecting(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取发布信息
    const publishResults = this.getFieldValue(state, 'publish_results', []);
    const workflowStats = this.getFieldValue(state, 'workflow_stats', {});

    this.setFieldValue(state, 'retroSubstate', 'await_input');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'retro_input',
        `📊 发布后复盘\n\n` +
        `写作流程统计：\n` +
        `• 发布平台：${publishResults.map((r: any) => r.platform).join(', ') || '未记录'}\n` +
        `• 总耗时：${workflowStats.duration || '未知'}\n\n` +
        `请回答以下问题（可选）：\n` +
        `1. 本次写作最顺畅的环节是什么？\n` +
        `2. 遇到了什么困难？如何解决的？\n` +
        `3. 有什么收获可以应用到下次写作？\n` +
        `4. 发布后数据（阅读数、点赞数等）\n\n` +
        `输入 skip 跳过复盘，或输入你的反思：`
      ),
      messages: ['等待复盘输入']
    };
  }

  /**
   * 等待用户输入复盘内容
   */
  private async handleAwaitInput(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.retro_input) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'retro_input',
          '输入你的复盘反思，或 skip 跳过：'
        )
      };
    }

    if (input.retro_input === 'skip') {
      this.setFieldValue(state, 'retroSubstate', 'completed');
      return this.handleCompleted(context);
    }

    // 保存复盘内容
    this.setFieldValue(state, 'retro_reflection', input.retro_input);
    this.setFieldValue(state, 'retroSubstate', 'completed');

    return this.handleCompleted(context);
  }

  /**
   * 完成复盘
   */
  private async handleCompleted(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const reflection = this.getFieldValue(state, 'retro_reflection');
    const publishResults = this.getFieldValue(state, 'publish_results', []);

    // 创建 retro_summary artifact
    const retroArtifact = await this.createArtifact(
      context,
      'retro_summary',
      {
        reflection: reflection || '用户选择跳过复盘',
        published_platforms: publishResults.map((r: any) => r.platform),
        completed_at: new Date().toISOString(),
        workflow_completed: true
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:6:completed');

    return {
      success: true,
      artifacts: [retroArtifact],
      messages: ['复盘完成，写作流程结束！']
    };
  }
}
