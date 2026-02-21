/**
 * 发布后复盘服务
 * Phase 6: Post-publish Retro
 *
 * 功能：
 * 1. 指标采集（阅读量、点赞、转发、评论等）
 * 2. 反对点 Top3 分析
 * 3. 保留项与删改项决策记录
 * 4. 下一篇假设生成
 * 5. 复盘卡片保存
 */

import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { chatCompletion } from './deepseek.service';

/**
 * 文章指标
 */
export interface ArticleMetrics {
  reads: number;
  likes: number;
  shares: number;
  comments: number;
  collections?: number;
}

/**
 * 反对点
 */
export interface Objection {
  point: string;
  source: 'comment' | 'private_message' | 'self_reflection';
  validity: 'valid' | 'misunderstanding' | 'perspective_diff';
  note?: string;
}

/**
 * 决策项
 */
export interface DecisionItem {
  type: 'keep' | 'change';
  content: string;
  reason: string;
}

/**
 * 复盘卡片
 */
export interface RetroCard {
  id: string;
  articleId: string;
  articleTitle: string;
  publishDate: string;
  metrics: ArticleMetrics;
  top3Objections: Objection[];
  keepItems: DecisionItem[];
  changeItems: DecisionItem[];
  nextHypothesis: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 创建复盘卡片
 * @param data 复盘数据
 */
export async function createRetroCard(data: {
  articleId: string;
  articleTitle: string;
  publishDate: string;
  metrics: ArticleMetrics;
  top3Objections?: Objection[];
  keepItems?: DecisionItem[];
  changeItems?: DecisionItem[];
  nextHypothesis?: string;
}): Promise<RetroCard> {
  logger.info(`Creating retro card for article: ${data.articleTitle}`);

  try {
    const retroId = `retro-${data.articleId}`;

    // 保存到数据库
    await prisma.retroCard.upsert({
      where: { id: retroId },
      update: {
        article_title: data.articleTitle,
        publish_date: new Date(data.publishDate),
        metrics_json: data.metrics as any,
        top3_objections_json: data.top3Objections as any,
        keep_items_json: data.keepItems as any,
        change_items_json: data.changeItems as any,
        next_hypothesis: data.nextHypothesis,
        updated_at: new Date(),
      },
      create: {
        id: retroId,
        article_id: data.articleId,
        article_title: data.articleTitle,
        publish_date: new Date(data.publishDate),
        metrics_json: data.metrics as any,
        top3_objections_json: data.top3Objections as any,
        keep_items_json: data.keepItems as any,
        change_items_json: data.changeItems as any,
        next_hypothesis: data.nextHypothesis,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const card: RetroCard = {
      id: retroId,
      articleId: data.articleId,
      articleTitle: data.articleTitle,
      publishDate: data.publishDate,
      metrics: data.metrics,
      top3Objections: data.top3Objections || [],
      keepItems: data.keepItems || [],
      changeItems: data.changeItems || [],
      nextHypothesis: data.nextHypothesis || '',
      createdAt: new Date().toISOString(),
    };

    logger.info(`Retro card created successfully: ${retroId}`);
    return card;
  } catch (error) {
    logger.error('Create retro card failed:', error);
    throw error;
  }
}

/**
 * 分析反对点（AI 辅助）
 * @param comments 评论列表
 * @param articleContent 文章内容
 */
export async function analyzeObjections(
  comments: string[],
  articleContent: string
): Promise<Objection[]> {
  logger.info(`Analyzing ${comments.length} comments for objections`);

  if (comments.length === 0) {
    return [];
  }

  try {
    const prompt = `请分析以下评论，提取最有价值的反对意见（最多3个）。

文章内容摘要：
${articleContent.substring(0, 500)}...

评论列表：
${comments.map((c, i) => `${i + 1}. ${c}`).join('\n')}

请按以下 JSON 格式输出反对点：
[
  {
    "point": "反对意见的核心观点",
    "source": "comment", // 来源：comment(评论)/private_message(私信)/self_reflection(自我反思)
    "validity": "valid", // 合理性评估：valid(有道理)/misunderstanding(误读)/perspective_diff(视角差异)
    "note": "补充说明"
  }
]

要求：
1. 选择最有代表性、最能帮助改进的反对意见
2. 排除无意义的攻击或无关评论
3. 最多返回3个反对点`;

    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的内容分析师，擅长从用户反馈中提取有价值的反对意见。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    const objections = JSON.parse(extractJson(response.content)) as Objection[];
    return objections.slice(0, 3);
  } catch (error) {
    logger.error('Analyze objections failed:', error);
    return [];
  }
}

/**
 * 生成下一篇假设（AI 辅助）
 * @param retroCard 当前复盘卡片
 */
export async function generateNextHypothesis(retroCard: RetroCard): Promise<string> {
  logger.info(`Generating next hypothesis for: ${retroCard.articleTitle}`);

  try {
    const prompt = `基于以下复盘数据，生成下一篇文章的写作假设。

文章标题：${retroCard.articleTitle}
发布日期：${retroCard.publishDate}

数据表现：
- 阅读量：${retroCard.metrics.reads}
- 点赞数：${retroCard.metrics.likes}
- 转发数：${retroCard.metrics.shares}
- 评论数：${retroCard.metrics.comments}

反对意见：
${retroCard.top3Objections.map((o, i) => `${i + 1}. ${o.point}（来源：${o.source}，合理性：${o.validity}）`).join('\n')}

保留项：
${retroCard.keepItems.map((k, i) => `${i + 1}. ${k.content} - ${k.reason}`).join('\n')}

删改项：
${retroCard.changeItems.map((c, i) => `${i + 1}. ${c.content} - ${c.reason}`).join('\n')}

请生成一个具体的写作假设，格式：
"基于[数据/反馈]，下一篇可以尝试[具体做法]，预期[效果]，验证方式[如何验证]"

要求：
1. 假设要具体可执行
2. 基于数据或反馈
3. 包含验证方式`;

    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个数据驱动的写作策略师，擅长基于复盘数据生成可验证的写作假设。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    return response.content.trim();
  } catch (error) {
    logger.error('Generate next hypothesis failed:', error);
    return '基于本篇数据，下一篇可以尝试调整结构，预期提升阅读完成率，验证方式：对比两篇文章的阅读时长数据。';
  }
}

/**
 * 获取复盘卡片
 * @param articleId 文章ID
 */
export async function getRetroCard(articleId: string): Promise<RetroCard | null> {
  try {
    const record = await prisma.retroCard.findUnique({
      where: { id: `retro-${articleId}` },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      articleId: record.article_id,
      articleTitle: record.article_title,
      publishDate: record.publish_date.toISOString().split('T')[0],
      metrics: record.metrics_json as unknown as ArticleMetrics,
      top3Objections: record.top3_objections_json as unknown as Objection[],
      keepItems: record.keep_items_json as unknown as DecisionItem[],
      changeItems: record.change_items_json as unknown as DecisionItem[],
      nextHypothesis: record.next_hypothesis || '',
      createdAt: record.created_at.toISOString(),
      updatedAt: record.updated_at?.toISOString(),
    };
  } catch (error) {
    logger.error('Get retro card failed:', error);
    return null;
  }
}

/**
 * 获取复盘历史列表
 * @param limit 数量限制
 */
export async function getRetroHistory(
  limit: number = 10
): Promise<
  Array<{
    id: string;
    articleTitle: string;
    publishDate: string;
    metrics: ArticleMetrics;
    createdAt: string;
  }>
> {
  try {
    const records = await prisma.retroCard.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        article_title: true,
        publish_date: true,
        metrics_json: true,
        created_at: true,
      },
    });

    return records.map((r: any) => ({
      id: r.id,
      articleTitle: r.article_title,
      publishDate: r.publish_date.toISOString().split('T')[0],
      metrics: r.metrics_json as unknown as ArticleMetrics,
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    logger.error('Get retro history failed:', error);
    return [];
  }
}

/**
 * 更新复盘卡片
 * @param articleId 文章ID
 * @param data 更新数据
 */
export async function updateRetroCard(
  articleId: string,
  data: Partial<Omit<RetroCard, 'id' | 'articleId' | 'createdAt'>>
): Promise<RetroCard | null> {
  logger.info(`Updating retro card for article: ${articleId}`);

  try {
    const existing = await prisma.retroCard.findUnique({
      where: { id: `retro-${articleId}` },
    });

    if (!existing) {
      return null;
    }

    await prisma.retroCard.update({
      where: { id: `retro-${articleId}` },
      data: {
        article_title: data.articleTitle,
        metrics_json: data.metrics as any,
        top3_objections_json: data.top3Objections as any,
        keep_items_json: data.keepItems as any,
        change_items_json: data.changeItems as any,
        next_hypothesis: data.nextHypothesis,
        updated_at: new Date(),
      },
    });

    return getRetroCard(articleId);
  } catch (error) {
    logger.error('Update retro card failed:', error);
    return null;
  }
}

/**
 * 删除复盘卡片
 * @param articleId 文章ID
 */
export async function deleteRetroCard(articleId: string): Promise<boolean> {
  try {
    await prisma.retroCard.delete({
      where: { id: `retro-${articleId}` },
    });
    return true;
  } catch (error) {
    logger.error('Delete retro card failed:', error);
    return false;
  }
}

/**
 * 格式化复盘卡片为 Markdown
 */
export function formatRetroCardMarkdown(card: RetroCard): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# 复盘卡片：${card.articleTitle}`);
  lines.push('');
  lines.push(`发布日期：${card.publishDate}`);
  lines.push('');

  // 数据指标
  lines.push('## 📊 数据表现');
  lines.push('');
  lines.push(`| 指标 | 数值 |`);
  lines.push(`|------|------|`);
  lines.push(`| 阅读量 | ${card.metrics.reads} |`);
  lines.push(`| 点赞数 | ${card.metrics.likes} |`);
  lines.push(`| 转发数 | ${card.metrics.shares} |`);
  lines.push(`| 评论数 | ${card.metrics.comments} |`);
  if (card.metrics.collections !== undefined) {
    lines.push(`| 收藏数 | ${card.metrics.collections} |`);
  }
  lines.push('');

  // 反对意见
  if (card.top3Objections.length > 0) {
    lines.push('## 💬 反对意见 Top 3');
    lines.push('');
    card.top3Objections.forEach((obj, i) => {
      const validityMap: Record<string, string> = {
        valid: '✅ 有道理',
        misunderstanding: '❓ 误读',
        perspective_diff: '🔄 视角差异',
      };
      lines.push(`${i + 1}. **${obj.point}**`);
      lines.push(`   - 来源：${obj.source}`);
      lines.push(`   - 合理性：${validityMap[obj.validity] || obj.validity}`);
      if (obj.note) {
        lines.push(`   - 备注：${obj.note}`);
      }
      lines.push('');
    });
  }

  // 保留项
  if (card.keepItems.length > 0) {
    lines.push('## ✅ 保留项');
    lines.push('');
    card.keepItems.forEach((item, i) => {
      lines.push(`${i + 1}. **${item.content}**`);
      lines.push(`   - 原因：${item.reason}`);
      lines.push('');
    });
  }

  // 删改项
  if (card.changeItems.length > 0) {
    lines.push('## 📝 删改项');
    lines.push('');
    card.changeItems.forEach((item, i) => {
      lines.push(`${i + 1}. **${item.content}**`);
      lines.push(`   - 原因：${item.reason}`);
      lines.push('');
    });
  }

  // 下一篇假设
  if (card.nextHypothesis) {
    lines.push('## 🎯 下一篇假设');
    lines.push('');
    lines.push(card.nextHypothesis);
    lines.push('');
  }

  // 页脚
  lines.push('---');
  lines.push('');
  lines.push(`*复盘时间: ${new Date(card.createdAt).toLocaleString('zh-CN')}*`);

  return lines.join('\n');
}

/**
 * 提取 JSON 字符串
 */
function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const genericBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (genericBlockMatch) {
    return genericBlockMatch[1].trim();
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text;
}
