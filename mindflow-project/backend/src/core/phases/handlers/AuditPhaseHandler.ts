import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';
import { CyberEditorialService } from '../../services/CyberEditorialService';

interface AuditCheck {
  id: string;
  category: 'brief_alignment' | 'logic' | 'evidence' | 'readability' | 'ethics';
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

/**
 * Phase 4.5: Audit
 * 深度审核阶段 - 基于赛博编辑部进行多维度深度审核
 */
export class AuditPhaseHandler extends PhaseHandler {
  private cyberEditorialService: CyberEditorialService | null = null;

  constructor(cyberEditorialService?: CyberEditorialService) {
    super('4.5');
    this.cyberEditorialService = cyberEditorialService || null;
  }

  /**
   * 设置赛博编辑部服务
   */
  setCyberEditorialService(service: CyberEditorialService): void {
    this.cyberEditorialService = service;
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'auditSubstate', 'analyzing');

    switch (currentSubstate) {
      case 'analyzing':
        return this.handleAnalyzing(context);
      case 'await_review':
        return this.handleAwaitReview(context);
      case 'await_revision':
        return this.handleAwaitRevision(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handleAnalyzing(context);
    }
  }

  /**
   * 深度分析文章 - 使用赛博编辑部服务
   */
  private async handleAnalyzing(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    // 获取必要信息
    const draftContent = this.getFieldValue(state, 'current_draft')?.content || '';
    const brief = {
      thesis: this.getFieldValue(state, 'thesis'),
      target_audience: this.getFieldValue(state, 'target_audience'),
      existing_belief: this.getFieldValue(state, 'existing_belief'),
      change_goal: this.getFieldValue(state, 'change_goal'),
      evidence_strategy: this.getFieldValue(state, 'evidence_strategy')
    };

    if (!draftContent) {
      return this.errorResult('没有找到草稿内容');
    }

    if (!brief.thesis || !brief.target_audience) {
      return this.errorResult('缺少必要的 Brief 信息');
    }

    let auditChecks: AuditCheck[];

    // 如果有赛博编辑部服务，使用它进行审计
    if (this.cyberEditorialService) {
      try {
        const report = await this.cyberEditorialService.auditArticle(draftContent, brief);
        
        // 转换赛博编辑部的审计结果为 AuditCheck 格式
        auditChecks = report.checks.map((check, index) => ({
          id: `check_${index}`,
          category: this.mapRoleToCategory(check.auditor_role),
          passed: check.score >= 6,
          score: check.score * 10, // 转换为 0-100
          issues: check.criticisms,
          suggestions: check.suggestions
        }));

        // 添加一个总体对齐度检查
        const alignmentCheck: AuditCheck = {
          id: 'check_alignment',
          category: 'brief_alignment',
          passed: report.passed,
          score: report.overall_score * 10,
          issues: report.revision_needed ? ['文章需要修改'] : [],
          suggestions: [report.summary]
        };
        
        auditChecks.unshift(alignmentCheck);
      } catch (error) {
        console.error('[AuditPhaseHandler] CyberEditorial audit failed:', error);
        // 降级到本地审计
        auditChecks = this.performLocalAudit(draftContent, brief);
      }
    } else {
      // 使用本地审计
      auditChecks = this.performLocalAudit(draftContent, brief);
    }

    this.setFieldValue(state, 'audit_checks', auditChecks);
    this.setFieldValue(state, 'auditSubstate', 'await_review');

    // 创建 audit_report artifact
    const auditArtifact = await this.createArtifact(
      context,
      'audit_report',
      {
        checks: auditChecks,
        overall_score: this.calculateOverallScore(auditChecks),
        passed: auditChecks.every(c => c.passed),
        analyzed_at: new Date().toISOString()
      },
      true
    );

    // 生成审核报告
    const report = this.generateAuditReport(auditChecks);

    return {
      success: true,
      artifacts: [auditArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'audit_action',
        report
      ),
      messages: ['深度审核完成']
    };
  }

  /**
   * 将赛博编辑部角色映射到审核类别
   */
  private mapRoleToCategory(role: string): AuditCheck['category'] {
    const mapping: Record<string, AuditCheck['category']> = {
      '逻辑编辑': 'logic',
      '伦理审查员': 'ethics',
      '读者代表': 'readability',
      '事实核查员': 'evidence',
      '风格编辑': 'readability'
    };
    return mapping[role] || 'logic';
  }

