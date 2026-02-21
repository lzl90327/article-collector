/**
 * 第三方集成 API
 * Phase2: 飞书、微信等
 */

import { request } from './index';
import Taro from '@tarojs/taro';

/**
 * 获取飞书授权 URL
 */
export async function getFeishuAuthUrl(): Promise<string> {
  const response = await request<{ authUrl: string }>('/integrations/feishu/auth-url');
  return response.authUrl;
}

/**
 * 获取飞书连接状态
 */
export async function getFeishuStatus(): Promise<{
  connected: boolean;
  status: string;
  name: string | null;
  updatedAt: string | null;
}> {
  const response = await request<{
    connected: boolean;
    status: string;
    name: string | null;
    updatedAt: string | null;
  }>('/integrations/feishu/status');
  return response;
}

/**
 * 获取 Bitable 列表
 */
export async function getBitableList(): Promise<
  Array<{
    app_token: string;
    name: string;
    tables: Array<{
      table_id: string;
      name: string;
    }>;
  }>
> {
  const response = await request<{ bitables: any[] }>('/integrations/feishu/bitable');
  return response.bitables;
}

/**
 * 同步 Session 到 Bitable
 */
export async function syncToBitable(
  sessionId: string,
  target: {
    appToken: string;
    tableId: string;
  }
): Promise<{ recordId: string }> {
  const response = await request<{ recordId: string }>(
    `/integrations/feishu/sync/${sessionId}`,
    {
      method: 'POST',
      data: target,
    }
  );
  return response;
}

/**
 * 断开飞书连接
 */
export async function disconnectFeishu(): Promise<{ disconnected: boolean }> {
  const response = await request<{ disconnected: boolean }>('/integrations/feishu', {
    method: 'DELETE',
  });
  return response;
}

/**
 * 获取所有集成列表
 */
export async function listIntegrations(): Promise<
  Array<{
    id: string;
    provider: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>
> {
  const response = await request<{ integrations: any[] }>('/integrations');
  return response.integrations;
}

/**
 * 微信小程序登录
 */
export async function wechatLogin(code: string): Promise<{ connected: boolean; openid: string }> {
  const response = await request<{ connected: boolean; openid: string }>(
    '/integrations/wechat/login',
    {
      method: 'POST',
      data: { code },
    }
  );
  return response;
}

/**
 * 获取微信连接状态
 */
export async function getWechatStatus(): Promise<{
  connected: boolean;
  status: string;
  name: string | null;
  updatedAt: string | null;
}> {
  const response = await request<{
    connected: boolean;
    status: string;
    name: string | null;
    updatedAt: string | null;
  }>('/integrations/wechat/status');
  return response;
}

/**
 * 断开微信连接
 */
export async function disconnectWechat(): Promise<{ disconnected: boolean }> {
  const response = await request<{ disconnected: boolean }>('/integrations/wechat', {
    method: 'DELETE',
  });
  return response;
}

/**
 * 微信登录（封装Taro API）
 */
export async function loginWithWechat(): Promise<void> {
  try {
    const { code } = await Taro.login();
    await wechatLogin(code);
  } catch (error) {
    console.error('WeChat login failed:', error);
    throw error;
  }
}
