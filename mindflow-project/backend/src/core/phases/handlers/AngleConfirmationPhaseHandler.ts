import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

/**
 * Phase 1: Angle Confirmation
 * 选题确认阶段 - 确认最终选题方向（可选）
 */
export class AngleConfirmationPhaseHandler extends PhaseHandler {
  constructor() {
    super('1');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'angleConfirmSubstate', 'presenting');

    switch (currentSubstate) {
      case 'presenting':
        return this.handlePresenting(context);
      case 'await_confirm':
        return this.handleAwaitConfirm(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handlePresenting(context);
    }
  }

  /**
   * 展示选题
   */
  private async handlePresenting(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取之前阶段的信息
    const preSelectedTopic = this.getFieldValue(state, 'selected_angle_topic');
    const selectedMaterial = this.getFieldValue(state, 'selected_material');

    const finalTopic = preSelectedTopic || 
                      (selectedMaterial ? selectedMaterial.title : '待定');

    this.setFieldValue(state, 'final_angle_topic', finalTopic);
    this.setFieldValue(state, 'angleConfirmSubstate', 'await_confirm');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'angle_confirm',
        `🎯 选题确认\n\n` +
        `最终选题方向：${finalTopic}\n\n` +
        `请确认这个选题方向：\n` +
        `• confirm: 确认，进入写作简报阶段\n` +
        `• modify: 修改选题\n` +
        `• restart: 重新开始选题`
      ),
      messages: ['等待选题确认']
    };
  }

  /**
   * 等待用户确认
   */
  private async handleAwaitConfirm(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.angle_confirm) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'angle_confirm',
          '输入 confirm、modify 或 restart：'
        )
      };
    }

    const action = input.angle_confirm;

    if (action === 'confirm') {
      this.setFieldValue(state, 'angleConfirmSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    if (action === 'modify') {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'new_topic',
          '请输入修改后的选题：'
        ),
        messages: ['等待新选题']
      };
    }

    if (action === 'restart') {
      // 清除之前的选择，重新开始
      this.setFieldValue(state, 'selected_angle_topic', undefined);
      this.setFieldValue(state, 'final_angle_topic', undefined);
      this.setFieldValue(state, 'angleConfirmSubstate', 'presenting');
      return this.handlePresenting(context);
    }

    // 处理新选题输入
    if (input.new_topic) {
      this.setFieldValue(state, 'final_angle_topic', input.new_topic);
      this.setFieldValue(state, 'angleConfirmSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    return this.errorResult('无效的操作');
  }

  /**
   * 确认完成
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const finalTopic = this.getFieldValue(state, 'final_angle_topic');

    this.completeAction(state, 'phase:1:completed');

    return {
      success: true,
      artifacts: [],
      nextPhaseId: '-1', // 进入 Brief 阶段
      messages: [`选题已确认：${finalTopic}，进入写作简报阶段`]
    };
  }
}
