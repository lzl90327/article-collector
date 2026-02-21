/**
 * 周度认知简报服务
 * Phase 0.8: Weekly Cognitive Digest
 *
 * 功能：
 * 1. 自动获取过去 7 天素材
 * 2. D/R/C/H 四维评分（可争议性/关联度/可论证性/枢纽价值）
 * 3. 主题地图聚类
 * 4. 对抗式问题清单生成
 * 5. 周报飞书文档自动生成
 */

import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { getMaterials, MaterialRecord } from './feishu.materials.service';
import { createWikiDocument } from './feishu.wiki.service';
import { chatCompletion } from './deepseek.service';

/**
 * D/R/C/H 四维评分
 */
export interface MaterialScore {
  D: number; // Debatability (可争议性): 1-5
  R: number; // Relevance (关联度): 1-5
  C: number; // Credibility (可论证性): 1-5
  H: number; // Hub Value (枢纽价值): 1-5
}

/**
 * 带评分的素材
 */
export interface ScoredMaterial extends MaterialRecord {
  scores: MaterialScore;
  total: number; // 加权总分
  recommendation: 'deep_dive' | 'background' | 'skip';
  coreClaim: string; // 核心主张（一句话）
}

/**
 * 主题聚类
 */
export interface ThemeCluster {
  theme: string;
  materials: string[]; // 素材ID列表
  connection: string; // 关联点描述
}

/**
 * 对抗式问题
 */
export interface ContrarianQuestion {
  originalClaim: string;
  gentleChallenge: string;
  stimulusQuestion: string;
  materialId: string;
}

/**
 * 周度认知简报
 */
export interface WeeklyDigest {
  id: string;
  weekStart: string;
  weekEnd: string;
  materialsCount: number;
  materials: ScoredMaterial[];
  themeClusters: ThemeCluster[];
  crossThemeTension: string;
  contrarianQuestions: ContrarianQuestion[];
  deepDiveCandidates: ScoredMaterial[];
  createdAt: string;
  feishuDocUrl?: string;
}

/**
 * 生成周度认知简报
 * @param userId 用户ID
 * @param days 天数（默认7天）
 */
export async function generateWeeklyDigest(
  userId: string,
  days: number = 7
): Promise<WeeklyDigest> {
  logger.info(`Generating weekly digest for user ${userId}, days: ${days}`);

  try {
    // 1. 获取过去 N 天的素材
    const materials = await getMaterials(50, days);
    logger.info(`Retrieved ${materials.length} materials`);

    if (materials.length === 0) {
      throw new Error('No materials found for the specified period');
    }

    // 2. D/R/C/H 四维评分
    const scoredMaterials = await scoreMaterials(materials);
    logger.info(`Scored ${scoredMaterials.length} materials`);

    // 3. 主题聚类
    const themeClusters = await clusterThemes(scoredMaterials);
    logger.info(`Identified ${themeClusters.length} theme clusters`);

    // 4. 跨主题张力分析
    const crossThemeTension = await analyzeCrossThemeTension(themeClusters, scoredMaterials);

    // 5. 生成对抗式问题
    const contrarianQuestions = await generateContrarianQuestions(scoredMaterials);
    logger.info(`Generated ${contrarianQuestions.length} contrarian questions`);

    // 6. 筛选深挖候选
    const deepDiveCandidates = scoredMaterials
      .filter(m => m.recommendation === 'deep_dive')
      .slice(0, 3);

    // 7. 计算时间范围
    const now = new Date();
    const weekStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 8. 构建周报对象
    const digest: WeeklyDigest = {
      id: `weekly-digest-${now.toISOString().split('T')[0]}`,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: now.toISOString().split('T')[0],
      materialsCount: materials.length,
      materials: scoredMaterials,
      themeClusters,
      crossThemeTension,
      contrarianQuestions,
      deepDiveCandidates,
      createdAt: now.toISOString(),
    };

    // 9. 保存到数据库
    await saveWeeklyDigest(userId, digest);

    // 10. 生成飞书文档
    const docUrl = await createWeeklyDigestDocument(digest);
    digest.feishuDocUrl = docUrl;

    logger.info(`Weekly digest generated successfully: ${digest.id}`);
    return digest;
  } catch (error) {
    logger.error('Generate weekly digest failed:', error);
    throw error;
  }
}

