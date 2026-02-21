import axios from 'axios';
import { feishuAuth } from './feishu.auth';
import { FeishuTableRecord } from '../config/feishu';
import { logger } from '../utils/logger';

class FeishuBitableService {
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
      logger.error(`飞书请求失败: ${method} ${url}`, error);
      throw error;
    }
  }

  // 读取表格记录
  async getRecords(appToken: string, tableId: string, params?: {
    pageSize?: number;
    pageToken?: string;
    filter?: string;
  }): Promise<{ items: FeishuTableRecord[]; hasMore: boolean; pageToken?: string }> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());
    if (params?.pageToken) queryParams.append('page_token', params.pageToken);
    if (params?.filter) queryParams.append('filter', params.filter);

    const data = await this.request(
      'GET',
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records?${queryParams.toString()}`
    );

    return {
      items: data.items || [],
      hasMore: data.has_more || false,
      pageToken: data.page_token,
    };
  }

  // 创建记录
  async createRecord(appToken: string, tableId: string, fields: Record<string, any>): Promise<FeishuTableRecord> {
    return this.request(
      'POST',
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      { fields }
    );
  }
}

export const feishuBitable = new FeishuBitableService();
