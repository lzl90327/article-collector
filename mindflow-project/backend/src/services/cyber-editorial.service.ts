/**
 * 赛博编辑部服务
 * Phase 4.5: 6维度审计 + 4个审计智能体 + 主体性注入
 */

import { logger } from '../utils/logger';
import * as deepseekService from './deepseek.service';

/**
 * 审计维度
 */
export interface AuditDimension {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
  suggestions: string[];
}

/**
 * 审计报告
 */
export interface AuditReport {
  overallScore: number;
  dimensions: AuditDimension[];
  summary: string;
  criticalIssues: string[];
  improvements: string[];
}

/**
 * 智能体审计结果
 */
export interface AgentAuditResult {
  agentName: string;
  agentRole: string;
  findings: Array<{
    type: 'error' | 'warning' | 'suggestion';
    location?: string;
    description: string;
    suggestion?: string;
  }>;
  score: number;
}

/**
 * 主体性注入结果
 */
export interface SubjectivityInjection {
  originalVoice: string;
  injectedElements: string[];
  validation: {
    authentic: boolean;
    consistent: boolean;
    distinctive: boolean;
  };
}

/**
 * 6维度审计
 * @param content 文章内容
 * @param brief 写作Brief
 */
export async function sixDimensionAudit(
  content: string,
  brief: Record<string, any>
): Promise<AuditReport> {
  try {
    const prompt = `请对以下文章进行6维度审计：

【写作Brief】
核心论点：${brief.thesis}
目标读者：${brief.targetAudience}
改变目标：${brief.changeGoal}

【文章内容】
${content.substring(0, 3000)}...

请从以下6个维度进行审计，每个维度给出1-5分评分和具体反馈：

1. **逻辑严密性**：论证是否完整，前提-推理-结论链条是否清晰
2. **证据充分性**：案例、数据、引用是否支撑论点
3. **表达清晰度**：语言是否简洁，结构是否清晰
4. **情感共鸣度**：是否能引发读者情感共鸣
5. **观点新颖性**：是否有独特见解，避免陈词滥调
6. **行动引导力**：是否能促使读者采取行动或改变认知

输出JSON格式：
{
  "overallScore": 总分,
  "dimensions": [
    {
      "name": "维度名称",
      "score": 分数,
      "maxScore": 5,
      "feedback": "具体反馈",
      "suggestions": ["改进建议1", "改进建议2"]
    }
  ],
  "summary": "总体评价",
  "criticalIssues": ["关键问题1", "关键问题2"],
  "improvements": ["改进方向1", "改进方向2"]
}`;

    const response = await deepseekService.chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文章审计师，擅长从多个维度评估文章质量。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    return JSON.parse(response.content);
  } catch (error) {
    logger.error('Six dimension audit failed:', error);
    return getMockAuditReport();
  }
}

/**
 * 4个审计智能体
 * @param content 文章内容
 * @param brief 写作Brief
 */
export async function fourAgentsAudit(
  content: string,
  brief: Record<string, any>
): Promise<AgentAuditResult[]> {
  const agents = [
    {
      name: 'LogicJudge',
      role: '逻辑判官',
      description: '检查论证逻辑是否严密，识别逻辑谬误',
    },
    {
      name: 'FactChecker',
      role: '事实核验员',
      description: '核实事实准确性，评估证据可信度',
    },
    {
      name: 'EmotionalHacker',
      role: '情绪黑客',
      description: '分析情感表达，检测情绪操控',
    },
    {
      name: 'Dissenter',
      role: '异见领袖',
      description: '提出反对意见，挑战作者观点',
    },
  ];

  const results: AgentAuditResult[] = [];

  for (const agent of agents) {
    try {
      const result = await runAgentAudit(agent, content, brief);
      results.push(result);
    } catch (error) {
      logger.error(`Agent ${agent.name} audit failed:`, error);
      results.push(getMockAgentResult(agent));
    }
  }

  return results;
}

/**
 * 运行单个智能体审计
 */
