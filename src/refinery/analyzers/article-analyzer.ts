import axios from 'axios';
import { logger } from '../../utils/logger';
import { config } from '../../config';

/**
 * 深度分析结果
 */
export interface DeepAnalysisResult {
  keyPoints: string; // 核心要点（200-300 字）
  tags: string[]; // 智能标签（2-4 个）
  category: string; // 内容分类
  quotes: string; // 金句摘录（精选 2-3 句）
  relatedDocs: string; // 关联文档建议
}

/**
 * 文章深度分析器
 */
export class ArticleAnalyzer {
  private readonly apiKey: string;
  private readonly apiUrl: string = 'https://api.deepseek.com/v1/chat/completions';

  constructor() {
    this.apiKey = config.DEEPSEEK_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('DEEPSEEK_API_KEY 未配置，深度分析功能将失败');
    }
  }

  /**
   * 执行深度分析
   */
  async analyze(title: string, content: string, author: string): Promise<DeepAnalysisResult> {
    try {
      const startTime = Date.now();

      // 分别调用各个分析功能
      const [keyPoints, tags, category, quotes, relatedDocs] = await Promise.all([
        this.extractKeyPoints(title, content),
        this.generateTags(title, content),
        this.generateCategory(title, content),
        this.extractQuotes(content),
        this.suggestRelatedDocs(title, content),
      ]);

      const elapsedTime = Date.now() - startTime;

      logger.info(`文章深度分析完成`, {
        title,
        elapsedMs: elapsedTime,
      });

      return {
        keyPoints,
        tags,
        category,
        quotes,
        relatedDocs,
      };
    } catch (error) {
      logger.error('文章深度分析失败', {
        error: error instanceof Error ? error.message : String(error),
        title,
      });
      throw error;
    }
  }

  /**
   * 提取核心要点（200-300 字）
   */
  private async extractKeyPoints(title: string, content: string): Promise<string> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的内容分析助手。请提取文章的核心要点，要求：\n' +
                '1. 提炼 3-5 个核心观点或论据\n' +
                '2. 使用条目式结构（如：1. ...  2. ...）\n' +
                '3. 每个要点 30-60 字\n' +
                '4. 保留原文的关键信息和论证逻辑\n' +
                '5. 总字数控制在 200-300 字',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${content}\n\n请提取核心要点：`,
            },
          ],
          max_tokens: 500,
          temperature: 0.3,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 15000,
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('提取核心要点失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '分析失败';
    }
  }

  /**
   * 生成智能标签（2-4 个）
   */
  private async generateTags(title: string, content: string): Promise<string[]> {
    try {
      const truncatedContent = content.substring(0, 5000);

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
          timeout: 5000,
        }
      );

      const tagsString = response.data.choices[0].message.content.trim();
      const tags = tagsString
        .split(/[,，、]/)
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0)
        .slice(0, 4);

      return tags;
    } catch (error) {
      logger.error('生成智能标签失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 生成内容分类
   */
  private async generateCategory(title: string, content: string): Promise<string> {
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
          timeout: 5000,
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('生成内容分类失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '思考';
    }
  }

  /**
   * 提取金句（2-3 句）
   */
  private async extractQuotes(content: string): Promise<string> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的金句提取助手。请从文章中提取 2-3 句最精彩的金句，要求：\n' +
                '1. 选择最具洞察力、启发性的句子\n' +
                '2. 每句话独立成立，不依赖上下文\n' +
                '3. 用换行分隔每句话\n' +
                '4. 保持原文表述，不要修改',
            },
            {
              role: 'user',
              content: `内容：${content}\n\n请提取金句：`,
            },
          ],
          max_tokens: 300,
          temperature: 0.3,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('提取金句失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  /**
   * 推荐关联文档
   */
  private async suggestRelatedDocs(title: string, content: string): Promise<string> {
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
                '你是一个专业的知识关联助手。请基于文章内容，推荐 2-3 个相关主题或延伸阅读方向，要求：\n' +
                '1. 每个推荐用一行描述（10-20 字）\n' +
                '2. 重点关注知识关联和延伸价值\n' +
                '3. 用换行分隔每个推荐',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}\n\n请推荐关联文档：`,
            },
          ],
          max_tokens: 200,
          temperature: 0.5,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 8000,
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('推荐关联文档失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }
}

// 导出单例
export const articleAnalyzer = new ArticleAnalyzer();
