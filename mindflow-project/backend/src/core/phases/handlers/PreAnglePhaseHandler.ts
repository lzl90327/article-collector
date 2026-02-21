import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface AngleCandidate {
  id: string;
  title: string;
  description: string;
  confidence: number;
}

/**
 * Phase 0.5: Pre-Angle
 * 预选题阶段 - AI推荐选题方向（可选）
 */
export class PreAnglePhaseHandler extends PhaseHandler {
  constructor() {
    super('0.5');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'preAngleSubstate', 'recommending');

    switch (currentSubstate) {
      case 'recommending':
        return this.handleRecommending(context);
      case 'await_selection':
        return this.handleAwaitSelection(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleRecommending(context);
    }
  }

  /**
   * 推荐选题
   */
  private async handleRecommending(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取素材信息（如果有）
    const selectedMaterial = this.getFieldValue(state, 'selected_material');

    // 模拟AI推荐选题
    const mockAngles: AngleCandidate[] = [
      {
        id: 'angle_1',
        title: 'AI写作工具的实践反思',
        description: '从实际使用经验出发，探讨AI工具的价值与局限',
        confidence: 0.85
      },
      {
        id: 'angle_2',
        title: '效率与深度的平衡',
        description: '如何在追求效率的同时保持思考深度',
        confidence: 0.78
      },
      {
        id: 'angle_3',
        title: '人机协作的新模式',
        description: '探索AI时代的人类创作新模式',
        confidence: 0.72
      }
    ];

    this.setFieldValue(state, 'recommended_angles', mockAngles);
    this.setFieldValue(state, 'preAngleSubstate', 'await_selection');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'angle_selection',
        `🎯 预选题推荐\n\n` +
        `基于${selectedMaterial ? '选定素材' : '当前趋势'}，AI推荐以下选题方向：\n\n` +
        mockAngles.map((a, i) => 
          `${i + 1}. ${a.title} (置信度: ${Math.round(a.confidence * 100)}%)\n   ${a.description}`
        ).join('\n\n') +
        `\n\n输入编号选择，custom 自定义选题，或 skip 跳过：`
      ),
      messages: ['选题推荐完成']
    };
  }

  /**
   * 等待用户选择
   */
  private async handleAwaitSelection(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.angle_selection) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'angle_selection',
          '输入编号选择，custom 自定义，或 skip 跳过：'
        )
      };
    }

    const action = input.angle_selection;

    if (action === 'skip') {
      this.setFieldValue(state, 'preAngleSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    if (action === 'custom') {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'custom_angle',
          '请输入你的自定义选题：'
        ),
        messages: ['等待自定义选题']
      };
    }

    // 处理自定义选题输入
    if (this.getFieldValue(state, 'preAngleSubstate') === 'await_selection' && input.custom_angle) {
      this.setFieldValue(state, 'selected_angle_topic', input.custom_angle);
      this.setFieldValue(state, 'preAngleSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    const index = parseInt(action) - 1;
    const angles = this.getFieldValue(state, 'recommended_angles', []);

    if (index >= 0 && index < angles.length) {
      this.setFieldValue(state, 'selected_angle_topic', angles[index].title);
      this.setFieldValue(state, 'preAngleSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    return this.errorResult('无效的选择');
  }

  /**
   * 确认完成
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const selectedTopic = this.getFieldValue(state, 'selected_angle_topic');

    if (selectedTopic) {
      this.completeAction(state, 'phase:0.5:completed');
      return {
        success: true,
        artifacts: [],
        nextPhaseId: '0.8', // 进入自动同步阶段
        messages: [`选题已确定：${selectedTopic}`]
      };
    }

    this.completeAction(state, 'phase:0.5:skipped');
    return {
      success: true,
      artifacts: [],
      nextPhaseId: '0.8',
      messages: ['跳过预选题']
    };
  }
}
