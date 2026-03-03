import { Router } from 'express';
import { feishuAuth } from '../services/feishu.auth';
import { feishuAuthDB } from '../lib/feishuAuth.db';
import { logger } from '../utils/logger';

const router = Router();

/**
 * 获取飞书授权 URL
 * GET /api/auth/feishu
 * 
 * 返回授权页面 URL，前端引导用户跳转
 */
router.get('/', async (req, res) => {
  try {
    const redirectUri = process.env.FEISHU_REDIRECT_URI || 'http://localhost:3000/api/auth/feishu/callback';
    const state = req.query.state as string || '';
    
    const authUrl = feishuAuth.buildAuthUrl(redirectUri, state);
    
    res.json({
      success: true,
      data: {
        authUrl,
      },
    });
  } catch (error: any) {
    logger.error('生成飞书授权 URL 失败', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 飞书授权回调
 * GET /api/auth/feishu/callback
 * 
 * 处理飞书授权回调，获取 User Access Token
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: '缺少授权 code',
      });
    }
    
    logger.info('收到飞书授权回调', { code: code.toString().substring(0, 10) + '...', state });
    
    // 用 code 换取 User Access Token
    const tokenInfo = await feishuAuth.getUserAccessToken(code as string);
    
    logger.info('获取 User Access Token 成功', { openId: tokenInfo.openId });
    
    // 计算过期时间
    const expiresAt = new Date(Date.now() + tokenInfo.expire * 1000);
    
    // 保存或更新用户的飞书授权信息
    // 注意：这里需要知道当前用户是谁
    // 实际项目中应该通过 session 或 JWT 获取当前用户 ID
    const userId = state as string || 'unknown';
    
    await feishuAuthDB.upsert(userId, {
      accessToken: tokenInfo.accessToken,
      refreshToken: tokenInfo.refreshToken,
      expiresAt,
      openId: tokenInfo.openId,
    });
    
    // 返回成功页面或重定向到前端
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>飞书授权成功</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #52c41a; font-size: 24px; margin-bottom: 20px; }
            .info { color: #666; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="success">✅ 飞书授权成功！</div>
          <div>您已成功授权 MindFlow 访问您的飞书文档。</div>
          <div class="info">可以关闭此页面，返回小程序继续使用。</div>
        </body>
      </html>
    `);
    
  } catch (error: any) {
    logger.error('飞书授权回调处理失败', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>飞书授权失败</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #f5222d; font-size: 24px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="error">❌ 飞书授权失败</div>
          <div>错误信息: ${error.message}</div>
          <div style="margin-top: 30px;">请返回小程序重试。</div>
        </body>
      </html>
    `);
  }
});

/**
 * 刷新 User Access Token
 * POST /api/auth/feishu/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少 userId',
      });
    }
    
    // 获取用户的刷新令牌
    const authInfo = await feishuAuthDB.findByUserId(userId);
    
    if (!authInfo) {
      return res.status(404).json({
        success: false,
        error: '未找到用户的飞书授权信息',
      });
    }
    
    // 刷新 token
    const newTokenInfo = await feishuAuth.refreshUserAccessToken(authInfo.refreshToken);
    
    // 更新数据库
    const expiresAt = new Date(Date.now() + newTokenInfo.expire * 1000);
    await feishuAuthDB.update(userId, {
      accessToken: newTokenInfo.accessToken,
      refreshToken: newTokenInfo.refreshToken,
      expiresAt,
    });
    
    res.json({
      success: true,
      message: 'Token 刷新成功',
    });
    
  } catch (error: any) {
    logger.error('刷新 User Access Token 失败', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取用户的飞书授权状态
 * GET /api/auth/feishu/status/:userId
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const authInfo = await feishuAuthDB.findByUserId(userId);
    
    if (!authInfo) {
      return res.json({
        success: true,
        data: {
          authorized: false,
        },
      });
    }
    
    // 检查 token 是否过期
    const isExpired = new Date() > authInfo.expiresAt;
    
    res.json({
      success: true,
      data: {
        authorized: true,
        isExpired,
        expiresAt: authInfo.expiresAt,
        openId: authInfo.openId,
      },
    });
    
  } catch (error: any) {
    logger.error('获取飞书授权状态失败', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
