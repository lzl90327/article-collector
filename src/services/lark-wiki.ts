/**
 * 飞书知识库服务
 * 将云文档添加到知识库
 */

import { larkClient, userLarkClient } from './lark-client';
import { logger } from '../utils/logger';
import config, { wikiConfig } from '../config';

/**
 * 移动文档到知识库的响应
 */
interface MoveDocsToWikiResponse {
  code: number;
  msg: string;
  data?: {
    /** 移动后的知识库节点 token */
    wiki_token?: string;
    /** 异步任务 ID（如果是异步操作） */
    task_id?: string;
    /** 是否已应用 */
    applied?: boolean;
  };
}

/**
 * 任务状态响应
 */
interface TaskStatusResponse {
  code: number;
  msg: string;
  data?: {
    task: {
      task_id: string;
      status: string; // 'pending' | 'running' | 'done' | 'failed'
      result?: {
        wiki_token?: string;
      };
    };
  };
}

/**
 * 知识库节点信息
 */
export interface WikiNode {
  space_id?: string;
  node_token?: string;
  obj_token?: string;
  obj_type?: string;
  parent_node_token?: string;
  node_type?: string;
  title?: string;
  has_child?: boolean;
}

/**
 * 添加文档到知识库的结果
 */
export interface AddToWikiResult {
  /** 知识库节点 token */
  wikiToken: string;
  /** 知识库页面 URL */
  url: string;
}

/**
 * 添加文档到知识库
 * 使用 moveDocsToWiki API 将云空间文档移动到知识库
 * 
 * @param docToken 文档 token（document_id）
 * @param parentWikiToken 父节点 wiki token（可选，不填则使用配置）
 * @returns 添加结果
 */
export async function addDocumentToWiki(
  docToken: string,
  parentWikiToken?: string
): Promise<AddToWikiResult> {
  const targetParent = parentWikiToken || config.WIKI_PARENT_NODE_TOKEN || undefined;
  
  logger.info(`添加文档到知识库: ${docToken}`, {
    spaceId: config.WIKI_SPACE_ID,
    parentWikiToken: targetParent || '(根目录)',
  });

  // 准备请求数据
  const requestData = {
    obj_type: 'docx',
    obj_token: docToken,
    parent_wiki_token: targetParent,
  };

  // 1. 优先尝试使用用户身份移动 (保留文档所有权和权限)
  try {
    logger.info('尝试使用用户身份(User Token)进行归档...');
    const response = await userLarkClient.post<MoveDocsToWikiResponse>(
      `/wiki/v2/spaces/${config.WIKI_SPACE_ID}/nodes/move_docs_to_wiki`,
      requestData
    );
    
    if (response.code === 0) {
      logger.info('✅ [用户身份] 文档归档成功');
      return handleSuccessResponse(response, targetParent);
    }
    
    logger.warn(`[用户身份] 归档失败 (code: ${response.code}, msg: ${response.msg})，尝试切换为机器人身份...`);
  } catch (error: any) {
    logger.warn(`[用户身份] 归档异常: ${error.message}，尝试切换为机器人身份...`);
  }

  // 2. 降级：使用机器人身份移动
  try {
    logger.info('尝试使用机器人身份(Tenant Token)进行归档...');
    
    logger.debug('请求数据:', JSON.stringify(requestData));
    
    const response = await larkClient.post<MoveDocsToWikiResponse>(
      `/wiki/v2/spaces/${config.WIKI_SPACE_ID}/nodes/move_docs_to_wiki`,
      requestData
    );

    logger.debug('API 响应:', JSON.stringify(response));

    if (response.code !== 0) {
      handleErrorCode(response.code, response.msg);
      throw new Error(`添加到知识库失败: ${response.msg} (code: ${response.code})`);
    }

    return handleSuccessResponse(response, targetParent);
  } catch (error) {
    logger.error('添加文档到知识库失败', error);
    throw error;
  }
}

/**
 * 处理成功响应
 */
