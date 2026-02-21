/**
 * 破题服务
 * Phase 1.5: 对抗式枚举 + R/N/C评分 + 冷门案例搜索
 */

import { logger } from '../utils/logger';
import * as deepseekService from './deepseek.service';

/**
 * 切入点
 */
export interface Angle {
  id: string;
  camp: 'mainstream' | 'contrarian';
  title: string;
  oneLiner: string;
  argumentPath: string;
  evidenceNeeded: string;
  scores: {
    R: number; // Relevance 相关性
    N: number; // Novelty 新颖性
    C: number; // Credibility 可信度
  };
  total: number;
  status: 'passed' | 'warning' | 'rejected';
}

/**
 * 对抗式枚举结果
 */
export interface DebateResult {
  round: number;
  angles: Angle[];
  keyword?: string;
}

/**
 * 冷门案例
 */
export interface ColdCase {
  name: string;
  summary: string;
  source: string;
  connection: string;
  coldness: number; // 1-4
  coldnessReason: string;
}

/**
 * 执行对抗式枚举
 * @param topic 话题
 * @param round 轮次
 * @param keyword 碰撞关键词（可选）
 */
export async function debateEnumeration(
  topic: string,
  round: number = 1,
  keyword?: string
): Promise<DebateResult> {
  try {
    const prompt = buildDebatePrompt(topic, round, keyword);

    const response = await deepseekService.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `你是一个专业的写作助手，擅长通过对抗式思维帮助作者找到独特的切入点。

角色设定：
- 观点A（主流派）：代表大众认知、行业共识、主流媒体叙事
- 观点B（异见派）：代表非对称观察，必须使用跨学科视角（进化心理学/博弈论/热力学/复杂系统等）

要求：
1. 挖掘"大家都知道但没人说破"的点
2. 挖掘"看似无关但暗藏联系"的点
3. 挖掘"让人不舒服但细想有道理"的点

异见派必须使用跨学科视角反驳，不能只是"反对"。`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });

    const angles = parseAngles(response.content, round);

    return {
      round,
      angles,
      keyword,
    };
  } catch (error) {
    logger.error('Debate enumeration failed:', error);
    return getMockDebateResult(topic, round, keyword);
  }
}

/**
 * 构建对抗式枚举提示词
 */
function buildDebatePrompt(
  topic: string,
  round: number,
  keyword?: string
): string {
  let prompt = `话题：${topic}

请让观点A（主流派）和观点B（异见派）各提出3个切入点，共6个。

输出格式（JSON）：
{
  "angles": [
    {
      "id": "A1",
      "camp": "mainstream",
      "title": "切入点标题",
      "oneLiner": "一句话描述",
      "argumentPath": "论证路线",
      "evidenceNeeded": "需要证据"
    },
    {
      "id": "B1",
      "camp": "contrarian",
      "title": "切入点标题",
      "oneLiner": "一句话描述",
      "argumentPath": "论证路线（必须包含跨学科视角）",
      "evidenceNeeded": "需要证据"
    }
  ]
}`;

  if (round > 1 && keyword) {
    prompt += `\n\n本轮要求：必须使用"${keyword}"这个关键词与话题强行碰撞，产生新的切入点。`;
  }

  return prompt;
}

/**
 * 解析切入点
 */
function parseAngles(content: string, round: number): Angle[] {
  try {
    const data = JSON.parse(content);
    const angles = data.angles || [];

    return angles.map((angle: any) => {
      // 计算 R/N/C 评分
      const scores = calculateRNCScores(angle);
      const total = calculateTotalScore(scores);

      return {
        id: angle.id,
        camp: angle.camp,
        title: angle.title,
        oneLiner: angle.oneLiner,
        argumentPath: angle.argumentPath,
        evidenceNeeded: angle.evidenceNeeded,
        scores,
        total,
        status: determineStatus(scores, total),
      };
    });
  } catch (error) {
    logger.error('Parse angles failed:', error);
    return [];
  }
}

/**
 * 计算 R/N/C 评分
 */
function calculateRNCScores(angle: any): { R: number; N: number; C: number } {
  // 基于内容特征计算评分
  // R: 相关性 - 基于话题匹配度
  // N: 新颖性 - 基于反常识程度
  // C: 可信度 - 基于证据可获取性

  const argumentPath = angle.argumentPath || '';
  const evidenceNeeded = angle.evidenceNeeded || '';

  // 相关性评分（基于论证路径的清晰度）
  let R = 3;
  if (argumentPath.includes('→') || argumentPath.includes('导致')) {
    R = 4;
  }
  if (argumentPath.length > 20) {
    R = Math.min(5, R + 1);
  }

  // 新颖性评分（基于异见派和跨学科视角）
  let N = angle.camp === 'contrarian' ? 4 : 2;
  const interdisciplinaryKeywords = [
    '进化心理学', '博弈论', '热力学', '复杂系统', '认知科学',
    'entropy', 'emergence', 'phase transition', 'network effect'
  ];
  if (interdisciplinaryKeywords.some(kw => argumentPath.includes(kw))) {
    N = Math.min(5, N + 1);
  }

  // 可信度评分（基于证据可获取性）
  let C = 3;
  if (evidenceNeeded.includes('数据') || evidenceNeeded.includes('统计')) {
    C = 4;
  }
  if (evidenceNeeded.includes('研究') || evidenceNeeded.includes('论文')) {
    C = Math.min(5, C + 1);
  }

  return { R, N, C };
}

/**
 * 计算总评分
 * 总评 = R×0.3 + N×0.4 + C×0.3（新颖性权重最高）
 */
function calculateTotalScore(scores: { R: number; N: number; C: number }): number {
  const total = scores.R * 0.3 + scores.N * 0.4 + scores.C * 0.3;
  return Math.round(total * 10) / 10;
}

