import { feishuBitable } from './feishu.bitable';
import { feishuConfig } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  type: 'article' | 'video' | 'audio' | 'image';
  tags: string[];
  summary?: string;
  createdAt: Date;
}

class SourceSyncService {
  async sync(): Promise<{ count: number; error?: string }> {
    try {
      const appToken = feishuConfig.bitable.sourcesToken;
      // 假设表格 ID 为 'tbllyDDUwGMFogD2'，从用户提供的链接中获取
      const tableId = 'tbllyDDUwGMFogD2';

      let allRecords: any[] = [];
      let pageToken: string | undefined;
      let hasMore = true;

      // 分页获取所有记录
      while (hasMore) {
        const result = await feishuBitable.getRecords(appToken, tableId, {
          pageSize: 500,
          pageToken,
        });

        allRecords = allRecords.concat(result.items);
        hasMore = result.hasMore;
        pageToken = result.pageToken;
      }

      // 转换并保存到数据库
      const sources = allRecords.map(this.transformRecord);

      // 批量 upsert
      for (const source of sources) {
        await prisma.source.upsert({
          where: { id: source.id },
          update: source,
          create: source,
        });
      }

      // 更新同步记录
      await this.updateSyncRecord(allRecords.length);

      logger.info(`素材同步完成: ${sources.length} 条`);
      return { count: sources.length };
    } catch (error: any) {
      logger.error('素材同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message };
    }
  }

  private transformRecord(record: any): SourceRecord {
    const fields = record.fields;
    return {
      id: record.record_id,
      title: fields['标题'] || fields['title'] || '无标题',
      url: fields['链接'] || fields['url'] || '',
      type: this.detectType(fields),
      tags: fields['标签'] || fields['tags'] || [],
      summary: fields['摘要'] || fields['summary'],
      createdAt: new Date(record.created_time || Date.now()),
    };
  }

  private detectType(fields: any): 'article' | 'video' | 'audio' | 'image' {
    const url = fields['链接'] || fields['url'] || '';
    if (url.includes('bilibili.com') || url.includes('youtube.com')) return 'video';
    if (url.includes('xiaoyuzhoufm.com') || url.includes('ximalaya.com')) return 'audio';
    if (url.includes('xiaohongshu.com')) return 'image';
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
