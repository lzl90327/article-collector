/**
 * Convergence Phase 处理器
 * Phase 3: 收敛阶段，整合讨论成果，生成大纲
 */

import { BasePhase, PhaseContext, PhaseResult, PhaseRegistry } from './base.phase';
import * as deepseekService from '../services/deepseek.service';
import { logger } from '../utils/logger';

/**
 * Convergence Phase 配置
 */
const CONVERGENCE_PHASE_CONFIG = {
  phaseId: '3',
  name: 'Convergence',
  description: '整合讨论成果，生成大纲',
  requiredInputs: [],
  gatingRules: [
    {
      check: (context: PhaseContext) => {
        const state = context.session.state_json as any;
        return !!state?.brief && !!state?.discussions && state.discussions.length >= 3;
      },
      errorMessage: 'Must complete Brief and Discussion phases before convergence',
    },
  ],
};

/**
 * Convergence Phase 处理器
 */
export class ConvergencePhase extends BasePhase {
  constructor() {
    super(CONVERGENCE_PHASE_CONFIG);
  }

  /**
   * 执行 Convergence Phase
   */
  async execute(context: PhaseContext): Promise<PhaseResult> {
    this.logExecution(context, 'Starting Convergence phase');

    // 门控检查
    const gating = this.checkGatingRules(context);
    if (!gating.passed) {
      return this.buildErrorResult(gating.error || 'Gating check failed');
    }

    const state = context.session.state_json as any;
    const brief = state.brief;
    const discussions = state.discussions || [];

    try {
      // 生成大纲
      const outline = await this.generateOutline(brief, discussions);

      // 创建 Outline Artifact
      const artifact = await this.createArtifact(context.session.id, {
        kind: 'outline',
        title: `大纲: ${brief.thesis}`,
        content: JSON.stringify(outline, null, 2),
        metaJson: {
          generatedAt: new Date().toISOString(),
          sectionCount: outline.sections.length,
        },
        sourceJobId: context.job.id,
      });

      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '3',
        substate: 'outline_pending',
        pendingInputDef: {
          type: 'confirm',
          question: '大纲已生成，是否确认并进入草稿阶段？',
        },
        stateJson: {
          ...state,
          outline,
          outlineGenerated: true,
        },
      });

      this.logExecution(context, 'Outline generated successfully', {
        artifactId: artifact.id,
        sectionCount: outline.sections.length,
      });

      // 构建大纲展示
      const sectionsText = outline.sections
        .map((s: any, i: number) => `${i + 1}. **${s.title}**\n   ${s.summary}`)
        .join('\n\n');

      return this.buildSuccessResult({
        nextPhase: '3',
        nextSubstate: 'outline_pending',
        pendingInput: {
          type: 'confirm',
          question: '大纲已生成，是否确认并进入草稿阶段？',
        },
        artifacts: [artifact],
        messages: [
          {
            role: 'assistant',
            content: `## 📝 文章大纲

**标题**: ${outline.title}

**核心论点**: ${outline.thesis}

### 章节结构
${sectionsText}

---

大纲已生成，确认后将进入草稿撰写阶段。`,
          },
        ],
      });
    } catch (error) {
      logger.error('Convergence phase failed:', error);
      return this.buildErrorResult(`Convergence phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * 生成大纲
   */
  private async generateOutline(
    brief: Record<string, any>,
    discussions: Array<{ question: string; answer: string }>
  ): Promise<{
    title: string;
    thesis: string;
    sections: Array<{
      title: string;
      summary: string;
      keyPoints: string[];
    }>;
  }> {
    const prompt = `基于以下Brief和讨论记录，生成文章大纲：

【Brief】
核心论点：${brief.thesis}
目标读者：${brief.targetAudience}
关键词：${brief.keywords?.join(', ')}

【讨论记录】
${discussions.map((d, i) => `讨论${i + 1}：${d.question}\n回答：${d.answer}`).join('\n\n')}

请生成JSON格式的大纲：
{
  "title": "文章标题",
  "thesis": "核心论点",
  "sections": [
    {
      "title": "章节标题",
      "summary": "章节概要",
      "keyPoints": ["要点1", "要点2"]
    }
  ]
}`;

    const response = await deepseekService.chatCompletion({
      messages: [
        { role: 'system', content: '你是一个专业的写作助手，擅长根据Brief和讨论记录生成结构清晰的文章大纲。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    return JSON.parse(response.content);
  }

  /**
   * 确认大纲
   */
  async confirmOutline(context: PhaseContext, confirmed: boolean): Promise<PhaseResult> {
    this.logExecution(context, `Outline confirmation: ${confirmed}`);

    const state = context.session.state_json as any;

    if (!confirmed) {
      // 用户拒绝，返回讨论阶段
      await this.updateSessionState(context.session.id, {
        phase: '2',
        substate: 'idle',
        pendingInputDef: {
          type: 'text_input',
          question: '大纲需要哪些调整？请告诉我您的想法：',
          placeholder: '例如：需要增加某个章节、调整章节顺序等',
        },
        stateJson: {
          ...state,
          outlineRejected: true,
        },
      });

      return this.buildSuccessResult({
        nextPhase: '2',
        nextSubstate: 'idle',
        pendingInput: {
          type: 'text_input',
          question: '大纲需要哪些调整？请告诉我您的想法：',
          placeholder: '例如：需要增加某个章节、调整章节顺序等',
        },
        messages: [
          {
            role: 'assistant',
            content: '请告诉我如何调整大纲，我会根据您的反馈重新生成。',
          },
        ],
      });
    }

    // 用户确认，进入草稿阶段
    await this.updateSessionState(context.session.id, {
      phase: '4',
      substate: 'idle',
      pendingInputDef: null,
    });

    return this.buildSuccessResult({
      nextPhase: '4',
      nextSubstate: 'idle',
      pendingInput: null,
      messages: [
        {
          role: 'assistant',
          content: '大纲已确认！接下来进入草稿撰写阶段，我会根据大纲生成完整的文章。',
        },
      ],
    });
  }
}

// 注册 Phase
PhaseRegistry.register(new ConvergencePhase());
