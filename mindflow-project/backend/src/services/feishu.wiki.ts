import axios from 'axios';
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
      logger.info(`[FeishuWiki] 开始获取文档内容: documentId=${documentId}`);
      const token = userAccessToken || await feishuAuth.getAccessToken();
      logger.info(`[FeishuWiki] 获取到 token, 开始调用 MCP fetchDocument`);
      const doc = await feishuMCP.fetchDocument(token, documentId);
      logger.info(`[FeishuWiki] 文档获取成功: title=${doc.title}, content长度=${doc.content?.length || 0}`);
      return doc.content || '';
    } catch (error: any) {
      logger.error(`[FeishuWiki] 获取文档内容失败: documentId=${documentId}`, error);
      logger.error(`[FeishuWiki] 错误详情: ${error.message}`);
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

  /**
   * 获取指定文件夹下的子文档（使用 space_id 和 parent_node_token）
   * @param spaceId 知识库空间ID
   * @param parentNodeToken 父节点token（文件夹的node_token）
   * @param userAccessToken 用户访问令牌（可选）
   * @returns 文档列表
   */
  async getChildDocuments(
    spaceId: string,
    parentNodeToken: string,
    userAccessToken?: string
  ): Promise<{
    items: Array<{
      title: string;
      wikiToken: string;
      url: string;
      createdAt: string;
      updatedAt: string;
    }>;
    total: number;
  }> {
    try {
      const token = userAccessToken || await feishuAuth.getAccessToken(true);

      logger.info(`获取子文档: spaceId=${spaceId}, parentNodeToken=${parentNodeToken}`);

      const response = await axios.get(
        `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            parent_node_token: parentNodeToken,
            page_size: 50,
          },
        }
      );

      if (response.data.code !== 0) {
        logger.error('获取子文档失败', { code: response.data.code, msg: response.data.msg });
        return { items: [], total: 0 };
      }

      const nodes = response.data.data?.items || [];

      // 只返回文档类型的节点
      const docNodes = nodes.filter((node: any) => node.obj_type === 'docx');

      const items = docNodes.map((node: any) => {
        // 构建飞书文档 URL
        // 格式: https://xxx.feishu.cn/wiki/xxx 或 https://xxx.feishu.cn/docx/xxx
        let url = node.url || '';
        if (!url && node.node_token) {
          // 如果没有 URL，尝试构建
          url = `https://www.feishu.cn/wiki/${node.node_token}`;
        }
        
        return {
          title: node.title || '无标题',
          wikiToken: node.node_token || node.obj_token,
          url: url,
          createdAt: node.created_at || new Date().toISOString(),
          updatedAt: node.updated_at || new Date().toISOString(),
        };
      });

      logger.info(`获取到 ${items.length} 个子文档`);

      return {
        items,
        total: items.length,
      };
    } catch (error: any) {
      logger.error('获取子文档失败', error);
      return { items: [], total: 0 };
    }
  }

  /**
   * 获取知识库根节点下的所有子节点（包括文件夹和文档）
   * @param spaceId 知识库空间ID
   * @param userAccessToken 用户访问令牌（可选）
   * @returns 所有子节点
   */
  async getRootNodes(spaceId: string, userAccessToken?: string): Promise<{
    items: Array<{
      title: string;
      nodeToken: string;
      objType: string; // 'docx' | 'wiki'
      url: string;
    }>;
    total: number;
  }> {
    try {
      const token = userAccessToken || await feishuAuth.getAccessToken(true);
      
      logger.info(`获取根节点: spaceId=${spaceId}`);
      
      const response = await axios.get(
        `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            page_size: 50,
          },
        }
      );

      if (response.data.code !== 0) {
        logger.error('获取根节点失败', { code: response.data.code, msg: response.data.msg });
        return { items: [], total: 0 };
      }

      const nodes = response.data.data?.items || [];
      
      const items = nodes.map((node: any) => ({
        title: node.title || '无标题',
        nodeToken: node.node_token,
        objType: node.obj_type,
        url: node.url || '',
      }));

      // 打印所有根节点名称，用于调试
      const nodeNames = items.map((n: any) => `${n.title}(${n.objType})`).join(', ');
      logger.info(`获取到 ${items.length} 个根节点: ${nodeNames}`);
      
      return {
        items,
        total: items.length,
      };
    } catch (error: any) {
      logger.error('获取根节点失败', error);
      return { items: [], total: 0 };
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
