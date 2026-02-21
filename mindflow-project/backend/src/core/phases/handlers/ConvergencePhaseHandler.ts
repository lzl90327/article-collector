import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface ConvergencePoint {
  id: string;
  content: string;
  source: string; // 'discussion' | 'user_added'
  priority: number;
}

/**
 * Phase 3: Convergence
 * 观点收敛阶段 - 整理讨论要点，形成结构化总结
 */
export class ConvergencePhaseHandler extends PhaseHandler {
  constructor() {
    super('3');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'convergenceSubstate', 'extract_points');

    switch (currentSubstate) {
      case 'extract_points':
        return this.handleExtractPoints(context);
      case 'await_review':
        return this.handleAwaitReview(context);
      case 'await_modification':
        return this.handleAwaitModification(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleExtractPoints(context);
    }
  }

  /**
   * 提取讨论要点
   */
  private async handleExtractPoints(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取讨论记录
    const discussionRecord = this.getFieldValue(state, 'discussion_messages', []);

    if (discussionRecord.length === 0) {
      return this.errorResult('没有讨论记录，无法收敛');
    }

    // 模拟从讨论中提取要点
    // 实际应该调用 AI 服务分析讨论内容
    const mockPoints: ConvergencePoint[] = [
      {
        id: 'point_1',
        content: 'AI工具降低了专业写作的门槛，让更多人能够表达复杂观点',
        source: 'discussion',
        priority: 1
      },
      {
        id: 'point_2',
        content: '但过度依赖AI可能导致思维懒惰，失去独立思考能力',
        source: 'discussion',
        priority: 2
      },
      {
        id: 'point_3',
        content: '关键在于将AI作为"外脑"而非"替代"，保持人的主体性',
        source: 'discussion',
        priority: 1
      }
    ];

    this.setFieldValue(state, 'convergence_points', mockPoints);
    this.setFieldValue(state, 'convergenceSubstate', 'await_review');

    // 创建 convergence_summary artifact
    const convergenceArtifact = await this.createArtifact(
      context,
      'convergence_summary',
      {
        points: mockPoints,
        extracted_at: new Date().toISOString(),
        discussion_rounds: discussionRecord.filter((m: any) => m.role === 'user').length
      },
      true
    );

    return {
      success: true,
      artifacts: [convergenceArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'convergence_review',
        `📝 观点收敛\n\n` +
        `基于我们的讨论，我提取了以下核心要点：\n\n` +
        mockPoints.map((p, i) => `${i + 1}. ${p.content} ${p.priority === 1 ? '(核心)' : ''}`).join('\n') +
        `\n\n你可以：\n` +
        `• confirm: 确认这些要点，进入写作阶段\n` +
        `• add: 添加新的要点\n` +
        `• modify: 修改现有要点\n` +
        `• remove: 删除某些要点（输入编号，如 remove 2）`
      ),
      messages: ['讨论要点已提取，等待审核']
    };
  }

  /**
   * 等待用户审核要点
   */
  private async handleAwaitReview(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.convergence_review) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'convergence_review',
          '请选择操作：confirm（确认）、add（添加）、modify（修改）、remove（删除）'
        )
      };
    }

    const action = input.convergence_review;

    switch (action) {
      case 'confirm':
        this.setFieldValue(state, 'convergenceSubstate', 'confirmed');
        return this.handleConfirmed(context);

      case 'add':
        this.setFieldValue(state, 'convergenceSubstate', 'await_modification');
        this.setFieldValue(state, 'modification_type', 'add');
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'new_point',
            '请输入要添加的要点内容：'
          ),
          messages: ['等待添加新要点']
        };

      case 'modify':
        this.setFieldValue(state, 'convergenceSubstate', 'await_modification');
        this.setFieldValue(state, 'modification_type', 'modify');
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'modification_request',
            '请输入要修改的要点编号和修改内容（格式：编号|新内容）：'
          ),
          messages: ['等待修改要点']
        };

      default:
        if (action.startsWith('remove')) {
          const index = parseInt(action.split(' ')[1]) - 1;
          const points = this.getFieldValue(state, 'convergence_points', []);
          if (index >= 0 && index < points.length) {
            points.splice(index, 1);
            this.setFieldValue(state, 'convergence_points', points);
            return {
              success: true,
              artifacts: [],
              pendingInput: this.createPendingInput(
                'user_input',
                'convergence_review',
                `已删除要点 #${index + 1}。\n\n` +
                `当前要点：\n` +
                points.map((p: ConvergencePoint, i: number) => `${i + 1}. ${p.content}`).join('\n') +
                `\n\n请选择：confirm、add、modify、remove`
              ),
              messages: ['要点已删除']
            };
          }
        }
        return this.errorResult('无效的操作，请选择 confirm、add、modify 或 remove');
    }
  }

  /**
   * 处理修改请求
   */
  private async handleAwaitModification(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const modificationType = this.getFieldValue(state, 'modification_type');
    const points = this.getFieldValue(state, 'convergence_points', []);

    if (modificationType === 'add') {
      if (!input || !input.new_point) {
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'new_point',
            '请输入要添加的要点内容：'
          )
        };
      }

      const newPoint: ConvergencePoint = {
        id: `point_${Date.now()}`,
        content: input.new_point,
        source: 'user_added',
        priority: 2
      };
      points.push(newPoint);
      this.setFieldValue(state, 'convergence_points', points);

    } else if (modificationType === 'modify') {
      if (!input || !input.modification_request) {
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'modification_request',
            '请输入要修改的要点编号和修改内容（格式：编号|新内容）：'
          )
        };
      }

      const [indexStr, newContent] = input.modification_request.split('|');
      const index = parseInt(indexStr) - 1;

      if (index >= 0 && index < points.length && newContent) {
        points[index].content = newContent.trim();
        this.setFieldValue(state, 'convergence_points', points);
      }
    }

    // 回到审核状态
    this.setFieldValue(state, 'convergenceSubstate', 'await_review');
    this.setFieldValue(state, 'modification_type', undefined);

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'convergence_review',
        `修改完成。当前要点：\n\n` +
        points.map((p: ConvergencePoint, i: number) => `${i + 1}. ${p.content}`).join('\n') +
        `\n\n请选择：confirm、add、modify、remove`
      ),
      messages: ['要点已更新']
    };
  }

  /**
   * 确认收敛，进入写作阶段
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const points = this.getFieldValue(state, 'convergence_points', []);

    // 创建最终的 convergence_summary artifact
    const finalArtifact = await this.createArtifact(
      context,
      'convergence_summary',
      {
        points,
        final_point_count: points.length,
        core_points: points.filter((p: ConvergencePoint) => p.priority === 1).length,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:3:completed');

    return {
      success: true,
      artifacts: [finalArtifact],
      nextPhaseId: '4', // 进入 Drafting 阶段
      messages: [`观点收敛完成，共 ${points.length} 个要点，进入写作阶段`]
    };
  }
}
