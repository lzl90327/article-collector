import axios from 'axios';
import { logger } from '../../utils/logger';
import { LLM_PROVIDERS } from '../../config/models';
import { mindflowConfig } from '../../config';
import { ModelProvider } from '../engine/types';

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

  static async chatCompletion(request: LLMRequest): Promise<string> {
    const { provider, model, messages, temperature = 0.7, maxTokens = 2000, jsonMode = false } = request;
    const apiKey = this.getApiKey(provider);

    if (!apiKey) {
      throw new Error(`API Key not configured for provider: ${provider}`);
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
            }
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
            }
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
            }
          }
        );
        return response.data.choices[0].message.content;
      }

      throw new Error(`Unsupported provider: ${provider}`);

    } catch (error: any) {
      logger.error(`LLM Call Failed [${provider}/${model}]`, error.response?.data || error.message);
      throw error;
    }
  }
}