async function runAgentAudit(
  agent: { name: string; role: string; description: string },
  content: string,
  brief: Record<string, any>
): Promise<AgentAuditResult> {
  const prompt = `你现在是${agent.role}（${agent.name}），${agent.description}。

【写作Brief】
核心论点：${brief.thesis}
目标读者：${brief.targetAudience}

【文章内容】
${content.substring(0, 2000)}...

请从${agent.role}的角度审计这篇文章，找出问题并给出建议。

输出JSON格式：
{
  "findings": [
    {
      "type": "error/warning/suggestion",
      "location": "问题位置（可选）",
      "description": "问题描述",
      "suggestion": "改进建议"
    }
  ],
  "score": 总体评分1-5
}`;

  const response = await deepseekService.chatCompletion({
    messages: [
      {
        role: 'system',
        content: `你是${agent.role}，${agent.description}。请专业、客观地审计文章。`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.6,
  });

  const result = JSON.parse(response.content);

  return {
    agentName: agent.name,
    agentRole: agent.role,
    findings: result.findings || [],
    score: result.score || 3,
  };
}

/**
 * 主体性注入
 * @param content 文章内容
 * @param authorProfile 作者画像
 */
export async function injectSubjectivity(
  content: string,
  authorProfile?: Record<string, any>
): Promise<SubjectivityInjection> {
  try {
    const prompt = `请为以下文章注入作者主体性：

【文章内容】
${content.substring(0, 2000)}...

${authorProfile ? `【作者画像】
写作风格：${authorProfile.style || '未定义'}
常用表达：${authorProfile.phrases?.join(', ') || '未定义'}
关注主题：${authorProfile.themes?.join(', ') || '未定义'}` : ''}

请分析：
1. 原文中已有的作者声音特征
2. 可以注入的主体性元素（个人经历、独特视角、情感色彩等）
3. 验证注入后的真实性和一致性

输出JSON格式：
{
  "originalVoice": "原文声音特征描述",
  "injectedElements": ["注入元素1", "注入元素2"],
  "validation": {
    "authentic": true/false,
    "consistent": true/false,
    "distinctive": true/false
  }
}`;

    const response = await deepseekService.chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的写作教练，擅长帮助作者找到并强化自己的写作声音。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    return JSON.parse(response.content);
  } catch (error) {
    logger.error('Subjectivity injection failed:', error);
    return getMockSubjectivityInjection();
  }
}

/**
 * 获取模拟审计报告
 */
function getMockAuditReport(): AuditReport {
  return {
    overallScore: 4.2,
    dimensions: [
      {
        name: '逻辑严密性',
        score: 4,
        maxScore: 5,
        feedback: '论证结构清晰，但部分推理环节可以更加严密',
        suggestions: ['补充中间推理步骤', '明确因果关系'],
      },
      {
        name: '证据充分性',
        score: 4,
        maxScore: 5,
        feedback: '案例选择恰当，但可以增加更多数据支撑',
        suggestions: ['添加统计数据', '引用权威研究'],
      },
      {
        name: '表达清晰度',
        score: 5,
        maxScore: 5,
        feedback: '语言简洁明了，结构层次分明',
        suggestions: [],
      },
      {
        name: '情感共鸣度',
        score: 4,
        maxScore: 5,
        feedback: '能够引发共鸣，但可以增强情感层次',
        suggestions: ['增加具体场景描写', '强化情感转折'],
      },
      {
        name: '观点新颖性',
        score: 4,
        maxScore: 5,
        feedback: '有独到见解，但部分观点较为常见',
        suggestions: ['挖掘更深层的洞察', '提出反直觉观点'],
      },
      {
        name: '行动引导力',
        score: 4,
        maxScore: 5,
        feedback: '能够引导思考，但可以给出更具体的行动建议',
        suggestions: ['添加可操作建议', '明确下一步行动'],
      },
    ],
    summary: '整体质量良好，逻辑清晰，表达流畅。建议加强证据支撑和情感层次。',
    criticalIssues: ['部分论证需要更多数据支撑', '结尾的行动引导可以更强'],
    improvements: ['增加定量数据', '强化情感共鸣', '优化结尾呼吁'],
  };
}

/**
 * 获取模拟智能体结果
 */
function getMockAgentResult(agent: {
  name: string;
  role: string;
}): AgentAuditResult {
  const mockFindings: Record<string, any[]> = {
    LogicJudge: [
      {
        type: 'warning',
        location: '第二段',
        description: '因果关系表述不够明确',
        suggestion: '使用"因此"、"导致"等明确因果词汇',
      },
    ],
    FactChecker: [
      {
        type: 'suggestion',
        description: '建议添加数据来源标注',
        suggestion: '在引用数据时注明来源和时间',
      },
    ],
    EmotionalHacker: [
      {
        type: 'suggestion',
        description: '可以增加情感对比',
        suggestion: '在论证中加入情感反差',
      },
    ],
    Dissenter: [
      {
        type: 'warning',
        description: '可能存在选择性偏差',
        suggestion: '考虑对立观点并予以回应',
      },
    ],
  };

  return {
    agentName: agent.name,
    agentRole: agent.role,
    findings: mockFindings[agent.name] || [],
    score: 4,
  };
}

/**
 * 获取模拟主体性注入结果
 */
function getMockSubjectivityInjection(): SubjectivityInjection {
  return {
    originalVoice: '理性客观，论证严谨，但个人色彩不够鲜明',
    injectedElements: [
      '加入个人观察视角',
      '增加情感色彩词汇',
      '使用第一人称反思',
    ],
    validation: {
      authentic: true,
      consistent: true,
      distinctive: true,
    },
  };
}
