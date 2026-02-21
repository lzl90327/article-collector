import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface ReviewIssue {
  id: string;
  type: 'clarity' | 'grammar' | 'style' | 'structure';
  description: string;
  suggestion: string;
  severity: 'minor' | 'moderate' | 'major';
}

/**
 * Phase 4.3: Light Review
 * 轻量审阅阶段 - 快速检查文章的基础问题
 */
export class LightReviewPhaseHandler extends PhaseHandler {
  constructor() {
    super('4.3');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'lightReviewSubstate', 'scanning');

    switch (currentSubstate) {
      case 'scanning':
        return this.handleScanning(context);
      case 'await_review':
        return this.handleAwaitReview(context);
      case 'await_fix':
        return this.handleAwaitFix(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleScanning(context);
    }
  }

  /**
   * 扫描文章，识别问题
   */
  private async handleScanning(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取草稿内容
    const draftContent = this.getFieldValue(state, 'current_draft')?.content ||
                        this.getFieldValue(state, 'journal_content') || '';

    if (!draftContent) {
      return this.errorResult('没有找到草稿内容，无法进行审阅');
    }

    // 模拟扫描文章发现问题
    // 实际应该调用 AI 服务进行轻量审阅
    const mockIssues: ReviewIssue[] = this.scanForIssues(draftContent);

    this.setFieldValue(state, 'light_review_issues', mockIssues);
    this.setFieldValue(state, 'lightReviewSubstate', 'await_review');

    // 创建 light_review_report artifact
    const reviewArtifact = await this.createArtifact(
      context,
      'light_review_report',
      {
        issues: mockIssues,
        issue_count: mockIssues.length,
        scanned_at: new Date().toISOString(),
        word_count: draftContent.length
      },
      true
    );

    const hasMajorIssues = mockIssues.some(i => i.severity === 'major');
    const hasIssues = mockIssues.length > 0;

    let prompt = `🔍 轻量审阅完成\n\n`;

    if (!hasIssues) {
      prompt += `✅ 未发现明显问题，文章看起来不错！\n\n`;
    } else {
      prompt += `发现 ${mockIssues.length} 个问题：\n\n`;
      prompt += mockIssues.map((issue, i) => 
        `${i + 1}. [${issue.type}] ${issue.description}\n   建议：${issue.suggestion}`
      ).join('\n\n');
      prompt += `\n\n`;
    }

    prompt += `你可以：\n`;
    prompt += `• confirm: ${hasMajorIssues ? '忽略问题，' : ''}继续下一步\n`;
    if (hasIssues) {
      prompt += `• fix: 根据建议修改文章\n`;
      prompt += `• detail: 查看某个问题的详细说明（输入 detail 编号）\n`;
    }

    return {
      success: true,
      artifacts: [reviewArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'light_review_action',
        prompt
      ),
      messages: [`轻量审阅完成，发现 ${mockIssues.length} 个问题`]
    };
  }

