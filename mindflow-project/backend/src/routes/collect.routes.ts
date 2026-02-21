/**
 * 素材收集路由 - 飞书对接
 * 小程序 -> 后端 -> 飞书 OpenAPI
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import { memoryStore } from '../server.simple';
import axios from 'axios';
import NodeCache from 'node-cache';

const router: Router = Router();

// Token 缓存 (TTL: 7000秒，飞书token有效期7200秒)
const tokenCache = new NodeCache({ stdTTL: 7000 });

// 任务状态
interface CollectTask {
  taskId: string;
  url: string;
  sourceType: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  retries: number;
  feishuDocId?: string;
  feishuDocUrl?: string;
  bitableRecordId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 获取 tenant_access_token
 */
async function getTenantAccessToken(): Promise<string> {
  const cachedToken = tokenCache.get<string>('tenant_access_token');
  if (cachedToken) {
    return cachedToken;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('飞书应用凭证未配置');
  }

  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret,
      }
    );

    const { tenant_access_token, expire } = response.data;
    
    // 缓存token
    tokenCache.set('tenant_access_token', tenant_access_token, expire - 200);
    
    logger.info('获取 tenant_access_token 成功');
    return tenant_access_token;
  } catch (error: any) {
    logger.error('获取 tenant_access_token 失败', error.response?.data || error.message);
    throw new Error('获取飞书token失败');
  }
}

/**
 * URL 安全校验
 */
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // 禁止内网地址
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      return false;
    }
    
    // 只允许 http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建知识库文档
 */
async function createWikiDocument(
  token: string,
  title: string,
  content: string,
  parentNodeToken: string
): Promise<{ nodeToken: string; url: string }> {
  const spaceId = process.env.FEISHU_ARTICLE_WIKI_SPACE_ID; // 使用文章素材库作为默认
  
  if (!spaceId) {
    throw new Error('知识库 Space ID 未配置');
  }

  try {
    // 创建文档
    const createResponse = await axios.post(
      'https://open.feishu.cn/open-apis/wiki/v2/spaces/:space_id/nodes',
      {
        parent_node_token: parentNodeToken,
        node_type: 'origin', // 创建云文档
        title: title,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { space_id: spaceId },
      }
    );

    const { node_token, obj_token } = createResponse.data.data.node;
    
    // 写入文档内容
    await axios.patch(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${obj_token}/content`,
      {
        content: content,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // 构建文档URL
    const docUrl = `https://my.feishu.cn/wiki/${node_token}`;

    return { nodeToken: node_token, url: docUrl };
  } catch (error: any) {
    logger.error('创建知识库文档失败', error.response?.data || error.message);
    throw new Error('创建知识库文档失败');
  }
}

/**
 * 写入多维表格
 */
async function addBitableRecord(
  token: string,
  fields: Record<string, any>
): Promise<string> {
  const appToken = process.env.FEISHU_SOURCES_BITABLE_TOKEN;
  const tableId = process.env.FEISHU_SOURCES_TABLE_ID;

  if (!appToken || !tableId) {
    throw new Error('多维表格配置未设置');
  }

  try {
    const response = await axios.post(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      {
        fields: fields,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.data.record.record_id;
  } catch (error: any) {
    logger.error('写入多维表格失败', error.response?.data || error.message);
    throw new Error('写入多维表格失败');
  }
}

/**
 * POST /api/collect - 主接口
 */
router.post('/', async (req, res) => {
  try {
    const { url, sourceType = 'article' } = req.body;

    // 1. 参数校验
    if (!url) {
      return res.status(400).json({
        success: false,
        error: '缺少 URL 参数',
      });
    }

    // 2. URL 安全校验
    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL 不合法或禁止访问',
      });
    }

    // 3. 幂等检查 - 24小时内同一URL
    const existingTask = Array.from(memoryStore.tasks.values()).find(
      (t: CollectTask) => t.url === url && 
        new Date().getTime() - new Date(t.createdAt).getTime() < 24 * 60 * 60 * 1000
    );

    if (existingTask && existingTask.status === 'success') {
      return res.json({
        success: true,
        data: {
          taskId: existingTask.taskId,
          status: 'success',
          feishuDocUrl: existingTask.feishuDocUrl,
          bitableRecordId: existingTask.bitableRecordId,
          message: '该链接已在24小时内处理过，返回已有结果',
        },
      });
    }

    // 4. 创建任务
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: CollectTask = {
      taskId,
      url,
      sourceType,
      status: 'processing',
      retries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.tasks.set(taskId, task);

    // 5. 获取飞书 token
    const token = await getTenantAccessToken();

    // 6. 解析链接内容（简化版，实际应调用飞书机器人或爬虫）
    const title = `素材-${Date.now()}`;
    const content = `# 素材记录

**来源链接**: ${url}

**类型**: ${sourceType}

**采集时间**: ${new Date().toLocaleString()}

---

（此处为自动采集的内容，实际应通过飞书机器人或爬虫解析）
`;

    // 7. 创建知识库文档
    const parentNodeToken = ''; // 根节点
    const docResult = await createWikiDocument(token, title, content, parentNodeToken);
    task.feishuDocId = docResult.nodeToken;
    task.feishuDocUrl = docResult.url;

    // 8. 写入多维表格
    const recordId = await addBitableRecord(token, {
      '标题': title,
      '链接': url,
      '类型': sourceType,
      '知识库链接': docResult.url,
      '采集时间': new Date().toISOString(),
      '状态': '已采集',
    });
    task.bitableRecordId = recordId;

    // 9. 更新任务状态
    task.status = 'success';
    task.updatedAt = new Date();
    memoryStore.tasks.set(taskId, task);

    // 10. 返回结果
    res.json({
      success: true,
      data: {
        taskId,
        status: 'success',
        feishuDocUrl: docResult.url,
        bitableRecordId: recordId,
      },
    });

  } catch (error: any) {
    logger.error('素材收集失败', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理失败',
    });
  }
});

/**
 * GET /api/collect/:taskId - 查询任务状态
 */
router.get('/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const task = memoryStore.tasks.get(taskId) as CollectTask | undefined;

  if (!task) {
    return res.status(404).json({
      success: false,
      error: '任务不存在',
    });
  }

  res.json({
    success: true,
    data: {
      taskId: task.taskId,
      url: task.url,
      status: task.status,
      feishuDocUrl: task.feishuDocUrl,
      bitableRecordId: task.bitableRecordId,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
  });
});

export default router;
