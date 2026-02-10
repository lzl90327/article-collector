import axios from 'axios';
import { logger } from '../utils/logger';
import { llmConfig } from '../config';

/**
 * 阿里云通义千问 LLM 服务
 * 用于生成摘要、标签和分类
 */
export class QwenLLMService {
  private readonly apiKey: string;
  private readonly model: string;
  // 阿里云百炼兼容 OpenAI 协议的 endpoint
  private readonly apiUrl: string = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  constructor() {
    this.apiKey = llmConfig.apiKey;
    this.model = llmConfig.model;
    
    if (!this.apiKey) {
      logger.warn('ALIYUN_API_KEY 未配置，AI 功能将不可用');
    }
  }

  /**
   * 生成摘要
   */
  async generateSummary(title: string, content: string): Promise<string> {
    try {
      const startTime = Date.now();
      
      // Qwen 支持长文本，但为了响应速度和成本，还是限制一下
      // qwen-turbo context window 较大，可以处理较长文本
      const truncatedContent = content.length > 30000 ? content.substring(0, 30000) : content;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的内容摘要助手。你的任务是将文章核心观点提炼成摘要，要求：\n' +
                '1. 提炼核心观点和关键信息\n' +
                '2. 结构清晰，分点表述\n' +
                '3. 语言简洁准确\n' +
                '4. 控制在 300 字以内',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}\n\n请生成摘要：`,
            },
          ],
          temperature: 0.3,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000, // 30秒超时
        }
      );

      const summary = response.data.choices[0].message.content.trim();
      const elapsedTime = Date.now() - startTime;

      logger.info(`AI 摘要生成成功`, {
        title,
        summaryLength: summary.length,
        elapsedMs: elapsedTime,
        model: this.model
      });

      return summary;
    } catch (error) {
      logger.error('AI 摘要生成失败', {
        error: error instanceof Error ? error.message : String(error),
        title,
      });
      return '';
    }
  }

  /**
   * 生成一句话总结
   */
  async generateOneSentenceSummary(title: string, content: string): Promise<string> {
    try {
      const truncatedContent = content.substring(0, 5000);

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '用一句话总结这篇文章的核心思想，不超过 50 字。',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}`,
            },
          ],
          temperature: 0.3,
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
      logger.warn('一句话总结生成失败', error);
      return title;
    }
  }

  /**
   * 生成思维导图 (Markdown 格式)
   */
  async generateMindMap(title: string, content: string): Promise<string> {
    try {
      const truncatedContent = content.length > 20000 ? content.substring(0, 20000) : content;

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '请为这篇文章生成一个 Markdown 格式的思维导图。使用无序列表 (- ) 表示层级。不要包含任何其他解释性文字，直接输出 Markdown 内容。',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}`,
            },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.warn('思维导图生成失败', error);
      return '';
    }
  }

  /**
   * 生成标签
   */
  async generateTags(title: string, content: string): Promise<string[]> {
    try {
      const truncatedContent = content.substring(0, 5000);

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '提取 3-5 个关键标签，用逗号分隔。不要包含其他文字。',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}`,
            },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );

      const tagsString = response.data.choices[0].message.content.trim();
      return tagsString.split(/[,，、]/).map((t: string) => t.trim()).filter((t: string) => t);
    } catch (error) {
      logger.warn('标签生成失败', error);
      return [];
    }
  }
  /**
   * 生成分类
   */
  async generateCategory(title: string, content: string): Promise<string> {
    try {
      const truncatedContent = content.substring(0, 3000);

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的内容分类助手。根据文章内容，从以下分类中选择一个最相关的分类：\n' +
                '技术, 产品, 管理, 思考, 生活, 经济, 政治, 历史, 文化, 其他\n' +
                '要求：\n' +
                '1. 只返回一个分类名称\n' +
                '2. 严格从上述分类中选择',
            },
            {
              role: 'user',
              content: `标题：${title}\n\n内容：${truncatedContent}\n\n请选择分类：`,
            },
          ],
          temperature: 0.2,
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
      logger.warn('分类生成失败', error);
      return '未分类';
    }
  }
}

export const qwenService = new QwenLLMService();