  /**
   * 等待用户处理审阅结果
   */
  private async handleAwaitReview(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.light_review_action) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'light_review_action',
          '请选择操作：confirm（确认）、fix（修改）、detail（查看详情）'
        )
      };
    }

    const action = input.light_review_action;

    if (action === 'confirm') {
      this.setFieldValue(state, 'lightReviewSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    if (action === 'fix') {
      this.setFieldValue(state, 'lightReviewSubstate', 'await_fix');
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'fix_request',
          '请描述你的修改计划，或输入"auto"让AI自动修复：'
        ),
        messages: ['等待修改']
      };
    }

    if (action.startsWith('detail')) {
      const index = parseInt(action.split(' ')[1]) - 1;
      const issues = this.getFieldValue(state, 'light_review_issues', []);
      if (index >= 0 && index < issues.length) {
        const issue = issues[index];
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'light_review_action',
            `问题 #${index + 1} 详情：\n\n` +
            `类型：${issue.type}\n` +
            `严重程度：${issue.severity}\n` +
            `描述：${issue.description}\n` +
            `建议：${issue.suggestion}\n\n` +
            `输入 confirm、fix 或其他操作：`
          ),
          messages: ['显示问题详情']
        };
      }
    }

    return this.errorResult('无效的操作');
  }

  /**
   * 等待用户修复或自动修复
   */
  private async handleAwaitFix(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.fix_request) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'fix_request',
          '请描述修改计划，或输入"auto"自动修复：'
        )
      };
    }

    const fixRequest = input.fix_request;
    const draftContent = this.getFieldValue(state, 'current_draft')?.content ||
                        this.getFieldValue(state, 'journal_content') || '';

    let fixedContent: string;

    if (fixRequest === 'auto') {
      // 模拟自动修复
      fixedContent = this.autoFix(draftContent, this.getFieldValue(state, 'light_review_issues', []));
    } else {
      // 保存用户的修改计划
      this.setFieldValue(state, 'fix_plan', fixRequest);
      fixedContent = draftContent; // 实际应该根据用户计划修改
    }

    // 更新草稿
    const currentDraft = this.getFieldValue(state, 'current_draft') || {};
    currentDraft.content = fixedContent;
    this.setFieldValue(state, 'current_draft', currentDraft);

    // 重新扫描
    this.setFieldValue(state, 'lightReviewSubstate', 'scanning');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'light_review_action',
        fixRequest === 'auto' ? '已自动修复，重新扫描中...' : '修改计划已记录，重新扫描中...'
      ),
      messages: ['已应用修改，重新审阅']
    };
  }

  /**
   * 确认审阅完成
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const issues = this.getFieldValue(state, 'light_review_issues', []);

    // 创建最终的审阅报告
    const finalArtifact = await this.createArtifact(
      context,
      'light_review_report',
      {
        issues,
        issue_count: issues.length,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        resolution: issues.length > 0 ? 'confirmed_with_issues' : 'no_issues_found'
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:4.3:completed');

    // 根据模式决定下一步
    const mode = state.mode;
    const nextPhase = mode === 'argument_mode' ? '4.5' : '4.8';

    return {
      success: true,
      artifacts: [finalArtifact],
      nextPhaseId: nextPhase,
      messages: [`轻量审阅完成，${issues.length > 0 ? '带问题确认' : '无问题'}，进入${mode === 'argument_mode' ? '深度审核' : '配图生成'}阶段`]
    };
  }

  /**
   * 扫描文章问题（模拟）
   */
  private scanForIssues(content: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    // 检查长句子
    const sentences = content.split(/[。！？.!?]/);
    sentences.forEach((sentence, index) => {
      if (sentence.length > 100) {
        issues.push({
          id: `issue_${index}`,
          type: 'clarity',
          description: `第 ${index + 1} 句过长（${sentence.length} 字），可能影响可读性`,
          suggestion: '考虑拆分成多个短句',
          severity: 'minor'
        });
      }
    });

    // 检查重复词汇
    const words = content.split(/\s+/);
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 2) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });

    Object.entries(wordCount).forEach(([word, count]) => {
      if (count > 5) {
        issues.push({
          id: `issue_repeat_${word}`,
          type: 'style',
          description: `"${word}" 重复出现 ${count} 次`,
          suggestion: '考虑使用同义词替换部分重复',
          severity: 'minor'
        });
      }
    });

    // 检查缺少标点
    if (!content.includes('？') && content.length > 200) {
      issues.push({
        id: 'issue_no_question',
        type: 'style',
        description: '文章较长但缺少问句，可能缺少互动性',
        suggestion: '考虑添加反问或设问增加互动感',
        severity: 'minor'
      });
    }

    return issues;
  }

  /**
   * 自动修复问题（模拟）
   */
  private autoFix(content: string, issues: ReviewIssue[]): string {
    let fixed = content;

    // 简单的自动修复示例
    issues.forEach(issue => {
      if (issue.type === 'grammar') {
        // 实际应该调用 AI 服务
        fixed = fixed.replace(/，，/g, '，');
        fixed = fixed.replace(/。。/g, '。');
      }
    });

    return fixed + '\n\n[已自动修复]';
  }
}
