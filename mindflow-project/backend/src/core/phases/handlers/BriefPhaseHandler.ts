import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

/**
 * Phase -1: Brief
 * 写作简报阶段 - 明确写作目标、读者、Thesis
 */
export class BriefPhaseHandler extends PhaseHandler {
  constructor() {
    super('-1');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input, phaseConfig } = context;

    // 获取当前子状态
    const currentSubstate = this.getFieldValue(state, 'briefSubstate', 'idle');

    switch (currentSubstate) {
      case 'idle':
        return this.handleIdleState(context);
      case 'await_confirm':
        return this.handleAwaitConfirm(context);
      case 'await_free_text':
        return this.handleAwaitFreeText(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleIdleState(context);
    }
  }

  /**
   * 初始状态：收集 Brief 信息
   */
  private async handleIdleState(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input, phaseConfig } = context;

    // 如果是首次进入，需要收集所有字段
    if (!input) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'briefData',
          '请提供以下信息：\n1. 目标读者是谁？\n2. 读者的既有信念/误区是什么？\n3. 你想改变读者的什么认知？\n4. 一句话概括你的核心主张（Thesis）\n5. 你打算用什么证据策略来支撑？'
        ),
        messages: ['请填写写作简报信息']
      };
    }

    // 验证输入
    const validation = this.validateInput(input, phaseConfig?.fields || {});
    if (!validation.valid) {
      return this.errorResult(validation.errors.join('\n'));
    }

    // 保存字段值
    const briefFields = [
      'target_audience',
      'existing_belief',
      'change_goal',
      'thesis',
      'evidence_strategy'
    ];

    for (const field of briefFields) {
      if (input[field]) {
        this.setFieldValue(state, field, input[field]);
      }
    }

    // 创建 brief_card artifact
    const briefCard = await this.createArtifact(
      context,
      'brief_card',
      {
        target_audience: input.target_audience,
        existing_belief: input.existing_belief,
        change_goal: input.change_goal,
        thesis: input.thesis,
        evidence_strategy: input.evidence_strategy,
        status: 'draft',
        created_at: new Date().toISOString()
      },
      false
    );

    // 进入等待确认状态
    this.setFieldValue(state, 'briefSubstate', 'await_confirm');

    return {
      success: true,
      artifacts: [briefCard],
      pendingInput: this.createPendingInput(
        'user_input',
        'revision_choice',
        `写作简报已生成：\n\n` +
        `📌 目标读者：${input.target_audience}\n` +
        `💭 既有信念：${input.existing_belief}\n` +
        `🎯 改变目标：${input.change_goal}\n` +
        `📝 核心主张：${input.thesis}\n` +
        `📊 证据策略：${input.evidence_strategy}\n\n` +
        `请选择：\n- confirm: 确认，继续探讨\n- modify: 告诉我要改哪里\n- redo: 重新生成`
      ),
      messages: ['Brief 已创建，等待确认']
    };
  }

  /**
   * 等待确认状态
   */
  private async handleAwaitConfirm(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.revision_choice) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'revision_choice',
          '请选择操作：confirm（确认）、modify（修改）、redo（重做）'
        )
      };
    }

    const choice = input.revision_choice;

    switch (choice) {
      case 'confirm':
        this.setFieldValue(state, 'briefSubstate', 'confirmed');
        this.setFieldValue(state, 'briefConfirmed', true);
        this.completeAction(state, 'brief_confirmed');
        return this.handleConfirmed(context);

      case 'modify':
        this.setFieldValue(state, 'briefSubstate', 'await_free_text');
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'modification_request',
            '请告诉我你想修改哪里，以及你希望如何修改：'
          ),
          messages: ['等待修改意见']
        };

      case 'redo':
        // 清除之前的数据，回到初始状态
        this.setFieldValue(state, 'briefSubstate', 'idle');
        this.setFieldValue(state, 'target_audience', undefined);
        this.setFieldValue(state, 'existing_belief', undefined);
        this.setFieldValue(state, 'change_goal', undefined);
        this.setFieldValue(state, 'thesis', undefined);
        this.setFieldValue(state, 'evidence_strategy', undefined);
        return this.handleIdleState(context);

      default:
        return this.errorResult('无效的选择，请选择 confirm、modify 或 redo');
    }
  }

  /**
   * 等待自由文本修改意见
   */
  private async handleAwaitFreeText(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.modification_request) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'modification_request',
          '请描述你的修改需求：'
        )
      };
    }

    // 保存修改意见
    this.setFieldValue(state, 'modification_request', input.modification_request);

    // 这里应该调用 AI 服务来根据修改意见重新生成 Brief
    // 暂时返回等待状态，让上层处理 AI 调用
    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'ai_response',
        'brief_revision',
        '根据修改意见重新生成 Brief...'
      ),
      messages: ['正在根据修改意见调整 Brief...']
    };
  }

  /**
   * 已确认状态
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 更新 brief_card 状态为 confirmed
    const briefData = {
      target_audience: this.getFieldValue(state, 'target_audience'),
      existing_belief: this.getFieldValue(state, 'existing_belief'),
      change_goal: this.getFieldValue(state, 'change_goal'),
      thesis: this.getFieldValue(state, 'thesis'),
      evidence_strategy: this.getFieldValue(state, 'evidence_strategy'),
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    };

    // 创建最终的 brief_card
    const briefCard = await this.createArtifact(
      context,
      'brief_card',
      briefData,
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:-1:completed');

    return {
      success: true,
      artifacts: [briefCard],
      nextPhaseId: '1.5', // 进入 Breakthrough 阶段
      messages: ['Brief 已确认，进入切入点选择阶段']
    };
  }
}
