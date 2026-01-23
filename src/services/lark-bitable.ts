/**
 * 飞书多维表格服务
 * 记录文章元信息
 */

import { larkClient } from './lark-client';
import { logger } from '../utils/logger';
import config from '../config';
import type { ArticleMeta } from '../types/article';

/**
 * 创建记录响应
 */
interface CreateRecordResponse {
  code: number;
  msg: string;
  data?: {
    record: {
      record_id: string;
      fields: Record<string, any>;
    };
  };
}

/**
 * 文章记录数据
 */
export interface ArticleRecord {
  /** 文章元信息 */
  meta: ArticleMeta;
  /** 飞书云文档 URL */
  docUrl: string;
  /** 收藏时间 */
  collectTime: Date;
}

/**
 * 将文章信息写入多维表格
 */
export async function createArticleRecord(
  record: ArticleRecord
): Promise<{ recordId: string }> {
  const { meta, docUrl, collectTime } = record;

  logger.info(`写入多维表格记录: ${meta.title}`);

  try {
    // 构建字段数据
    const fields: Record<string, any> = {
      [config.FIELD_TITLE]: meta.title,
      [config.FIELD_AUTHOR]: meta.author || '',
      [config.FIELD_SOURCE]: meta.source,
      [config.FIELD_SUMMARY]: meta.summary,
      [config.FIELD_DOC_URL]: {
        text: '查看文档',
        link: docUrl,
      },
      [config.FIELD_COLLECT_TIME]: collectTime.getTime(),
    };

    // 原文链接
    if (meta.originalUrl) {
      fields[config.FIELD_ORIGINAL_URL] = {
        text: '原文链接',
        link: meta.originalUrl,
      };
    }

    // 发布时间（如果有）
    if (meta.publishTime) {
      try {
        const publishDate = new Date(meta.publishTime);
        if (!isNaN(publishDate.getTime())) {
          fields[config.FIELD_PUBLISH_TIME] = publishDate.getTime();
        }
      } catch {
        // 忽略日期解析错误
      }
    }

    const response = await larkClient.post<CreateRecordResponse>(
      `/bitable/v1/apps/${config.BITABLE_APP_TOKEN}/tables/${config.BITABLE_TABLE_ID}/records`,
      { fields }
    );

    if (response.code !== 0) {
      throw new Error(`写入记录失败: ${response.msg}`);
    }

    const recordId = response.data!.record.record_id;
    logger.info(`记录写入成功: ${recordId}`);

    return { recordId };
  } catch (error) {
    logger.error('写入多维表格失败', error);
    throw error;
  }
}

/**
 * 查询文章记录（按原文链接去重）
 */
export async function findRecordByUrl(
  originalUrl: string
): Promise<{ recordId: string; fields: Record<string, any> } | null> {
  logger.debug(`查询记录: ${originalUrl}`);

  try {
    const response = await larkClient.post(
      `/bitable/v1/apps/${config.BITABLE_APP_TOKEN}/tables/${config.BITABLE_TABLE_ID}/records/search`,
      {
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: config.FIELD_ORIGINAL_URL,
              operator: 'contains',
              value: [originalUrl],
            },
          ],
        },
        page_size: 1,
      }
    );

    if (response.code !== 0) {
      logger.warn(`查询记录失败: ${response.msg}`);
      return null;
    }

    const items = response.data?.items || [];
    if (items.length === 0) {
      return null;
    }

    return {
      recordId: items[0].record_id,
      fields: items[0].fields,
    };
  } catch (error) {
    logger.warn('查询记录失败', error);
    return null;
  }
}

/**
 * 更新文章记录
 */
export async function updateArticleRecord(
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  logger.info(`更新记录: ${recordId}`);

  try {
    const response = await larkClient.put(
      `/bitable/v1/apps/${config.BITABLE_APP_TOKEN}/tables/${config.BITABLE_TABLE_ID}/records/${recordId}`,
      { fields }
    );

    if (response.code !== 0) {
      throw new Error(`更新记录失败: ${response.msg}`);
    }

    logger.info('记录更新成功');
  } catch (error) {
    logger.error('更新记录失败', error);
    throw error;
  }
}

/**
 * 获取表格字段列表
 */
export async function getTableFields(): Promise<
  Array<{ fieldId: string; fieldName: string; type: number }>
> {
  try {
    const response = await larkClient.get(
      `/bitable/v1/apps/${config.BITABLE_APP_TOKEN}/tables/${config.BITABLE_TABLE_ID}/fields`
    );

    if (response.code !== 0) {
      throw new Error(`获取字段列表失败: ${response.msg}`);
    }

    return (response.data?.items || []).map((item: any) => ({
      fieldId: item.field_id,
      fieldName: item.field_name,
      type: item.type,
    }));
  } catch (error) {
    logger.error('获取字段列表失败', error);
    throw error;
  }
}

