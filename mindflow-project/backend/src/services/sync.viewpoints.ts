import { feishuBitable } from './feishu.bitable';
import { feishuConfig } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface ViewpointRecord {
  id: string;
  content: string;
  sourceArticle?: string;
  tags: string[];
  createdAt: Date;
}

class ViewpointSyncService {
  async sync(): Promise<{ count: number; error?: string }> {
    try {
      const appToken = feishuConfig.bitable.viewpointsToken;
      const tableId = 'tbltuRo6sSWbWsYh';

      let allRecords: any[] = [];
      let pageToken: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await feishuBitable.getRecords(appToken, tableId, {
          pageSize: 500,
          pageToken,
        });

        allRecords = allRecords.concat(result.items);
        hasMore = result.hasMore;
        pageToken = result.pageToken;
      }

      const viewpoints = allRecords.map(this.transformRecord);

      for (const viewpoint of viewpoints) {
        await prisma.viewpoint.upsert({
          where: { id: viewpoint.id },
          update: viewpoint,
          create: viewpoint,
        });
      }

      await this.updateSyncRecord(viewpoints.length);

      logger.info(`观点同步完成: ${viewpoints.length} 条`);
      return { count: viewpoints.length };
    } catch (error: any) {
      logger.error('观点同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message };
    }
  }

  private transformRecord(record: any): ViewpointRecord {
    const fields = record.fields;
    return {
      id: record.record_id,
      content: fields['观点'] || fields['content'] || '',
      sourceArticle: fields['来源文章'] || fields['source'],
      tags: fields['标签'] || fields['tags'] || [],
      createdAt: new Date(record.created_time || Date.now()),
    };
  }

  private async updateSyncRecord(count: number, error?: string) {
    await prisma.syncRecord.create({
      data: {
        type: 'viewpoints',
        lastSyncAt: new Date(),
        recordCount: count,
        status: error ? 'failed' : 'success',
        error,
      },
    });
  }
}

export const viewpointSync = new ViewpointSyncService();
