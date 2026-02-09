/**
 * 飞书 API 基础客户端
 * 封装认证和通用请求方法
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import config from '../config';

const LARK_API_BASE = 'https://open.feishu.cn/open-apis';

class LarkClient {
  private client: AxiosInstance;
  private accessToken: string = '';
  private tokenExpireTime: number = 0;
  private appId: string;
  private appSecret: string;
  private clientName: string;

  constructor(appId?: string, appSecret?: string, clientName?: string) {
    // 支持自定义凭证，默认使用主应用凭证
    this.appId = appId || config.LARK_APP_ID;
    this.appSecret = appSecret || config.LARK_APP_SECRET;
    this.clientName = clientName || 'default';
    
    this.client = axios.create({
      baseURL: LARK_API_BASE,
      timeout: 30000,
    });

    // 请求拦截器：自动添加 token
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // 响应拦截器：处理错误
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          logger.error('飞书 API 请求失败', {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
          });
        }
        throw error;
      }
    );
  }

  /**
   * 获取 tenant_access_token
   */
  private async getAccessToken(): Promise<string> {
    // 如果 token 未过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime - 60000) {
      return this.accessToken;
    }

    logger.debug(`获取新的 access_token (${this.clientName})`);

    try {
      const response = await axios.post(
        `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
        {
          app_id: this.appId,
          app_secret: this.appSecret,
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`获取 token 失败: ${response.data.msg}`);
      }

      this.accessToken = response.data.tenant_access_token;
      // token 有效期 2 小时，提前 1 分钟刷新
      this.tokenExpireTime = Date.now() + response.data.expire * 1000;

      logger.debug(`access_token 获取成功 (${this.clientName})`);
      return this.accessToken;
    } catch (error) {
      logger.error(`获取 access_token 失败 (${this.clientName})`, error);
      throw error;
    }
  }

  /**
   * 发送 GET 请求
   */
  async get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  /**
   * 发送 POST 请求
   */
  async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  /**
   * 发送 PUT 请求
   */
  async put<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  /**
   * 发送 DELETE 请求
   */
  async delete<T = any>(url: string): Promise<T> {
    const response = await this.client.delete(url);
    return response.data;
  }

  /**
   * 发送文本消息
   */
  async sendMessage(
    receiveId: string,
    content: string,
    receiveIdType: 'open_id' | 'chat_id' = 'open_id'
  ): Promise<void> {
    await this.post(`/im/v1/messages?receive_id_type=${receiveIdType}`, {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text: content }),
    });
  }

  /**
   * 回复消息
   */
  async replyMessage(messageId: string, content: string): Promise<void> {
    await this.post(`/im/v1/messages/${messageId}/reply`, {
      msg_type: 'text',
      content: JSON.stringify({ text: content }),
    });
  }

  /**
   * 发送交互卡片
   */
  async sendInteractiveCard(
    receiveId: string,
    card: any,
    receiveIdType: 'open_id' | 'chat_id' = 'open_id'
  ): Promise<void> {
    await this.post(`/im/v1/messages?receive_id_type=${receiveIdType}`, {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    });
  }

  /**
   * 回复交互卡片
   */
  async replyInteractiveCard(messageId: string, card: any): Promise<void> {
    await this.post(`/im/v1/messages/${messageId}/reply`, {
      msg_type: 'interactive',
      content: JSON.stringify(card),
    });
  }

  /**
   * 更新文档块（用于更新图片块的 token）
   * 
   * @param documentId 文档 ID
   * @param blockId 块 ID
   * @param updateData 更新数据
   * @returns 是否成功
   */
  async updateBlock(
    documentId: string,
    blockId: string,
    updateData: { replace_image?: { token: string } }
  ): Promise<boolean> {
    try {
      const response = await this.client.patch(
        `/docx/v1/documents/${documentId}/blocks/${blockId}`,
        updateData
      );
      
      if (response.data?.code === 0) {
        logger.debug(`块更新成功: ${blockId}`);
        return true;
      } else {
        logger.warn(`块更新失败: ${JSON.stringify(response.data)}`);
        return false;
      }
    } catch (error: any) {
      logger.error('更新块失败', {
        documentId,
        blockId,
        error: error?.response?.data || error.message,
      });
      return false;
    }
  }

  /**
   * 上传图片到飞书云文档
   * 使用云空间媒体上传 API (需要 drive:drive 或 docs:document.media:upload 权限)
   * 
   * 注意：根据飞书官方文档，parent_node 应该是 Image Block ID，而不是 Document ID
   * 
   * @param filePath 本地文件路径
   * @param parentNode Image Block ID（图片块 ID）
   * @returns file_token
   */
  async uploadImage(filePath: string, parentNode: string): Promise<string | null> {
    const fs = await import('fs');
    const path = await import('path');
    const FormData = (await import('form-data')).default;
    
    try {
      // 读取文件
      if (!fs.existsSync(filePath)) {
        logger.warn(`图片文件不存在: ${filePath}`);
        return null;
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const fileSize = fileBuffer.length;
      
      // 获取 MIME 类型
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      const mimeType = mimeTypes[ext] || 'image/jpeg';
      
      // 构建 FormData
      const form = new FormData();
      form.append('file_name', fileName);
      form.append('parent_type', 'docx_image');
      form.append('parent_node', parentNode);
      form.append('size', fileSize.toString());
      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType,
      });
      
      // 获取 access token
      const token = await this.getAccessToken();
      
      // 发送请求到云空间媒体上传 API
      const response = await axios.post(
        `${LARK_API_BASE}/drive/v1/medias/upload_all`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      
      if (response.data.code === 0 && response.data.data?.file_token) {
        logger.debug(`图片上传成功: ${fileName} -> ${response.data.data.file_token}`);
        return response.data.data.file_token;
      } else {
        logger.warn(`图片上传失败: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error: any) {
      // 详细记录错误信息
      if (error.response) {
        logger.error('上传图片失败', {
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        logger.error('上传图片异常', error);
      }
      return null;
    }
  }

  /**
   * 上传图片到飞书临时存储
   * 用于在创建文档前获取 image_key
   * 使用消息图片上传 API，适合临时图片上传
   * 
   * @param imagePath 本地图片文件路径
   * @returns image_key (可用于文档中的 TOKEN: 格式)
   */
  async uploadImageToTemp(imagePath: string): Promise<string | null> {
    try {
      const fs = await import('fs');
      const FormData = require('form-data');
      
      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        logger.warn(`图片文件不存在: ${imagePath}`);
        return null;
      }
      
      const form = new FormData();
      form.append('image_type', 'message');
      form.append('image', fs.createReadStream(imagePath));
      
      // 获取 access token
      const token = await this.getAccessToken();
      
      // 使用 axios 直接发送请求（需要自定义 headers）
      const response = await axios.post(
        `${LARK_API_BASE}/im/v1/images`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.code === 0 && response.data.data?.image_key) {
        logger.debug(`临时图片上传成功: ${response.data.data.image_key}`);
        return response.data.data.image_key;
      }
      
      logger.warn('上传临时图片失败', response.data);
      return null;
    } catch (error: any) {
      if (error.response) {
        logger.error('上传临时图片失败', {
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        logger.error('上传临时图片异常', error);
      }
      return null;
    }
  }
}

// 导出默认单例（使用主应用凭证）
export const larkClient = new LarkClient();

/**
 * 创建新的 LarkClient 实例
 * 用于需要使用不同应用凭证的场景（如 COROS）
 */
export function createLarkClient(appId: string, appSecret: string, clientName?: string): LarkClient {
  return new LarkClient(appId, appSecret, clientName || 'custom');
}