/**
 * D/R/C/H 四维评分
 * 使用 DeepSeek AI 进行智能评分
 */
async function scoreMaterials(materials: MaterialRecord[]): Promise<ScoredMaterial[]> {
  const scoredMaterials: ScoredMaterial[] = [];

  for (const material of materials) {
    try {
      const prompt = `请对以下素材进行 D/R/C/H 四维评分，并提取核心主张。

素材标题：${material.title}
素材作者：${material.author}
素材摘要：${material.summary}

请按以下 JSON 格式输出：
{
  "coreClaim": "核心主张（一句话概括）",
  "scores": {
    "D": 4, // Debatability (可争议性): 核心主张有多大的"反驳空间"？1=正确的废话，5=有明确立场能形成对抗
    "R": 4, // Relevance (关联度): 与作者职业领域/近期思考主题有多相关？1=完全无关，5=直接相关
    "C": 4, // Credibility (可论证性): 原文的论据质量如何？1=纯观点无证据，5=有数据/案例可核查
    "H": 3  // Hub Value (枢纽价值): 这篇素材能连接到其他几篇素材？1=孤立主题，5=能串联3+篇素材
  },
  "reasoning": "评分理由简述"
}

评分规则：
- D ≤ 2 的素材建议跳过（无法形成有价值的对抗）
- H ≥ 4 的素材优先推荐（枢纽素材能带出更多洞见）
- 总分 = D×0.3 + R×0.3 + C×0.2 + H×0.2`;

      const response = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: '你是一个专业的内容分析师，擅长评估素材的深度、关联性和价值。',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      });

      const result = JSON.parse(extractJson(response.content));
      const scores: MaterialScore = result.scores;

      // 计算加权总分
      const total = scores.D * 0.3 + scores.R * 0.3 + scores.C * 0.2 + scores.H * 0.2;

      // 确定推荐等级
      let recommendation: 'deep_dive' | 'background' | 'skip' = 'background';
      if (scores.D <= 2) {
        recommendation = 'skip';
      } else if (total >= 4.0 || scores.H >= 4) {
        recommendation = 'deep_dive';
      }

      scoredMaterials.push({
        ...material,
        scores,
        total: Math.round(total * 10) / 10,
        recommendation,
        coreClaim: result.coreClaim || '未提取到核心主张',
      });
    } catch (error) {
      logger.error(`Score material failed: ${material.id}`, error);
      // 使用默认评分
      scoredMaterials.push({
        ...material,
        scores: { D: 3, R: 3, C: 3, H: 3 },
        total: 3.0,
        recommendation: 'background',
        coreClaim: '评分失败，使用默认值',
      });
    }
  }

  // 按总分排序
  return scoredMaterials.sort((a, b) => b.total - a.total);
}

/**
 * 主题聚类
 * 使用 AI 识别素材间的主题关联
 */
