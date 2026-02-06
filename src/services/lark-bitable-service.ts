/**
 * 通用 Bitable 服务
 * 提供统一的多维表格操作接口
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

export class LarkBitableService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * 获取访问令牌
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // 如果 token 还没过期，直接返回
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    // 获取新 token
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: config.LARK_APP_ID,
        app_secret: config.LARK_APP_SECRET,
      }
    );

    this.accessToken = response.data.tenant_access_token;
    // 提前 5 分钟过期
    this.tokenExpiry = now + (response.data.expire - 300) * 1000;

    if (!this.accessToken) {
      throw new Error('获取飞书 access token 失败');
    }

    return this.accessToken;
  }

  /**
   * 更新记录
   */
  async updateRecord(
    appToken: string,
    tableId: string,
    recordId: string,
    fields: Record<string, any>
  ): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      await axios.put(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
        {
          fields,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Bitable 记录更新成功`, {
        appToken,
        tableId,
        recordId,
      });
    } catch (error) {
      logger.error(`Bitable 记录更新失败`, {
        error: error instanceof Error ? error.message : String(error),
        appToken,
        tableId,
        recordId,
      });
      throw error;
    }
  }
}

// 导出单例
export const larkBitableService = new LarkBitableService();
