import { EventEmitter } from 'events';

export interface WeChatConfig {
  appId: string;
  appSecret: string;
  baseUrl?: string;
}

export interface WeChatArticle {
  title: string;
  content: string;
  author?: string;
  digest?: string;
  content_source_url?: string;
  thumb_media_id?: string;
  show_cover_pic?: number;
  need_open_comment?: number;
  only_fans_can_comment?: number;
}

export interface WeChatPublishResult {
  success: boolean;
  mediaId?: string;
  url?: string;
  error?: string;
}

/**
 * 微信公众号服务
 * 用于发布文章到微信公众号
 */
export class WeChatService extends EventEmitter {
  private config: WeChatConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: WeChatConfig) {
    super();
    this.config = {
      baseUrl: 'https://api.weixin.qq.com/cgi-bin',
      ...config
    };
  }

  /**
   * 获取 Access Token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(
      `${this.config.baseUrl}/token?grant_type=client_credential&appid=${this.config.appId}&secret=${this.config.appSecret}`
    );

    const data = await response.json();
    if (data.errcode) {
      throw new Error(`WeChat auth error: ${data.errmsg}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken!;
  }

  /**
   * 发送 API 请求
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.config.baseUrl}${endpoint}?access_token=${token}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();
    if (data.errcode && data.errcode !== 0) {
      throw new Error(`WeChat API error: ${data.errmsg}`);
    }

    return data;
  }

  /**
   * 上传图文消息素材
   */
  async uploadNews(articles: WeChatArticle[]): Promise<{ media_id: string }> {
    this.emit('news:uploading', { count: articles.length });

    try {
      // 转换文章格式
      const formattedArticles = articles.map(article => ({
        title: article.title,
        content: this.formatContent(article.content),
        author: article.author || 'MindFlow',
        digest: article.digest || article.content.substring(0, 100) + '...',
        content_source_url: article.content_source_url || '',
        thumb_media_id: article.thumb_media_id || '',
        show_cover_pic: article.show_cover_pic ?? 0,
        need_open_comment: article.need_open_comment ?? 0,
        only_fans_can_comment: article.only_fans_can_comment ?? 0
      }));

      const result = await this.request('/material/add_news', {
        method: 'POST',
        body: JSON.stringify({ articles: formattedArticles })
      });

      this.emit('news:uploaded', { mediaId: result.media_id });
      return { media_id: result.media_id };
    } catch (error) {
      this.emit('news:error', { error });
      throw error;
    }
  }

  /**
   * 发布图文消息
   */
  async publishNews(mediaId: string): Promise<{ publish_id: string }> {
    this.emit('news:publishing', { mediaId });

    try {
      const result = await this.request('/freepublish/submit', {
        method: 'POST',
        body: JSON.stringify({ media_id: mediaId })
      });

      this.emit('news:published', { publishId: result.publish_id });
      return { publish_id: result.publish_id };
    } catch (error) {
      this.emit('news:error', { error });
      throw error;
    }
  }

  /**
   * 发布草稿（预览）
   */
  async addDraft(articles: WeChatArticle[]): Promise<{ media_id: string }> {
    this.emit('draft:creating', { count: articles.length });

    try {
      const formattedArticles = articles.map(article => ({
        title: article.title,
        content: this.formatContent(article.content),
        author: article.author || 'MindFlow',
        digest: article.digest || article.content.substring(0, 100) + '...',
        content_source_url: article.content_source_url || '',
        thumb_media_id: article.thumb_media_id || '',
        show_cover_pic: article.show_cover_pic ?? 0,
        need_open_comment: article.need_open_comment ?? 0,
        only_fans_can_comment: article.only_fans_can_comment ?? 0
      }));

      const result = await this.request('/draft/add', {
        method: 'POST',
        body: JSON.stringify({ articles: formattedArticles })
      });

      this.emit('draft:created', { mediaId: result.media_id });
      return { media_id: result.media_id };
    } catch (error) {
      this.emit('draft:error', { error });
      throw error;
    }
  }

  /**
   * 发布文章（完整流程）
   */
  async publishArticle(
    title: string,
    content: string,
    options?: {
      author?: string;
      digest?: string;
      thumbMediaId?: string;
    }
  ): Promise<WeChatPublishResult> {
    this.emit('publish:starting', { title });

    try {
      // 创建草稿
      const draftResult = await this.addDraft([{
        title,
        content,
        author: options?.author,
        digest: options?.digest,
        thumb_media_id: options?.thumbMediaId
      }]);

      // 发布草稿
      const publishResult = await this.publishNews(draftResult.media_id);

      this.emit('publish:completed', { 
        mediaId: draftResult.media_id,
        publishId: publishResult.publish_id 
      });

      return {
        success: true,
        mediaId: draftResult.media_id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发布失败';
      this.emit('publish:error', { error, title });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 获取发布状态
   */
  async getPublishStatus(publishId: string): Promise<any> {
    try {
      return await this.request('/freepublish/get', {
        method: 'POST',
        body: JSON.stringify({ publish_id: publishId })
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 格式化内容为微信支持的 HTML
   */
  private formatContent(content: string): string {
    // 将 Markdown 转换为微信支持的 HTML
    // 这里简化处理，实际应该使用更完善的转换
    return content
      .replace(/\n/g, '<br>')
      .replace(/#{1,6} (.+)/g, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/- (.+)/g, '<p>• $1</p>');
  }
}
