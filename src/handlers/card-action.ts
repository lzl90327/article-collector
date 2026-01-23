/**
 * 卡片交互回调处理器
 */

import { logger } from '../utils/logger';
import { larkClient } from '../services/lark-client';
import { createDocument } from '../services/lark-doc';
import { addDocumentToWiki } from '../services/lark-wiki';
import { createArticleRecord } from '../services/lark-bitable';
import type { ArticleMeta } from '../types/article';

/**
 * 处理卡片交互回调
 */
export async function handleCardAction(event: any): Promise<void> {
  const action = event.action;
  const operatorId = event.operator?.open_id;
  
  if (!action?.value) {
    logger.warn('卡片回调缺少 action.value');
    return;
  }

  let actionData: any;
  try {
    actionData = typeof action.value === 'string' 
      ? JSON.parse(action.value) 
      : action.value;
  } catch {
    logger.error('解析 action.value 失败', action.value);
    return;
  }

  logger.info(`卡片操作: ${actionData.action}`, { operatorId });

  switch (actionData.action) {
    case 'save_direct_content':
      await handleSaveDirectContent(actionData, event);
      break;
    
    case 'cancel':
      logger.info('用户取消操作');
      // 可以更新卡片显示已取消
      break;
    
    default:
      logger.warn(`未知的卡片操作: ${actionData.action}`);
  }
}

/**
 * 处理"保存直接内容"操作
 */
async function handleSaveDirectContent(
  actionData: any,
  event: any
): Promise<void> {
  const { title, full_content_id } = actionData;
  const operatorId = event.operator?.open_id;
  const messageId = event.context?.open_message_id;

  logger.info(`保存直接内容: ${title}`);

  // 从全局缓存获取完整内容
  const pendingContents = (global as any).__pendingContents as Map<string, any> | undefined;
  const cachedData = pendingContents?.get(full_content_id);

  if (!cachedData) {
    logger.error('未找到缓存的内容', { full_content_id });
    // 发送错误提示
    try {
      await larkClient.sendMessage(
        operatorId,
        '❌ 内容已过期，请重新发送文章内容',
        'open_id'
      );
    } catch (err) {
      logger.error('发送错误消息失败', err);
    }
    return;
  }

  const { content, senderId } = cachedData;

  try {
    // 发送处理中提示
    await larkClient.sendMessage(
      operatorId,
      '⏳ 正在保存内容到云文档...',
      'open_id'
    );

    // 构建文章元信息
    const meta: ArticleMeta = {
      title: title || '未命名文档',
      author: '',
      publishTime: null,
      source: '用户发送',
      originalUrl: '',
      summary: content.substring(0, 200),
    };

    // 1. 创建云文档
    const docResult = await createDocument(
      meta.title,
      content,
      meta
    );
    logger.info(`文档创建成功: ${docResult.url}`);

    // 2. 添加到知识库
    const wikiResult = await addDocumentToWiki(docResult.documentId);
    logger.info(`已添加到知识库: ${wikiResult.url}`);

    // 3. 写入多维表格
    const recordResult = await createArticleRecord({
      meta,
      docUrl: docResult.url,
      collectTime: new Date(),
    });
    logger.info(`记录写入成功: ${recordResult.recordId}`);

    // 4. 发送成功消息
    const successCard = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '✅ 内容保存成功' },
        template: 'green',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**${meta.title}**`,
          },
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `内容长度: ${content.length} 字`,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '📄 查看文档' },
              type: 'primary',
              url: docResult.url,
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '📚 知识库' },
              type: 'default',
              url: wikiResult.url,
            },
          ],
        },
      ],
    };

    await larkClient.sendInteractiveCard(operatorId, successCard, 'open_id');

    // 清理缓存
    pendingContents?.delete(full_content_id);

  } catch (error) {
    logger.error('保存内容失败', error);
    await larkClient.sendMessage(
      operatorId,
      `❌ 保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'open_id'
    );
  }
}
