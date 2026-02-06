import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * 快速摘要生成服务
 * 使用 DeepSeek V3 生成 3 秒内的即时摘要
 */
export class QuickSummaryService {
  private readonly apiKey: string;
  private readonly apiUrl: string = 'https://api.deepseek.com/v1/chat/completions';

  constructor() {
    this.apiKey = config.DEEPSEEK_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('DEEPSEEK_API_KEY 未配置，快速摘要功能将降级');
    }
  }

  /**
   * 生成快速摘要（30-50 字）
   */
  async generateQuickSummary(title: string, content: string): Promise<string> {
    try {
      const startTime = Date.now();

      // 截取内容前 3000 字（约 2000 tokens），确保快速响应
      const truncatedContent = content.substring(0, 3000);

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的内容摘要助手。你的任务是将文章核心观点提炼成 30-50 字的精简摘要，要求：\n' +
                '1. 只提取最核心的 1-2 个观点\n' +
                '2. 使用简洁、准确的语言\n' +
                '3. 不要使用"本文"、"这篇文章"等指代词\n' +
                '4. 直接陈述观点，不需要修饰\n' +
                '5. 严格控制在 50 字以内',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}\n\n请生成 30-50 字的快速摘要：`,
            },
          ],
          max_tokens: 100,
          temperature: 0.3,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 5000, // 5 秒超时
        }
      );

      const summary = response.data.choices[0].message.content.trim();
      const elapsedTime = Date.now() - startTime;

      logger.info(`快速摘要生成成功`, {
        title,
        summaryLength: summary.length,
        elapsedMs: elapsedTime,
      });

      return summary;
    } catch (error) {
      logger.error('快速摘要生成失败', {
        error: error instanceof Error ? error.message : String(error),
        title,
      });

      // 降级：返回标题或内容前 50 字
      if (title.length <= 50) {
        return title;
      }
      return content.substring(0, 50) + '...';
    }
  }

  /**
   * 生成智能标签（2-4 个）
   */
  async generateTags(title: string, content: string): Promise<string[]> {
    try {
      const truncatedContent = content.substring(0, 3000);

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的内容标签生成助手。根据文章内容，从以下标签中选择 2-4 个最相关的标签：\n' +
                'AI, 产品, 技术, 管理, 思考, 认知工具, 创业, 职场, 生活, 写作\n' +
                '要求：\n' +
                '1. 只返回标签，用逗号分隔\n' +
                '2. 严格从上述标签中选择\n' +
                '3. 选择 2-4 个最相关的标签',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}\n\n请生成标签：`,
            },
          ],
          max_tokens: 50,
          temperature: 0.3,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 3000,
        }
      );

      const tagsString = response.data.choices[0].message.content.trim();
      const tags = tagsString
        .split(/[,，、]/)
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0)
        .slice(0, 4);

      logger.info(`智能标签生成成功`, {
        title,
        tags,
      });

      return tags;
    } catch (error) {
      logger.error('智能标签生成失败', {
        error: error instanceof Error ? error.message : String(error),
        title,
      });

      // 降级：返回空数组
      return [];
    }
  }

  /**
   * 生成内容分类（单选）
   */
  async generateCategory(title: string, content: string): Promise<string> {
    try {
      const truncatedContent = content.substring(0, 3000);

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的内容分类助手。根据文章内容，从以下分类中选择一个最相关的分类：\n' +
                '技术, 产品, 管理, 思考, 生活\n' +
                '要求：\n' +
                '1. 只返回一个分类名称\n' +
                '2. 严格从上述分类中选择',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}\n\n请选择分类：`,
            },
          ],
          max_tokens: 10,
          temperature: 0.2,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 3000,
        }
      );

      const category = response.data.choices[0].message.content.trim();

      logger.info(`内容分类生成成功`, {
        title,
        category,
      });

      return category;
    } catch (error) {
      logger.error('内容分类生成失败', {
        error: error instanceof Error ? error.message : String(error),
        title,
      });

      // 降级：返回"思考"
      return '思考';
    }
  }
}

// 导出单例
export const quickSummaryService = new QuickSummaryService();
