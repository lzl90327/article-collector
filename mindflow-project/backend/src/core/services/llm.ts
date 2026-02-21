import axios from 'axios';
import { logger } from '../../utils/logger';
import { LLM_PROVIDERS } from '../../config/models';
import { mindflowConfig } from '../../config';
import { ModelProvider } from '../engine/types';
import { withRetry } from '../../utils/retry';
import { AppError, ErrorCode } from '../../utils/errors';

interface LLMRequest {
  provider: ModelProvider;
  model: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export class LLMService {
  private static getApiKey(provider: ModelProvider): string | undefined {
    switch (provider) {
      case ModelProvider.DEEPSEEK:
        return mindflowConfig.llmKeys.deepseek;
      case ModelProvider.CLAUDE:
        return mindflowConfig.llmKeys.claude;
      case ModelProvider.PERPLEXITY:
        return mindflowConfig.llmKeys.perplexity;
      default:
        return undefined;
    }
  }

  static async streamChatCompletion(
    request: LLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const { provider, model, messages, temperature = 0.7, maxTokens = 2000 } = request;
    const apiKey = this.getApiKey(provider);

    if (!apiKey) {
      throw new Error(`API Key not configured for provider: ${provider}`);
    }

    if (provider !== ModelProvider.DEEPSEEK) {
      // Fallback for non-DeepSeek providers (implement streaming later for others)
      const content = await this.chatCompletion(request);
      onChunk(content);
      return content;
    }

    try {
      const response = await axios.post(
        `${LLM_PROVIDERS.DEEPSEEK.baseUrl}/chat/completions`,
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          responseType: 'stream',
          timeout: 120000 // Increase timeout to 120s for R1
        }
      );

      let fullContent = '';
      
      // Process the stream
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              
              // Handle R1's reasoning_content - stream it with special marker
              const reasoningContent = parsed.choices[0]?.delta?.reasoning_content;
              if (reasoningContent) {
                  // Stream reasoning content with [THINKING] marker
                  onChunk(`[THINKING]${reasoningContent}`);
                  continue; 
              }

              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                onChunk(content);
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      return fullContent;

    } catch (error: any) {
      logger.error(`LLM Stream Call Failed [${provider}/${model}]`, error.message);
      throw error;
    }
  }

  static async chatCompletion(request: LLMRequest): Promise<string> {
    return withRetry(
      () => this.chatCompletionInternal(request),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        onRetry: (error, attempt) => {
          logger.warn(`LLM 调用失败，第 ${attempt} 次重试`, {
            provider: request.provider,
            model: request.model,
            error: error.message
          });
        }
      }
    );
  }

  private static async chatCompletionInternal(request: LLMRequest): Promise<string> {
    const { provider, model, messages, temperature = 0.7, maxTokens = 2000, jsonMode = false } = request;
    const apiKey = this.getApiKey(provider);

    if (!apiKey) {
      throw new AppError(
        `API Key not configured for provider: ${provider}`,
        ErrorCode.CONFIG_ERROR,
        false
      );
    }

    try {
      let response;
      
      if (provider === ModelProvider.DEEPSEEK) {
        // DeepSeek API (OpenAI compatible)
        response = await axios.post(
          `${LLM_PROVIDERS.DEEPSEEK.baseUrl}/chat/completions`,
          {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            response_format: jsonMode ? { type: 'json_object' } : undefined,
            stream: false // Support streaming later
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 60000 // 60s timeout
          }
        );
        return response.data.choices[0].message.content;
      } 
      
      else if (provider === ModelProvider.CLAUDE) {
        // Anthropic API
        response = await axios.post(
          `${LLM_PROVIDERS.CLAUDE.baseUrl}/messages`,
          {
            model,
            messages, // Need to adapt format if different
            max_tokens: maxTokens,
            temperature,
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            timeout: 60000
          }
        );
        return response.data.content[0].text;
      }
      
      else if (provider === ModelProvider.PERPLEXITY) {
        // Perplexity API (OpenAI compatible)
        response = await axios.post(
          `${LLM_PROVIDERS.PERPLEXITY.baseUrl}/chat/completions`,
          {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );
        return response.data.choices[0].message.content;
      }

      throw new AppError(
        `Unsupported provider: ${provider}`,
        ErrorCode.CONFIG_ERROR,
        false
      );

    } catch (error: any) {
      logger.error(`LLM Call Failed [${provider}/${model}]`, error.response?.data || error.message);
      
      // 转换为 AppError
      if (error instanceof AppError) {
        throw error;
      }
      
      // 根据错误类型转换
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new AppError(
          '无法连接到 AI 服务',
          ErrorCode.NETWORK_ERROR,
          true,
          { provider, model, originalError: error.message }
        );
      }
      
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new AppError(
          'AI 服务响应超时',
          ErrorCode.TIMEOUT_ERROR,
          true,
          { provider, model, originalError: error.message }
        );
      }
      
      if (error.response?.status === 429) {
        throw new AppError(
          'AI 服务请求过于频繁',
          ErrorCode.LLM_RATE_LIMIT,
          true,
          { provider, model }
        );
      }
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new AppError(
          'AI 服务认证失败',
          ErrorCode.CONFIG_ERROR,
          false,
          { provider, model }
        );
      }
      
      throw new AppError(
        error.message || 'AI 服务调用失败',
        ErrorCode.LLM_ERROR,
        true,
        { provider, model, originalError: error }
      );
    }
  }
}
