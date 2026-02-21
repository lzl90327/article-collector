import { PhaseHandler, PhaseContext, PhaseOutput, PhaseMessage, ActionRequest } from '../PhaseHandler';
import { PhaseConfig } from '../../config/PhaseLoader';

export interface BriefCard {
  target_audience: string;
  existing_belief: string;
  change_goal: string;
  thesis: string;
  evidence_strategy: string;
  status: 'draft' | 'confirmed' | 'revised';
  created_at: string;
  updated_at: string;
}

export class BriefPhaseHandler extends PhaseHandler {
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

      // 获取已存在的 brief_card（如果有）
      const existingBrief = await this.loadArtifacts(context.workflowId, ['brief_card']);
      const briefCard = existingBrief.get('brief_card') as BriefCard | undefined;

      // 处理用户输入或 Action
      if (action) {
        return await this.handleAction(action, context, briefCard);
      }

      // 初始进入 Phase
      if (!briefCard) {
        return await this.handleInitialInput(context);
      }

      // 显示现有的 Brief Card
      return this.handleDisplayBrief(briefCard);

    } catch (error) {
      return this.createErrorOutput(
        error instanceof Error ? error.message : 'Unknown error in Brief phase'
      );
    }
  }

  private async handleInitialInput(context: PhaseContext): Promise<PhaseOutput> {
    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: '让我们开始创建写作简报。请告诉我：\n\n1. **目标读者**：这篇文章写给谁？\n2. **既有信念/误区**：读者目前怎么想？\n3. **要改变什么**：读完后读者应该...\n4. **核心主张(Thesis)**：一句话概括文章观点\n5. **证据策略**：用什么支撑主张？',
        type: 'info'
      }
    ];

    const uiState = this.buildUIState(
      { 
        phase: 'input',
        fields: this.config.fields
      },
      ['submit_brief']
    );

    return this.createSuccessOutput(
      {},
      messages,
      undefined,
      uiState
    );
  }

  private async handleAction(
    action: ActionRequest, 
    context: PhaseContext,
    existingBrief?: BriefCard
  ): Promise<PhaseOutput> {
    switch (action.actionId) {
      case 'submit_brief':
        return this.handleSubmitBrief(action.payload, context);
      
      case 'confirm':
        return this.handleConfirm(context, existingBrief);
      
      case 'modify':
        return this.handleModify(context, existingBrief, action.payload);
      
      case 'redo':
        return this.handleRedo(context);
      
      default:
        return this.createErrorOutput(`Unknown action: ${action.actionId}`);
    }
  }

  private async handleSubmitBrief(payload: any, context: PhaseContext): Promise<PhaseOutput> {
    // 验证必需字段
    const requiredFields = ['target_audience', 'existing_belief', 'change_goal', 'thesis', 'evidence_strategy'];
    const missingFields = requiredFields.filter(f => !payload?.[f]);

    if (missingFields.length > 0) {
      return this.createErrorOutput(
        `Missing required fields: ${missingFields.join(', ')}`,
        [{
          role: 'system',
          content: `请补充以下信息：${missingFields.join('、')}`,
          type: 'warning'
        }]
      );
    }

    // 创建 Brief Card
    const briefCard: BriefCard = {
      target_audience: payload.target_audience,
      existing_belief: payload.existing_belief,
      change_goal: payload.change_goal,
      thesis: payload.thesis,
      evidence_strategy: payload.evidence_strategy,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 保存产物
    await this.saveArtifact(
      context.workflowId,
      'brief_card',
      briefCard,
      'user',
      'Created brief card'
    );

    return this.handleDisplayBrief(briefCard);
  }

  private async handleDisplayBrief(briefCard: BriefCard): Promise<PhaseOutput> {
    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: `## 写作简报

**目标读者**：${briefCard.target_audience}

**既有信念/误区**：${briefCard.existing_belief}

**要改变什么**：${briefCard.change_goal}

**核心主张(Thesis)**：${briefCard.thesis}

**证据策略**：${briefCard.evidence_strategy}

---

这个简报看起来如何？`,
        type: 'info'
      }
    ];

    const availableActions = briefCard.status === 'confirmed' 
      ? ['modify', 'redo']
      : ['confirm', 'modify', 'redo'];

    const uiState = this.buildUIState(
      {
        phase: 'confirmation',
        briefCard,
        status: briefCard.status
      },
      availableActions
    );

    // 检查是否可以进入下一阶段
    // Note: context is passed to handleDisplayBrief in a real implementation
    // For now, we'll skip the exit check here since we don't have access to workflowId
    const nextPhase = briefCard.status === 'confirmed' 
      ? this.config.exit.next_phase?.toString() 
      : undefined;

    return this.createSuccessOutput(
      { brief_card: briefCard },
      messages,
      nextPhase,
      uiState
    );
  }

  private async handleConfirm(context: PhaseContext, briefCard?: BriefCard): Promise<PhaseOutput> {
    if (!briefCard) {
      return this.createErrorOutput('No brief card to confirm');
    }

    const updatedBrief: BriefCard = {
      ...briefCard,
      status: 'confirmed',
      updated_at: new Date().toISOString()
    };

    await this.saveArtifact(
      context.workflowId,
      'brief_card',
      updatedBrief,
      'user',
      'Confirmed brief card'
    );

    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: '✅ 简报已确认！我们将基于这个简报继续写作流程。',
        type: 'success'
      }
    ];

    // 检查出口条件
    const exitCheck = await this.checkExitGating(context.workflowId, this.config.exit.next_phase?.toString());
    
    if (!exitCheck.allowed) {
      return this.createGatingViolationOutput(exitCheck);
    }

    const uiState = this.buildUIState(
      { phase: 'confirmed', briefCard: updatedBrief },
      []
    );

    return this.createSuccessOutput(
      { brief_card: updatedBrief },
      messages,
      this.config.exit.next_phase?.toString(),
      uiState
    );
  }

  private async handleModify(
    context: PhaseContext, 
    briefCard?: BriefCard,
    modificationRequest?: string
  ): Promise<PhaseOutput> {
    if (!briefCard) {
      return this.createErrorOutput('No brief card to modify');
    }

    if (!modificationRequest) {
      // 请求用户输入修改意见
      const messages: PhaseMessage[] = [
        {
          role: 'assistant',
          content: '请告诉我需要修改哪里，以及你希望如何调整？',
          type: 'info'
        }
      ];

      const uiState = this.buildUIState(
        { phase: 'modification_input', briefCard },
        ['submit_modification']
      );

      return this.createSuccessOutput(
        { brief_card: briefCard },
        messages,
        undefined,
        uiState
      );
    }

    // 应用修改（这里可以集成 AI 来智能修改）
    const updatedBrief: BriefCard = {
      ...briefCard,
      status: 'revised',
      updated_at: new Date().toISOString()
    };

    await this.saveArtifact(
      context.workflowId,
      'brief_card',
      updatedBrief,
      'user',
      `Modified: ${modificationRequest}`
    );

    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: `已根据你的反馈修改简报。\n\n修改意见：${modificationRequest}`,
        type: 'info'
      }
    ];

    return this.handleDisplayBrief(updatedBrief);
  }

  private async handleRedo(context: PhaseContext): Promise<PhaseOutput> {
    // 删除现有的 brief_card
    const existingBrief = await this.loadArtifacts(context.workflowId, ['brief_card']);
    if (existingBrief.has('brief_card')) {
      // 重置为初始状态
      await this.saveArtifact(
        context.workflowId,
        'brief_card',
        null,
        'system',
        'Reset brief card'
      );
    }

    const messages: PhaseMessage[] = [
      {
        role: 'assistant',
        content: '好的，让我们重新创建简报。',
        type: 'info'
      }
    ];

    return this.handleInitialInput(context);
  }
}
