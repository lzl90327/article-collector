import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface DraftVersion {
  version: number;
  content: string;
  createdAt: string;
  wordCount: number;
}

/**
 * Phase 4: Drafting
 * 草稿生成阶段 - 基于收敛的要点生成文章草稿
 */
export class DraftingPhaseHandler extends PhaseHandler {
  constructor() {
    super('4');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'draftingSubstate', 'generate');

    switch (currentSubstate) {
      case 'generate':
        return this.handleGenerate(context);
      case 'await_review':
        return this.handleAwaitReview(context);
      case 'await_revision':
        return this.handleAwaitRevision(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleGenerate(context);
    }
  }

  /**
   * 生成草稿
   */
  private async handleGenerate(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取必要的信息
    const brief = {
      target_audience: this.getFieldValue(state, 'target_audience'),
      thesis: this.getFieldValue(state, 'thesis'),
      evidence_strategy: this.getFieldValue(state, 'evidence_strategy')
    };

    const convergencePoints = this.getFieldValue(state, 'convergence_points', []);
    const selectedAngle = this.getFieldValue(state, 'selected_angle');

    if (convergencePoints.length === 0) {
      return this.errorResult('没有收敛的要点，无法生成草稿');
    }

    // 模拟生成草稿
    // 实际应该调用 AI 服务生成
    const mockDraft = this.generateMockDraft(brief, convergencePoints, selectedAngle);

    // 保存草稿
    const draftVersion: DraftVersion = {
      version: 1,
      content: mockDraft,
      createdAt: new Date().toISOString(),
      wordCount: mockDraft.length
    };

    this.setFieldValue(state, 'current_draft', draftVersion);
    this.setFieldValue(state, 'draftingSubstate', 'await_review');

    // 创建 draft_v1 artifact
    const draftArtifact = await this.createArtifact(
      context,
      'draft_v1',
      {
        content: mockDraft,
        version: 1,
        word_count: draftVersion.wordCount,
        based_on: {
          brief: brief.thesis,
          points_count: convergencePoints.length,
          angle: selectedAngle?.title
        },
        generated_at: new Date().toISOString()
      },
      true
    );

    return {
      success: true,
      artifacts: [draftArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'draft_review',
        `📝 草稿生成完成（版本 1）\n\n` +
        `字数：${draftVersion.wordCount}\n` +
        `基于：${convergencePoints.length} 个要点\n\n` +
        `草稿预览：\n` +
        `---\n` +
        `${mockDraft.substring(0, 500)}...\n` +
        `---\n\n` +
        `你可以：\n` +
        `• confirm: 确认草稿，进入审阅阶段\n` +
        `• revise: 提出修改意见\n` +
        `• regenerate: 重新生成（基于相同要点）`
      ),
      messages: ['草稿已生成，等待审核']
    };
  }

  /**
   * 等待用户审核草稿
   */
  private async handleAwaitReview(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.draft_review) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'draft_review',
          '请选择：confirm（确认）、revise（修改）、regenerate（重新生成）'
        )
      };
    }

    const action = input.draft_review;

    switch (action) {
      case 'confirm':
        this.setFieldValue(state, 'draftingSubstate', 'confirmed');
        return this.handleConfirmed(context);

      case 'revise':
        this.setFieldValue(state, 'draftingSubstate', 'await_revision');
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'revision_request',
            '请描述你的修改意见：\n' +
            '• 哪些部分需要调整？\n' +
            '• 希望增加或删除什么内容？\n' +
            '• 语气或风格需要改变吗？'
          ),
          messages: ['等待修改意见']
        };

      case 'regenerate':
        // 重新生成，回到生成状态
        this.setFieldValue(state, 'draftingSubstate', 'generate');
        return this.handleGenerate(context);

      default:
        return this.errorResult('无效的操作，请选择 confirm、revise 或 regenerate');
    }
  }

  /**
   * 处理修改请求
   */
  private async handleAwaitRevision(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.revision_request) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'revision_request',
          '请描述你的修改意见：'
        )
      };
    }

    // 保存修改意见
    this.setFieldValue(state, 'revision_request', input.revision_request);

    // 获取当前草稿
    const currentDraft = this.getFieldValue(state, 'current_draft');
    const newVersion = (currentDraft?.version || 1) + 1;

    // 模拟根据修改意见生成新版本
    // 实际应该调用 AI 服务
    const revisedContent = this.generateRevisedDraft(
      currentDraft?.content || '',
      input.revision_request
    );

    const draftVersion: DraftVersion = {
      version: newVersion,
      content: revisedContent,
      createdAt: new Date().toISOString(),
      wordCount: revisedContent.length
    };

    this.setFieldValue(state, 'current_draft', draftVersion);
    this.setFieldValue(state, 'draftingSubstate', 'await_review');

    // 创建新版本的 draft artifact
    const artifactType = newVersion === 2 ? 'draft_v2' : 'draft_v3';
    const draftArtifact = await this.createArtifact(
      context,
      artifactType as any,
      {
        content: revisedContent,
        version: newVersion,
        word_count: draftVersion.wordCount,
        revision_request: input.revision_request,
        revised_at: new Date().toISOString()
      },
      true
    );

    return {
      success: true,
      artifacts: [draftArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'draft_review',
        `📝 草稿已修改（版本 ${newVersion}）\n\n` +
        `修改基于：${input.revision_request.substring(0, 100)}...\n\n` +
        `草稿预览：\n` +
        `---\n` +
        `${revisedContent.substring(0, 500)}...\n` +
        `---\n\n` +
        `请选择：confirm、revise、regenerate`
      ),
      messages: [`草稿已修改，当前版本 ${newVersion}`]
    };
  }

  /**
   * 确认草稿完成
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const currentDraft = this.getFieldValue(state, 'current_draft');

    // 创建最终的 draft_final artifact
    const finalArtifact = await this.createArtifact(
      context,
      'draft_final',
      {
        content: currentDraft?.content,
        version: currentDraft?.version || 1,
        word_count: currentDraft?.wordCount,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:4:completed');

    return {
      success: true,
      artifacts: [finalArtifact],
      nextPhaseId: '4.3', // 进入 Light Review 阶段
      messages: ['草稿已完成，进入轻量审阅阶段']
    };
  }

  /**
   * 生成模拟草稿
   */
  private generateMockDraft(
    brief: any,
    points: any[],
    angle?: any
  ): string {
    const hook = angle?.hook || '你有没有想过...';
    const thesis = brief.thesis || 'AI工具改变了写作方式';

    return `${hook}

${thesis}。这听起来像是一个技术话题，但实际上它关乎我们每个人如何思考和表达。

${points.map((p: any) => `首先，${p.content}。这一点在我们的讨论中反复出现，说明它触及了问题的核心。`).join('\n\n')}

那么，这意味着什么？当我们谈论AI工具时，我们真正在谈论的是认知的边界、创造的本质，以及人与技术的关系。

或许，答案不在于选择"用"或"不用"，而在于找到那个平衡点——让AI成为思维的延伸，而非替代。

你怎么看？`;
  }

  /**
   * 生成修改后的草稿
   */
  private generateRevisedDraft(original: string, revisionRequest: string): string {
    // 简单模拟修改：在原文基础上添加修改标记
    return `[已根据"${revisionRequest.substring(0, 30)}..."修改]\n\n${original}\n\n[修改完成]`;
  }
}
