import { EventEmitter } from 'events';

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  json_mode?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekService extends EventEmitter {
  private config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    super();
    this.config = {
      baseUrl: 'https://api.deepseek.com/v1',
      maxTokens: 4096,
      ...config
    };
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.emit('request:start', { model: request.model || this.config.model });

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: request.model || this.config.model,
          messages: request.messages,
          temperature: request.temperature ?? this.config.temperature,
          max_tokens: request.max_tokens ?? this.config.maxTokens,
          stream: request.stream ?? false,
          response_format: request.json_mode ? { type: 'json_object' } : undefined
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API error: ${error}`);
      }

      const data = await response.json();
      
      this.emit('request:complete', {
        model: request.model || this.config.model,
        usage: data.usage
      });

      return data;
    } catch (error) {
      this.emit('request:error', { error });
      throw error;
    }
  }

  async generateDebateQuestions(topic: string, thesis: string): Promise<string[]> {
    const prompt = `作为一位批判性思考者，针对以下主题和核心主张，提出3-5个有深度的反驳或质疑问题：

主题：${topic}
核心主张：${thesis}

请提出能够挑战这个观点的问题，帮助作者完善论证。`;

    const response = await this.chatCompletion({
      messages: [
        { role: 'system', content: '你是一个善于批判性思考的专家，擅长提出有深度的问题。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8
    });

    const content = response.choices[0]?.message?.content || '';
    return content.split('\n').filter(q => q.trim().length > 0);
  }

  async searchRelevantCases(query: string): Promise<Array<{title: string; summary: string}>> {
    const prompt = `搜索与以下主题相关的案例、数据或研究：

查询：${query}

请提供3-5个相关的案例或数据，每个包含标题和简要总结。`;

    const response = await this.chatCompletion({
      messages: [
        { role: 'system', content: '你是一个研究助手，擅长查找相关案例和数据。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    // 解析响应，提取案例
    const content = response.choices[0]?.message?.content || '';
    // 简单解析，实际可能需要更复杂的解析逻辑
    return [{ title: '相关案例', summary: content }];
  }

  async generateDraft(brief: any, points: any[], angle?: any): Promise<string> {
    const prompt = `基于以下信息生成一篇文章草稿：

写作简报：
- 目标读者：${brief.target_audience}
- 核心主张：${brief.thesis}
- 证据策略：${brief.evidence_strategy}

核心要点：
${points.map((p: any) => `- ${p.content}`).join('\n')}

${angle ? `切入点：${angle.hook}` : ''}

请生成一篇结构清晰、论证有力的文章草稿。`;

    const response = await this.chatCompletion({
      messages: [
        { role: 'system', content: '你是一个专业的写作助手，擅长生成高质量的文章。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    return response.choices[0]?.message?.content || '';
  }

  async auditArticle(content: string, brief: any): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    const prompt = `请对以下文章进行深度审核，评估其与写作简报的对齐程度：

写作简报：
- 核心主张：${brief.thesis}
- 目标读者：${brief.target_audience}

文章内容：
${content}

请从以下维度评估：
1. 与Brief的对齐程度
2. 逻辑结构
3. 论据支撑
4. 可读性
5. 伦理风险

请以JSON格式返回：{
  "score": 0-100,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`;

    const response = await this.chatCompletion({
      messages: [
        { role: 'system', content: '你是一个专业的文章审核员，擅长评估文章质量。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      json_mode: true
    });

    const result = response.choices[0]?.message?.content || '{}';
    return JSON.parse(result);
  }
}
