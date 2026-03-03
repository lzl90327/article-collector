import { feishuMCP } from './feishu.mcp';
import { feishuAuth } from './feishu.auth';
import { logger } from '../utils/logger';

class FeishuWikiService {
  /**
   * 同步文章到 Feishu 知识库
   * 使用 MCP 服务创建文档
   */
  async syncArticleToFeishu({
    title,
    content,
    wikiToken,
    spaceId,
    folderToken,
    userAccessToken,
  }: {
    title: string;
    content: string;
    wikiToken?: string;
    spaceId?: string;
    folderToken?: string;
    userAccessToken?: string;
  }): Promise<{ wikiToken: string; url: string; nodeToken: string }> {
    try {
      // 获取 token
      const token = userAccessToken || await feishuAuth.getAccessToken();

      // 如果提供了 wikiToken，说明是更新现有文档
      if (wikiToken) {
        logger.info(`更新现有文档: ${title}`, { wikiToken });
        await feishuMCP.updateDocument(token, {
          docId: wikiToken,
          content,
          mode: 'append',
        });

        // 获取文档信息
        const docInfo = await feishuMCP.fetchDocument(token, wikiToken);
        return {
          wikiToken,
          nodeToken: wikiToken,
          url: docInfo.content?.match(/https:\/\/\S+/)?.[0] || '',
        };
      }

      // 创建新文档
      const result = await feishuMCP.createDocument(token, {
        title,
        content,
        folderToken,
      });

      logger.info(`文章同步到 Feishu 成功: ${title}`, { wikiToken: result.docToken });

      return {
        wikiToken: result.docToken,
        nodeToken: result.docToken,
        url: result.url,
      };
    } catch (error: any) {
      logger.error('同步文章到 Feishu 失败', error);
      throw error;
    }
  }

  /**
   * 获取知识库节点列表
   * 使用 MCP list-docs 工具
   */
  async getWikiNodes(spaceId: string, userAccessToken?: string): Promise<any[]> {
    try {
      const token = userAccessToken || await feishuAuth.getAccessToken();
      const docs = await feishuMCP.listDocuments(token, spaceId);
      
      // 转换为兼容格式
      return docs.map(doc => ({
        title: doc.title,
        obj_type: 'docx',
        node_token: doc.docId,
        obj_token: doc.docId,
        url: doc.url,
      }));
    } catch (error: any) {
      logger.error('获取知识库节点失败', error);
      throw error;
    }
  }

  /**
   * 获取文档内容
   */
  async getDocumentContent(documentId: string, userAccessToken?: string): Promise<string> {
    try {
      const token = userAccessToken || await feishuAuth.getAccessToken();
      const doc = await feishuMCP.fetchDocument(token, documentId);
      return doc.content || '';
    } catch (error: any) {
      logger.error('获取文档内容失败', error);
      throw error;
    }
  }

  /**
   * 获取文档元数据
   */
  async getDocumentMeta(documentId: string, userAccessToken?: string): Promise<any> {
    try {
      const token = userAccessToken || await feishuAuth.getAccessToken();
      const doc = await feishuMCP.fetchDocument(token, documentId);
      return {
        title: doc.title,
        content: doc.content,
      };
    } catch (error: any) {
      logger.error('获取文档元数据失败', error);
      throw error;
    }
  }

  /**
   * 创建文档
   */
  async createDocument({
    spaceId,
    folderToken,
    title,
    content,
    userAccessToken,
  }: {
    spaceId: string;
    folderToken?: string;
    title: string;
    content: string;
    userAccessToken?: string;
  }): Promise<{ wikiToken: string; url: string; nodeToken: string }> {
    try {
      const token = userAccessToken || await feishuAuth.getAccessToken();
      
      const result = await feishuMCP.createDocument(token, {
        title,
        content,
        folderToken,
      });

      logger.info(`文档创建成功: ${title}`, { docToken: result.docToken });

      return {
        wikiToken: result.docToken,
        nodeToken: result.docToken,
        url: result.url,
      };
    } catch (error: any) {
      logger.error('创建文档失败', error);
      throw error;
    }
  }

  /**
   * 搜索文档
   */
  async searchDocuments(query: string, userAccessToken?: string): Promise<any[]> {
    try {
      const token = userAccessToken || await feishuAuth.getAccessToken();
      const docs = await feishuMCP.searchDocuments(token, query);
      
      return docs.map(doc => ({
        title: doc.title,
        obj_type: 'docx',
        node_token: doc.docId,
        obj_token: doc.docId,
        url: doc.url,
      }));
    } catch (error: any) {
      logger.error('搜索文档失败', error);
      throw error;
    }
  }
}

export const feishuWiki = new FeishuWikiService();

// 保持向后兼容的导出
export async function syncArticleToFeishu(params: {
  title: string;
  content: string;
  wikiToken?: string;
  spaceId?: string;
  folderToken?: string;
  userAccessToken?: string;
}): Promise<{ wikiToken: string; url: string; nodeToken: string }> {
  return feishuWiki.syncArticleToFeishu(params);
}
