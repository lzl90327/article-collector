import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface JournalEntry {
  id: string;
  content: string;
  timestamp: string;
  linked_fragments: string[];
}

/**
 * Phase 2-D: Observation Journal
 * 观察随想整理阶段 - 将片段整理成随想
 */
export class ObservationJournalPhaseHandler extends PhaseHandler {
  constructor() {
    super('2-D');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 获取当前子状态
    const currentSubstate = this.getFieldValue(state, 'journalSubstate', 'await_theme');

    switch (currentSubstate) {
      case 'await_theme':
        return this.handleAwaitTheme(context);
      case 'await_journal':
        return this.handleAwaitJournal(context);
      case 'await_confirm':
        return this.handleAwaitConfirm(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleAwaitTheme(context);
    }
  }

  /**
   * 等待用户确定随想主题
   */
  private async handleAwaitTheme(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 获取之前收集的片段
    const fragments = this.getFieldValue(state, 'observation_fragments', []);

    if (!input || !input.journal_theme) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'journal_theme',
          `📝 观察随想整理\n\n` +
          `你已收集 ${fragments.length} 个观察片段。\n\n` +
          `现在，请思考这些片段之间的联系，确定一个主题或线索。\n` +
          `可以是：\n` +
          `• 一个共同的话题\n` +
          `• 一种情绪或感受\n` +
          `• 一个你想探讨的问题\n\n` +
          `输入你的随想主题：`
        ),
        messages: ['等待随想主题']
      };
    }

    // 保存主题
    this.setFieldValue(state, 'journal_theme', input.journal_theme);
    this.setFieldValue(state, 'journalSubstate', 'await_journal');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'journal_content',
        `主题已确定："${input.journal_theme}"\n\n` +
        `现在，基于你收集的片段，写一篇随想。\n` +
        `不需要完整的结构，可以是：\n` +
        `• 片段之间的联想\n` +
        `• 对某个观察的深入思考\n` +
        `• 情感的自然流露\n\n` +
        `参考片段：\n` +
        fragments.map((f: any, i: number) => `${i + 1}. ${f.content.substring(0, 40)}...`).join('\n') +
        `\n\n输入你的随想内容：`
      ),
      messages: ['等待随想内容']
    };
  }

  /**
   * 等待用户输入随想内容
   */
  private async handleAwaitJournal(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.journal_content) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'journal_content',
          '请输入你的随想内容：'
        )
      };
    }

    // 保存随想内容
    this.setFieldValue(state, 'journal_content', input.journal_content);
    this.setFieldValue(state, 'journalSubstate', 'await_confirm');

    // 创建 journal_entry artifact
    const journalEntry: JournalEntry = {
      id: `journal_${Date.now()}`,
      content: input.journal_content,
      timestamp: new Date().toISOString(),
      linked_fragments: this.getFieldValue(state, 'observation_fragments', []).map((f: any) => f.id)
    };

    const journalArtifact = await this.createArtifact(
      context,
      'discussion_record', // 复用 discussion_record 类型
      {
        entry: journalEntry,
        theme: this.getFieldValue(state, 'journal_theme'),
        fragment_count: this.getFieldValue(state, 'observation_fragments', []).length
      },
      false
    );

    return {
      success: true,
      artifacts: [journalArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'journal_confirm',
        `随想已生成：\n\n` +
        `主题：${this.getFieldValue(state, 'journal_theme')}\n` +
        `内容预览：${input.journal_content.substring(0, 100)}...\n\n` +
        `请选择：\n` +
        `• confirm: 确认，进入轻量审阅\n` +
        `• modify: 修改内容\n` +
        `• redo: 重新整理`
      ),
      messages: ['随想已创建，等待确认']
    };
  }

  /**
   * 等待用户确认随想
   */
  private async handleAwaitConfirm(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.journal_confirm) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'journal_confirm',
          '请选择：confirm（确认）、modify（修改）、redo（重做）'
        )
      };
    }

    const choice = input.journal_confirm;

    switch (choice) {
      case 'confirm':
        this.setFieldValue(state, 'journalSubstate', 'confirmed');
        return this.handleConfirmed(context);

      case 'modify':
        this.setFieldValue(state, 'journalSubstate', 'await_journal');
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'journal_content',
            '请修改你的随想内容：'
          ),
          messages: ['等待修改随想']
        };

      case 'redo':
        // 清除随想内容，回到主题选择
        this.setFieldValue(state, 'journalSubstate', 'await_theme');
        this.setFieldValue(state, 'journal_theme', undefined);
        this.setFieldValue(state, 'journal_content', undefined);
        return this.handleAwaitTheme(context);

      default:
        return this.errorResult('无效的选择，请选择 confirm、modify 或 redo');
    }
  }

  /**
   * 随想已确认
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 创建最终的 journal artifact
    const finalJournalArtifact = await this.createArtifact(
      context,
      'discussion_record',
      {
        entry: {
          id: `journal_${Date.now()}`,
          content: this.getFieldValue(state, 'journal_content'),
          timestamp: new Date().toISOString(),
          linked_fragments: this.getFieldValue(state, 'observation_fragments', []).map((f: any) => f.id)
        },
        theme: this.getFieldValue(state, 'journal_theme'),
        fragment_count: this.getFieldValue(state, 'observation_fragments', []).length,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:2-D:completed');

    return {
      success: true,
      artifacts: [finalJournalArtifact],
      nextPhaseId: '4.3', // 进入 Light Review 阶段
      messages: ['观察随想整理完成，进入轻量审阅阶段']
    };
  }
}