/**
 * 删除文章记录
 * @param recordId 记录 ID
 */
export async function deleteArticleRecord(recordId: string): Promise<void> {
  logger.info(`删除记录: ${recordId}`);

  try {
    const response = await larkClient.delete(
      `/bitable/v1/apps/${config.BITABLE_APP_TOKEN}/tables/${config.BITABLE_TABLE_ID}/records/${recordId}`
    );

    if (response.code !== 0) {
      throw new Error(`删除记录失败: ${response.msg}`);
    }

    logger.info('记录删除成功');
  } catch (error) {
    logger.error('删除记录失败', error);
    throw error;
  }
}

/**
 * 检查文章是否已存在（去重检查）
 * @param originalUrl 原文链接
 * @returns 是否存在
 */
export async function checkDuplicate(originalUrl: string): Promise<boolean> {
  try {
    const record = await findRecordByUrl(originalUrl);
    return record !== null;
  } catch (error) {
    logger.warn('去重检查失败，默认为不重复', { originalUrl });
    return false;
  }
}

/**
 * 创建或更新文章记录（根据原文链接去重）
 * @param record 文章记录
 * @returns 记录 ID
 */
export async function upsertArticleRecord(
  record: ArticleRecord
): Promise<{ recordId: string; isNew: boolean }> {
  const { meta } = record;

  // 先查找是否存在
  const existing = await findRecordByUrl(meta.originalUrl);

  if (existing) {
    // 已存在，更新记录
    logger.info(`记录已存在，执行更新: ${existing.recordId}`);

    const fields: Record<string, any> = {
      [config.FIELD_TITLE]: meta.title,
      [config.FIELD_AUTHOR]: meta.author || '',
      [config.FIELD_SOURCE]: meta.source,
      [config.FIELD_SUMMARY]: meta.summary,
      [config.FIELD_DOC_URL]: {
        text: '查看文档',
        link: record.docUrl,
      },
    };

    // 发布时间（如果有）
    if (meta.publishTime) {
      try {
        const publishDate = new Date(meta.publishTime);
        if (!isNaN(publishDate.getTime())) {
          fields[config.FIELD_PUBLISH_TIME] = publishDate.getTime();
        }
      } catch {
        // 忽略日期解析错误
      }
    }

    await updateArticleRecord(existing.recordId, fields);
    return { recordId: existing.recordId, isNew: false };
  } else {
    // 不存在，创建新记录
    const result = await createArticleRecord(record);
    return { recordId: result.recordId, isNew: true };
  }
}

/**
 * 批量创建文章记录
 * @param records 文章记录数组
 * @returns 记录 ID 数组
 */
export async function batchCreateArticleRecords(
  records: ArticleRecord[]
): Promise<{ recordIds: string[] }> {
  logger.info(`批量写入 ${records.length} 条记录`);

  try {
    const recordsData = records.map((record) => {
      const { meta, docUrl, collectTime } = record;

      const fields: Record<string, any> = {
        [config.FIELD_TITLE]: meta.title,
        [config.FIELD_AUTHOR]: meta.author || '',
        [config.FIELD_SOURCE]: meta.source,
        [config.FIELD_SUMMARY]: meta.summary,
        [config.FIELD_DOC_URL]: {
          text: '查看文档',
          link: docUrl,
        },
        [config.FIELD_COLLECT_TIME]: collectTime.getTime(),
      };

      // 原文链接
      if (meta.originalUrl) {
        fields[config.FIELD_ORIGINAL_URL] = {
          text: '原文链接',
          link: meta.originalUrl,
        };
      }

      // 发布时间（如果有）
      if (meta.publishTime) {
        try {
          const publishDate = new Date(meta.publishTime);
          if (!isNaN(publishDate.getTime())) {
            fields[config.FIELD_PUBLISH_TIME] = publishDate.getTime();
          }
        } catch {
          // 忽略日期解析错误
        }
      }

      return { fields };
    });

    const response = await larkClient.post(
      `/bitable/v1/apps/${config.BITABLE_APP_TOKEN}/tables/${config.BITABLE_TABLE_ID}/records/batch_create`,
      { records: recordsData }
    );

    if (response.code !== 0) {
      throw new Error(`批量写入记录失败: ${response.msg}`);
    }

    const recordIds = (response.data?.records || []).map(
      (r: any) => r.record_id
    );
    logger.info(`批量写入成功，共 ${recordIds.length} 条记录`);

    return { recordIds };
  } catch (error) {
    logger.error('批量写入多维表格失败', error);
    throw error;
  }
}
