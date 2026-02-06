/**
 * 飞书存储实现
 * 实现 IArticleStorage 接口，封装飞书 Bitable、Doc、Wiki 服务
 */
import { IArticleStorage } from '../../core/interfaces';
import { Article, QuickAnalysis, DocumentInfo } from '../../core/events';
import { createDocumentWithImages } from '../../services/lark-doc';
import { addDocumentToWiki } from '../../services/lark-wiki';
import { larkClient } from '../../services/lark-client';
import { logger } from '../../utils/logger';
import { article as articleConfig, fieldConfig, wikiConfig } from '../../config';

export class FeishuStorage implements IArticleStorage {
  /**
   * 检查文章是否已存在
   */
  async checkArticleExists(url: string): Promise<DocumentInfo | null> {
    try {
      logger.info(`[FeishuStorage] 检查文章是否存在: ${url}`);

      const response = await larkClient.post(
        `/bitable/v1/apps/${articleConfig.appToken}/tables/${articleConfig.tableId}/records/search`,
        {
          filter: {
            conjunction: 'and',
            conditions: [
              {
                field_name: fieldConfig.originalUrl,
                operator: 'is',
                value: [url],
              },
            ],
          },
          page_size: 1,
        }
      );

      if (response.code !== 0) {
        logger.warn('[FeishuStorage] 检查失败', { code: response.code, msg: response.msg });
        return null;
      }

      const items = response.data?.items || [];
      if (items.length === 0) {
        logger.info('[FeishuStorage] 文章不存在');
        return null;
      }

      const record = items[0];
      // 尝试从多个可能的字段获取文档URL
      const docUrl = record.fields[fieldConfig.docUrl]?.link || 
                     record.fields[fieldConfig.docUrl] ||
                     record.fields['知识库链接']?.link ||
                     '';
      const wikiNodeToken = record.fields['知识库节点'] || '';
      const documentUrl = wikiNodeToken
        ? `https://bytedance.larkoffice.com/wiki/${wikiNodeToken}`
        : (typeof docUrl === 'string' ? docUrl : '');

      logger.info('[FeishuStorage] 文章已存在', { wikiNodeToken, documentUrl });

      return {
        documentUrl,
        wikiNodeToken: wikiNodeToken || '',
        bitableRecordId: record.record_id,
      };
    } catch (error) {
      logger.error('[FeishuStorage] 检查文章存在异常', error);
      return null;
    }
  }

  /**
   * 创建文档并存储文章
   */
  async createDocument(
    article: Article,
    quickAnalysis: QuickAnalysis,
    userId: string
  ): Promise<DocumentInfo> {
    logger.info(`[FeishuStorage] 创建文档: ${article.title}`);

    try {
      // 1. 解析图片信息（如果有）- 简化处理，直接传空数组
      const imageInfos: any[] = [];

      // 2. 创建飞书云文档（不含图片，因为图片路径是字符串数组）
      const { documentId } = await createDocumentWithImages(
        article.title,
        article.content,
        {
          title: article.title,
          originalUrl: article.originalUrl,
          source: article.metadata?.source || '未知',
          author: article.metadata?.author || '未知',
          publishTime: article.metadata?.publishDate || null,
          summary: article.content.substring(0, 200),
        },
        imageInfos
      );

      // 3. 添加到知识库
      const { wikiToken, url } = await addDocumentToWiki(documentId, wikiConfig.articleParentNodeToken);

      logger.info(`[FeishuStorage] 文档创建成功: ${url}`);

      return {
        documentUrl: url,
        wikiNodeToken: wikiToken,
        bitableRecordId: '', // 稍后填充
      };
    } catch (error) {
      logger.error('[FeishuStorage] 创建文档失败', error);
      throw error;
    }
  }

  /**
   * 创建 Bitable 记录
   * 注意：使用旧版字段配置，兼容现有 Bitable 表格
   */
  async createBitableRecord(
    article: Article,
    quickAnalysis: QuickAnalysis,
    documentInfo: DocumentInfo
  ): Promise<string> {
    logger.info(`[FeishuStorage] 创建 Bitable 记录`);

    try {
      const fields: Record<string, any> = {
        [fieldConfig.title]: article.title,
        [fieldConfig.originalUrl]: {
          text: '原文链接',
          link: article.originalUrl,
        },
        [fieldConfig.source]: article.metadata?.source || '未知',
        [fieldConfig.docUrl]: {
          text: '查看文档',
          link: documentInfo.documentUrl,
        },
        // 将 AI 摘要写入到摘要字段
        [fieldConfig.summary]: quickAnalysis.summary || article.content.substring(0, 200),
        [fieldConfig.collectTime]: Date.now(),
      };

      // 可选字段
      if (article.metadata?.author) {
        fields[fieldConfig.author] = article.metadata.author;
      }
      if (article.metadata?.publishDate) {
        try {
          const publishDate = new Date(article.metadata.publishDate);
          if (!isNaN(publishDate.getTime())) {
            fields['发布时间'] = publishDate.getTime();
          }
        } catch {
          // 忽略无效的日期格式
          logger.warn('[FeishuStorage] 发布时间格式无效，跳过', {
            publishDate: article.metadata.publishDate,
          });
        }
      }

      logger.info(`[FeishuStorage] 写入字段:`, {
        fields: Object.keys(fields),
        title: fields[fieldConfig.title],
        originalUrl: fields[fieldConfig.originalUrl],
        docUrl: fields[fieldConfig.docUrl],
      });

      const response = await larkClient.post(
        `/bitable/v1/apps/${articleConfig.appToken}/tables/${articleConfig.tableId}/records`,
        { fields }
      );

      if (response.code !== 0) {
        throw new Error(`创建 Bitable 记录失败: ${response.msg}`);
      }

      const recordId = response.data!.record.record_id;
      logger.info(`[FeishuStorage] Bitable 记录创建成功: ${recordId}`);

      return recordId;
    } catch (error) {
      logger.error('[FeishuStorage] 创建 Bitable 记录失败', error);
      throw error;
    }
  }
}
