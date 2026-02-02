/**
 * DeepSeek LLM 消息意图分类服务
 * 使用 DeepSeek API 智能判断消息类型
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// DeepSeek API 配置
const DEEPSEEK_CONFIG = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};

/**
 * 消息意图分类结果
 */
export interface MessageIntent {
  /** 意图类型 */
  type: 'idea' | 'article_with_comment' | 'article_only' | 'command' | 'unknown';
  /** 置信度 0-1 */
  confidence: number;
  /** 用户的想法内容 */
  ideaContent?: string;
  /** 文章链接 */
  articleUrl?: string;
  /** 对文章的评论 */
  articleComment?: string;
  /** 识别的情绪 */
  emotion?: string;
  /** 识别的场景 */
  scene?: string;
  /** 识别的主题标签 */
  topics?: string[];
}

/**
 * 使用 DeepSeek 分类消息意图
 */
export async function classifyMessageIntent(
  text: string,
  messageType: string = 'text',
  apiKey: string
): Promise<MessageIntent> {
  logger.info(`DeepSeek 分类: ${text.substring(0, 50)}...`);

  const prompt = `你是一个消息分类助手。请分析用户发送的消息，判断其意图类型。

用户消息：
"""
${text}
"""

消息来源：${messageType === 'audio' ? '语音转文字' : '文字输入'}

请判断这条消息属于以下哪种类型：
1. idea - 用户在记录自己的想法、感悟、灵感、日记（不包含文章链接，或虽有链接但主要是表达想法）
2. article_with_comment - 用户分享了一篇文章链接，并附带了自己的评论/想法（想法内容明显是对文章的评论）
3. article_only - 用户只分享了文章链接，没有额外评论，或只有简短的"收藏"、"存一下"等
4. command - 用户在执行命令（如 /帮助、/状态、/汇总 等以斜杠开头的）
5. unknown - 无法判断或太短无意义

判断逻辑：
- 如果消息主要是表达个人想法、感受、思考，即使提到了某篇文章，也应该是 idea
- 如果消息核心是分享链接，附带的文字是对链接内容的评论，才是 article_with_comment
- 纯链接或链接+简短指令词才是 article_only

请以 JSON 格式返回，包含以下字段：
{
  "type": "idea/article_with_comment/article_only/command/unknown",
  "confidence": 0.0-1.0,
  "ideaContent": "如果是 idea 或 article_with_comment，提取用户的想法/评论内容",
  "articleUrl": "如果包含文章链接，提取链接 URL",
  "articleComment": "如果是 article_with_comment，提取对文章的评论",
  "emotion": "从内容中识别的情绪：兴奋/焦虑/平静/困惑/释然/愤怒/其他",
  "scene": "推测的场景：通勤/读书/聊天/工作/睡前/其他",
  "topics": ["相关主题标签，从以下选择：认知工具/AI/产品/生活/职场/创业/写作/其他"]
}

只返回 JSON，不要其他内容。`;

  try {
    const response = await axios.post(
      `${DEEPSEEK_CONFIG.baseUrl}/chat/completions`,
      {
        model: DEEPSEEK_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: '你是一个精准的消息分类助手，只返回 JSON 格式的结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content || '';
    
    // 尝试解析 JSON（可能包含 markdown 代码块）
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const result = JSON.parse(jsonStr) as MessageIntent;
    logger.info(`DeepSeek 分类结果: type=${result.type}, confidence=${result.confidence}`);
    
    return result;

  } catch (error) {
    logger.error('DeepSeek 分类失败', error);
    
    // 降级处理：使用简单规则判断
    return fallbackClassify(text);
  }
}

/**
 * 降级分类（当 LLM 不可用时）
 */
function fallbackClassify(text: string): MessageIntent {
  logger.info('使用降级分类规则');

  // 检查命令
  if (text.trim().startsWith('/')) {
    return { type: 'command', confidence: 1.0 };
  }

  // 提取 URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  
  if (urls.length > 0) {
    // 计算非 URL 部分的长度
    let nonUrlText = text;
    urls.forEach(url => {
      nonUrlText = nonUrlText.replace(url, '');
    });
    nonUrlText = nonUrlText.trim();

    if (nonUrlText.length < 10) {
      return {
        type: 'article_only',
        confidence: 0.8,
        articleUrl: urls[0],
      };
    } else {
      return {
        type: 'article_with_comment',
        confidence: 0.7,
        articleUrl: urls[0],
        articleComment: nonUrlText,
        ideaContent: nonUrlText,
        emotion: '平静',
        scene: '其他',
      };
    }
  }

  // 无 URL，判断为想法
  if (text.length >= 5) {
    return {
      type: 'idea',
      confidence: 0.8,
      ideaContent: text,
      emotion: '平静',
      scene: '其他',
    };
  }

  return { type: 'unknown', confidence: 0.5 };
}
