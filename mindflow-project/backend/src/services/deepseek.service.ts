/**
 * DeepSeek AI 服务
 * 提供对话生成、草稿生成、文章审核等功能
 */

import { logger } from '../utils/logger';

// DeepSeek API 配置
const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
};

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 聊天完成选项
 */
export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * 聊天完成响应
 */
export interface ChatCompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 流式响应回调
 */
export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

/**
 * 生成 Brief
 */
export async function generateBrief(topic: string, context?: string): Promise<{
  thesis: string;
  targetAudience: string;
  existingBelief: string;
  changeGoal: string;
  keywords: string[];
}> {
  const prompt = `基于以下话题生成写作Brief：

话题：${topic}
${context ? `背景信息：${context}` : ''}

请生成以下内容的JSON格式：
{
  "thesis": "核心论点（一句话）",
  "targetAudience": "目标读者群体",
  "existingBelief": "读者现有认知",
  "changeGoal": "希望读者产生的改变",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`;

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个专业的写作助手，擅长生成结构化的写作Brief。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    // 解析JSON响应
    const result = JSON.parse(response.content);
    return result;
  } catch (error) {
    logger.error('Generate brief failed:', error);
    throw error;
  }
}

/**
 * 生成讨论问题
 */
export async function generateDebateQuestions(
  brief: Record<string, any>,
  count: number = 3
): Promise<Array<{
  id: string;
  question: string;
  angle: string;
}>> {
  const prompt = `基于以下Brief生成${count}个讨论角度的问题：

核心论点：${brief.thesis}
目标读者：${brief.targetAudience}
现有认知：${brief.existingBelief}
改变目标：${brief.changeGoal}

请生成JSON格式的问题列表：
[
  {
    "id": "q1",
    "question": "具体问题",
    "angle": "讨论角度说明"
  }
]`;

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个专业的写作助手，擅长从不同角度挖掘话题深度。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });

    return JSON.parse(response.content);
  } catch (error) {
    logger.error('Generate debate questions failed:', error);
    throw error;
  }
}

/**
 * 生成草稿
 */
export async function generateDraft(
  brief: Record<string, any>,
  discussions: Array<{ question: string; answer: string }>,
  callbacks?: StreamCallbacks
): Promise<string> {
  const prompt = `基于以下信息生成一篇完整的文章草稿：

【Brief】
核心论点：${brief.thesis}
目标读者：${brief.targetAudience}
现有认知：${brief.existingBelief}
改变目标：${brief.changeGoal}
关键词：${brief.keywords?.join(', ')}

【讨论记录】
${discussions.map((d, i) => `${i + 1}. ${d.question}\n${d.answer}`).join('\n\n')}

请生成一篇结构清晰、论证有力的文章，包含：
1. 引人入胜的开头
2. 清晰的论点展开
3. 有力的论证和案例
4. 令人信服的结论`;

  try {
    if (callbacks) {
      // 流式生成
      await streamChatCompletion(
        {
          messages: [
            { role: 'system', content: '你是一个专业的写作助手，擅长生成高质量的文章草稿。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          stream: true,
        },
        callbacks
      );
      return '';
    } else {
      // 非流式生成
      const response = await chatCompletion({
        messages: [
          { role: 'system', content: '你是一个专业的写作助手，擅长生成高质量的文章草稿。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });
      return response.content;
    }
  } catch (error) {
    logger.error('Generate draft failed:', error);
    throw error;
  }
}

/**
 * 生成素材摘要和观点
 * @param content 素材内容
 * @returns 摘要和观点
 */
export async function generateSourceSummary(content: string): Promise<{
  summary: string;
  viewpoints: string[];
}> {
  const prompt = `# Role
你是一位专业的内容分析师，擅长从文章中提取核心观点和关键信息。

# Task
请阅读以下文章内容，生成：
1. **摘要**（100-200字）：概括文章核心内容，突出关键洞察
2. **核心观点**（3-5个）：提炼文章的主要论点，每个观点用一句话表达

# Output Format
请按以下 JSON 格式输出，不要包含其他内容：
{
  "summary": "文章摘要...",
  "viewpoints": [
    "观点1：...",
    "观点2：...",
    "观点3：..."
  ]
}

# Article Content
${content}`;

  let responseContent = '';
  
  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个专业的内容分析师，擅长提取文章核心观点和关键信息。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 1500,
    });

    responseContent = response.content;
    
    // 解析JSON响应
    let content = responseContent;
    
    // 去除可能的 markdown 代码块标记
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.substring(7);
    } else if (content.startsWith('```')) {
      content = content.substring(3);
    }
    if (content.endsWith('```')) {
      content = content.substring(0, content.length - 3);
    }
    content = content.trim();
    
    logger.info(`[DeepSeek] 清理后的响应内容: ${content.substring(0, 100)}...`);
    
    const result = JSON.parse(content);
    return {
      summary: result.summary || '',
      viewpoints: result.viewpoints || [],
    };
  } catch (error) {
    logger.error('[DeepSeek] Generate source summary failed:', error);
    logger.error(`[DeepSeek] 原始响应内容: ${responseContent.substring(0, 200)}...`);
    throw error;
  }
}

/**
 * 审核文章
 */
export async function auditArticle(
  content: string,
  brief: Record<string, any>
): Promise<{
  score: number;
  criticisms: Array<{ point: string; suggestion: string }>;
  improvements: string[];
}> {
  const prompt = `请审核以下文章，基于Brief进行评估：

【Brief】
核心论点：${brief.thesis}
目标读者：${brief.targetAudience}
改变目标：${brief.changeGoal}

【文章内容】
${content}

请提供以下内容的JSON格式评估：
{
  "score": 85,
  "criticisms": [
    {
      "point": "问题描述",
      "suggestion": "改进建议"
    }
  ],
  "improvements": ["改进点1", "改进点2"]
}`;

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个专业的文章审核员，擅长从结构、逻辑、表达等维度评估文章质量。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    return JSON.parse(response.content);
  } catch (error) {
    logger.error('Audit article failed:', error);
    throw error;
  }
}

/**
 * 聊天完成
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  try {
    // 诊断日志：检查 API 密钥
    const apiKeyPreview = DEEPSEEK_CONFIG.apiKey 
      ? `${DEEPSEEK_CONFIG.apiKey.substring(0, 10)}...` 
      : '未设置';
    logger.info(`[DeepSeek] API 密钥: ${apiKeyPreview}`);
    logger.info(`[DeepSeek] 请求模型: ${DEEPSEEK_CONFIG.model}`);
    logger.info(`[DeepSeek] 请求消息数: ${options.messages.length}`);

    const response = await fetch(`${DEEPSEEK_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[DeepSeek] API 错误: ${response.status} ${response.statusText}, 详情: ${errorText}`);
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    logger.info(`[DeepSeek] 请求成功, 使用 tokens: ${data.usage?.total_tokens || 'unknown'}`);
    
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  } catch (error) {
    logger.error('[DeepSeek] Chat completion failed:', error);
    throw error;
  }
}

/**
 * 流式聊天完成
 */
export async function streamChatCompletion(
  options: ChatCompletionOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            callbacks.onComplete();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices[0]?.delta?.content;
            if (chunk) {
              callbacks.onChunk(chunk);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    callbacks.onComplete();
  } catch (error) {
    logger.error('Stream chat completion failed:', error);
    callbacks.onError(error as Error);
  }
}
