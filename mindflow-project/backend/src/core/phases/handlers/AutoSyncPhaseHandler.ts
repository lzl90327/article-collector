import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

/**
 * Phase 0.8: Auto-Sync
 * 自动同步阶段 - 同步飞书文档（可选）
 */
export class AutoSyncPhaseHandler extends PhaseHandler {
  constructor() {
    super('0.8');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'autoSyncSubstate', 'checking');

    switch (currentSubstate) {
      case 'checking':
        return this.handleChecking(context);
      case 'syncing':
        return this.handleSyncing(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleChecking(context);
    }
  }

  /**
   * 检查同步需求
   */
  private async handleChecking(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 检查是否有飞书文档需要同步
    const hasFeishuDoc = this.getFieldValue(state, 'feishu_doc_url');

    if (!hasFeishuDoc) {
      // 询问是否创建新文档
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'sync_decision',
          `🔄 自动同步\n\n` +
          `是否创建飞书文档用于本次写作？\n` +
          `• create: 创建新文档\n` +
          `• link: 关联现有文档\n` +
          `• skip: 跳过同步`
        ),
        messages: ['等待同步决策']
      };
    }

    this.setFieldValue(state, 'autoSyncSubstate', 'syncing');
    return this.handleSyncing(context);
  }

  /**
   * 执行同步
   */
  private async handleSyncing(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.sync_decision) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'sync_decision',
          '输入 create、link 或 skip：'
        )
      };
    }

    const action = input.sync_decision;

    if (action === 'skip') {
      this.setFieldValue(state, 'autoSyncSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    if (action === 'create') {
      // 模拟创建飞书文档
      const docUrl = `https://feishu.example.com/doc/${Date.now()}`;
      this.setFieldValue(state, 'feishu_doc_url', docUrl);
      this.setFieldValue(state, 'feishu_doc_created', true);

      this.setFieldValue(state, 'autoSyncSubstate', 'confirmed');
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'sync_confirm',
          `✅ 飞书文档已创建\n` +
          `链接：${docUrl}\n\n` +
          `输入 continue 继续：`
        ),
        messages: ['文档创建成功']
      };
    }

    if (action === 'link') {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'doc_url',
          '请输入飞书文档链接：'
        ),
        messages: ['等待文档链接']
      };
    }

    // 处理文档链接输入
    if (input.doc_url) {
      this.setFieldValue(state, 'feishu_doc_url', input.doc_url);
      this.setFieldValue(state, 'autoSyncSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    return this.errorResult('无效的操作');
  }

  /**
   * 确认完成
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const docUrl = this.getFieldValue(state, 'feishu_doc_url');

    if (docUrl) {
      this.completeAction(state, 'phase:0.8:completed');
      return {
        success: true,
        artifacts: [],
        nextPhaseId: '1', // 进入选题确认阶段
        messages: ['同步配置完成']
      };
    }

    this.completeAction(state, 'phase:0.8:skipped');
    return {
      success: true,
      artifacts: [],
      nextPhaseId: '1',
      messages: ['跳过同步']
    };
  }
}
