/**
 * AI 处理服务
 * 处理素材的 AI 摘要和观点生成
 */

import { logger } from '../utils/logger';
import { generateSourceSummary } from './deepseek.service';
import { feishuWiki } from './feishu.wiki';
import { feishuImage } from './feishu.image';
import { prisma } from '../lib/prisma';

/**
 * 处理单个素材的 AI 摘要生成
 * @param sourceId 素材ID
 * @param wikiToken 飞书文档token
 * @param userAccessToken 用户访问令牌（可选）
 */
export async function processSourceAI(
  sourceId: string,
  wikiToken: string,
  userAccessToken?: string
): Promise<void> {
  try {
    logger.info(`[AI Processor] 开始处理素材 AI: sourceId=${sourceId}, wikiToken=${wikiToken}`);

    // 更新状态为处理中
    await prisma.source.update({
      where: { id: sourceId },
      data: { aiStatus: 'processing' },
    });
    logger.info(`[AI Processor] 状态已更新为 processing: sourceId=${sourceId}`);

    // 1. 获取文档内容
    logger.info(`[AI Processor] 开始获取文档内容: wikiToken=${wikiToken}`);
    const content = await feishuWiki.getDocumentContent(wikiToken, userAccessToken);
    logger.info(`[AI Processor] 文档内容获取完成: 长度=${content?.length || 0}`);
    
    if (!content || content.length < 50) {
      logger.warn(`[AI Processor] 文档内容太短或为空: sourceId=${sourceId}, 长度=${content?.length || 0}`);
      await prisma.source.update({
        where: { id: sourceId },
        data: { aiStatus: 'failed' },
      });
      return;
    }

    // 2. 调用 AI 生成摘要和观点
    logger.info(`[AI Processor] 开始调用 AI 生成摘要: sourceId=${sourceId}, 内容长度=${content.length}`);
    const result = await generateSourceSummary(content);
    logger.info(`[AI Processor] AI 生成完成: summary长度=${result.summary?.length || 0}, 观点数=${result.viewpoints?.length || 0}`);

    // 3. 提取并处理图片
    logger.info(`[AI Processor] 开始提取图片: sourceId=${sourceId}`);
    const imageTokens = feishuImage.extractImageTokens(content);
    logger.info(`[AI Processor] 发现 ${imageTokens.length} 张图片`);

    let images: { token: string; url: string; expiresAt: string }[] = [];
    if (imageTokens.length > 0) {
      images = await feishuImage.getImageUrls(imageTokens, userAccessToken);
      logger.info(`[AI Processor] 成功获取 ${images.length} 张图片 URL`);
    }

    // 4. 更新数据库
    logger.info(`[AI Processor] 开始更新数据库: sourceId=${sourceId}`);
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        summary: result.summary,
        viewpoints: JSON.stringify(result.viewpoints),
        content: content, // 存储完整内容
        images: JSON.stringify(images), // 存储图片信息
        aiStatus: 'completed',
      },
    });

    logger.info(`[AI Processor] 素材 AI 处理完成: sourceId=${sourceId}`);
  } catch (error: any) {
    logger.error(`[AI Processor] 素材 AI 处理失败: sourceId=${sourceId}`, error);
    logger.error(`[AI Processor] 错误详情: ${error.message}`);
    if (error.stack) {
      logger.error(`[AI Processor] 错误堆栈: ${error.stack}`);
    }
    
    // 更新状态为失败
    try {
      await prisma.source.update({
        where: { id: sourceId },
        data: { aiStatus: 'failed' },
      });
    } catch (updateError) {
      logger.error(`[AI Processor] 更新失败状态也失败了: sourceId=${sourceId}`, updateError);
    }
  }
}

/**
 * 批量处理待处理的素材
 * @param batchSize 批次大小
 */
export async function processPendingSources(batchSize: number = 5): Promise<void> {
  try {
    // 查询待处理的素材
    const pendingSources = await prisma.source.findMany({
      where: { aiStatus: 'pending' },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    if (pendingSources.length === 0) {
      return;
    }

    logger.info(`发现 ${pendingSources.length} 个待处理素材`);

    // 逐个处理
    for (const source of pendingSources) {
      if (source.feishuWikiToken) {
        await processSourceAI(source.id, source.feishuWikiToken);
        // 添加延迟，避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error: any) {
    logger.error('批量处理素材 AI 失败', error);
  }
}
