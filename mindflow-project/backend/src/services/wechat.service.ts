/**
 * 微信小程序集成服务
 * Phase2: 微信生态打通
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import type { Integration } from '@prisma/client';

// 微信小程序配置
const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
};

/**
 * 微信登录 - 通过 code 换取 session
 */
export async function code2Session(code: string): Promise<{
  openid: string;
  sessionKey: string;
  unionid?: string;
}> {
  try {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_CONFIG.appId}&secret=${WECHAT_CONFIG.appSecret}&js_code=${code}&grant_type=authorization_code`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
      throw new Error(`WeChat login error: ${data.errmsg}`);
    }

    return {
      openid: data.openid,
      sessionKey: data.session_key,
      unionid: data.unionid,
    };
  } catch (error) {
    logger.error('WeChat code2session failed:', error);
    throw error;
  }
}

/**
 * 保存或更新微信集成
 */
export async function saveIntegration(
  userId: string,
  sessionData: {
    openid: string;
    sessionKey: string;
    unionid?: string;
  }
): Promise<Integration> {
  const integration = await prisma.integration.upsert({
    where: {
      id: `${userId}:wechat`,
    },
    update: {
      credential_json: {
        openid: sessionData.openid,
        session_key: sessionData.sessionKey,
        unionid: sessionData.unionid,
      },
      status: 'connected',
      updated_at: new Date(),
    },
    create: {
      id: `${userId}:wechat`,
      provider: 'wechat_mp',
      name: '微信小程序',
      status: 'connected',
      credential_json: {
        openid: sessionData.openid,
        session_key: sessionData.sessionKey,
        unionid: sessionData.unionid,
      },
    },
  });

  return integration;
}

/**
 * 获取用户的微信集成
 */
export async function getIntegration(userId: string): Promise<Integration | null> {
  return prisma.integration.findUnique({
    where: { id: `${userId}:wechat` },
  });
}

/**
 * 解密微信加密数据
 */
export function decryptData(
  sessionKey: string,
  encryptedData: string,
  iv: string
): Record<string, any> {
  const sessionKeyBuffer = Buffer.from(sessionKey, 'base64');
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');

  const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer);
  decipher.setAutoPadding(true);

  let decoded = decipher.update(encryptedBuffer, 'binary', 'utf8');
  decoded += decipher.final('utf8');

  return JSON.parse(decoded);
}

/**
 * 获取小程序码
 */
export async function getWXACode(
  scene: string,
  page?: string
): Promise<Buffer> {
  try {
    // 先获取 access_token
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_CONFIG.appId}&secret=${WECHAT_CONFIG.appSecret}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.errcode) {
      throw new Error(`Get access_token failed: ${tokenData.errmsg}`);
    }

    // 获取小程序码
    const codeUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${tokenData.access_token}`;
    const codeRes = await fetch(codeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene,
        page,
        width: 280,
      }),
    });

    const buffer = await codeRes.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    logger.error('Get WXA code failed:', error);
    throw error;
  }
}

/**
 * 发送订阅消息
 */
export async function sendSubscribeMessage(
  openid: string,
  templateId: string,
  data: Record<string, { value: string }>,
  page?: string
): Promise<void> {
  try {
    // 获取 access_token
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_CONFIG.appId}&secret=${WECHAT_CONFIG.appSecret}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.errcode) {
      throw new Error(`Get access_token failed: ${tokenData.errmsg}`);
    }

    // 发送消息
    const msgUrl = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${tokenData.access_token}`;
    const msgRes = await fetch(msgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: openid,
        template_id: templateId,
        page,
        data,
      }),
    });

    const result = await msgRes.json();
    if (result.errcode !== 0) {
      throw new Error(`Send message failed: ${result.errmsg}`);
    }
  } catch (error) {
    logger.error('Send subscribe message failed:', error);
    throw error;
  }
}

/**
 * 断开微信连接
 */
export async function disconnectWechat(userId: string): Promise<void> {
  await prisma.integration.delete({
    where: { id: `${userId}:wechat` },
  });
}
