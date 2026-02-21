/**
 * 简化版认证路由 - 使用内存存储
 * 用于测试阶段
 */

import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const router: Router = Router();

// 内存用户存储
const users = new Map();
let userIdCounter = 1;

// 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: '缺少 code 参数' });
    }

    // 调用微信接口换取 openid
    const wxResponse = await axios.get(
      'https://api.weixin.qq.com/sns/jscode2session',
      {
        params: {
          appid: process.env.WECHAT_APP_ID,
          secret: process.env.WECHAT_APP_SECRET,
          js_code: code,
          grant_type: 'authorization_code',
        },
      }
    );

    const { openid, unionid, session_key } = wxResponse.data;

    if (!openid) {
      logger.error('微信登录失败', wxResponse.data);
      return res.status(400).json({ error: '微信登录失败', detail: wxResponse.data });
    }

    // 查找或创建用户
    let user = Array.from(users.values()).find((u: any) => u.openid === openid);

    if (!user) {
      user = {
        id: `user_${userIdCounter++}`,
        openid,
        unionid,
        nickname: `用户${userIdCounter}`,
        avatar: '',
        createdAt: new Date(),
      };
      users.set(user.id, user);
      logger.info(`新用户创建: ${user.id}`);
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, openid },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    logger.error('登录失败', error);
    res.status(500).json({ error: '登录失败', message: error.message });
  }
});

// 获取用户信息
router.get('/profile', (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: '未登录' });
    }

    const userData = users.get(user.userId);
    if (!userData) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      id: userData.id,
      nickname: userData.nickname,
      avatar: userData.avatar,
    });
  } catch (error) {
    logger.error('获取用户信息失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

export default router;