async function clusterThemes(scoredMaterials: ScoredMaterial[]): Promise<ThemeCluster[]> {
  // 只对有评分的素材进行聚类
  const validMaterials = scoredMaterials.filter(m => m.recommendation !== 'skip');

  if (validMaterials.length < 3) {
    return [];
  }

  const prompt = `请对以下素材进行主题聚类分析，识别 2-3 个主题聚类。

素材列表：
${validMaterials.map((m, i) => `${i + 1}. ${m.title}
   核心主张：${m.coreClaim}
   标签：${m.total >= 4 ? '⭐ 高分' : ''}`).join('\n\n')}

请按以下 JSON 格式输出：
{
  "clusters": [
    {
      "theme": "主题名称（如：AI 能力边界）",
      "materialIndices": [1, 3, 5], // 素材序号（从1开始）
      "connection": "关联点描述（如：都在讨论 AI 能做什么 vs 不能做什么）"
    }
  ],
  "crossThemeTension": "跨主题张力描述（如：主题A与主题B之间的潜在矛盾或互补关系）"
}

要求：
1. 每个聚类至少包含 2 篇素材
2. 聚类主题要有明确的语义边界
3. 识别素材间的"隐藏连接"`;

  try {
    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的主题分析专家，擅长发现内容间的隐性关联和主题聚类。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    const result = JSON.parse(extractJson(response.content));

    // 转换素材索引为 ID
    return (result.clusters || []).map((cluster: any) => ({
      theme: cluster.theme,
      materials: cluster.materialIndices
        .map((idx: number) => validMaterials[idx - 1]?.id)
        .filter(Boolean),
      connection: cluster.connection,
    }));
  } catch (error) {
    logger.error('Cluster themes failed:', error);
    return [];
  }
}

/**
 * 分析跨主题张力
 */
async function analyzeCrossThemeTension(
  clusters: ThemeCluster[],
  materials: ScoredMaterial[]
): Promise<string> {
  if (clusters.length < 2) {
    return '素材主题较为单一，未形成明显的跨主题张力。';
  }

  const prompt = `请分析以下主题之间的张力关系：

主题聚类：
${clusters.map((c, i) => `${i + 1}. ${c.theme}
   关联点：${c.connection}`).join('\n\n')}

请用一句话描述这些主题之间的张力关系（矛盾、互补、递进等）。
输出格式：直接输出一句话，不要JSON。`;

  try {
    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个擅长发现主题间张力的分析师。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    return response.content.trim();
  } catch (error) {
    logger.error('Analyze cross theme tension failed:', error);
    return '跨主题张力分析失败。';
  }
}

/**
 * 生成对抗式问题
 */
async function generateContrarianQuestions(
  scoredMaterials: ScoredMaterial[]
): Promise<ContrarianQuestion[]> {
  // 只对高分素材生成对抗式问题
  const topMaterials = scoredMaterials
    .filter(m => m.recommendation === 'deep_dive')
    .slice(0, 5);

  const questions: ContrarianQuestion[] = [];

  for (const material of topMaterials) {
    try {
      const prompt = `针对以下素材的核心主张，扮演"温和的异见派"提出质疑：

素材：${material.title}
核心主张：${material.coreClaim}

请按以下 JSON 格式输出：
{
  "gentleChallenge": "温和质疑（如：是否可能...、会不会...）",
  "stimulusQuestion": "刺激性问题（帮助作者提前想到别人会怎么反驳）"
}

质疑风格约束：
- 温和的质疑，不是攻击
- 帮作者提前想到别人会怎么反驳
- 使用"是否可能..."、"会不会..."等句式`;

      const response = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: '你是一个温和的异见派，擅长提出有建设性的质疑。',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
      });

      const result = JSON.parse(extractJson(response.content));
      questions.push({
        originalClaim: material.coreClaim,
        gentleChallenge: result.gentleChallenge,
        stimulusQuestion: result.stimulusQuestion,
        materialId: material.id,
      });
    } catch (error) {
      logger.error(`Generate contrarian question failed: ${material.id}`, error);
    }
  }

  return questions;
}

/**
 * 保存周报到数据库
 */
