import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface ViewpointCard {
  id: string;
  content: string;
  source: string;
  tags: string[];
  createdAt: string;
}

/**
 * Phase 5.5: Viewpoint
 * 观点提炼阶段 - 从文章中提炼核心观点卡片
 */
export class ViewpointPhaseHandler extends PhaseHandler {
  constructor() {
    super('5.5');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'viewpointSubstate', 'extracting');

    switch (currentSubstate) {
      case 'extracting':
        return this.handleExtracting(context);
      case 'await_review':
        return this.handleAwaitReview(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleExtracting(context);
    }
  }

  /**
   * 提炼观点
   */
  private async handleExtracting(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const draftContent = this.getFieldValue(state, 'current_draft')?.content ||
                        this.getFieldValue(state, 'journal_content') || '';

    // 模拟从文章中提炼观点
    // 实际应该调用 AI 服务
    const extractedViewpoints: ViewpointCard[] = [
      {
        id: 'vp_1',
        content: 'AI工具的真正价值不在于替代思考，而在于降低思考的启动成本',
        source: 'article_core',
        tags: ['AI', '思考', '效率'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'vp_2',
        content: '将AI作为"外脑"而非"替代"，保持人的主体性是关键',
        source: 'article_conclusion',
        tags: ['AI', '主体性', '协作'],
        createdAt: new Date().toISOString()
      }
    ];

    this.setFieldValue(state, 'extracted_viewpoints', extractedViewpoints);
    this.setFieldValue(state, 'viewpointSubstate', 'await_review');

    // 创建 viewpoint_card artifact
    const viewpointArtifact = await this.createArtifact(
      context,
      'viewpoint_card',
      {
        viewpoints: extractedViewpoints,
        extracted_at: new Date().toISOString()
      },
      true
    );

    return {
      success: true,
      artifacts: [viewpointArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'viewpoint_review',
        `💡 观点提炼\n\n` +
        `从文章中提炼出以下核心观点：\n\n` +
        extractedViewpoints.map((vp, i) => 
          `${i + 1}. ${vp.content}\n   标签：${vp.tags.join(', ')}`
        ).join('\n\n') +
        `\n\n输入 confirm 确认保存到素材库，add 添加新观点，或 edit 修改：`
      ),
      messages: ['观点提炼完成']
    };
  }

  /**
   * 等待用户审核观点
   */
  private async handleAwaitReview(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.viewpoint_review) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'viewpoint_review',
          '输入 confirm 确认，add 添加，edit 修改，或 skip 跳过：'
        )
      };
    }

    const action = input.viewpoint_review;

    if (action === 'confirm') {
      this.setFieldValue(state, 'viewpointSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    if (action === 'skip') {
      this.setFieldValue(state, 'viewpointSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    // add 和 edit 功能可以后续扩展

    return this.errorResult('无效的操作');
  }

  /**
   * 确认观点保存
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const viewpoints = this.getFieldValue(state, 'extracted_viewpoints', []);

    // 创建最终的 viewpoint_card artifact
    const finalArtifact = await this.createArtifact(
      context,
      'viewpoint_card',
      {
        viewpoints: viewpoints.map((vp: ViewpointCard) => ({ ...vp, status: 'confirmed' })),
        saved_to_library: true,
        confirmed_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:5.5:completed');

    return {
      success: true,
      artifacts: [finalArtifact],
      nextPhaseId: '6', // 进入复盘阶段
      messages: ['观点已保存到素材库，进入复盘阶段']
    };
  }
}
