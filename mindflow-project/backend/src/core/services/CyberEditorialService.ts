/**
 * 赛博编辑部服务
 * 基于 DeepSeek 的多维度文章审计服务
 * 实现 Skill 规范中的 cyber-editorial MCP 服务
 */

import { EventEmitter } from 'events';
import { DeepSeekService } from './DeepSeekService';

export interface AuditConfig {
  deepSeekService: DeepSeekService;
  auditorRoles?: string[];
  minScore?: number;
}

export interface AuditCheck {
  auditor_role: string;
  score: number;
  criticisms: string[];
  suggestions: string[];
  alignment_analysis?: {
    thesis_match: boolean;
    audience_match: boolean;
    goal_match: boolean;
  };
}

export interface AuditReport {
  checks: AuditCheck[];
  overall_score: number;
  passed: boolean;
  summary: string;
  revision_needed: boolean;
}

export interface BriefAlignment {
  thesis_match: boolean;
  thesis_deviation?: string;
  audience_match: boolean;
  audience_deviation?: string;
  goal_match: boolean;
  goal_deviation?: string;
}

/**
 * 赛博编辑部服务
 * 模拟多个专业编辑从不同维度审计文章
 */
export class CyberEditorialService extends EventEmitter {
  private deepSeekService: DeepSeekService;
  private auditorRoles: string[];
  private minScore: number;

  // 预定义的审计员角色
  private static readonly DEFAULT_ROLES = [
    '逻辑编辑',
    '伦理审查员',
    '读者代表',
    '事实核查员',
    '风格编辑'
  ];

  // 每个角色的系统提示词
  private static readonly ROLE_PROMPTS: Record<string, string> = {
    '逻辑编辑': `你是一位严谨的逻辑编辑。你的职责是：
1. 检查文章论证是否严密，有无逻辑漏洞
2. 识别因果关系的合理性
3. 指出论证跳跃或推理不严谨的地方
4. 评估结构是否清晰，段落之间是否有逻辑联系

请以JSON格式返回：{
  "score": 0-10,
  "criticisms": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`,
    '伦理审查员': `你是一位敏感的伦理审查员。你的职责是：
1. 识别文章中的潜在伦理风险
2. 检查是否有歧视、偏见或不当表述
3. 评估内容的社会影响和后果
4. 指出可能引发争议的内容

请以JSON格式返回：{
  "score": 0-10,
  "criticisms": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`,
    '读者代表': `你是一位典型的目标读者代表。你的职责是：
1. 从读者角度评估文章的可读性
2. 指出理解困难或晦涩的地方
3. 评估文章是否有趣、吸引人
4. 提出改善阅读体验的建议

请以JSON格式返回：{
  "score": 0-10,
  "criticisms": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`,
    '事实核查员': `你是一位严格的事实核查员。你的职责是：
1. 检查文章中的数据和事实声明
2. 评估论据的可靠性
3. 指出需要引用来源的地方
4. 识别可能的夸大或不准确表述

请以JSON格式返回：{
  "score": 0-10,
  "criticisms": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`,
    '风格编辑': `你是一位资深的风格编辑。你的职责是：
1. 评估文章的写作风格和语气
2. 检查与目标受众的匹配度
3. 指出表达冗余或不够精炼的地方
4. 提出改善文风的具体建议

请以JSON格式返回：{
  "score": 0-10,
  "criticisms": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`
  };

  constructor(config: AuditConfig) {
    super();
    this.deepSeekService = config.deepSeekService;
    this.auditorRoles = config.auditorRoles || CyberEditorialService.DEFAULT_ROLES;
    this.minScore = config.minScore || 6;
  }

  /**
   * 执行完整的多维度审计
   */
  async auditArticle(
    content: string,
    brief: {
      thesis: string;
      target_audience: string;
      existing_belief?: string;
      change_goal?: string;
    }
  ): Promise<AuditReport> {
    this.emit('audit:start', { contentLength: content.length });

    try {
      // 并行执行所有审计员的检查
      const checkPromises = this.auditorRoles.map(role =>
        this.performAuditCheck(role, content, brief)
      );

      const checks = await Promise.all(checkPromises);

      // 计算总体评分
      const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;

      // 生成审计报告
      const report: AuditReport = {
        checks,
        overall_score: overallScore,
        passed: overallScore >= this.minScore,
        summary: this.generateSummary(checks, overallScore),
        revision_needed: overallScore < this.minScore || checks.some(c => c.score < 5)
      };

      this.emit('audit:complete', report);
      return report;
    } catch (error) {
      this.emit('audit:error', { error });
      throw error;
    }
  }