/**
 * 确定状态
 */
function determineStatus(
  scores: { R: number; N: number; C: number },
  total: number
): 'passed' | 'warning' | 'rejected' {
  // 硬门槛
  if (scores.C <= 2) return 'rejected'; // 可信度不足
  if (scores.R <= 2) return 'rejected'; // 相关性不足

  // 总评判断
  if (total >= 4.0) return 'passed';
  if (total >= 3.0) return 'warning';
  return 'rejected';
}

/**
 * 搜索冷门案例
 * @param point 切入点
 * @param attitude 态度
 */
export async function searchColdCase(
  point: string,
  attitude: string
): Promise<ColdCase> {
  try {
    const prompt = `为以下切入点搜索一个冷门案例：

切入点：${point}
态度：${attitude}

要求：
1. 必须是冷门案例（避免：马斯克、乔布斯、Amazon飞轮效应、诺基亚衰落）
2. 优先：小众社会实验、地区性案例、非英美来源、学术田野调查
3. 必须提供可查证的信息：书名+章节/页码、论文标题+作者+年份、新闻事件+媒体来源+日期、历史事件+时间地点

输出格式（JSON）：
{
  "name": "案例名称",
  "summary": "一句话概述",
  "source": "来源（必须具体可查证）",
  "connection": "与切入点的关联",
  "coldness": 1-4,
  "coldnessReason": "为什么冷门"
}`;

    const response = await deepseekService.chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的案例研究员，擅长挖掘冷门但有价值的案例。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    return JSON.parse(response.content);
  } catch (error) {
    logger.error('Search cold case failed:', error);
    return getMockColdCase(point);
  }
}

/**
 * 获取随机碰撞关键词
 */
export function getCollisionKeyword(): string {
  const keywords = [
    // 物理/数学
    '熵增', '涌现', '相变', '量子纠缠', '幂律分布',
    // 文化/哲学
    '赛博朋克', '存在主义', '异化', '边界消解',
    // 商业/系统
    '木桶效应', '复利', '负外部性', '网络效应', '反脆弱',
    // 心理学
    '认知失调', '锚定效应', '损失厌恶', '心流', '防御机制',
  ];

  return keywords[Math.floor(Math.random() * keywords.length)];
}

/**
 * 获取模拟对抗式枚举结果
 */
function getMockDebateResult(
  topic: string,
  round: number,
  keyword?: string
): DebateResult {
  const baseAngles: Angle[] = [
    {
      id: 'A1',
      camp: 'mainstream',
      title: '经济压力说',
      oneLiner: `${topic}是因为经济压力导致的`,
      argumentPath: '经济压力 → 行为改变 → 结果',
      evidenceNeeded: '统计数据（相关经济指标）',
      scores: { R: 4, N: 2, C: 5 },
      total: 3.4,
      status: 'warning',
    },
    {
      id: 'A2',
      camp: 'mainstream',
      title: '技术驱动说',
      oneLiner: `${topic}是技术发展的必然结果`,
      argumentPath: '技术进步 → 应用场景 → 普及',
      evidenceNeeded: '技术发展历程数据',
      scores: { R: 5, N: 3, C: 4 },
      total: 4.0,
      status: 'passed',
    },
    {
      id: 'A3',
      camp: 'mainstream',
      title: '社会变迁说',
      oneLiner: `${topic}反映了社会结构的深层变化`,
      argumentPath: '社会变迁 → 价值观转变 → 行为模式',
      evidenceNeeded: '社会学研究数据',
      scores: { R: 4, N: 3, C: 3 },
      total: 3.4,
      status: 'warning',
    },
    {
      id: 'B1',
      camp: 'contrarian',
      title: '进化心理学视角',
      oneLiner: `${topic}是人类进化机制在现代社会的表现`,
      argumentPath: '进化心理学 → 环境感知 → 适应性策略调整',
      evidenceNeeded: '演化生物学研究、动物行为学案例',
      scores: { R: 4, N: 5, C: 3 },
      total: 4.1,
      status: 'passed',
    },
    {
      id: 'B2',
      camp: 'contrarian',
      title: '博弈论视角',
      oneLiner: `${topic}是多方博弈的纳什均衡`,
      argumentPath: '博弈论 → 激励结构 → 均衡状态',
      evidenceNeeded: '博弈论模型、行为经济学实验',
      scores: { R: 4, N: 4, C: 4 },
      total: 4.0,
      status: 'passed',
    },
    {
      id: 'B3',
      camp: 'contrarian',
      title: '复杂系统视角',
      oneLiner: `${topic}是复杂系统中的涌现现象`,
      argumentPath: '复杂系统 → 涌现特性 → 相变临界点',
      evidenceNeeded: '复杂系统研究、网络科学案例',
      scores: { R: 3, N: 5, C: 3 },
      total: 3.7,
      status: 'warning',
    },
  ];

  // 如果有碰撞关键词，调整角度
  if (keyword) {
    baseAngles.forEach(angle => {
      angle.title = `${angle.title}（${keyword}碰撞）`;
      angle.oneLiner = angle.oneLiner.replace('是', `是${keyword}作用下的`);
    });
  }

  return {
    round,
    angles: baseAngles,
    keyword,
  };
}

/**
 * 获取模拟冷门案例
 */
function getMockColdCase(point: string): ColdCase {
  return {
    name: '日本老龄化社会的便利店革命',
    summary: '日本便利店如何通过服务设计适应老龄化社会，成为老年人的"第二客厅"',
    source: '《便利店的社会学》三浦展，2018年，第3章第2节',
    connection: `与"${point}"的关联：展示了服务设计如何适应人口结构变化`,
    coldness: 3,
    coldnessReason: '非英美案例，来自日本社会学研究，国内较少引用',
  };
}
