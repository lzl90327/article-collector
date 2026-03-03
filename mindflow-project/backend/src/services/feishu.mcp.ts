import axios from 'axios';
import { logger } from '../utils/logger';

const MCP_ENDPOINT = 'https://mcp.feishu.cn/mcp';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

class FeishuMCPService {
  private requestId = 0;

  /**
   * 调用 MCP 工具
   */
  async callTool(
    token: string,
    toolName: string,
    args: Record<string, any>,
    allowedTools: string[] = []
  ): Promise<any> {
    const tools = allowedTools.length > 0 ? allowedTools : [toolName];
    
    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: ++this.requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      };

      logger.info(`调用 MCP 工具: ${toolName}`, { args });

      const response = await axios.post<MCPResponse>(
        MCP_ENDPOINT,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Lark-MCP-TAT': token,
            'X-Lark-MCP-Allowed-Tools': tools.join(','),
          },
        }
      );

      if (response.data.error) {
        throw new Error(`MCP 错误: ${response.data.error.message} (code: ${response.data.error.code})`);
      }

      const result = response.data.result;
      
      // 检查工具执行错误
      if (result?.isError) {
        const errorText = result.content?.[0]?.text;
        throw new Error(`工具执行失败: ${errorText}`);
      }

      logger.info(`MCP 工具调用成功: ${toolName}`);
      return result;
    } catch (error: any) {
      logger.error(`MCP 工具调用失败: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * 列出可用工具
   */
  async listTools(token: string, allowedTools: string[]): Promise<any[]> {
    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: ++this.requestId,
        method: 'tools/list',
      };

      const response = await axios.post<MCPResponse>(
        MCP_ENDPOINT,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Lark-MCP-TAT': token,
            'X-Lark-MCP-Allowed-Tools': allowedTools.join(','),
          },
        }
      );

      if (response.data.error) {
        throw new Error(`MCP 错误: ${response.data.error.message}`);
      }

      return response.data.result?.tools || [];
    } catch (error: any) {
      logger.error('获取 MCP 工具列表失败', error);
      throw error;
    }
  }

  /**
   * 初始化 MCP 连接
   */
  async initialize(token: string): Promise<any> {
    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: ++this.requestId,
        method: 'initialize',
      };

      const response = await axios.post<MCPResponse>(
        MCP_ENDPOINT,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Lark-MCP-TAT': token,
          },
        }
      );

      if (response.data.error) {
        throw new Error(`MCP 初始化失败: ${response.data.error.message}`);
      }

      logger.info('MCP 连接初始化成功');
      return response.data.result;
    } catch (error: any) {
      logger.error('MCP 初始化失败', error);
      throw error;
    }
  }

  // ==================== 文档操作工具 ====================

  /**
   * 创建文档
   */
  async createDocument(
    token: string,
    params: {
      title: string;
      content?: string;
      folderToken?: string;
    }
  ): Promise<{ docToken: string; url: string }> {
    const result = await this.callTool(token, 'create-doc', {
      title: params.title,
      content: params.content || '',
      folder_token: params.folderToken,
    }, ['create-doc']);

    const content = result?.content?.[0]?.text;
    const data = JSON.parse(content);

    return {
      docToken: data.doc_id,
      url: data.doc_url,
    };
  }

  /**
   * 获取文档内容
   */
  async fetchDocument(
    token: string,
    docId: string
  ): Promise<{ title: string; content: string }> {
    const result = await this.callTool(token, 'fetch-doc', {
      docID: docId,
    }, ['fetch-doc']);

    const content = result?.content?.[0]?.text;
    const data = JSON.parse(content);

    return {
      title: data.title,
      content: data.markdown || data.content,
    };
  }

  /**
   * 更新文档
   */
  async updateDocument(
    token: string,
    params: {
      docId: string;
      content: string;
      mode?: 'overwrite' | 'append' | 'replace_range' | 'replace_all' | 'insert_after' | 'delete_range';
    }
  ): Promise<void> {
    await this.callTool(token, 'update-doc', {
      docID: params.docId,
      markdown: params.content,
      mode: params.mode || 'append',
    }, ['update-doc']);
  }

  /**
   * 获取文档列表
   * @param token - Access Token (TAT 或 UAT)
   * @param folderToken - 文件夹 token，或使用 'my_library' 获取我的文档库
   * @param pageSize - 分页大小
   */
  async listDocuments(
    token: string,
    folderToken?: string,
    pageSize: number = 50
  ): Promise<Array<{ title: string; docId: string; url: string }>> {
    // 构建参数
    const args: any = { page_size: pageSize };
    
    if (folderToken === 'my_library') {
      args.my_library = true;
    } else if (folderToken) {
      args.folder_token = folderToken;
    } else {
      // 默认获取我的文档库
      args.my_library = true;
    }

    const result = await this.callTool(token, 'list-docs', args, ['list-docs']);

    const content = result?.content?.[0]?.text;
    const data = JSON.parse(content);

    const items = data.items || data.data?.items || [];
    return items.map((item: any) => ({
      title: item.title,
      docId: item.document_id || item.doc_id,
      url: item.url,
    }));
  }

  /**
   * 搜索文档
   */
  async searchDocuments(
    token: string,
    query: string,
    pageSize: number = 20
  ): Promise<Array<{ title: string; docId: string; url: string }>> {
    const result = await this.callTool(token, 'search-doc', {
      query,
      page_size: pageSize,
    }, ['search-doc']);

    const content = result?.content?.[0]?.text;
    const data = JSON.parse(content);

    const items = data.items || data.data?.items || [];
    return items.map((item: any) => ({
      title: item.title,
      docId: item.document_id || item.doc_id,
      url: item.url,
    }));
  }
}

export const feishuMCP = new FeishuMCPService();
