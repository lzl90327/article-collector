/**
 * 资讯穿透服务
 * Phase 0.5: 多维溯源 + 强行链接
 */

import { logger } from '../utils/logger';
import * as deepseekService from './deepseek.service';

/**
 * 资讯简报
 */
export interface ResearchBrief {
  timeline: Array<{
    date: string;
    event: string;
    source: string;
  }>;
  keyPlayers: string[];
  currentStatus: string;
  perspectives: Array<{
    stance: string;
    viewpoint: string;
    source: string;
  }>;
  authorConnections: Array<{
    question: string;
    angle: string;
  }>;
}

/**
 * 执行资讯穿透
 * @param topic 话题
 * @param materialSummary 素材摘要
 */
export async function researchTopic(
  topic: string,
  materialSummary?: string
): Promise<ResearchBrief> {
  try {
    // 构建提示词
    const prompt = `请对以下话题进行资讯穿透分析，提供多维溯源和强行链接：

话题：${topic}
${materialSummary ? `素材摘要：${materialSummary}` : ''}

请提供以下内容的JSON格式：
{
  "timeline": [
    {"date": "时间", "event": "事件", "source": "来源"}
  ],
  "keyPlayers": ["关键人物/组织"],
  "currentStatus": "当前局势概述",
  "perspectives": [
    {"stance": "立场名称", "viewpoint": "观点内容", "source": "来源"}
  ],
  "authorConnections": [
    {"question": "刺激性问题", "angle": "关联角度"}
  ]
}

要求：
1. 时间轴：提供完整的事件发展脉络
2. 关键人物：识别核心当事人
3. 对立视角：找出3个代表性对立观点
4. 强行链接：从产品思维、心理学、社会学角度提出3个刺激性问题`;

    const response = await deepseekService.chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的资讯分析师，擅长多维溯源和跨领域关联分析。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    return JSON.parse(response.content);
  } catch (error) {
    logger.error('Research topic failed:', error);
    // 返回模拟数据
    return getMockResearchBrief(topic);
  }
}

/**
 * 生成 Claim-Evidence Table
 * @param topic 话题
 * @param researchBrief 资讯简报
 */
export async function generateClaimEvidenceTable(
  topic: string,
  researchBrief: ResearchBrief
): Promise<
  Array<{
    claim: string;
    evidence: string;
    source: string;
    confidence: number;
    boundary: string;
    risk: string;
  }>
> {
  try {
    const prompt = `基于以下资讯简报，生成 Claim-Evidence Table：

话题：${topic}

关键信息：
${researchBrief.perspectives.map((p, i) => `${i + 1}. ${p.stance}: ${p.viewpoint}`).join('\n')}

请生成JSON格式的表格：
[
  {
    "claim": "断言/论点",
    "evidence": "支撑证据",
    "source": "来源",
    "confidence": 1-5,
    "boundary": "适用边界",
    "risk": "反驳风险"
  }
]`;

    const response = await deepseekService.chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的论证分析师，擅长识别论点、证据和潜在风险。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    return JSON.parse(response.content);
  } catch (error) {
    logger.error('Generate claim-evidence table failed:', error);
    return getMockClaimEvidenceTable(topic);
  }
}

/**
 * 获取模拟资讯简报
 */
function getMockResearchBrief(topic: string): ResearchBrief {
  return {
    timeline: [
      { date: '2023年初', event: 'ChatGPT引发AI热潮', source: 'OpenAI官方' },
      { date: '2023年中', event: '各大厂商纷纷推出大模型产品', source: '行业观察' },
      { date: '2024年初', event: 'AI应用开始落地到具体场景', source: '市场调研' },
    ],
    keyPlayers: ['OpenAI', 'Google', 'Meta', '百度', '阿里'],
    currentStatus: `关于"${topic}"的讨论正处于白热化阶段，各方观点激烈碰撞。`,
    perspectives: [
      {
        stance: '技术乐观派',
        viewpoint: 'AI将极大提升生产效率，创造新的经济价值',
        source: '科技媒体',
      },
      {
        stance: '人文忧虑派',
        viewpoint: 'AI可能加剧社会不平等，需要谨慎监管',
        source: '社会学研究',
      },
      {
        stance: '务实应用派',
        viewpoint: 'AI的价值在于解决具体问题，不应过度神化或妖魔化',
        source: '产品经理社区',
      },
    ],
    authorConnections: [
      {
        question: `如果你是产品经理，会如何设计"${topic}"相关的产品功能？`,
        angle: '职业映射',
      },
      {
        question: `这个话题引发的公众情绪，符合哪种社会心理学模型？`,
        angle: '心理观察',
      },
      {
        question: `它能作为你之前哪篇文章的延伸案例吗？`,
        angle: '素材预埋',
      },
    ],
  };
}

/**
 * 获取模拟 Claim-Evidence Table
 */
function getMockClaimEvidenceTable(
  topic: string
): Array<{
  claim: string;
  evidence: string;
  source: string;
  confidence: number;
  boundary: string;
  risk: string;
}> {
  return [
    {
      claim: `${topic}是未来发展的重要趋势`,
      evidence: '多家科技巨头投入巨资研发',
      source: '行业报告',
      confidence: 4,
      boundary: '科技行业',
      risk: '可能存在泡沫',
    },
    {
      claim: '用户对AI产品的接受度正在提升',
      evidence: 'ChatGPT月活用户数突破1亿',
      source: '公开数据',
      confidence: 5,
      boundary: 'C端应用',
      risk: '数据可能包含重复用户',
    },
    {
      claim: 'AI将取代部分传统工作岗位',
      evidence: '部分企业已开始使用AI替代人工客服',
      source: '企业案例',
      confidence: 3,
      boundary: '特定行业',
      risk: '样本量有限，可能不具代表性',
    },
  ];
}