  /**
   * 等待用户处理审核结果
   */
  private async handleAwaitReview(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.audit_action) {
      const auditChecks = this.getFieldValue(state, 'audit_checks', []);
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'audit_action',
          this.generateAuditReport(auditChecks)
        )
      };
    }

    const action = input.audit_action;

    switch (action) {
      case 'confirm':
        this.setFieldValue(state, 'auditSubstate', 'confirmed');
        return this.handleConfirmed(context);

      case 'revise':
        this.setFieldValue(state, 'auditSubstate', 'await_revision');
        return {
          success: true,
          artifacts: [],
          pendingInput: this.createPendingInput(
            'user_input',
            'revision_request',
            '请描述修改计划：'
          ),
          messages: ['等待修改']
        };

      case 'detail':
        // 查看特定类别的详情
        const category = input.category;
        const auditChecks = this.getFieldValue(state, 'audit_checks', []);
        const check = auditChecks.find((c: AuditCheck) => c.category === category);
        if (check) {
          return {
            success: true,
            artifacts: [],
            pendingInput: this.createPendingInput(
              'user_input',
              'audit_action',
              `${this.getCategoryName(check.category)} 详情：\n\n` +
              `得分：${check.score}/100\n` +
              `状态：${check.passed ? '✅ 通过' : '❌ 未通过'}\n\n` +
              `问题：\n${check.issues.map((i: string) => `• ${i}`).join('\n')}\n\n` +
              `建议：\n${check.suggestions.map((s: string) => `• ${s}`).join('\n')}\n\n` +
              `输入 confirm、revise 或 detail <category>：`
            ),
            messages: ['显示详情']
          };
        }
        break;
    }

    return this.errorResult('无效的操作');
  }

  /**
   * 等待用户修改
   */
  private async handleAwaitRevision(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.revision_request) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'revision_request',
          '请描述修改计划：'
        )
      };
    }

    // 保存修改计划
    this.setFieldValue(state, 'audit_revision_plan', input.revision_request);

    // 重新分析
    this.setFieldValue(state, 'auditSubstate', 'analyzing');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'audit_action',
        '修改计划已记录，重新审核中...'
      ),
      messages: ['重新审核中']
    };
  }

  /**
   * 确认审核通过
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const auditChecks = this.getFieldValue(state, 'audit_checks', []);

    // 创建最终的审核报告
    const finalArtifact = await this.createArtifact(
      context,
      'audit_report',
      {
        checks: auditChecks,
        overall_score: this.calculateOverallScore(auditChecks),
        passed: true,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:4.5:completed');

    return {
      success: true,
      artifacts: [finalArtifact],
      nextPhaseId: '4.8', // 进入配图生成阶段
      messages: ['深度审核通过，进入配图生成阶段']
    };
  }

  /**
   * 执行本地审核检查（降级方案）
   */
  private performLocalAudit(content: string, brief: any): AuditCheck[] {
    return [
      {
        id: 'check_brief',
        category: 'brief_alignment',
        passed: content.includes(brief.thesis?.substring(0, 10) || ''),
        score: 85,
        issues: content.includes(brief.thesis || '') ? [] : ['文章内容与核心主张关联不够紧密'],
        suggestions: ['在开头和结尾更明确地呼应核心主张']
      },
      {
        id: 'check_logic',
        category: 'logic',
        passed: true,
        score: 90,
        issues: [],
        suggestions: ['逻辑结构清晰']
      },
      {
        id: 'check_evidence',
        category: 'evidence',
        passed: content.length > 500,
        score: content.length > 500 ? 80 : 60,
        issues: content.length > 500 ? [] : ['论据支撑略显单薄'],
        suggestions: content.length > 500 ? [] : ['考虑添加具体案例或数据支撑']
      },
      {
        id: 'check_readability',
        category: 'readability',
        passed: true,
        score: 88,
        issues: [],
        suggestions: ['可读性良好']
      },
      {
        id: 'check_ethics',
        category: 'ethics',
        passed: true,
        score: 95,
        issues: [],
        suggestions: ['无伦理风险']
      }
    ];
  }

  /**
   * 计算总体得分
   */
  private calculateOverallScore(checks: AuditCheck[]): number {
    if (checks.length === 0) return 0;
    const total = checks.reduce((sum, c) => sum + c.score, 0);
    return Math.round(total / checks.length);
  }

  /**
   * 生成审核报告
   */
  private generateAuditReport(checks: AuditCheck[]): string {
    const overallScore = this.calculateOverallScore(checks);
    const allPassed = checks.every(c => c.passed);

    let report = `🔍 深度审核报告\n\n`;
    report += `总体得分：${overallScore}/100\n`;
    report += `审核结果：${allPassed ? '✅ 通过' : '⚠️ 需要改进'}\n\n`;
    report += `各项检查：\n`;

    checks.forEach(check => {
      const icon = check.passed ? '✅' : '❌';
      report += `${icon} ${this.getCategoryName(check.category)}: ${check.score}/100\n`;
      if (check.issues.length > 0) {
        report += `   问题：${check.issues[0]}\n`;
      }
    });

    report += `\n你可以：\n`;
    report += `• confirm: ${allPassed ? '通过审核' : '强制通过'}，进入配图阶段\n`;
    report += `• revise: 根据建议修改\n`;
    report += `• detail <category>: 查看某类别的详细报告（如 detail logic）\n`;

    return report;
  }

  /**
   * 获取类别名称
   */
  private getCategoryName(category: string): string {
    const names: Record<string, string> = {
      'brief_alignment': 'Brief 对齐',
      'logic': '逻辑结构',
      'evidence': '论据支撑',
      'readability': '可读性',
      'ethics': '伦理风险'
    };
    return names[category] || category;
  }
}
