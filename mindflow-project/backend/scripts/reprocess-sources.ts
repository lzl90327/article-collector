/**
 * 重新处理所有素材，生成图片信息
 */

import { prisma } from '../src/lib/prisma';
import { processSourceAI } from '../src/services/ai.processor';
import { feishuAuthDB } from '../src/lib/feishuAuth.db';
import { logger } from '../src/utils/logger';

async function reprocessAllSources() {
  try {
    // 获取第一个用户的 access token
    const authRecords = await prisma.feishuAuth.findFirst();
    let userAccessToken: string | undefined;
    
    if (authRecords) {
      userAccessToken = authRecords.accessToken;
      logger.info(`使用用户 access token: ${userAccessToken.substring(0, 20)}...`);
    } else {
      logger.warn('没有找到用户授权信息，将使用 App Access Token（图片可能无法获取）');
    }

    // 获取所有已同步的素材
    const sources = await prisma.source.findMany({
      where: {
        syncStatus: 'synced',
        feishuWikiToken: { not: null },
      },
    });

    logger.info(`找到 ${sources.length} 个素材需要重新处理`);

    // 逐个处理
    for (const source of sources) {
      if (source.feishuWikiToken) {
        try {
          logger.info(`重新处理素材: ${source.title}`);
          // 重置 AI 状态为 pending，触发重新处理
          await prisma.source.update({
            where: { id: source.id },
            data: { aiStatus: 'pending' },
          });
          // 触发 AI 处理，传入 userAccessToken
          await processSourceAI(source.id, source.feishuWikiToken, userAccessToken);
          logger.info(`素材处理完成: ${source.title}`);
        } catch (error) {
          logger.error(`素材处理失败: ${source.title}`, error);
        }
        // 添加延迟，避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    logger.info('所有素材重新处理完成');
  } catch (error) {
    logger.error('重新处理素材失败', error);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessAllSources();
