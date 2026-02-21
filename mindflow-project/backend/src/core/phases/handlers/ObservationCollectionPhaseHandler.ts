import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface ObservationFragment {
  id: string;
  content: string;
  timestamp: string;
  tags: string[];
  source?: string;
}

/**
 * Phase 2-C: Observation Collection
 * 观察片段收集阶段 - 鼓励用户记录片段，不追求结构
 */
export class ObservationCollectionPhaseHandler extends PhaseHandler {
  constructor() {
    super('2-C');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 获取当前子状态
    const currentSubstate = this.getFieldValue(state, 'observationSubstate', 'collecting');

    switch (currentSubstate) {
      case 'collecting':
        return this.handleCollecting(context);
      case 'await_more':
        return this.handleAwaitMore(context);
      case 'ready_to_journal':
        return this.handleReadyToJournal(context);
      default:
        return this.handleCollecting(context);
    }
  }

  /**
   * 收集观察片段
   */
  private async handleCollecting(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    // 获取已有的片段
    const fragments = this.getFieldValue(state, 'observation_fragments', []);

    // 如果没有输入，提示用户开始记录
    if (!input || !input.observation_content) {
      const prompt = fragments.length === 0
        ? `📝 观察模式 - 片段收集\n\n` +
          `请随意记录你观察到的内容。可以是：\n` +
          `• 今天看到、听到、想到的事情\n` +
          `• 一个场景、一段对话、一种感受\n` +
          `• 不需要完整，不需要有结论\n` +
          `• 就像随手记笔记一样\n\n` +
          `输入你的第一个观察片段：`
        : `已记录 ${fragments.length} 个片段。\n` +
          `继续添加片段，或输入"整理"进入随想整理阶段：\n\n` +
          fragments.map((f: ObservationFragment, i: number) => `${i + 1}. ${f.content.substring(0, 50)}...`).join('\n');

      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'observation_content',
          prompt
        ),
        messages: ['等待观察片段']
      };
    }

    const content = input.observation_content;

    // 检查是否触发整理
    if (content.includes('整理') || content.includes('进入下一阶段') || content.includes('完成')) {
      if (fragments.length === 0) {
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'observation_content',
            '请至少记录一个观察片段后再整理。输入你的观察：'
          )
        };
      }
      this.setFieldValue(state, 'observationSubstate', 'ready_to_journal');
      return this.handleReadyToJournal(context);
    }

    // 创建新片段
    const newFragment: ObservationFragment = {
      id: `frag_${Date.now()}`,
      content: content,
      timestamp: new Date().toISOString(),
      tags: this.extractTags(content),
      source: input.source || 'user_input'
    };

    fragments.push(newFragment);
    this.setFieldValue(state, 'observation_fragments', fragments);

    // 如果已有3个或以上片段，提示可以整理
    if (fragments.length >= 3) {
      this.setFieldValue(state, 'observationSubstate', 'await_more');
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'observation_content',
          `✅ 已记录 ${fragments.length} 个片段！\n\n` +
          `最新片段：${content.substring(0, 50)}...\n\n` +
          `你可以：\n` +
          `1. 继续添加更多片段\n` +
          `2. 输入"整理"进入随想整理阶段\n\n` +
          `你的选择：`
        ),
        messages: [`已添加片段 #${fragments.length}`]
      };
    }

    // 继续收集
    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'observation_content',
        `✅ 已记录！（${fragments.length} 个片段）\n\n` +
        `继续添加片段，或输入"整理"进入下一阶段：`
      ),
      messages: [`已添加片段 #${fragments.length}`]
    };
  }

  /**
   * 等待用户决定是否继续收集
   */
  private async handleAwaitMore(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.observation_content) {
      return this.handleCollecting(context);
    }

    const content = input.observation_content;

    if (content.includes('整理') || content.includes('进入下一阶段') || content.includes('完成')) {
      this.setFieldValue(state, 'observationSubstate', 'ready_to_journal');
      return this.handleReadyToJournal(context);
    }

    // 用户想继续添加，回到收集状态
    this.setFieldValue(state, 'observationSubstate', 'collecting');
    return this.handleCollecting(context);
  }

  /**
   * 准备进入随想整理阶段
   */
  private async handleReadyToJournal(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const fragments = this.getFieldValue(state, 'observation_fragments', []);

    // 创建 observation_fragments artifact
    const fragmentsArtifact = await this.createArtifact(
      context,
      'materials',
      {
        fragments,
        fragment_count: fragments.length,
        collected_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:2-C:completed');

    return {
      success: true,
      artifacts: [fragmentsArtifact],
      nextPhaseId: '2-D', // 进入 Observation Journal 阶段
      messages: [`观察片段收集完成，共 ${fragments.length} 个片段，进入随想整理阶段`]
    };
  }

  /**
   * 从内容中提取标签
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];

    // 简单关键词提取
    const keywords = [
      { pattern: /今天|昨天|刚刚|早上|晚上/, tag: '时间' },
      { pattern: /看到|听到|发现|注意到/, tag: '观察' },
      { pattern: /觉得|感觉|认为|想/, tag: '感受' },
      { pattern: /人|朋友|同事|家人/, tag: '人物' },
      { pattern: /地方|场景|环境/, tag: '场景' }
    ];

    for (const { pattern, tag } of keywords) {
      if (pattern.test(content)) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)]; // 去重
  }
}
