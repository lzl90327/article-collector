import { feishuBitable } from './feishu.bitable';
import { feishuWiki } from './feishu.wiki';
import { feishuConfig, SOURCE_TYPE_MAPPING, SourceType } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  type: SourceType;
  tags: string[];
  summary?: string;
  content?: string;
  createdAt: Date;
}

class SourceSyncService {
  /**
   * 同步素材
   * 1. 保存到知识库（子文档形式）
   * 2. 在多维表格中增加记录
   */
  async sync(): Promise<{ count: number; error?: string; details: Record<SourceType, number> }> {
    const details: Record<SourceType, number> = {
      article: 0,
      video: 0,
      audio: 0,
      image: 0,
      book: 0,
      paper: 0,
    };
    let totalCount = 0;

    try {
      // 从数据库获取待同步的素材
      const sources = await prisma.source.findMany({
        where: {
          syncStatus: 'pending',
        },
        take: 100, // 每次同步100条
      });

      for (const source of sources) {
        try {
          const sourceType = source.type as SourceType;
          const typeConfig = SOURCE_TYPE_MAPPING[sourceType];

          if (!typeConfig) {
            logger.warn(`未知的素材类型: ${sourceType}`);
            continue;
          }

          // 1. 保存到知识库（子文档）
          const wikiResult = await this.saveToWiki(source, typeConfig.wikiConfig);

          // 2. 保存到多维表格
          const bitableResult = await this.saveToBitable(source, wikiResult.url);

          // 3. 更新本地数据库状态
          await prisma.source.update({
            where: { id: source.id },
            data: {
              syncStatus: 'synced',
              feishuWikiToken: wikiResult.token,
              feishuRecordId: bitableResult.recordId,
              updatedAt: new Date(),
            },
          });

          details[sourceType]++;
          totalCount++;
          logger.info(`素材同步成功: ${source.title} -> ${typeConfig.name}素材库`);
        } catch (error: any) {
          logger.error(`素材同步失败: ${source.title}`, error);
          // 更新为失败状态
          await prisma.source.update({
            where: { id: source.id },
            data: {
              syncStatus: 'failed',
              syncError: error.message,
              updatedAt: new Date(),
            },
          });
        }
      }

      // 更新同步记录
      await this.updateSyncRecord(totalCount);

      logger.info(`素材同步完成: 总计 ${totalCount} 条`);
      return { count: totalCount, details };
    } catch (error: any) {
      logger.error('素材同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message, details };
    }
  }

  /**
   * 保存素材到知识库（子文档形式）
   */
  private async saveToWiki(
    source: any,
    wikiConfig: { spaceId: string; name: string }
  ): Promise<{ token: string; url: string }> {
    if (!wikiConfig.spaceId) {
      throw new Error(`知识库 ${wikiConfig.name} 未配置`);
    }

    // 构建文档内容
    const content = this.buildWikiContent(source);

    // 创建飞书文档
    const result = await feishuWiki.createDocument({
      spaceId: wikiConfig.spaceId,
      title: source.title,
      content: content,
    });

    return {
      token: result.wikiToken,
      url: result.url,
    };
  }

  /**
   * 保存素材记录到多维表格
   */
  private async saveToBitable(
    source: any,
    wikiUrl: string
  ): Promise<{ recordId: string }> {
    const config = feishuConfig.bitable.sources;

    if (!config.appToken || !config.tableId) {
      throw new Error('素材库多维表格未配置');
    }

    const typeConfig = SOURCE_TYPE_MAPPING[source.type as SourceType];

    // 构建记录字段
    const fields: Record<string, any> = {
      '标题': source.title,
      '链接': source.url,
      '类型': typeConfig?.name || source.type,
      '标签': source.tags || [],
      '摘要': source.summary || '',
      '知识库链接': wikiUrl,
      '素材库分类': typeConfig?.bitableField || '其他',
      '同步时间': new Date().toISOString(),
    };

    // 创建记录
    const result = await feishuBitable.createRecord(
      config.appToken,
      config.tableId,
      fields
    );

    return {
      recordId: result.record.record_id,
    };
  }

  /**
   * 构建知识库文档内容
   */
  private buildWikiContent(source: any): string {
    const lines = [
      `# ${source.title}`,
      '',
      `**类型**: ${source.type}`,
      `**链接**: ${source.url}`,
      '',
      '## 摘要',
      source.summary || '暂无摘要',
      '',
      '## 标签',
      source.tags?.join(', ') || '无标签',
      '',
      '---',
      `同步时间: ${new Date().toLocaleString()}`,
    ];

    return lines.join('\n');
  }

  private async updateSyncRecord(count: number, error?: string) {
    await prisma.syncRecord.create({
      data: {
        type: 'sources',
        lastSyncAt: new Date(),
        recordCount: count,
        status: error ? 'failed' : 'success',
        error,
      },
    });
  }
}

export const sourceSync = new SourceSyncService();
