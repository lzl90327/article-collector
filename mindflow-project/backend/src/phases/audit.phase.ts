/**
 * Audit Phase 处理器
 * Phase 4.5: 审核文章
 */

import { BasePhase, PhaseContext, PhaseResult, PhaseRegistry } from './base.phase';
import * as deepseekService from '../services/deepseek.service';
import { logger } from '../utils/logger';

/**
 * Audit Phase 配置
 */
const AUDIT_PHASE_CONFIG = {
  phaseId: '4.5',
  name: 'Audit',
  description: '审核文章质量',
  requiredInputs: [],
  gatingRules: [
    {
      check: (context: PhaseContext) => {
        const state = context.session.state_json as any;
        return !!state?.draftGenerated;
      },
      errorMessage: 'Must generate draft before audit',
    },
  ],
};

/**
 * Audit Phase 处理器
 */
export class AuditPhase extends BasePhase {
  constructor() {
    super(AUDIT_PHASE_CONFIG);
  }

  /**
   * 执行 Audit Phase
   */
  async execute(context: PhaseContext): Promise<PhaseResult> {
    this.logExecution(context, 'Starting Audit phase');

    // 门控检查
    const gating = this.checkGatingRules(context);
    if (!gating.passed) {
      return this.buildErrorResult(gating.error || 'Gating check failed');
    }

    const state = context.session.state_json as any;
    const brief = state.brief;

    try {
      // 获取最新的草稿
      const draftArtifact = await this.getLatestArtifact(context.session.id, 'draft');

      if (!draftArtifact) {
        return this.buildErrorResult('Draft not found');
      }

      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '4.5',
        substate: 'auditing',
        pendingInputDef: null,
      });

      // 审核文章
      const auditResult = await deepseekService.auditArticle(
        draftArtifact.content,
        brief
      );

      // 创建 Audit Report Artifact
      const artifact = await this.createArtifact(context.session.id, {
        kind: 'audit_report',
        title: `审校报告: ${brief.thesis}`,
        content: JSON.stringify(auditResult, null, 2),
        metaJson: {
          score: auditResult.score,
          generatedAt: new Date().toISOString(),
        },
        sourceJobId: context.job.id,
      });

      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '4.5',
        substate: 'audit_pending',
        pendingInputDef: {
          type: 'confirm',
          question: '审校报告已生成，是否接受建议并修改？',
        },
        stateJson: {
          ...state,
          auditCompleted: true,
          auditScore: auditResult.score,
        },
      });

      this.logExecution(context, 'Audit completed successfully', {
        artifactId: artifact.id,
        score: auditResult.score,
      });

      // 构建审校报告消息
      const criticismsText = auditResult.criticisms
        .map((c: any, i: number) => `${i + 1}. **${c.point}**\n   💡 ${c.suggestion}`)
        .join('\n\n');

      const improvementsText = auditResult.improvements
        .map((imp: string, i: number) => `${i + 1}. ${imp}`)
        .join('\n');

      return this.buildSuccessResult({
        nextPhase: '4.5',
        nextSubstate: 'audit_pending',
        pendingInput: {
          type: 'confirm',
          question: '审校报告已生成，是否接受建议并修改？',
        },
        artifacts: [artifact],
        messages: [
          {
            role: 'assistant',
            content: `## 📊 审校报告

**综合评分**: ${auditResult.score}/100

### 🔍 主要问题
${criticismsText}

### 💡 改进建议
${improvementsText}

---

您可以选择：
1. **接受建议** - 返回编辑阶段修改
2. **忽略建议** - 直接发布`,
          },
        ],
      });
    } catch (error) {
      logger.error('Audit phase failed:', error);
      return this.buildErrorResult(`Audit phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * 处理审核结果确认
   */
  async handleAuditConfirmation(
    context: PhaseContext,
    acceptSuggestions: boolean
  ): Promise<PhaseResult> {
    this.logExecution(context, `Audit confirmation: ${acceptSuggestions}`);

    if (acceptSuggestions) {
      // 用户接受建议，返回编辑阶段
      await this.updateSessionState(context.session.id, {
        phase: '4',
        substate: 'draft_pending',
        pendingInputDef: {
          type: 'confirm',
          question: '已返回编辑阶段，请根据审校建议修改草稿。',
        },
      });

      return this.buildSuccessResult({
        nextPhase: '4',
        nextSubstate: 'draft_pending',
        pendingInput: {
          type: 'confirm',
          question: '已返回编辑阶段，请根据审校建议修改草稿。',
        },
        messages: [
          {
            role: 'assistant',
            content: '已返回编辑阶段。请根据审校建议修改草稿，完成后可以再次提交审核或直接发布。',
          },
        ],
      });
    }

    // 用户忽略建议，进入发布阶段
    await this.updateSessionState(context.session.id, {
      phase: '5',
      substate: 'completed',
      pendingInputDef: null,
    });

    return this.buildSuccessResult({
      nextPhase: '5',
      nextSubstate: 'completed',
      pendingInput: null,
      messages: [
        {
          role: 'assistant',
          content: '🎉 文章已完成！您可以查看最终版本或导出文章。',
        },
      ],
    });
  }
}

// 注册 Phase
PhaseRegistry.register(new AuditPhase());
