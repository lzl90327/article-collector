/**
 * 碎片想法多维表格服务
 * 记录用户的碎片化想法
 */

import { larkClient } from './lark-client';
import { logger } from '../utils/logger';

/**
 * 想法记录数据
 */
export interface IdeaRecord {
  /** 想法内容 */
  content: string;
  /** 输入方式 */
  inputType: '文字' | '语音';
  /** 来源场景 */
  scene?: string;
  /** 情绪标签 */
  emotion?: string;
  /** 关联素材 URL */
  relatedArticleUrl?: string;
  /** 关联素材标题 */
  relatedArticleTitle?: string;
  /** 语音时长（秒） */
  voiceDuration?: number;
  /** 主题标签 */
  topics?: string[];
  /** 成熟度 */
  maturity?: string;
  /** 记录时间 */
  recordTime: Date;
}

/**
 * 想法库配置
 */
export interface IdeasBitableConfig {
  appToken: string;
  tableId: string;
  fields: {
    content: string;
    recordTime: string;
    inputType: string;
    scene: string;
    emotion: string;
    relatedUrl: string;
    relatedTitle: string;
    voiceDuration: string;
    topics: string;
    maturity: string;
    summarized: string;
  };
}

/**
 * 创建想法记录
 */
export async function createIdeaRecord(
  idea: IdeaRecord,
  config: IdeasBitableConfig
): Promise<{ recordId: string }> {
  logger.info(`写入想法记录: ${idea.content.substring(0, 50)}...`);

  try {
    const fields: Record<string, any> = {
      [config.fields.content]: idea.content,
      [config.fields.recordTime]: idea.recordTime.getTime(),
      [config.fields.inputType]: idea.inputType,
    };

    // 可选字段
    if (idea.scene) {
      fields[config.fields.scene] = idea.scene;
    }
    if (idea.emotion) {
      fields[config.fields.emotion] = idea.emotion;
    }
    // 调试：打印关联字段的原始值
    logger.info(`====== 检查关联字段 ======`);
    logger.info(`relatedArticleUrl: "${idea.relatedArticleUrl}" (${typeof idea.relatedArticleUrl})`);
    logger.info(`relatedArticleTitle: "${idea.relatedArticleTitle}" (${typeof idea.relatedArticleTitle})`);
    logger.info(`字段名 relatedUrl: "${config.fields.relatedUrl}"`);
    logger.info(`字段名 relatedTitle: "${config.fields.relatedTitle}"`);

    if (idea.relatedArticleUrl) {
      logger.info(`设置关联URL字段: ${config.fields.relatedUrl} = ${idea.relatedArticleUrl}`);
      fields[config.fields.relatedUrl] = {
        link: idea.relatedArticleUrl,
        text: idea.relatedArticleTitle || '关联文章',
      };
    } else {
      logger.info(`跳过关联URL字段：relatedArticleUrl 为空`);
    }
    if (idea.relatedArticleTitle) {
      logger.info(`设置关联标题字段: ${config.fields.relatedTitle} = ${idea.relatedArticleTitle}`);
      fields[config.fields.relatedTitle] = idea.relatedArticleTitle;
    } else {
      logger.info(`跳过关联标题字段：relatedArticleTitle 为空`);
    }
    
    // 调试：打印最终要写入的字段
    logger.info(`最终写入字段: ${JSON.stringify(fields, null, 2)}`);
    if (idea.voiceDuration !== undefined && idea.voiceDuration > 0) {
      fields[config.fields.voiceDuration] = idea.voiceDuration;
    }
    if (idea.topics && idea.topics.length > 0) {
      fields[config.fields.topics] = idea.topics;
    }
    if (idea.maturity) {
      fields[config.fields.maturity] = idea.maturity;
    }

    const response = await larkClient.post(
      `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`,
      { fields }
    );

    if (response.code !== 0) {
      throw new Error(`写入想法记录失败: ${response.msg}`);
    }

    const recordId = response.data!.record.record_id;
    logger.info(`想法记录写入成功: ${recordId}`);

    return { recordId };

  } catch (error) {
    logger.error('写入想法记录失败', error);
    throw error;
  }
}

/**
 * 获取今日想法列表
 */
export async function getTodayIdeas(
  config: IdeasBitableConfig
): Promise<any[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const response = await larkClient.post(
      `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/search`,
      {
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: config.fields.recordTime,
              operator: 'isGreater',
              value: [today.getTime().toString()],
            },
          ],
        },
        sort: [{ field_name: config.fields.recordTime, desc: true }],
        page_size: 100,
      }
    );

    if (response.code !== 0) {
      logger.warn(`获取今日想法失败: ${response.msg}`);
      return [];
    }

    return response.data?.items || [];

  } catch (error) {
    logger.error('获取今日想法失败', error);
    return [];
  }
}

/**
 * 获取未汇总的想法列表
 */
export async function getUnsummarizedIdeas(
  config: IdeasBitableConfig,
  limit: number = 50
): Promise<any[]> {
  try {
    const response = await larkClient.post(
      `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/search`,
      {
        filter: {
          conjunction: 'or',
          conditions: [
            {
              field_name: config.fields.summarized,
              operator: 'is',
              value: ['false'],
            },
            {
              field_name: config.fields.summarized,
              operator: 'isEmpty',
              value: [],
            },
          ],
        },
        sort: [{ field_name: config.fields.recordTime, desc: true }],
        page_size: limit,
      }
    );

    if (response.code !== 0) {
      logger.warn(`获取未汇总想法失败: ${response.msg}`);
      return [];
    }

    return response.data?.items || [];

  } catch (error) {
    logger.error('获取未汇总想法失败', error);
    return [];
  }
}

/**
 * 更新想法记录的关联字段（用于有感而发回填）
 */
export async function updateIdeaRecordLink(
  recordId: string,
  articleTitle: string,
  articleUrl: string,
  config: IdeasBitableConfig
): Promise<boolean> {
  logger.info(`回填想法关联: recordId=${recordId}, title=${articleTitle}`);

  try {
    const fields: Record<string, any> = {
      [config.fields.relatedTitle]: articleTitle,
      [config.fields.relatedUrl]: {
        link: articleUrl,
        text: articleTitle,
      },
    };

    const response = await larkClient.put(
      `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`,
      { fields }
    );

    if (response.code !== 0) {
      logger.warn(`回填想法关联失败: ${response.msg}`);
      return false;
    }

    logger.info(`想法关联回填成功: ${recordId} -> ${articleTitle}`);
    return true;

  } catch (error) {
    logger.error('回填想法关联失败', error);
    return false;
  }
}

/**
 * 标记想法为已汇总
 */
export async function markIdeasAsSummarized(
  recordIds: string[],
  config: IdeasBitableConfig
): Promise<void> {
  const today = new Date();

  for (const recordId of recordIds) {
    try {
      await larkClient.put(
        `/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/${recordId}`,
        {
          fields: {
            [config.fields.summarized]: true,
            // 如果有汇总日期字段
            // [config.fields.summarizedDate]: today.getTime(),
          },
        }
      );
    } catch (error) {
      logger.warn(`标记想法 ${recordId} 为已汇总失败`, error);
    }
  }

  logger.info(`已标记 ${recordIds.length} 条想法为已汇总`);
}

/**
 * 根据成熟度判断
 */
export function determineMaturity(content: string): string {
  const length = content.length;
  if (length >= 300) {
    return '可成文📝';
  } else if (length >= 150) {
    return '半成品🔧';
  } else if (length >= 50) {
    return '萌芽🌱';
  }
  return '火花💡';
}
