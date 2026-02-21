import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface Material {
  id: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
  createdAt: string;
}

/**
 * Phase 0: Material
 * 素材获取阶段 - 从飞书获取素材
 */
export class MaterialPhaseHandler extends PhaseHandler {
  constructor() {
    super('0');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'materialSubstate', 'searching');

    switch (currentSubstate) {
      case 'searching':
        return this.handleSearching(context);
      case 'selecting':
        return this.handleSelecting(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleSearching(context);
    }
  }

  /**
   * 搜索素材
   */
  private async handleSearching(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.search_query) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'search_query',
          `📚 素材获取\n\n` +
          `输入关键词搜索素材库，或 skip 跳过：`
        ),
        messages: ['等待搜索关键词']
      };
    }

    if (input.search_query === 'skip') {
      this.setFieldValue(state, 'materialSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    // 模拟从飞书搜索素材
    // 实际应该调用飞书 API
    const mockMaterials: Material[] = [
      {
        id: 'mat_1',
        title: 'AI写作的思考',
        content: '关于AI辅助写作的一些想法...',
        source: 'feishu_doc',
        tags: ['AI', '写作'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'mat_2',
        title: '效率工具对比',
        content: '各种写作工具的优缺点...',
        source: 'feishu_doc',
        tags: ['工具', '效率'],
        createdAt: new Date().toISOString()
      }
    ];

    this.setFieldValue(state, 'search_results', mockMaterials);
    this.setFieldValue(state, 'materialSubstate', 'selecting');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'material_selection',
        `搜索结果：\n\n` +
        mockMaterials.map((m, i) => `${i + 1}. ${m.title} [${m.tags.join(', ')}]`).join('\n') +
        `\n\n输入编号选择素材，或 search 重新搜索，skip 跳过：`
      ),
      messages: ['素材搜索完成']
    };
  }

  /**
   * 选择素材
   */
  private async handleSelecting(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.material_selection) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'material_selection',
          '输入编号选择，search 重新搜索，或 skip 跳过：'
        )
      };
    }

    const action = input.material_selection;

    if (action === 'skip') {
      this.setFieldValue(state, 'materialSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    if (action === 'search') {
      this.setFieldValue(state, 'materialSubstate', 'searching');
      return this.handleSearching(context);
    }

    const index = parseInt(action) - 1;
    const results = this.getFieldValue(state, 'search_results', []);

    if (index >= 0 && index < results.length) {
      const selected = results[index];
      this.setFieldValue(state, 'selected_material', selected);
      this.setFieldValue(state, 'materialSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    return this.errorResult('无效的选择');
  }

  /**
   * 确认完成
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const selectedMaterial = this.getFieldValue(state, 'selected_material');

    if (selectedMaterial) {
      // 创建 materials artifact
      const materialArtifact = await this.createArtifact(
        context,
        'materials',
        {
          materials: [selectedMaterial],
          selected_at: new Date().toISOString()
        },
        false
      );

      this.completeAction(state, 'phase:0:completed');

      return {
        success: true,
        artifacts: [materialArtifact],
        nextPhaseId: '-1', // 进入 Brief 阶段
        messages: ['素材已选择，进入写作简报阶段']
      };
    }

    // 跳过素材选择
    this.completeAction(state, 'phase:0:skipped');

    return {
      success: true,
      artifacts: [],
      nextPhaseId: '-1',
      messages: ['跳过素材获取，进入写作简报阶段']
    };
  }
}
