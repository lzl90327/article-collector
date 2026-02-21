import { EventEmitter } from 'events';

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  baseUrl?: string;
}

export interface FeishuDocument {
  docToken: string;
  title: string;
  url: string;
  createTime: string;
  updateTime: string;
}

export interface FeishuMaterial {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
}

export interface FeishuPublishResult {
  success: boolean;
  docToken?: string;
  url?: string;
  error?: string;
}

export class FeishuService extends EventEmitter {
  private config: FeishuConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: FeishuConfig) {
    super();
    this.config = {
      baseUrl: 'https://open.feishu.cn/open-apis',
      ...config
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(`${this.config.baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_secret: this.config.appSecret
      })
    });

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`Feishu auth error: ${data.msg}`);
    }

    this.accessToken = data.tenant_access_token;
    this.tokenExpiry = Date.now() + (data.expire - 60) * 1000;

    return this.accessToken!;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    return data.data;
  }

  async createDocument(title: string, content?: string): Promise<FeishuDocument> {
    this.emit('document:creating', { title });

    try {
      const result = await this.request('/docx/v1/documents', {
        method: 'POST',
        body: JSON.stringify({
          title,
          folder_token: '' // 可选：指定文件夹
        })
      });

      const doc: FeishuDocument = {
        docToken: result.document.document_id,
        title: result.document.title,
        url: `https://docs.feishu.cn/docx/${result.document.document_id}`,
        createTime: result.document.create_time,
        updateTime: result.document.update_time
      };

      if (content) {
        await this.updateDocument(doc.docToken, content);
      }

      this.emit('document:created', doc);
      return doc;
    } catch (error) {
      this.emit('document:error', { error, title });
      throw error;
    }
  }

  async updateDocument(docToken: string, content: string): Promise<void> {
    this.emit('document:updating', { docToken });

    try {
      // 飞书文档API需要将内容转换为特定的块格式
      // 这里简化处理，实际实现需要更复杂的转换逻辑
      await this.request(`/docx/v1/documents/${docToken}/blocks`, {
        method: 'POST',
        body: JSON.stringify({
          blocks: [
            {
              block_type: 2, // 文本块
              text: {
                elements: [
                  {
                    text_run: {
                      content: content
                    }
                  }
                ]
              }
            }
          ]
        })
      });

      this.emit('document:updated', { docToken });
    } catch (error) {
      this.emit('document:error', { error, docToken });
      throw error;
    }
  }

  async getDocument(docToken: string): Promise<FeishuDocument> {
    const result = await this.request(`/docx/v1/documents/${docToken}`);

    return {
      docToken: result.document.document_id,
      title: result.document.title,
      url: `https://docs.feishu.cn/docx/${result.document.document_id}`,
      createTime: result.document.create_time,
      updateTime: result.document.update_time
    };
  }

  async searchMaterials(query: string): Promise<FeishuMaterial[]> {
    this.emit('materials:searching', { query });

    try {
      // 模拟搜索素材库
      // 实际应该调用飞书搜索API或查询自建素材库
      const mockMaterials: FeishuMaterial[] = [
        {
          id: 'mat_1',
          title: 'AI写作实践总结',
          content: '关于AI辅助写作的实践经验...',
          tags: ['AI', '写作'],
          source: 'feishu_doc'
        },
        {
          id: 'mat_2',
          title: '效率提升方法论',
          content: '提升写作效率的实用方法...',
          tags: ['效率', '方法'],
          source: 'feishu_doc'
        }
      ];

      this.emit('materials:found', { query, count: mockMaterials.length });
      return mockMaterials;
    } catch (error) {
      this.emit('materials:error', { error, query });
      throw error;
    }
  }

  async syncToDocument(docToken: string, content: string, metadata?: any): Promise<void> {
    this.emit('sync:starting', { docToken });

    try {
      // 更新文档内容
      await this.updateDocument(docToken, content);

      // 可以添加元数据到文档的评论或属性中
      if (metadata) {
        // 添加评论或更新文档属性
        await this.request(`/docx/v1/documents/${docToken}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            content: `写作元数据：${JSON.stringify(metadata, null, 2)}`
          })
        });
      }

      this.emit('sync:completed', { docToken });
    } catch (error) {
      this.emit('sync:error', { error, docToken });
      throw error;
    }
  }

  /**
   * 发布文章到飞书文档
   * 用于 Phase 5 (Publish)
   */
  async publishArticle(
    title: string,
    content: string,
    options?: {
      folderToken?: string;
      metadata?: any;
    }
  ): Promise<FeishuPublishResult> {
    this.emit('publish:starting', { title });

    try {
      // 创建文档
      const doc = await this.createDocument(title, content);

      // 添加元数据评论
      if (options?.metadata) {
        await this.request(`/docx/v1/documents/${doc.docToken}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            content: `文章元数据：\n${JSON.stringify(options.metadata, null, 2)}`
          })
        });
      }

      this.emit('publish:completed', { doc });

      return {
        success: true,
        docToken: doc.docToken,
        url: doc.url
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
   * 获取或创建素材库文档
   */
  async getOrCreateMaterialsDoc(title: string = '写作素材库'): Promise<FeishuDocument> {
    try {
      // 尝试搜索现有文档
      // 注意：飞书API不支持直接按标题搜索，这里简化处理
      // 实际应该维护一个素材库索引
      
      // 创建新文档
      return await this.createDocument(title);
    } catch (error) {
      throw error;
    }
  }
}
