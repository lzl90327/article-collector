import axios from 'axios';
import { feishuConfig } from '../config/feishu';
import { logger } from '../utils/logger';

class FeishuAuthService {
  private accessToken: string = '';
  private expireTime: number = 0;

  /**
   * 获取 Tenant Access Token (应用身份)
   * 用于服务端到服务端的调用
   */
  async getAccessToken(forceRefresh: boolean = false): Promise<string> {
    // 如果 token 还有效，直接返回
    if (!forceRefresh && this.accessToken && Date.now() < this.expireTime) {
      return this.accessToken;
    }

    try {
      // 检查配置
      if (!feishuConfig.appId || !feishuConfig.appSecret) {
        throw new Error('飞书应用配置缺失: appId 或 appSecret 为空');
      }

      logger.info('正在获取飞书 access_token', { appId: feishuConfig.appId });

      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
        {
          app_id: feishuConfig.appId,
          app_secret: feishuConfig.appSecret,
        }
      );

      logger.info('飞书 token 响应', { code: response.data.code, msg: response.data.msg });

      if (response.data.code === 0) {
        this.accessToken = response.data.app_access_token;
        // 提前 5 分钟过期
        this.expireTime = Date.now() + (response.data.expire - 300) * 1000;
        logger.info('获取飞书 access_token 成功');
        return this.accessToken;
      } else {
        throw new Error(`获取 access_token 失败: ${response.data.msg} (code: ${response.data.code})`);
      }
    } catch (error: any) {
      logger.error('获取飞书 access_token 失败', {
        error: error.message,
        response: error.response?.data,
        appId: feishuConfig.appId,
        hasSecret: !!feishuConfig.appSecret,
      });
      throw error;
    }
  }

  /**
   * 获取 User Access Token (用户身份)
   * 用于 MCP 服务调用，需要用户授权
   * 
   * 流程：
   * 1. 引导用户访问飞书授权页面
   * 2. 用户授权后，飞书会回调到我们的 redirect_uri
   * 3. 从回调中获取 code
   * 4. 用 code 换取 User Access Token
   */
  async getUserAccessToken(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expire: number;
    openId: string;
  }> {
    try {
      logger.info('正在获取 User Access Token', { appId: feishuConfig.appId });

      const response = await axios.post(
        'https://open.feishu.cn/open-apis/authen/v1/access_token',
        {
          grant_type: 'authorization_code',
          code,
          app_id: feishuConfig.appId,
          app_secret: feishuConfig.appSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code === 0) {
        const data = response.data.data;
        logger.info('获取 User Access Token 成功', { openId: data.open_id });
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expire: data.expires_in,
          openId: data.open_id,
        };
      } else {
        throw new Error(`获取 User Access Token 失败: ${response.data.msg}`);
      }
    } catch (error: any) {
      logger.error('获取 User Access Token 失败', error);
      throw error;
    }
  }

  /**
   * 构建飞书授权 URL
   * 引导用户访问此 URL 进行授权
   */
  buildAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      app_id: feishuConfig.appId,
      redirect_uri: redirectUri,
      scope: 'docx:document:readonly docx:document:create docx:document:write_only wiki:wiki:readonly',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://open.feishu.cn/open-apis/authen/v1/index?${params.toString()}`;
  }

  /**
   * 刷新 User Access Token
   */
  async refreshUserAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expire: number;
  }> {
    try {
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/authen/v1/refresh_access_token',
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }
      );

      if (response.data.code === 0) {
        const data = response.data.data;
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expire: data.expires_in,
        };
      } else {
        throw new Error(`刷新 User Access Token 失败: ${response.data.msg}`);
      }
    } catch (error: any) {
      logger.error('刷新 User Access Token 失败', error);
      throw error;
    }
  }
}

export const feishuAuth = new FeishuAuthService();
