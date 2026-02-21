import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

/**
 * Phase 1.5: Breakthrough
 * 切入点选择阶段 - 提供多个写作角度供用户选择
 */
export class BreakthroughPhaseHandler extends PhaseHandler {
  constructor() {
    super('1.5');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 获取当前子状态
    const currentSubstate = this.getFieldValue(state, 'breakthroughSubstate', 'generate_angles');

    switch (currentSubstate) {
      case 'generate_angles':
        return this.handleGenerateAngles(context);
      case 'await_selection':
        return this.handleAwaitSelection(context);
      case 'await_custom_angle':
        return this.handleAwaitCustomAngle(context);
      case 'angle_selected':
        return this.handleAngleSelected(context);
      default:
        return this.handleGenerateAngles(context);
    }
  }

  /**
   * 生成切入点候选
   */
  private async handleGenerateAngles(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取 Brief 信息
    const thesis = this.getFieldValue(state, 'thesis');
    const targetAudience = this.getFieldValue(state, 'target_audience');

    // 这里应该调用 AI 服务生成切入点
    // 暂时返回模拟数据
    const mockAngles = [
      {
        id: 'angle_1',
        title: '从痛点切入',
        description: `针对${targetAudience}的既有信念"${this.getFieldValue(state, 'existing_belief')}"，直接挑战这一误区`,
        hook: '你有没有想过，为什么...',
        rationale: '直接挑战既有信念，制造认知冲突'
      },
      {
        id: 'angle_2',
        title: '从故事切入',
        description: '用一个具体的场景故事引入主题',
        hook: '那天，我看到...',
        rationale: '故事化开头更容易吸引读者'
      },
      {
        id: 'angle_3',
        title: '从数据切入',
        description: '用 surprising 的数据或事实引入',
        hook: '数据显示，90%的人...',
        rationale: '数据增加可信度，制造意外感'
      }
    ];

    // 保存角度池
    this.setFieldValue(state, 'angle_pool', mockAngles);

    // 创建 angle_pool artifact
    const anglePoolArtifact = await this.createArtifact(
      context,
      'angle_pool',
      {
        angles: mockAngles,
        thesis,
        generated_at: new Date().toISOString()
      },
      true
    );

    // 进入等待选择状态
    this.setFieldValue(state, 'breakthroughSubstate', 'await_selection');

    return {
      success: true,
      artifacts: [anglePoolArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'angle_selection',
        `基于你的核心主张"${thesis}"，我为你生成了以下切入点：\n\n` +
        mockAngles.map((angle, idx) =>
          `${idx + 1}. ${angle.title}\n   ${angle.description}\n   💡 ${angle.hook}\n   ✅ ${angle.rationale}\n`
        ).join('\n') +
        `\n请选择（输入数字 1-3），或输入 "custom" 提供你自己的切入点：`
      ),
      messages: ['切入点候选已生成，等待选择']
    };
  }

  /**
   * 等待用户选择切入点
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
          '请选择一个切入点（1-3），或输入 "custom" 提供你自己的切入点：'
        )
      };
    }

    const selection = input.angle_selection;

    if (selection === 'custom') {
      this.setFieldValue(state, 'breakthroughSubstate', 'await_custom_angle');
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'custom_angle',
          '请描述你想要的切入点：\n- 标题/主题\n- 开头 hook\n- 为什么这个角度适合你的文章'
        ),
        messages: ['等待自定义切入点']
      };
    }

    // 解析选择
    const angleIndex = parseInt(selection) - 1;
    const anglePool = this.getFieldValue(state, 'angle_pool', []);

    if (isNaN(angleIndex) || angleIndex < 0 || angleIndex >= anglePool.length) {
      return this.errorResult('无效的选择，请输入 1-3 或 "custom"');
    }

    const selectedAngle = anglePool[angleIndex];
    this.setFieldValue(state, 'selected_angle', selectedAngle);
    this.setFieldValue(state, 'breakthroughSubstate', 'angle_selected');

    return this.handleAngleSelected(context);
  }

  /**
   * 等待自定义切入点
   */
  private async handleAwaitCustomAngle(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.custom_angle) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'custom_angle',
          '请描述你想要的切入点：'
        )
      };
    }

    // 保存自定义切入点
    const customAngle = {
      id: 'custom',
      title: '自定义切入点',
      description: input.custom_angle.description || '用户自定义',
      hook: input.custom_angle.hook || '',
      rationale: input.custom_angle.rationale || '用户自定义角度'
    };

    this.setFieldValue(state, 'selected_angle', customAngle);
    this.setFieldValue(state, 'breakthroughSubstate', 'angle_selected');

    return this.handleAngleSelected(context);
  }

  /**
   * 切入点已选择
   */
  private async handleAngleSelected(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const selectedAngle = this.getFieldValue(state, 'selected_angle');

    // 创建 angle_selected artifact
    const angleSelectedArtifact = await this.createArtifact(
      context,
      'angle_selected',
      {
        angle: selectedAngle,
        thesis: this.getFieldValue(state, 'thesis'),
        selected_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:1.5:completed');

    return {
      success: true,
      artifacts: [angleSelectedArtifact],
      nextPhaseId: '2', // 进入 Discussion 阶段
      messages: [`已选择切入点：${selectedAngle.title}，进入观点探讨阶段`]
    };
  }
}