async function handleSuccessResponse(response: MoveDocsToWikiResponse, targetParent?: string): Promise<AddToWikiResult> {
    // 从响应中获取 wiki_token
    let wikiToken = response.data?.wiki_token;
    const taskId = response.data?.task_id;
    const applied = response.data?.applied;

    logger.info('API 返回:', { wikiToken, taskId, applied });

    // 如果返回了 task_id，说明是异步操作，需要轮询获取结果
    if (taskId && !wikiToken) {
      logger.info('移动操作异步执行中，等待完成...', { taskId });
      wikiToken = await waitForTask(taskId);
    }

    if (!wikiToken) {
      logger.error('响应数据中没有 wiki_token', { response: JSON.stringify(response) });
      throw new Error('未获取到知识库节点 token');
    }

    const url = buildWikiUrl(wikiToken);
    logger.info(`文档已添加到知识库: ${url}`);

    if (targetParent) {
      try {
        // 如果文档创建时未直接放在目标节点下（例如 API 限制），则移动它
        // 注意：addDocumentToWiki 返回的 wikiToken 是已经存在于知识库的节点
        // 我们需要确保它在正确的父节点下
        
        // 简单延迟一下，确保节点元数据已同步
        await delay(1000);
        
        const node = await getWikiNode(wikiToken);
        const currentParent = node?.parent_node_token;
        
        if (currentParent !== targetParent) {
          logger.info(`父节点不匹配，正在移动节点: ${currentParent} -> ${targetParent}`);
          const moved = await moveWikiNode(wikiToken, targetParent);
          if (!moved) {
            logger.warn('节点移动失败', { currentParent, targetParent });
          } else {
            logger.info('节点已移动到指定父节点');
          }
        } else {
            logger.info('节点已在正确的位置，无需移动');
        }
      } catch (e) {
        logger.warn('校验并调整知识库父节点失败', e);
      }
    }

    return { wikiToken, url };
}

/**
 * 等待异步任务完成
 */
async function waitForTask(taskId: string): Promise<string> {
  const maxRetries = 20;  // 增加重试次数
  const retryInterval = 1500;  // 增加间隔

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await larkClient.get<TaskStatusResponse>(
        `/wiki/v2/tasks/${taskId}`,
        { task_type: 'move' }
      );

      // 打印完整响应用于调试
      logger.debug(`任务状态响应 (尝试 ${i + 1}/${maxRetries}):`, JSON.stringify(response));

      if (response.code !== 0) {
        logger.warn(`获取任务状态失败 (尝试 ${i + 1}/${maxRetries})`, {
          code: response.code,
          msg: response.msg,
        });
        await delay(retryInterval);
        continue;
      }

      const task = response.data?.task as any;
      
      // 检查 move_result 结构（飞书 API 实际返回的格式）
      const moveResult = task?.move_result?.[0];
      if (moveResult) {
        const nodeToken = moveResult.node?.node_token;
        const status = moveResult.status;
        const statusMsg = moveResult.status_msg;
        
        logger.debug('解析 move_result', { nodeToken, status, statusMsg });
        
        // status === 0 表示成功
        if (status === 0 && nodeToken) {
          logger.info(`任务成功完成，获取到 node_token: ${nodeToken}`);
          return nodeToken;
        } else if (status !== 0) {
          throw new Error(`移动任务失败: ${statusMsg || '未知错误'}`);
        }
      }
      
      // 兼容旧格式：尝试多种方式获取状态和 wiki_token
      const status = task?.status || (response.data as any)?.status;
      const wikiToken = task?.result?.wiki_token || (response.data as any)?.wiki_token || (response.data as any)?.result?.wiki_token;

      // 如果直接获取到 wikiToken，直接返回
      if (wikiToken) {
        logger.info(`获取到 wiki_token: ${wikiToken}`);
        return wikiToken;
      }

      if (status === 'done') {
        // 任务完成但没有 wiki_token，再检查一次
        logger.warn('任务状态为 done 但未找到 wiki_token，检查响应结构');
        throw new Error('任务完成但未返回 wiki_token');
      } else if (status === 'failed') {
        throw new Error('异步任务执行失败');
      }

      // 任务仍在进行中或状态未知
      logger.debug(`任务进行中 (尝试 ${i + 1}/${maxRetries})`, { status, hasTask: !!task, hasMoveResult: !!moveResult });
      await delay(retryInterval);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      logger.warn(`获取任务状态异常 (尝试 ${i + 1}/${maxRetries})`, error);
      await delay(retryInterval);
    }
  }

  throw new Error(`任务超时，已重试 ${maxRetries} 次`);
}

/**
 * 获取知识库节点信息
 * @param token 节点 token
 */
export async function getWikiNode(token: string): Promise<WikiNode | null> {
  try {
    const response = await larkClient.get(
      '/wiki/v2/spaces/get_node',
      { token }
    );

    if (response.code !== 0) {
      logger.warn('获取知识库节点信息失败', {
        code: response.code,
        msg: response.msg,
      });
      return null;
    }

    return response.data?.node || null;
  } catch (error) {
    logger.error('获取知识库节点信息异常', error);
    return null;
  }
}

/**
 * 获取知识库子节点列表
 * @param parentNodeToken 父节点 token（可选）
 * @param pageSize 每页数量
 */
