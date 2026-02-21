import axios from 'axios';
import { feishuConfig } from '../config/feishu';
import { logger } from '../utils/logger';

class FeishuAuthService {
  private accessToken: string = '';
  private expireTime: number = 0;

  async getAccessToken(): Promise<string> {
    // 如果 token 还有效，直接返回
    if (this.accessToken && Date.now() < this.expireTime) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
        {
          app_id: feishuConfig.appId,
          app_secret: feishuConfig.appSecret,
        }
      );

      if (response.data.code === 0) {
        this.accessToken = response.data.app_access_token;
        // 提前 5 分钟过期
        this.expireTime = Date.now() + (response.data.expire - 300) * 1000;
        return this.accessToken;
      } else {
        throw new Error(`获取 access_token 失败: ${response.data.msg}`);
      }
    } catch (error) {
      logger.error('获取飞书 access_token 失败', error);
      throw error;
    }
  }
}

export const feishuAuth = new FeishuAuthService();
