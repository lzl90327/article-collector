import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router: Router = Router();

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
      return res.status(400).json({ error: '微信登录失败', detail: wxResponse.data });
    }

    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { openid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          openid,
          unionid,
        },
      });
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, openid },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    logger.error('登录失败', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 更新用户信息
router.put('/profile', async (req, res) => {
  try {
    const { userId } = req.user as any;
    const { nickname, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { nickname, avatar },
    });

    res.json({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
    });
  } catch (error) {
    logger.error('更新用户信息失败', error);
    res.status(500).json({ error: '更新失败' });
  }
});

export default router;