export async function listWikiNodes(
  parentNodeToken?: string,
  pageSize: number = 50
): Promise<{ nodes: WikiNode[]; hasMore: boolean; pageToken?: string }> {
  try {
    const params: Record<string, any> = {
      page_size: pageSize,
    };
    if (parentNodeToken) {
      params.parent_node_token = parentNodeToken;
    }

    const response = await larkClient.get(
      `/wiki/v2/spaces/${config.WIKI_SPACE_ID}/nodes`,
      params
    );

    if (response.code !== 0) {
      logger.error('获取知识库节点列表失败', {
        code: response.code,
        msg: response.msg,
      });
      return { nodes: [], hasMore: false };
    }

    return {
      nodes: response.data?.items || [],
      hasMore: response.data?.has_more || false,
      pageToken: response.data?.page_token,
    };
  } catch (error) {
    logger.error('获取知识库节点列表异常', error);
    return { nodes: [], hasMore: false };
  }
}

  /**
   * 移动知识库节点（带重试机制）
   * @param nodeToken 要移动的节点 token
   * @param targetParentToken 目标父节点 token
   */
  export async function moveWikiNode(
    nodeToken: string,
    targetParentToken?: string
  ): Promise<boolean> {
    const maxRetries = 3;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        logger.info(`移动知识库节点 (尝试 ${i + 1}/${maxRetries})`, {
          nodeToken,
          targetParentToken: targetParentToken || '(根目录)',
        });
  
        const response = await larkClient.post(
          `/wiki/v2/spaces/${config.WIKI_SPACE_ID}/nodes/${nodeToken}/move`,
          {
            target_parent_token: targetParentToken,
          }
        );
  
        if (response.code === 0) {
          logger.info('知识库节点移动成功');
          return true;
        }
        
        logger.warn(`移动知识库节点失败 (尝试 ${i + 1}/${maxRetries})`, {
          code: response.code,
          msg: response.msg,
        });

        // 如果是并发冲突或临时错误，等待后重试
        if (response.code === 1000500 || response.code === 99991669) { // 假设这些是并发/状态错误码
           await delay(1000 * (i + 1));
           continue;
        }
        
        // 如果是权限或不存在等硬错误，直接失败
        return false;
  
      } catch (error) {
        logger.error(`移动知识库节点异常 (尝试 ${i + 1}/${maxRetries})`, error);
        await delay(1000 * (i + 1));
      }
    }
    
    return false;
  }

/**
 * 构建知识库页面 URL
 */
function buildWikiUrl(wikiToken: string): string {
  return `https://bytedance.larkoffice.com/wiki/${wikiToken}`;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 处理错误代码，输出诊断信息
 */
function handleErrorCode(code: number, msg: string): void {
  switch (code) {
    case 99991663:
      logger.error('');
      logger.error('❌ 错误码 99991663 - 权限不足');
      logger.error('');
      logger.error('可能原因及解决方案:');
      logger.error('  1. 应用未获得 wiki:wiki 权限');
      logger.error('     → 检查飞书开放平台 > 权限管理');
      logger.error('     → 确认 wiki:wiki 权限已上线');
      logger.error('');
      logger.error('  2. 应用未被添加为知识库成员');
      logger.error('     → 打开知识库设置 > 成员管理');
      logger.error('     → 添加应用作为知识库成员');
      logger.error('');
      break;

    case 99991664:
      logger.error('');
      logger.error('❌ 错误码 99991664 - 知识库空间不存在');
      logger.error('');
      logger.error('可能原因:');
      logger.error(`  当前配置的空间 ID: ${config.WIKI_SPACE_ID}`);
      logger.error('  请检查 WIKI_SPACE_ID 环境变量是否正确');
      logger.error('');
      break;

    case 99991665:
      logger.error('');
      logger.error('❌ 错误码 99991665 - 父节点不存在');
      logger.error('');
      logger.error('可能原因:');
      logger.error(`  当前配置的父节点: ${config.WIKI_PARENT_NODE_TOKEN || '(未配置)'}`);
      logger.error('  请检查 WIKI_PARENT_NODE_TOKEN 环境变量是否正确');
      logger.error('');
      break;

    case 99991668:
      logger.error('');
      logger.error('❌ 错误码 99991668 - 文档不存在或无权限');
      logger.error('');
      logger.error('可能原因:');
      logger.error('  1. obj_token 对应的文档不存在');
      logger.error('  2. 应用没有该文档的访问权限');
      logger.error('');
      break;

    case 99991672:
      logger.warn('');
      logger.warn('⚠️ 错误码 99991672 - 文档已在知识库中');
      logger.warn('');
      break;

    case 131006:
      logger.error('');
      logger.error('❌ 错误码 131006 - 节点权限不足');
      logger.error('');
      logger.error('可能原因:');
      logger.error('  应用没有目标父节点的编辑/移动权限');
      logger.error('解决方案:');
      logger.error('  请在飞书知识库页面将机器人应用添加为协作者（授予可编辑权限）');
      logger.error('');
      break;

    default:
      logger.error(`API 错误: ${msg} (code: ${code})`);
  }
}
