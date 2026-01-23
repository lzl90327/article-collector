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

  constructor() {
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

    logger.debug('获取新的 access_token');

    try {
      const response = await axios.post(
        `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
        {
          app_id: config.LARK_APP_ID,
          app_secret: config.LARK_APP_SECRET,
        }
      );

      if (response.data.code !== 0) {
        throw new Error(`获取 token 失败: ${response.data.msg}`);
      }

      this.accessToken = response.data.tenant_access_token;
      // token 有效期 2 小时，提前 1 分钟刷新
      this.tokenExpireTime = Date.now() + response.data.expire * 1000;

      logger.debug('access_token 获取成功');
      return this.accessToken;
    } catch (error) {
      logger.error('获取 access_token 失败', error);
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
}

// 导出单例
export const larkClient = new LarkClient();
