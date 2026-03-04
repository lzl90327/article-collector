/**
 * 更新现有文档的 URL
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';

async function updateUrls() {
  try {
    // 获取所有没有 URL 的素材
    const sources = await prisma.source.findMany({
      where: {
        OR: [
          { url: '' },
          { url: null },
        ],
        feishuWikiToken: { not: null },
      },
    });

    logger.info(`找到 ${sources.length} 个素材需要更新 URL`);

    // 逐个更新 URL
    for (const source of sources) {
      if (source.feishuWikiToken) {
        const url = `https://www.feishu.cn/wiki/${source.feishuWikiToken}`;
        try {
          await prisma.source.update({
            where: { id: source.id },
            data: { url },
          });
          logger.info(`更新 URL 成功: ${source.title} -> ${url}`);
        } catch (error) {
          logger.error(`更新 URL 失败: ${source.title}`, error);
        }
      }
    }

    logger.info('所有素材 URL 更新完成');
  } catch (error) {
    logger.error('更新 URL 失败', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUrls();
