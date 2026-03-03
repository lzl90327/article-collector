import { Router } from 'express';
import axios from 'axios';
import { feishuAuthDB } from '../lib/feishuAuth.db';
import { logger } from '../utils/logger';
import { checkAndRefreshToken } from '../services/feishu.auth.refresh';

const router = Router();

/**
 * 获取知识库节点列表
 * GET /api/wiki/spaces/:spaceId/nodes
 * Query: parent_node_token (可选) - 获取指定节点下的子节点
 */
router.get('/spaces/:spaceId/nodes', async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { parent_node_token } = req.query;
    const userId = req.headers['x-user-id'] as string || 'test_user_123';
    
    logger.info('获取知识库节点', { spaceId, userId, parent_node_token });
    
    // 检查并刷新 Token（如果即将过期）
    const tokenValid = await checkAndRefreshToken(userId);
    if (!tokenValid) {
      return res.status(401).json({
        success: false,
        error: '授权已过期，请重新完成飞书授权',
      });
    }
    
    // 获取用户的 UAT（刷新后的）
    const authInfo = await feishuAuthDB.findByUserId(userId);
    
    if (!authInfo) {
      return res.status(401).json({
        success: false,
        error: '未找到用户授权信息，请先完成飞书授权',
      });
    }
    
    // 构建请求参数
    const params: any = { page_size: 50 };
    logger.info('查询参数', { parent_node_token, query: req.query });
    if (parent_node_token) {
      params.parent_node_token = parent_node_token;
    }
    
    // 使用 UAT 调用飞书 Wiki API
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
      {
        headers: {
          'Authorization': `Bearer ${authInfo.accessToken}`,
        },
        params,
      }
    );
    
    if (response.data.code === 0) {
      const nodes = response.data.data?.items || [];
      
      // 只返回标题目录
      const catalog = nodes.map((node: any) => ({
        title: node.title,
        obj_type: node.obj_type,
        node_token: node.node_token,
        obj_token: node.obj_token,
        parent_node_token: node.parent_node_token,
      }));
      
      res.json({
        success: true,
        data: {
          items: catalog,
          total: nodes.length,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: response.data.msg,
        code: response.data.code,
      });
    }
    
  } catch (error: any) {
    logger.error('获取知识库节点失败', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取文档内容
 * GET /api/wiki/nodes/:nodeToken/content
 * 
 * 注意：此接口返回文档节点信息
 * 如需获取完整文档内容，需要使用 docx API（需要额外的 docx:document:readonly 权限）
 */
router.get('/nodes/:nodeToken/content', async (req, res) => {
  try {
    const { nodeToken } = req.params;
    const userId = req.headers['x-user-id'] as string || 'test_user_123';
    
    logger.info('获取文档内容', { nodeToken, userId });
    
    // 检查并刷新 Token（如果即将过期）
    const tokenValid = await checkAndRefreshToken(userId);
    if (!tokenValid) {
      return res.status(401).json({
        success: false,
        error: '授权已过期，请重新完成飞书授权',
      });
    }
    
    // 获取用户的 UAT（刷新后的）
    const authInfo = await feishuAuthDB.findByUserId(userId);
    
    if (!authInfo) {
      return res.status(401).json({
        success: false,
        error: '未找到用户授权信息，请先完成飞书授权',
      });
    }
    
    // 使用 UAT 调用飞书 Wiki API 获取节点信息
    // 注意：Wiki API 没有直接获取文档内容的接口，需要使用 docx API
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/wiki/v2/nodes/${nodeToken}`,
      {
        headers: {
          'Authorization': `Bearer ${authInfo.accessToken}`,
        },
      }
    );
    
    if (response.data.code === 0) {
      res.json({
        success: true,
        data: {
          node: response.data.data,
          message: '文档节点信息获取成功。如需获取完整文档内容，请使用飞书 Docx API',
          docUrl: `https://my.feishu.cn/wiki/${nodeToken}`,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: response.data.msg,
        code: response.data.code,
      });
    }
    
  } catch (error: any) {
    logger.error('获取文档内容失败', error);
    
    // 如果 Wiki API 返回 404，说明该接口不存在，返回友好提示
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Wiki 节点详情 API 不可用',
        message: '飞书 Wiki API 不提供节点详情接口',
        suggestion: '如需获取文档内容，请使用飞书 Docx API 或直接访问文档链接',
        docUrl: `https://my.feishu.cn/wiki/${req.params.nodeToken}`,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
