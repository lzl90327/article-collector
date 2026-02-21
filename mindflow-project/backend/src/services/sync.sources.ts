import { feishuBitable } from './feishu.bitable';
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
  createdAt: Date;
}

class SourceSyncService {
  /**
   * 同步所有类型的素材
   * 按类型分别同步到不同的 Feishu 表
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
      // 按类型分别同步
      for (const [type, config] of Object.entries(SOURCE_TYPE_MAPPING)) {
        const sourceType = type as SourceType;
        const typeConfig = config.config;

        // 检查配置是否存在
        if (!typeConfig.appToken || !typeConfig.tableId) {
          logger.warn(`素材类型 ${sourceType} 的 Feishu 配置缺失，跳过同步`);
          continue;
        }

        try {
          const count = await this.syncByType(sourceType, typeConfig);
          details[sourceType] = count;
          totalCount += count;
          logger.info(`素材类型 ${sourceType} 同步完成: ${count} 条`);
        } catch (error: any) {
          logger.error(`素材类型 ${sourceType} 同步失败`, error);
          // 继续同步其他类型
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
   * 按类型同步素材
   */
  private async syncByType(
    type: SourceType,
    config: { appToken: string; tableId: string }
  ): Promise<number> {
    let allRecords: any[] = [];
    let pageToken: string | undefined;
    let hasMore = true;

    // 分页获取该类型的所有记录
    while (hasMore) {
      const result = await feishuBitable.getRecords(config.appToken, config.tableId, {
        pageSize: 500,
        pageToken,
      });

      allRecords = allRecords.concat(result.items);
      hasMore = result.hasMore;
      pageToken = result.pageToken;
    }

    // 转换并保存到数据库
    const sources = allRecords.map((record) => this.transformRecord(record, type));

    // 批量 upsert
    for (const source of sources) {
      await prisma.source.upsert({
        where: { id: source.id },
        update: source,
        create: source,
      });
    }

    return sources.length;
  }

  /**
   * 将 Feishu 记录转换为 SourceRecord
   */
  private transformRecord(record: any, type: SourceType): SourceRecord {
    const fields = record.fields;
    return {
      id: record.record_id,
      title: fields['标题'] || fields['title'] || '无标题',
      url: fields['链接'] || fields['url'] || '',
      type: type, // 使用传入的类型，而不是检测
      tags: fields['标签'] || fields['tags'] || [],
      summary: fields['摘要'] || fields['summary'] || fields['描述'] || fields['description'],
      createdAt: new Date(record.created_time || Date.now()),
    };
  }

  /**
   * 检测素材类型（用于兼容旧数据）
   */
  private detectType(fields: any): SourceType {
    const url = fields['链接'] || fields['url'] || '';
    const title = fields['标题'] || fields['title'] || '';
    const typeField = fields['类型'] || fields['type'] || '';

    // 优先使用类型字段
    if (typeField) {
      const normalizedType = typeField.toLowerCase();
      if (['article', 'video', 'audio', 'image', 'book', 'paper'].includes(normalizedType)) {
        return normalizedType as SourceType;
      }
    }

    // 根据 URL 检测
    if (url.includes('bilibili.com') || url.includes('youtube.com') || url.includes('douyin.com')) {
      return 'video';
    }
    if (url.includes('xiaoyuzhoufm.com') || url.includes('ximalaya.com') || url.includes('podcast')) {
      return 'audio';
    }
    if (url.includes('xiaohongshu.com') || url.includes('instagram.com') || url.includes('pinterest.com')) {
      return 'image';
    }
    if (url.includes('douban.com/book') || url.includes('amazon.com') || title.includes('书')) {
      return 'book';
    }
    if (url.includes('arxiv.org') || url.includes('scholar.google.com') || url.includes('researchgate.net')) {
      return 'paper';
    }

    return 'article';
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