async function saveWeeklyDigest(userId: string, digest: WeeklyDigest): Promise<void> {
  try {
    await prisma.weeklyDigest.upsert({
      where: { id: digest.id },
      update: {
        user_id: userId,
        week_start: new Date(digest.weekStart),
        week_end: new Date(digest.weekEnd),
        materials_count: digest.materialsCount,
        materials_json: digest.materials as any,
        theme_clusters_json: digest.themeClusters as any,
        cross_theme_tension: digest.crossThemeTension,
        contrarian_questions_json: digest.contrarianQuestions as any,
        deep_dive_candidates_json: digest.deepDiveCandidates as any,
        feishu_doc_url: digest.feishuDocUrl,
        updated_at: new Date(),
      },
      create: {
        id: digest.id,
        user_id: userId,
        week_start: new Date(digest.weekStart),
        week_end: new Date(digest.weekEnd),
        materials_count: digest.materialsCount,
        materials_json: digest.materials as any,
        theme_clusters_json: digest.themeClusters as any,
        cross_theme_tension: digest.crossThemeTension,
        contrarian_questions_json: digest.contrarianQuestions as any,
        deep_dive_candidates_json: digest.deepDiveCandidates as any,
        feishu_doc_url: digest.feishuDocUrl,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  } catch (error) {
    logger.error('Save weekly digest failed:', error);
    // 不抛出错误，允许继续
  }
}

/**
 * 创建周报飞书文档
 */
async function createWeeklyDigestDocument(digest: WeeklyDigest): Promise<string> {
  try {
    const content = formatWeeklyDigestMarkdown(digest);
    const doc = await createWikiDocument(
      `周报-${digest.weekEnd}`,
      content,
      process.env.FEISHU_WEEKLY_DIGEST_FOLDER_TOKEN
    );
    return doc.url || '';
  } catch (error) {
    logger.error('Create weekly digest document failed:', error);
    return '';
  }
}

/**
 * 格式化周报为 Markdown
 */
function formatWeeklyDigestMarkdown(digest: WeeklyDigest): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# 周度认知简报 (${digest.weekStart} ~ ${digest.weekEnd})`);
  lines.push('');

  // Part 1: 素材速览
  lines.push('## Part 1: 素材速览');
  lines.push('');
  lines.push('| # | 标题 | 核心主张 | D/R/C/H | 总分 | 建议 |');
  lines.push('|---|------|----------|---------|------|------|');

  digest.materials.forEach((m, i) => {
    const scores = `${m.scores.D}/${m.scores.R}/${m.scores.C}/${m.scores.H}`;
    const rec = m.recommendation === 'deep_dive' ? '⭐ 深挖' :
                m.recommendation === 'skip' ? '跳过' : '背景';
    lines.push(`| ${i + 1} | ${m.title} | ${m.coreClaim.substring(0, 30)}... | ${scores} | ${m.total} | ${rec} |`);
  });

  lines.push('');

  // Part 2: 主题地图
  if (digest.themeClusters.length > 0) {
    lines.push('## Part 2: 主题地图');
    lines.push('');

    digest.themeClusters.forEach((cluster, i) => {
      lines.push(`### 主题 ${i + 1}: ${cluster.theme}`);
      lines.push('');
      const materialTitles = cluster.materials
        .map(id => digest.materials.find(m => m.id === id)?.title)
        .filter(Boolean);
      materialTitles.forEach(title => {
        lines.push(`- ${title}`);
      });
      lines.push('');
      lines.push(`**关联点**: ${cluster.connection}`);
      lines.push('');
    });

    // 跨主题张力
    lines.push('### 跨主题张力');
    lines.push('');
    lines.push(digest.crossThemeTension);
    lines.push('');
  }

  // Part 3: 对抗式问题清单
  if (digest.contrarianQuestions.length > 0) {
    lines.push('## Part 3: 对抗式问题清单');
    lines.push('');
    lines.push('| 原主张 | 温和质疑 | 刺激问题 |');
    lines.push('|--------|----------|----------|');

    digest.contrarianQuestions.forEach(q => {
      const claim = q.originalClaim.substring(0, 20) + '...';
      lines.push(`| ${claim} | ${q.gentleChallenge} | ${q.stimulusQuestion} |`);
    });

    lines.push('');
  }

  // Part 4: 深挖候选
  if (digest.deepDiveCandidates.length > 0) {
    lines.push('## Part 4: 深挖候选');
    lines.push('');
    lines.push('本周推荐深挖的素材（总分 Top 3）：');
    lines.push('');

    digest.deepDiveCandidates.forEach((m, i) => {
      lines.push(`${i + 1}. **${m.title}**（总分 ${m.total}）`);
      lines.push(`   - 核心主张：${m.coreClaim}`);
      lines.push(`   - 作者：${m.author}`);
      lines.push('');
    });

    lines.push('**下一步行动**：');
    lines.push('- 回复「深挖 1」→ 对第 1 篇启动 Phase 0.5 + 1.5（资讯穿透 + 破题）');
    lines.push('- 回复「深挖 1+2」→ 两篇都深挖');
    lines.push('- 回复「跳过深挖」→ 本周不深挖，存档待用');
    lines.push('');
  }

  // 页脚
  lines.push('---');
  lines.push('');
  lines.push(`*生成时间: ${new Date(digest.createdAt).toLocaleString('zh-CN')}*`);

  return lines.join('\n');
}

/**
 * 提取 JSON 字符串
 */
function extractJson(text: string): string {
  // 尝试提取 ```json 代码块
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 尝试提取 ``` 代码块
  const genericBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (genericBlockMatch) {
    return genericBlockMatch[1].trim();
  }

  // 尝试提取花括号包裹的内容
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text;
}

/**
 * 获取用户的最新周报
 */
export async function getLatestWeeklyDigest(userId: string): Promise<WeeklyDigest | null> {
  try {
    const record = await prisma.weeklyDigest.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      weekStart: record.week_start.toISOString().split('T')[0],
      weekEnd: record.week_end.toISOString().split('T')[0],
      materialsCount: record.materials_count,
      materials: record.materials_json as any,
      themeClusters: record.theme_clusters_json as any,
      crossThemeTension: record.cross_theme_tension || '',
      contrarianQuestions: record.contrarian_questions_json as any,
      deepDiveCandidates: record.deep_dive_candidates_json as any,
      createdAt: record.created_at.toISOString(),
      feishuDocUrl: record.feishu_doc_url || undefined,
    };
  } catch (error) {
    logger.error('Get latest weekly digest failed:', error);
    return null;
  }
}

/**
 * 获取周报历史列表
 */
export async function getWeeklyDigestHistory(
  userId: string,
  limit: number = 10
): Promise<Array<{ id: string; weekStart: string; weekEnd: string; createdAt: string }>> {
  try {
    const records = await prisma.weeklyDigest.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        week_start: true,
        week_end: true,
        created_at: true,
      },
    });

    return records.map((r: any) => ({
      id: r.id,
      weekStart: r.week_start.toISOString().split('T')[0],
      weekEnd: r.week_end.toISOString().split('T')[0],
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    logger.error('Get weekly digest history failed:', error);
    return [];
  }
}

/**
 * 选择深挖素材（用户交互）
 * @param digestId 周报ID
 * @param materialIndices 素材序号列表（从1开始）
 */
export async function selectDeepDiveMaterials(
  digestId: string,
  materialIndices: number[]
): Promise<{ success: boolean; selected: ScoredMaterial[]; message: string }> {
  try {
    const digest = await prisma.weeklyDigest.findUnique({
      where: { id: digestId },
    });

    if (!digest) {
      return { success: false, selected: [], message: '周报不存在' };
    }

    const materials = digest.materials_json as unknown as ScoredMaterial[];
    const selected = materialIndices
      .map(idx => materials[idx - 1])
      .filter(Boolean);

    if (selected.length === 0) {
      return { success: false, selected: [], message: '未找到选中的素材' };
    }

    // 更新数据库中的选择
    await prisma.weeklyDigest.update({
      where: { id: digestId },
      data: {
        deep_dive_candidates_json: selected as any,
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      selected,
      message: `已选择 ${selected.length} 篇素材进行深挖`,
    };
  } catch (error) {
    logger.error('Select deep dive materials failed:', error);
    return { success: false, selected: [], message: '选择失败' };
  }
}
