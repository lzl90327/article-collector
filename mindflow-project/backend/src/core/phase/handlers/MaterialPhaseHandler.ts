import { PhaseHandler, PhaseContext, PhaseOutput, PhaseMessage, ActionRequest } from '../PhaseHandler';
import { PhaseConfig } from '../../config/PhaseLoader';

export interface Material {
  id: string;
  title: string;
  type: 'podcast' | 'article' | 'note' | 'other';
  source: string;
  url?: string;
  core_viewpoint?: string;
  selected: boolean;
  content?: string;
  created_at: string;
}

export interface MaterialSet {
  materials: Material[];
  selected_material?: Material;
  skipped: boolean;
  created_at: string;
  updated_at: string;
}

export class MaterialPhaseHandler extends PhaseHandler {
  constructor(config: PhaseConfig) {
    super(config);
  }

  async execute(context: PhaseContext, action?: ActionRequest): Promise<PhaseOutput> {
    try {
      // 检查入口 Gating 规则
      const entryCheck = await this.checkEntryGating(context.workflowId);
      if (!entryCheck.allowed) {
        return this.createGatingViolationOutput(entryCheck);
      }

      // 获取已存在的 material_set（如果有）
      const existingMaterials = await this.loadArtifacts(context.workflowId, ['material_set']);
      const materialSet = existingMaterials.get('material_set') as MaterialSet | undefined;

      // 处理用户输入或 Action
      if (action) {
        return await this.handleAction(action, context, materialSet);
      }

      // 初始进入 Phase
      if (!materialSet) {
        return await this.handleInitialEntry(context);
      }

      // 显示现有的素材列表
      return this.handleDisplayMaterials(materialSet);

    } catch (error) {
      return this.createErrorOutput(
        error instanceof Error ? error.message : 'Unknown error in Material phase'
      );
    }
  }

  private async handleInitialEntry(context: PhaseContext): Promise<PhaseOutput> {
    // 尝试从飞书获取素材
    const materials = await this.fetchMaterialsFromFeishu();

    if (materials.length === 0) {
      const messages: PhaseMessage[] = [
        {
          role: 'assistant',
          content: '素材库中没有找到素材。你可以：\n\n1. **跳过** - 直接开始创建简报\n2. **手动添加** - 提供素材内容',
          type: 'info'
        }
      ];

      const uiState = this.buildUIState(
        { 
          phase: 'empty',
          materials: []
        },
        ['skip', 'add_manual']
      );

      return this.createSuccessOutput(
        {},
        messages,
        undefined,
        uiState
      );
    }

    // 创建 Material Set
    const materialSet: MaterialSet = {
      materials,
      skipped: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await this.saveArtifact(
      context.workflowId,
      'material_set',
      materialSet,
      'system',
      'Fetched materials from Feishu'
    );

    return this.handleDisplayMaterials(materialSet);
  }

  private async handleAction(
    action: ActionRequest, 
    context: PhaseContext,
    materialSet?: MaterialSet
  ): Promise<PhaseOutput> {
    switch (action.actionId) {
      case 'select':
        return this.handleSelectMaterial(action.payload, context, materialSet);
      
      case 'skip':
        return this.handleSkip(context);
      
      case 'add_manual':
        return this.handleAddManual(action.payload, context);
      
      case 'refresh':
        return this.handleRefresh(context);
      
      default:
        return this.createErrorOutput(`Unknown action: ${action.actionId}`);
    }
  }

  private async handleSelectMaterial(
    payload: any, 
    context: PhaseContext,
    materialSet?: MaterialSet
  ): Promise<PhaseOutput> {
    if (!materialSet) {
      return this.createErrorOutput('No materials to select from');
    }

    const materialId = payload?.materialId;
    if (!materialId) {
      return this.createErrorOutput('Material ID is required');
    }

    const selectedMaterial = materialSet.materials.find(m => m.id === materialId);
    if (!selectedMaterial) {
      return this.createErrorOutput(`Material not found: ${materialId}`);
    }

    // 更新选中状态
    const updatedMaterials = materialSet.materials.map(m => ({
      ...m,
      selected: m.id === materialId
    }));

    const updatedSet: MaterialSet = {
      ...materialSet,
      materials: updatedMaterials,
      selected_material: selectedMaterial,
      updated_at: new Date().toISOString()
    };

    await this.saveArtifact(
      context.workflowId,
      'material_set',
      updatedSet,
      'user',
      `Selected material: ${selectedMaterial.title}`
    );

    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: `已选中素材：**${selectedMaterial.title}**\n\n类型：${selectedMaterial.type}\n来源：${selectedMaterial.source}\n\n${selectedMaterial.core_viewpoint ? `核心观点：${selectedMaterial.core_viewpoint}` : ''}`,
        type: 'success'
      }
    ];

