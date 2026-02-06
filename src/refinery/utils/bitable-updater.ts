import { larkBitableService } from '../../services/lark-bitable-service';
import { logger } from '../../utils/logger';
import { config, article } from '../../config';
import type { DeepAnalysisResult } from '../analyzers/article-analyzer';

/**
 * Bitable 更新工具
 */
export class BitableUpdater {
  /**
   * 更新记录的深度分析结果
   */
  async updateAnalysisResult(recordId: string, result: DeepAnalysisResult): Promise<void> {
    try {
      const fields: Record<string, string | string[]> = {
        处理状态: 'completed',
        核心要点: result.keyPoints,
        金句摘录: result.quotes,
        关联文档: result.relatedDocs,
      };

      // 智能标签和内容分类需要特殊处理
      if (result.tags.length > 0) {
        fields.智能标签 = result.tags;
      }

      if (result.category) {
        fields.内容分类 = result.category;
      }

      await larkBitableService.updateRecord(
        article.appToken,
        article.tableId,
        recordId,
        fields
      );

      logger.info(`Bitable 记录更新成功`, {
        recordId,
        fieldsUpdated: Object.keys(fields),
      });
    } catch (error) {
      logger.error(`Bitable 记录更新失败`, {
        error: error instanceof Error ? error.message : String(error),
        recordId,
      });
      throw error;
    }
  }

  /**
   * 更新处理状态为 failed
   */
  async markAsFailed(recordId: string, errorMessage: string): Promise<void> {
    try {
      await larkBitableService.updateRecord(
        article.appToken,
        article.tableId,
        recordId,
        {
          处理状态: 'failed',
          核心要点: `分析失败: ${errorMessage}`,
        }
      );

      logger.warn(`Bitable 记录标记为失败`, {
        recordId,
        errorMessage,
      });
    } catch (error) {
      logger.error(`标记失败状态时出错`, {
        error: error instanceof Error ? error.message : String(error),
        recordId,
      });
    }
  }
}

// 导出单例
export const bitableUpdater = new BitableUpdater();
