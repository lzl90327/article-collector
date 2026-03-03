import { feishuWiki } from './feishu.wiki';
import { feishuConfig } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface ArticleRecord {
  id: string;
  title: string;
  content?: string;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

class ArticleSyncService {
  async sync(userId: string = 'system'): Promise<{ count: number; error?: string }> {
    try {
      const spaceId = feishuConfig.wiki.articleLibrary.spaceId;

      if (!spaceId) {
        throw new Error('文章库 spaceId 未配置');
      }

      // 获取知识库节点
      const nodes = await feishuWiki.getWikiNodes(spaceId);

      // 只同步文档类型的节点
      const documents = nodes.filter(node => node.obj_type === 'docx');

      for (const doc of documents) {
        try {
          const meta = await feishuWiki.getDocumentMeta(doc.obj_token);
          const content = await feishuWiki.getDocumentContent(doc.obj_token);

          await prisma.article.upsert({
            where: { id: doc.obj_token },
            update: {
              title: meta.title || doc.title,
              content,
              updatedAt: new Date(),
            },
            create: {
              id: doc.obj_token,
              userId,
              title: meta.title || doc.title,
              content,
              status: 'published',
              createdAt: new Date(meta.create_time * 1000),
              updatedAt: new Date(meta.update_time * 1000),
            },
          });
        } catch (error) {
          logger.error(`同步文章失败: ${doc.title}`, error);
        }
      }

      await this.updateSyncRecord(documents.length);

      logger.info(`文章同步完成: ${documents.length} 篇`);
      return { count: documents.length };
    } catch (error: any) {
      logger.error('文章同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message };
    }
  }

  private async updateSyncRecord(count: number, error?: string) {
    await prisma.syncRecord.create({
      data: {
        type: 'articles',
        lastSyncAt: new Date(),
        recordCount: count,
        status: error ? 'failed' : 'success',
        error,
      },
    });
  }
}

export const articleSync = new ArticleSyncService();
