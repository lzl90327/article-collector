import axios from 'axios';
import { logger } from '../utils/logger';
import { feishuAuthDB } from '../lib/feishuAuth.db';

/**
 * 刷新飞书 User Access Token
 * 使用 refresh_token 获取新的 access_token
 */
export async function refreshUserAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  openId: string;
}> {
  try {
    logger.info('开始刷新 User Access Token');

    // 获取 App Access Token
    const appTokenRes = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      {
        app_id: process.env.FEISHU_APP_ID,
        app_secret: process.env.FEISHU_APP_SECRET,
      }
    );

    const appAccessToken = appTokenRes.data.app_access_token;

    // 使用 refresh_token 刷新 user_access_token
    const refreshRes = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/refresh_access_token',
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      {
        headers: {
          'Authorization': `Bearer ${appAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (refreshRes.data.code !== 0) {
      throw new Error(`刷新 token 失败: ${refreshRes.data.msg}`);
    }

    const data = refreshRes.data.data;

    logger.info('Token 刷新成功', {
      openId: data.open_id,
      expiresIn: data.expires_in,
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      refreshExpiresIn: data.refresh_expires_in,
      openId: data.open_id,
    };
  } catch (error: any) {
    logger.error('刷新 User Access Token 失败', error);
    throw error;
  }
}

/**
 * 检查并刷新用户的 Token
 * 如果 Token 即将过期或已过期，自动刷新
 */
export async function checkAndRefreshToken(userId: string): Promise<boolean> {
  try {
    const authInfo = await feishuAuthDB.findByUserId(userId);

    if (!authInfo) {
      logger.warn('用户未授权，无法刷新 token', { userId });
      return false;
    }

    // 检查是否即将过期（提前 5 分钟刷新）
    const expiresAt = new Date(authInfo.expiresAt);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
      // Token 还有效，无需刷新
      logger.info('Token 仍然有效，无需刷新', { userId });
      return true;
    }

    // Token 即将过期或已过期，需要刷新
    logger.info('Token 即将过期，开始刷新', { userId });

    const newTokenInfo = await refreshUserAccessToken(authInfo.refreshToken);

    // 更新数据库
    const newExpiresAt = new Date(Date.now() + newTokenInfo.expiresIn * 1000);
    await feishuAuthDB.update(userId, {
      accessToken: newTokenInfo.accessToken,
      refreshToken: newTokenInfo.refreshToken,
      expiresAt: newExpiresAt,
    });

    logger.info('Token 刷新并更新成功', { userId });
    return true;
  } catch (error: any) {
    logger.error('检查并刷新 Token 失败', error);
    return false;
  }
}
