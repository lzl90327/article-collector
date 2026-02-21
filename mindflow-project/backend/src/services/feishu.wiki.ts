import axios from 'axios';
import { feishuAuth } from './feishu.auth';
import { logger } from '../utils/logger';

class FeishuWikiService {
  private async request(method: string, url: string, data?: any) {
    const token = await feishuAuth.getAccessToken();
    try {
      const response = await axios({
        method,
        url: `https://open.feishu.cn/open-apis${url}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      if (response.data.code !== 0) {
        throw new Error(`飞书 API 错误: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error(`飞书 Wiki 请求失败: ${method} ${url}`, error);
      throw error;
    }
  }

  // 获取知识库节点列表
  async getWikiNodes(spaceId: string, parentNodeToken?: string): Promise<any[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('space_id', spaceId);
    if (parentNodeToken) queryParams.append('parent_node_token', parentNodeToken);

    const data = await this.request(
      'GET',
      `/wiki/v2/spaces/${spaceId}/nodes?${queryParams.toString()}`
    );

    return data.items || [];
  }

  // 获取文档内容
  async getDocumentContent(documentId: string): Promise<string> {
    const data = await this.request(
      'GET',
      `/docx/v1/documents/${documentId}/content`
    );
    return data.content || '';
  }

  // 获取文档元数据
  async getDocumentMeta(documentId: string): Promise<any> {
    return this.request(
      'GET',
      `/docx/v1/documents/${documentId}`
    );
  }
}

// 同步文章到 Feishu 知识库
export async function syncArticleToFeishu({
  title,
  content,
  wikiToken,
}: {
  title: string;
  content: string;
  wikiToken?: string;
}): Promise<{ wikiToken: string; url: string }> {
  // TODO: 实现 Feishu 知识库文档创建/更新逻辑
  // 这里先返回模拟数据，后续根据实际 Feishu API 实现
  
  const mockWikiToken = wikiToken || `mock_wiki_${Date.now()}`;
  const mockUrl = `https://example.feishu.cn/wiki/${mockWikiToken}`;
  
  logger.info(`文章同步到 Feishu: ${title}`, { wikiToken: mockWikiToken });
  
  return {
    wikiToken: mockWikiToken,
    url: mockUrl,
  };
}

export const feishuWiki = new FeishuWikiService();