    // 检查出口条件
    const exitCheck = await this.checkExitGating(context.workflowId, this.config.exit.next_phase?.toString());
    
    if (!exitCheck.allowed) {
      return this.createGatingViolationOutput(exitCheck);
    }

    const uiState = this.buildUIState(
      { 
        phase: 'selected',
        materialSet: updatedSet,
        selectedMaterial
      },
      ['confirm', 'reselect']
    );

    return this.createSuccessOutput(
      { material_set: updatedSet },
      messages,
      this.config.exit.next_phase?.toString(),
      uiState
    );
  }

  private async handleSkip(context: PhaseContext): Promise<PhaseOutput> {
    const materialSet: MaterialSet = {
      materials: [],
      skipped: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await this.saveArtifact(
      context.workflowId,
      'material_set',
      materialSet,
      'user',
      'Skipped material selection'
    );

    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: '已跳过素材选择。我们将直接开始创建简报。',
        type: 'info'
      }
    ];

    const uiState = this.buildUIState(
      { phase: 'skipped' },
      []
    );

    return this.createSuccessOutput(
      { material_set: materialSet },
      messages,
      this.config.exit.next_phase?.toString(),
      uiState
    );
  }

  private async handleAddManual(payload: any, context: PhaseContext): Promise<PhaseOutput> {
    if (!payload?.title || !payload?.content) {
      return this.createErrorOutput('Title and content are required for manual material');
    }

    const newMaterial: Material = {
      id: `manual-${Date.now()}`,
      title: payload.title,
      type: payload.type || 'other',
      source: 'manual',
      content: payload.content,
      selected: false,
      created_at: new Date().toISOString()
    };

    const existingSet = await this.loadArtifacts(context.workflowId, ['material_set']);
    const currentSet = existingSet.get('material_set') as MaterialSet | undefined;

    const updatedSet: MaterialSet = currentSet 
      ? {
          ...currentSet,
          materials: [...currentSet.materials, newMaterial],
          updated_at: new Date().toISOString()
        }
      : {
          materials: [newMaterial],
          skipped: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

    await this.saveArtifact(
      context.workflowId,
      'material_set',
      updatedSet,
      'user',
      `Added manual material: ${newMaterial.title}`
    );

    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: `已添加素材：**${newMaterial.title}**`,
        type: 'success'
      }
    ];

    return this.handleDisplayMaterials(updatedSet);
  }

  private async handleRefresh(context: PhaseContext): Promise<PhaseOutput> {
    // 重新获取素材
    return this.handleInitialEntry(context);
  }

  private async handleDisplayMaterials(materialSet: MaterialSet): Promise<PhaseOutput> {
    const materialList = materialSet.materials.map((m, index) => 
      `${index + 1}. **${m.title}** (${m.type}) - ${m.source}${m.selected ? ' ✅' : ''}`
    ).join('\n');

    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: `## 素材列表

${materialList}

---

请选择一个素材作为写作基础，或选择跳过：`,
        type: 'info'
      }
    ];

    const availableActions = materialSet.materials.length > 0 
      ? ['select', 'skip', 'refresh']
      : ['skip', 'add_manual'];

    const uiState = this.buildUIState(
      { 
        phase: 'listing',
        materialSet,
        materials: materialSet.materials
      },
      availableActions
    );

    return this.createSuccessOutput(
      { material_set: materialSet },
      messages,
      undefined,
      uiState
    );
  }

  private async fetchMaterialsFromFeishu(): Promise<Material[]> {
    // TODO: 集成飞书 API 获取素材
    // 这里返回模拟数据，实际实现需要调用飞书 API
    
    // 模拟从飞书获取素材
    const mockMaterials: Material[] = [
      {
        id: 'feishu-1',
        title: 'AI 工具在内容创作中的应用',
        type: 'article',
        source: '飞书文档',
        url: 'https://feishu.cn/docx/xxx',
        core_viewpoint: 'AI 工具可以显著提升内容创作效率',
        selected: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'feishu-2',
        title: '播客：与 AI 共事的未来',
        type: 'podcast',
        source: '飞书妙记',
        url: 'https://feishu.cn/minutes/xxx',
        core_viewpoint: '人类与 AI 协作将是未来工作模式',
        selected: false,
        created_at: new Date().toISOString()
      }
    ];

    return mockMaterials;
  }
}
