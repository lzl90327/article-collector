/**
 * 飞书 Bitable 集成服务
 * Phase2: 第三方集成
 */

import { Client } from '@larksuiteoapi/node-sdk';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import type { Integration, Session, Artifact } from '@prisma/client';

// 飞书应用配置
const FEISHU_CONFIG = {
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
  redirectUri: process.env.FEISHU_REDIRECT_URI || 'http://localhost:3002/api/integrations/feishu/callback',
};

// 飞书客户端
let feishuClient: Client | null = null;

/**
 * 获取飞书客户端
 */
function getClient(): Client {
  if (!feishuClient) {
    feishuClient = new Client({
      appId: FEISHU_CONFIG.appId,
      appSecret: FEISHU_CONFIG.appSecret,
    });
  }
  return feishuClient;
}

/**
 * 飞书 OAuth 授权 URL
 */
export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    app_id: FEISHU_CONFIG.appId,
    redirect_uri: FEISHU_CONFIG.redirectUri,
    state,
  });
  return `https://open.feishu.cn/open-apis/authen/v1/index?${params.toString()}`;
}

/**
 * 交换授权码获取 Token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  openId: string;
}> {
  try {
    const client = getClient();
    const res = await client.authen.accessToken.create({
      data: {
        grant_type: 'authorization_code',
        code,
      },
    });

    if (res.code !== 0) {
      throw new Error(`Feishu auth error: ${res.msg}`);
    }

    return {
      accessToken: res.data?.access_token || '',
      refreshToken: res.data?.refresh_token || '',
      expiresIn: res.data?.expires_in || 7200,
      openId: res.data?.open_id || '',
    };
  } catch (error) {
    logger.error('Feishu exchange code failed:', error);
    throw error;
  }
}

/**
 * 保存或更新飞书集成
 */
export async function saveIntegration(
  userId: string,
  tokenData: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    openId: string;
  }
): Promise<Integration> {
  const expiresAt = new Date(Date.now() + tokenData.expiresIn * 1000);

  const integrationId = `${userId}:feishu`;
  
  // 先尝试更新
  const existing = await prisma.integration.findUnique({
    where: { id: integrationId },
  });
  
  if (existing) {
    // 更新
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        credential_json: {
          access_token: tokenData.accessToken,
          refresh_token: tokenData.refreshToken,
          expires_at: expiresAt.toISOString(),
          open_id: tokenData.openId,
        },
        status: 'connected',
      },
    });
  } else {
    // 创建
    await prisma.integration.create({
      data: {
        id: integrationId,
        provider: 'feishu',
        name: '飞书',
        status: 'connected',
        credential_json: {
          access_token: tokenData.accessToken,
          refresh_token: tokenData.refreshToken,
          expires_at: expiresAt.toISOString(),
          open_id: tokenData.openId,
        },
      },
    });
  }
  
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  return integration;
}

/**
 * 获取用户的飞书集成
 */
export async function getIntegration(userId: string): Promise<Integration | null> {
  return prisma.integration.findUnique({
    where: { id: `${userId}:feishu` },
  });
}

/**
 * 获取有效的 Access Token
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const integration = await getIntegration(userId);
  if (!integration) {
    throw new Error('FEISHU_NOT_CONNECTED');
  }

  const credential = integration.credential_json as {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  };

  // 检查是否过期
  const expiresAt = new Date(credential.expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    // 5分钟内过期，刷新token
    return refreshAccessToken(userId, credential.refresh_token);
  }

  return credential.access_token;
}

/**
 * 刷新 Access Token
 */
async function refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
  try {
    const client = getClient();
    const res = await client.authen.accessToken.create({
      data: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
    });

    if (res.code !== 0) {
      throw new Error(`Refresh token failed: ${res.msg}`);
    }

    const tokenData = {
      accessToken: res.data?.access_token || '',
      refreshToken: res.data?.refresh_token || refreshToken,
      expiresIn: res.data?.expires_in || 7200,
      openId: res.data?.open_id || '',
    };

    await saveIntegration(userId, tokenData);
    return tokenData.accessToken;
  } catch (error) {
    logger.error('Refresh feishu token failed:', error);
    // 标记为过期
    await prisma.integration.update({
      where: { id: `${userId}:feishu` },
      data: { status: 'expired' },
    });
    throw error;
  }
}

/**
 * 获取用户的 Bitable 列表
 */
export async function getBitableList(userId: string): Promise<
  Array<{
    app_token: string;
    name: string;
    tables: Array<{
      table_id: string;
      name: string;
    }>;
  }>
> {
  const accessToken = await getValidAccessToken(userId);

  try {
    // 获取用户可访问的应用
    const client = getClient();
    const appsRes = await client.request({
      method: 'GET',
      url: '/open-apis/bitable/v1/apps',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (appsRes.code !== 0) {
      throw new Error(`Get apps failed: ${appsRes.msg}`);
    }

    const apps = appsRes.data?.items || [];
    const result = [];

    for (const app of apps) {
      // 获取每个应用的表格
      const tablesRes = await client.request({
        method: 'GET',
        url: `/open-apis/bitable/v1/apps/${app.app_token}/tables`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (tablesRes.code === 0) {
        result.push({
          app_token: app.app_token,
          name: app.name,
          tables: tablesRes.data?.items?.map((t: any) => ({
            table_id: t.table_id,
            name: t.name,
          })) || [],
        });
      }
    }

    return result;
  } catch (error) {
    logger.error('Get bitable list failed:', error);
    throw error;
  }
}

/**
 * 同步 Session 到 Bitable
 */
export async function syncSessionToBitable(
  userId: string,
  session: Session,
  artifacts: Artifact[],
  target: {
    appToken: string;
    tableId: string;
  }
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  const accessToken = await getValidAccessToken(userId);

  try {
    const client = getClient();

    // 准备数据
    const draftArtifact = artifacts.find((a) => a.kind === 'draft');
    const reviewArtifact = artifacts.find((a) => a.kind === 'review_report');

    const recordData = {
      fields: {
        标题: session.title,
        话题: (session.state_json as any)?.topic || '',
        阶段: session.phase,
        状态: session.substate,
        内容: draftArtifact?.content || '',
        审校报告: reviewArtifact?.content || '',
        创建时间: session.created_at,
        更新时间: session.updated_at,
      },
    };

    // 创建记录
    const res = await client.request({
      method: 'POST',
      url: `/open-apis/bitable/v1/apps/${target.appToken}/tables/${target.tableId}/records`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: recordData,
    });

    if (res.code !== 0) {
      throw new Error(`Create record failed: ${res.msg}`);
    }

    return {
      success: true,
      recordId: res.data?.record?.record_id,
    };
  } catch (error: any) {
    logger.error('Sync to bitable failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 断开飞书连接
 */
export async function disconnectFeishu(userId: string): Promise<void> {
  await prisma.integration.delete({
    where: { id: `${userId}:feishu` },
  });
}