  /**
   * 单个审计员的检查
   */
  private async performAuditCheck(
    role: string,
    content: string,
    brief: {
      thesis: string;
      target_audience: string;
      existing_belief?: string;
      change_goal?: string;
    }
  ): Promise<AuditCheck> {
    const systemPrompt = CyberEditorialService.ROLE_PROMPTS[role] ||
      `你是一位${role}。请评估这篇文章的质量，从专业角度提出批评和建议。

请以JSON格式返回：{
  "score": 0-10,
  "criticisms": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`;

    const userPrompt = `请审计以下文章：

写作简报：
- 核心主张：${brief.thesis}
- 目标读者：${brief.target_audience}
${brief.existing_belief ? `- 读者现状：${brief.existing_belief}` : ''}
${brief.change_goal ? `- 改变目标：${brief.change_goal}` : ''}

文章内容：
${content}

请严格按照JSON格式返回审计结果。`;

    try {
      const response = await this.deepSeekService.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        json_mode: true
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(resultText);

      return {
        auditor_role: role,
        score: Math.min(10, Math.max(0, result.score || 5)),
        criticisms: result.criticisms || [],
        suggestions: result.suggestions || []
      };
    } catch (error) {
      console.error(`[CyberEditorial] Audit failed for role ${role}:`, error);
      // 返回默认结果，避免整个审计失败
      return {
        auditor_role: role,
        score: 5,
        criticisms: ['审计过程出现错误'],
        suggestions: ['请重试审计']
      };
    }
  }

  /**
   * 检查文章与 Brief 的对齐度
   */
  async checkBriefAlignment(
    content: string,
    brief: {
      thesis: string;
      target_audience: string;
      change_goal?: string;
    }
  ): Promise<BriefAlignment> {
    const prompt = `请评估以下文章与写作简报的对齐程度：

写作简报：
- 核心主张：${brief.thesis}
- 目标读者：${brief.target_audience}
${brief.change_goal ? `- 改变目标：${brief.change_goal}` : ''}

文章内容：
${content.substring(0, 2000)}...

请评估：
1. 文章是否准确表达了核心主张？
2. 文章是否适合目标读者？
3. 文章是否达成了改变目标？

请以JSON格式返回：{
  "thesis_match": true/false,
  "thesis_deviation": "如有偏差，请说明",
  "audience_match": true/false,
  "audience_deviation": "如有偏差，请说明",
  "goal_match": true/false,
  "goal_deviation": "如有偏差，请说明"
}`;

    try {
      const response = await this.deepSeekService.chatCompletion({
        messages: [
          { role: 'system', content: '你是一个专业的写作评估专家，擅长评估文章与写作目标的对齐程度。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        json_mode: true
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(resultText);

      return {
        thesis_match: result.thesis_match ?? true,
        thesis_deviation: result.thesis_deviation,
        audience_match: result.audience_match ?? true,
        audience_deviation: result.audience_deviation,
        goal_match: result.goal_match ?? true,
        goal_deviation: result.goal_deviation
      };
    } catch (error) {
      console.error('[CyberEditorial] Alignment check failed:', error);
      return {
        thesis_match: true,
        audience_match: true,
        goal_match: true
      };
    }
  }

  /**
   * 生成审计总结
   */
  private generateSummary(checks: AuditCheck[], overallScore: number): string {
    if (overallScore >= 8) {
      return '文章质量优秀，各维度表现良好，可以进入发布阶段。';
    } else if (overallScore >= 6) {
      return '文章质量良好，但有一些改进空间，建议根据建议进行优化。';
    } else if (overallScore >= 4) {
      return '文章存在明显问题，需要较大修改才能达到发布标准。';
    } else {
      return '文章质量不达标，建议重新梳理逻辑和论证。';
    }
  }

  /**
   * 流式审计（用于实时显示审计进度）
   */
  async *streamAudit(
    content: string,
    brief: {
      thesis: string;
      target_audience: string;
    }
  ): AsyncGenerator<{ role: string; status: 'start' | 'complete' | 'error'; check?: AuditCheck }> {
    for (const role of this.auditorRoles) {
      yield { role, status: 'start' };

      try {
        const check = await this.performAuditCheck(role, content, brief);
        yield { role, status: 'complete', check };
      } catch (error) {
        yield { role, status: 'error' };
      }
    }
  }
}

export default CyberEditorialService;
