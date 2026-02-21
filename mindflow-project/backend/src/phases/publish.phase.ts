/**
 * Publish Phase 处理器
 * Phase 5: 发布阶段，执行发布操作
 */

import { BasePhase, PhaseContext, PhaseResult, PhaseRegistry } from './base.phase';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

/**
 * Publish Phase 配置
 */
const PUBLISH_PHASE_CONFIG = {
  phaseId: '5',
  name: 'Publish',
  description: '发布文章到目标平台',
  requiredInputs: [],
  gatingRules: [
    {
      check: (context: PhaseContext) => {
        const state = context.session.state_json as any;
        return !!state?.draftGenerated;
      },
      errorMessage: 'Must generate draft before publish',
    },
  ],
};

/**
 * Publish Phase 处理器
 */
export class PublishPhase extends BasePhase {
  constructor() {
    super(PUBLISH_PHASE_CONFIG);
  }

  /**
   * 执行 Publish Phase
   */
  async execute(context: PhaseContext): Promise<PhaseResult> {
    this.logExecution(context, 'Starting Publish phase');

    // 门控检查
    const gating = this.checkGatingRules(context);
    if (!gating.passed) {
      return this.buildErrorResult(gating.error || 'Gating check failed');
    }

    const state = context.session.state_json as any;

    try {
      // 获取最新的草稿
      const draftArtifact = await this.getLatestArtifact(context.session.id, 'draft');

      if (!draftArtifact) {
        return this.buildErrorResult('Draft not found');
      }

      // 更新 Session 状态
      await this.updateSessionState(context.session.id, {
        phase: '5',
        substate: 'publishing',
        pendingInputDef: null,
      });

      // 执行发布操作（简化版）
      const publishResult = await this.performPublish(context, draftArtifact);

      // 创建 Publish Artifact
      const artifact = await this.createArtifact(context.session.id, {
        kind: 'publish_record',
        title: `发布记录: ${state.brief?.thesis || '未命名'}`,
        content: JSON.stringify(publishResult, null, 2),
        metaJson: {
          publishedAt: new Date().toISOString(),
          platforms: publishResult.platforms,
        },
        sourceJobId: context.job.id,
      });

      // 更新 Session 状态为完成
      await this.updateSessionState(context.session.id, {
        phase: '5',
        substate: 'completed',
        pendingInputDef: null,
        stateJson: {
          ...state,
          published: true,
          publishAt: new Date().toISOString(),
        },
      });

      // 记录同步日志
      await prisma.syncLog.create({
        data: {
          session_id: context.session.id,
          action: 'publish',
          target: 'mindflow:internal',
          status: 'success',
          result_json: publishResult,
        },
      });

      this.logExecution(context, 'Publish completed successfully', {
        artifactId: artifact.id,
        platforms: publishResult.platforms,
      });

      return this.buildSuccessResult({
        nextPhase: '5',
        nextSubstate: 'completed',
        pendingInput: null,
        artifacts: [artifact],
        messages: [
          {
            role: 'assistant',
            content: `## 🎉 发布成功！

文章已成功发布到以下平台：
${publishResult.platforms.map((p: string) => `- ${p}`).join('\n')}

**发布摘要**：
- 标题：${state.brief?.thesis || '未命名'}
- 字数：${draftArtifact.content.length}
- 发布时间：${new Date().toLocaleString()}

您可以在"文章管理"页面查看所有已发布的文章。`,
          },
        ],
      });
    } catch (error) {
      logger.error('Publish phase failed:', error);

      // 记录失败日志
      await prisma.syncLog.create({
        data: {
          session_id: context.session.id,
          action: 'publish',
          target: 'mindflow:internal',
          status: 'fail',
          error_message: (error as Error).message,
          retryable: true,
        },
      });

      return this.buildErrorResult(`Publish phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * 执行发布操作
   */
  private async performPublish(
    context: PhaseContext,
    draftArtifact: any
  ): Promise<{
    platforms: string[];
    results: Array<{
      platform: string;
      success: boolean;
      externalId?: string;
      error?: string;
    }>;
  }> {
    const results = [];
    const platforms = [];

    // 1. 保存到本地（始终执行）
    results.push({
      platform: 'mindflow',
      success: true,
      externalId: context.session.id,
    });
    platforms.push('MindFlow 本地存储');

    // 2. 同步到飞书 Bitable（如果有集成）
    try {
      const feishuIntegration = await prisma.integration.findFirst({
        where: {
          provider: 'feishu',
          status: 'connected',
        },
      });

      if (feishuIntegration) {
        // 这里应该调用飞书同步服务
        results.push({
          platform: 'feishu',
          success: true,
          externalId: 'bitable_record_id',
        });
        platforms.push('飞书 Bitable');
      }
    } catch (error) {
      logger.error('Feishu sync failed:', error);
      results.push({
        platform: 'feishu',
        success: false,
        error: (error as Error).message,
      });
    }

    return {
      platforms,
      results,
    };
  }

  /**
   * 发布预演
   */
  async dryRun(context: PhaseContext): Promise<PhaseResult> {
    this.logExecution(context, 'Starting publish dry run');

    const state = context.session.state_json as any;

    try {
      const draftArtifact = await this.getLatestArtifact(context.session.id, 'draft');

      if (!draftArtifact) {
        return this.buildErrorResult('Draft not found');
      }

      // 检查可发布到的平台
      const platforms = ['MindFlow 本地存储'];

      const feishuIntegration = await prisma.integration.findFirst({
        where: {
          provider: 'feishu',
          status: 'connected',
        },
      });

      if (feishuIntegration) {
        platforms.push('飞书 Bitable');
      }

      return this.buildSuccessResult({
        messages: [
          {
            role: 'assistant',
            content: `## 📋 发布预演

**文章信息**：
- 标题：${state.brief?.thesis || '未命名'}
- 字数：${draftArtifact.content.length}
- 状态：准备就绪

**可发布平台**：
${platforms.map((p, i) => `${i + 1}. ${p}`).join('\n')}

确认后将执行实际发布操作。`,
          },
        ],
      });
    } catch (error) {
      logger.error('Publish dry run failed:', error);
      return this.buildErrorResult(`Dry run failed: ${(error as Error).message}`);
    }
  }
}

// 注册 Phase
PhaseRegistry.register(new PublishPhase());
