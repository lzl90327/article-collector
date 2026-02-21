/**
 * 第三方集成路由
 * Phase2: 飞书 Bitable、微信等
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import * as feishuService from '../services/feishu.service';
import * as wechatService from '../services/wechat.service';

const router: Router = Router();

// 当前用户ID（简化版，实际应从JWT获取）
const getCurrentUserId = (): string => 'user-001';

/**
 * GET /api/integrations/feishu/auth-url
 * 获取飞书授权URL
 */
router.get('/feishu/auth-url', async (req: Request, res: Response) => {
  try {
    const state = Buffer.from(JSON.stringify({
      userId: getCurrentUserId(),
      timestamp: Date.now(),
    })).toString('base64');

    const authUrl = feishuService.getAuthUrl(state);

    res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error: any) {
    logger.error('Get feishu auth url failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/integrations/feishu/callback
 * 飞书 OAuth 回调
 */
router.get('/feishu/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Authorization code is required' },
    });
  }

  try {
    // 解析 state
    let userId = getCurrentUserId();
    if (state && typeof state === 'string') {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = stateData.userId || userId;
      } catch {
        // 忽略解析错误
      }
    }

    // 交换token
    const tokenData = await feishuService.exchangeCodeForToken(code);

    // 保存集成
    await feishuService.saveIntegration(userId, tokenData);

    // 重定向到前端成功页面
    res.redirect('/pages/me/index?feishu=connected');
  } catch (error: any) {
    logger.error('Feishu callback failed:', error);
    res.redirect('/pages/me/index?feishu=error&message=' + encodeURIComponent(error.message));
  }
});

/**
 * GET /api/integrations/feishu/status
 * 获取飞书连接状态
 */
router.get('/feishu/status', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId();
    const integration = await feishuService.getIntegration(userId);

    res.json({
      success: true,
      data: {
        connected: !!integration && integration.status === 'connected',
        status: integration?.status || 'disconnected',
        name: integration?.name || null,
        updatedAt: integration?.updated_at || null,
      },
    });
  } catch (error: any) {
    logger.error('Get feishu status failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/integrations/feishu/bitable
 * 获取用户的 Bitable 列表
 */
router.get('/feishu/bitable', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId();
    const bitables = await feishuService.getBitableList(userId);

    res.json({
      success: true,
      data: { bitables },
    });
  } catch (error: any) {
    logger.error('Get bitable list failed:', error);

    if (error.message === 'FEISHU_NOT_CONNECTED') {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_CONNECTED', message: 'Feishu not connected' },
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/integrations/feishu/sync/:sessionId
 * 同步 Session 到 Bitable
 */
router.post('/feishu/sync/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { appToken, tableId } = req.body;

  if (!appToken || !tableId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAMS', message: 'appToken and tableId are required' },
    });
  }

  try {
    const userId = getCurrentUserId();

    // 获取 Session 和 Artifacts
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    const artifacts = await prisma.artifact.findMany({
      where: { session_id: sessionId },
    });

    // 同步到 Bitable
    const result = await feishuService.syncSessionToBitable(userId, session, artifacts, {
      appToken,
      tableId,
    });

    // 记录同步日志
    await prisma.syncLog.create({
      data: {
        session_id: sessionId,
        integration_id: `${userId}:feishu`,
        action: 'sync',
        target: `feishu:${appToken}/${tableId}`,
        status: result.success ? 'success' : 'fail',
        result_json: result.success ? { recordId: result.recordId } : {},
        error_message: result.error || null,
      },
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: { code: 'SYNC_FAILED', message: result.error },
      });
    }

    res.json({
      success: true,
      data: { recordId: result.recordId },
    });
  } catch (error: any) {
    logger.error('Sync to bitable failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * DELETE /api/integrations/feishu
 * 断开飞书连接
 */
router.delete('/feishu', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId();
    await feishuService.disconnectFeishu(userId);

    res.json({
      success: true,
      data: { disconnected: true },
    });
  } catch (error: any) {
    logger.error('Disconnect feishu failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/integrations
 * 获取所有集成列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const integrations = await prisma.integration.findMany({
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      data: {
        integrations: integrations.map((i: { id: string; provider: string; name: string; status: string; created_at: Date; updated_at: Date }) => ({
          id: i.id,
          provider: i.provider,
          name: i.name,
          status: i.status,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Get integrations failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/integrations/wechat/login
 * 微信小程序登录
 */
router.post('/wechat/login', async (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_CODE', message: 'WeChat code is required' },
    });
  }

  try {
    // 通过 code 换取 session
    const sessionData = await wechatService.code2Session(code);

    // 保存集成
    const userId = getCurrentUserId();
    await wechatService.saveIntegration(userId, sessionData);

    res.json({
      success: true,
      data: {
        connected: true,
        openid: sessionData.openid,
      },
    });
  } catch (error: any) {
    logger.error('WeChat login failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: error.message },
    });
  }
});

/**
 * GET /api/integrations/wechat/status
 * 获取微信连接状态
 */
router.get('/wechat/status', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId();
    const integration = await wechatService.getIntegration(userId);

    res.json({
      success: true,
      data: {
        connected: !!integration && integration.status === 'connected',
        status: integration?.status || 'disconnected',
        name: integration?.name || null,
        updatedAt: integration?.updated_at || null,
      },
    });
  } catch (error: any) {
    logger.error('Get wechat status failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * GET /api/integrations/wechat/qrcode
 * 获取小程序码
 */
router.get('/wechat/qrcode', async (req: Request, res: Response) => {
  const { scene, page } = req.query;

  if (!scene || typeof scene !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_SCENE', message: 'Scene is required' },
    });
  }

  try {
    const buffer = await wechatService.getWXACode(
      scene,
      typeof page === 'string' ? page : undefined
    );

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Get wechat qrcode failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * DELETE /api/integrations/wechat
 * 断开微信连接
 */
router.delete('/wechat', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId();
    await wechatService.disconnectWechat(userId);

    res.json({
      success: true,
      data: { disconnected: true },
    });
  } catch (error: any) {
    logger.error('Disconnect wechat failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export default router;
