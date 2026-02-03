/**
 * 消息处理器
 * 处理用户发送的文章链接和碎片想法
 */

import { logger } from '../utils/logger';
import { 
  extractUrls, 
  isValidArticleUrl, 
  cleanUrl, 
  parseUrl, 
  UrlType,
  extractFeishuDocToken,
  extractFeishuWikiToken,
  isXiaohongshuUrl,
} from '../utils/url-parser';
import { fetchXhsNote, cleanupTempImages, XhsNoteInfo } from '../services/xhs-fetcher';
import { recognizeImages, mergeOcrResults, OcrResult } from '../services/baidu-ocr';
import { baiduOCRConfig, extendedFieldConfig } from '../config';
import { fetchArticleWithBrowser, checkPythonEnv } from '../services/browser-fetcher';
import { extractAuthor, extractPublishTime } from '../services/jina-reader';
import { createDocument, createDocumentWithImages } from '../services/lark-doc';
import { addDocumentToWiki } from '../services/lark-wiki';
import { createArticleRecord, findRecordByUrl } from '../services/lark-bitable';
import { larkClient } from '../services/lark-client';
import { copyDocumentContent, getDocTokenFromWikiNode } from '../services/feishu-doc-copy';
import { classifyMessageIntent } from '../services/deepseek-classifier';
import { handleIdeaMessage } from './idea';
import { deepseekConfig, ideasBitableConfig } from '../config';
import type { SaveResult, ProcessStatus } from '../types/article';

// 等待用户发送内容的状态缓存（简单实现）
const pendingContentRequests = new Map<string, { url: string; timestamp: number }>();
const PENDING_TIMEOUT = 5 * 60 * 1000; // 5 分钟超时

// ===== 有感而发：链接和评论分开发送的关联机制 =====
interface PendingArticle {
  url: string;
  messageId: string;
  senderId: string;
  timestamp: number;
  timer?: NodeJS.Timeout;
}

interface PendingComment {
  comment: string;
  messageId: string;
  senderId: string;
  timestamp: number;
  timer?: NodeJS.Timeout;
}

// 缓存最近的纯链接消息（按用户ID）
const pendingArticles = new Map<string, PendingArticle>();
// 缓存最近的纯评论消息（按用户ID）- 支持评论先到的情况
const pendingComments = new Map<string, PendingComment>();

const LINK_COMMENT_WINDOW = 5000; // 5秒时间窗口
const LINK_DELAY = 2000; // 延迟2秒处理链接，等待可能的评论
const COMMENT_DELAY = 2000; // 延迟2秒处理评论，等待可能的链接

/**
 * 检查是否有待关联的链接
 */
function getPendingArticle(senderId: string): PendingArticle | null {
  const pending = pendingArticles.get(senderId);
  if (!pending) return null;
  
  const now = Date.now();
  if (now - pending.timestamp > LINK_COMMENT_WINDOW) {
    pendingArticles.delete(senderId);
    return null;
  }
  
  return pending;
}

/**
 * 检查是否有待关联的评论
 */
function getPendingComment(senderId: string): PendingComment | null {
  const pending = pendingComments.get(senderId);
  if (!pending) return null;
  
  const now = Date.now();
  if (now - pending.timestamp > LINK_COMMENT_WINDOW) {
    pendingComments.delete(senderId);
    return null;
  }
  
  return pending;
}

/**
 * 清除待处理的链接
 */
function clearPendingArticle(senderId: string): void {
  const pending = pendingArticles.get(senderId);
  if (pending?.timer) {
    clearTimeout(pending.timer);
  }
  pendingArticles.delete(senderId);
}

/**
 * 清除待处理的评论
 */
function clearPendingComment(senderId: string): void {
  const pending = pendingComments.get(senderId);
  if (pending?.timer) {
    clearTimeout(pending.timer);
  }
  pendingComments.delete(senderId);
}

/**
 * 处理文本消息
 */
export async function handleTextMessage(event: any): Promise<void> {
  const message = event.message;
  const messageId = message?.message_id;
  const chatId = message?.chat_id;
  const senderId = event.sender?.sender_id?.open_id;

  // 解析消息内容
  let text = '';
  try {
    const content = message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      text = parsed.text || '';
    }
  } catch {
    text = message?.content || '';
  }

  logger.info(`收到文本消息: ${text.substring(0, 100)}...`);

  // 检查是否是命令
  if (text.startsWith('/')) {
    await handleCommand(text, messageId, senderId);
    return;
  }

  // 提取 URL
  const urls = extractUrls(text);
  
  // 优先检测飞书文档/知识库链接和小红书链接
  for (const url of urls) {
    const parsed = parseUrl(url);
    
    // 处理小红书链接
    if (parsed.type === UrlType.XIAOHONGSHU) {
      const comment = text.replace(url, '').trim();
      const hasComment = comment.length > 10 && ideasBitableConfig.enabled;
      
      // 处理小红书笔记
      const xhsResult = await processXiaohongshuNote(url, messageId, senderId);
      
      // 如果有评论且处理成功，保存想法
      if (hasComment && xhsResult) {
        logger.info(`小红书+评论: ${comment.substring(0, 30)}...`);
        await saveIdeaWithArticle(comment, url, xhsResult.title, messageId, senderId);
      }
      return;
    }
    
    // 处理飞书云文档
    if (parsed.type === UrlType.FEISHU_DOC) {
      const comment = text.replace(url, '').trim();
      const hasComment = comment.length > 10 && ideasBitableConfig.enabled;
      
      // 1. 保存文档
      const docResult = await processFeishuDocAndGetTitle(url, messageId, senderId);
      
      // 2. 如果有评论，保存想法
      if (hasComment && docResult) {
        logger.info(`飞书文档+评论: ${comment.substring(0, 30)}...`);
        await saveIdeaWithArticle(comment, url, docResult.title, messageId, senderId);
      }
      return;
    }
    
    // 处理飞书知识库
    if (parsed.type === UrlType.FEISHU_WIKI) {
      const comment = text.replace(url, '').trim();
      const hasComment = comment.length > 10 && ideasBitableConfig.enabled;
      
      // 1. 保存/记录知识库文档
      const wikiResult = await processFeishuWikiAndGetTitle(url, messageId, senderId);
      
      // 2. 如果有评论，保存想法
      if (hasComment && wikiResult) {
        logger.info(`飞书知识库+评论: ${comment.substring(0, 30)}...`);
        await saveIdeaWithArticle(comment, url, wikiResult.title, messageId, senderId);
      }
      return;
    }
  }
  
  const articleUrls = urls.filter(isValidArticleUrl);

  // ========== 支持链接和评论分开发送的有感而发 ==========

  // 情况1：包含有效的文章链接
  if (articleUrls.length > 0) {
    const articleUrl = articleUrls[0];
    
    // 提取非 URL 部分作为评论
    let comment = text;
    articleUrls.forEach(url => {
      comment = comment.replace(url, '');
    });
    comment = comment.trim();

    const shortPhrases = ['收藏', '存一下', '保存', '存', '马克', 'mark', '先存', '存着', ''];
    const isShortPhrase = shortPhrases.includes(comment.toLowerCase());
    const hasComment = comment.length > 10 && !isShortPhrase;

    logger.info(`处理文章链接: URL=${articleUrl}, 评论长度=${comment.length}, 有评论=${hasComment}`);

    if (hasComment && ideasBitableConfig.enabled) {
      // 同一条消息中包含链接和评论
      clearPendingComment(senderId); // 清除可能的待处理评论
      await handleArticleWithIdea(articleUrl, comment, messageId, senderId);
      return;
    }

    // ===== 纯链接：检查是否有待关联的评论（评论先到的情况） =====
    if (ideasBitableConfig.enabled) {
      const pendingComment = getPendingComment(senderId);
      
      if (pendingComment) {
        // 发现待关联的评论，按有感而发处理
        logger.info(`检测到有感而发(评论先到): 链接=${articleUrl}, 评论=${pendingComment.comment.substring(0, 30)}...`);
        clearPendingComment(senderId);
        await handleArticleWithIdea(articleUrl, pendingComment.comment, messageId, senderId);
        return;
      }
      
      // 没有待关联评论，缓存链接等待
      logger.info(`纯链接消息，缓存等待评论: ${articleUrl}`);
      clearPendingArticle(senderId);
      
      const pending: PendingArticle = {
        url: articleUrl,
        messageId,
        senderId,
        timestamp: Date.now(),
      };
      
      pending.timer = setTimeout(async () => {
        const stillPending = pendingArticles.get(senderId);
        if (stillPending && stillPending.url === articleUrl) {
          logger.info(`链接等待超时，按纯文章处理: ${articleUrl}`);
          pendingArticles.delete(senderId);
          await processArticleUrl(articleUrl, messageId, senderId);
        }
      }, LINK_DELAY);
      
      pendingArticles.set(senderId, pending);
      return;
    }

    // 想法库未启用，直接处理文章
    await processArticleUrl(articleUrl, messageId, senderId);
    return;
  }

  // 情况2：纯文字消息（可能是评论）
  if (text.length >= 5 && ideasBitableConfig.enabled) {
    // 先检查是否有待关联的链接（链接先到的情况）
    const pendingArticle = getPendingArticle(senderId);
    
    if (pendingArticle && text.length > 10) {
      logger.info(`检测到有感而发(链接先到): 链接=${pendingArticle.url}, 评论=${text.substring(0, 30)}...`);
      clearPendingArticle(senderId);
      await handleArticleWithIdea(pendingArticle.url, text, messageId, senderId);
      return;
    }
    
    // 没有待关联链接，缓存评论等待可能的链接
    if (text.length > 10 && text.length < 200) {
      logger.info(`纯评论消息，缓存等待链接: ${text.substring(0, 30)}...`);
      clearPendingComment(senderId);
      
      const pending: PendingComment = {
        comment: text,
        messageId,
        senderId,
        timestamp: Date.now(),
      };
      
      pending.timer = setTimeout(async () => {
        const stillPending = pendingComments.get(senderId);
        if (stillPending && stillPending.comment === text) {
          logger.info(`评论等待超时，按纯想法处理: ${text.substring(0, 30)}...`);
          pendingComments.delete(senderId);
          await handleIdeaMessage(text, messageId, senderId);
        }
      }, COMMENT_DELAY);
      
      pendingComments.set(senderId, pending);
      return;
    }
    
    // 短文本（<=10字）直接保存为想法
    if (text.length <= 10) {
      await handleIdeaMessage(text, messageId, senderId);
      return;
    }
  }

  // 情况3：中等及长文本（>=100字），弹卡片让用户选择
  if (text.length >= 100 && ideasBitableConfig.enabled) {
    // 先检查是否有待关联的链接
    const pendingArticle = getPendingArticle(senderId);
    if (pendingArticle) {
      logger.info(`长评论+待关联链接，按有感而发处理`);
      clearPendingArticle(senderId);
      await handleArticleWithIdea(pendingArticle.url, text, messageId, senderId);
      return;
    }
    
    await showTypeSelectionCard(text, messageId, senderId);
    return;
  }

  // 情况4：长文本但想法库未启用，当作文章内容处理
  if (text.length >= 200) {
    await handleDirectContent(text, messageId, senderId);
    return;
  }

  // 情况5：太短或其他情况，显示帮助信息
  await larkClient.replyMessage(
    messageId,
    '👋 你好！我是文章收藏 & 想法记录助手。\n\n' +
      '📎 **发送文章链接**，我会自动抓取内容并保存到飞书。\n\n' +
      '💭 **发送文字/语音**，我会记录为碎片想法。\n\n' +
      '📝 **发送链接+评论**，我会关联保存你的想法。\n\n' +
      '支持的功能：\n' +
      '• 收藏网页文章（微信、知乎、掘金等）\n' +
      '• 记录碎片想法（文字/语音）\n' +
      '• 有感而发（文章+想法关联）\n\n' +
      '使用 /帮助 查看更多命令。'
  );
}

/**
 * 显示类型选择卡片（中等长度文本）
 */
async function showTypeSelectionCard(
  text: string,
  messageId: string,
  senderId: string
): Promise<void> {
  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🤔 这是想法还是文章？' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**内容预览**: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**长度**: ${text.length} 字`,
        },
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '💭 这是我的想法' },
            type: 'primary',
            value: JSON.stringify({
              action: 'save_as_idea',
              content_preview: text.substring(0, 500),
              full_content_id: messageId,
            }),
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📄 这是文章内容' },
            type: 'default',
            value: JSON.stringify({
              action: 'save_as_article',
              content_preview: text.substring(0, 500),
              full_content_id: messageId,
            }),
          },
        ],
      },
    ],
  };

  // 缓存完整内容
  (global as any).__pendingContents = (global as any).__pendingContents || new Map();
  (global as any).__pendingContents.set(messageId, {
    content: text,
    senderId,
    timestamp: Date.now(),
  });

  await larkClient.replyInteractiveCard(messageId, card);
}

/**
 * 处理用户直接发送的文章内容
 */
async function handleDirectContent(
  content: string,
  messageId: string,
  senderId: string
): Promise<void> {
  logger.info(`处理直接内容，长度: ${content.length}`);

  try {
    // 提取标题（第一行或前50个字符）
    const lines = content.split('\n').filter(l => l.trim());
    let title = lines[0]?.trim() || '';
    
    // 清理标题
    title = title
      .replace(/^[#\s]+/, '') // 移除开头的 # 和空格
      .substring(0, 80);
    
    if (!title) {
      title = content.substring(0, 50).replace(/\n/g, ' ') + '...';
    }

    // 发送确认卡片
    const confirmCard = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '📝 确认保存内容' },
        template: 'blue',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**标题**: ${title}`,
          },
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**内容长度**: ${content.length} 字`,
          },
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**预览**: ${content.substring(0, 150).replace(/\n/g, ' ')}...`,
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
              text: { tag: 'plain_text', content: '✅ 确认保存' },
              type: 'primary',
              value: JSON.stringify({
                action: 'save_direct_content',
                title,
                content_preview: content.substring(0, 500),
                full_content_id: messageId, // 用于后续获取完整内容
              }),
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '❌ 取消' },
              type: 'default',
              value: JSON.stringify({ action: 'cancel' }),
            },
          ],
        },
      ],
    };

    // 缓存完整内容（用于后续保存）
    pendingContentRequests.set(messageId, {
      url: `direct:${senderId}:${Date.now()}`,
      timestamp: Date.now(),
    });

    // 同时缓存完整内容到全局（简单实现）
    (global as any).__pendingContents = (global as any).__pendingContents || new Map();
    (global as any).__pendingContents.set(messageId, {
      title,
      content,
      senderId,
      timestamp: Date.now(),
    });

    await larkClient.replyInteractiveCard(messageId, confirmCard);
  } catch (error) {
    logger.error('处理直接内容失败', error);
    await larkClient.replyMessage(
      messageId,
      '❌ 处理内容失败，请稍后重试'
    );
  }
}

/**
 * 有感而发模式：先保存想法，再处理文章，最后回填关联
 */
async function handleArticleWithIdea(
  articleUrl: string,
  comment: string,
  messageId: string,
  senderId: string
): Promise<void> {
  logger.info(`有感而发模式: URL=${articleUrl}, 评论="${comment.substring(0, 30)}..."`);

  // 导入所需模块
  const { createIdeaRecord, updateIdeaRecordLink, determineMaturity } = await import('../services/ideas-bitable');
  const { ideasFieldConfig } = await import('../config');

  const config = {
    appToken: ideasBitableConfig.appToken,
    tableId: ideasBitableConfig.tableId,
    fields: ideasFieldConfig,
  };

  // ===== 步骤1：先保存想法（不带关联） =====
  let ideaRecordId: string | null = null;
  let emotion = '平静';
  let scene = '读书';
  let topics: string[] = [];

  try {
    // 使用 LLM 分析情绪和主题（如果可用）
    if (deepseekConfig.enabled) {
      try {
        const intent = await classifyMessageIntent(comment, 'text', deepseekConfig.apiKey);
        emotion = intent.emotion || '平静';
        scene = intent.scene || '读书';
        topics = intent.topics || [];
      } catch (e) {
        logger.warn('LLM 分析失败，使用默认值');
      }
    }

    const ideaResult = await createIdeaRecord(
      {
        content: comment,
        inputType: '文字',
        scene,
        emotion,
        topics,
        maturity: determineMaturity(comment),
        recordTime: new Date(),
        // 暂时不设置关联字段，等文章处理完再回填
      },
      config
    );
    ideaRecordId = ideaResult.recordId;
    logger.info(`想法已保存: ${ideaRecordId}`);

    // 立即回复用户
    await larkClient.replyMessage(
      messageId,
      `💭 想法已记录！正在处理文章...\n\n` +
      `想法: ${comment.substring(0, 60)}${comment.length > 60 ? '...' : ''}`
    );

  } catch (error) {
    logger.error('保存想法失败', error);
    await larkClient.replyMessage(messageId, '❌ 保存想法失败');
    // 想法保存失败，仍然尝试处理文章
  }

  // ===== 步骤2：处理文章（抓取、保存） =====
  const articleResult = await processArticleUrl(articleUrl, messageId, senderId);

  // ===== 步骤3：回填关联字段 =====
  if (ideaRecordId && articleResult) {
    try {
      const success = await updateIdeaRecordLink(
        ideaRecordId,
        articleResult.title,
        articleUrl,  // 使用原始 URL
        config
      );

      if (success) {
        logger.info(`想法关联回填成功: ${ideaRecordId} -> ${articleResult.title}`);
        // 可选：发送更新通知
        try {
          await larkClient.replyMessage(
            messageId,
            `✅ 想法已关联到文章「${articleResult.title}」`
          );
        } catch (e) {
          // 忽略通知失败
        }
      }
    } catch (error) {
      logger.warn('回填想法关联失败', error);
    }
  } else if (ideaRecordId && !articleResult) {
    logger.info(`文章处理失败，想法 ${ideaRecordId} 未关联`);
  }
}

/**
 * 保存想法并关联文章（简化版）- 保留用于其他场景
 */
async function saveIdeaWithArticle(
  comment: string,
  articleUrl: string,
  articleTitle: string,
  messageId: string,
  senderId: string
): Promise<void> {
  // 详细调试日志
  logger.info(`====== saveIdeaWithArticle 被调用 ======`);
  logger.info(`评论: ${comment.substring(0, 50)}...`);
  logger.info(`文章URL: ${articleUrl}`);
  logger.info(`文章标题: ${articleTitle}`);

  if (!ideasBitableConfig.enabled) {
    return;
  }

  try {
    // 使用 LLM 分析情绪和主题（如果可用）
    let emotion = '平静';
    let scene = '读书';
    let topics: string[] = [];

    if (deepseekConfig.enabled) {
      try {
        const intent = await classifyMessageIntent(comment, 'text', deepseekConfig.apiKey);
        emotion = intent.emotion || '平静';
        scene = intent.scene || '读书';
        topics = intent.topics || [];
        logger.info(`LLM 分析: 情绪=${emotion}, 场景=${scene}`);
      } catch (e) {
        logger.warn('LLM 分析失败，使用默认值');
      }
    }

    // 导入想法库服务
    const { createIdeaRecord, determineMaturity } = await import('../services/ideas-bitable');
    const { ideasFieldConfig } = await import('../config');

    const result = await createIdeaRecord(
      {
        content: comment,
        inputType: '文字',
        scene,
        emotion,
        relatedArticleUrl: articleUrl,
        relatedArticleTitle: articleTitle,
        topics,
        maturity: determineMaturity(comment),
        recordTime: new Date(),
      },
      {
        appToken: ideasBitableConfig.appToken,
        tableId: ideasBitableConfig.tableId,
        fields: ideasFieldConfig,
      }
    );

    logger.info(`想法记录成功: ${result.recordId}, 关联: ${articleTitle}`);

    // 发送确认消息
    try {
      await larkClient.replyMessage(
        messageId,
        `💭 有感而发已记录！\n\n` +
        `想法: ${comment.substring(0, 80)}${comment.length > 80 ? '...' : ''}\n` +
        `关联: ${articleTitle}\n` +
        `情绪: ${emotion}`
      );
    } catch (e) {
      logger.warn('发送确认消息失败');
    }

  } catch (error) {
    logger.error('保存想法失败', error);
  }
}

/**
 * 处理飞书云文档链接并返回标题（用于有感而发）
 */
async function processFeishuDocAndGetTitle(
  url: string,
  messageId: string,
  senderId: string
): Promise<{ title: string; docUrl: string } | null> {
  logger.info(`处理飞书文档(获取标题): ${url}`);

  try {
    const docToken = extractFeishuDocToken(url);
    if (!docToken) {
      await larkClient.replyMessage(messageId, '❌ 无法解析飞书文档链接');
      return null;
    }

    // 先检查是否已收藏过
    const existing = await findRecordByUrl(url);
    if (existing) {
      const existingTitle = existing.fields['标题'] || existing.fields['title'] || '飞书文档';
      logger.info(`文档已收藏过，跳过: ${existingTitle}`);
      return { title: existingTitle, docUrl: url };
    }

    await larkClient.replyMessage(messageId, '⏳ 正在读取并复制文档到知识库...');

    // 读取源文档内容
    const docContent = await copyDocumentContent(docToken);
    logger.info(`文档标题: ${docContent.title}`);

    // 创建新文档
    const meta = {
      title: docContent.title,
      author: docContent.author,
      publishTime: docContent.publishTime,
      source: '飞书云文档',
      originalUrl: url,
      summary: '',
    };
    const docResult = await createDocument(docContent.title, docContent.markdown, meta);

    // 添加到知识库
    const wikiResult = await addDocumentToWiki(docResult.documentId);

    // 记录到多维表格
    await createArticleRecord({
      meta: {
        title: docContent.title,
        author: docContent.author,
        publishTime: docContent.publishTime,
        source: '飞书云文档',
        originalUrl: url,
        summary: docContent.markdown.slice(0, 200) + (docContent.markdown.length > 200 ? '...' : ''),
      },
      docUrl: docResult.url,
      collectTime: new Date(),
    });

    // 发送成功卡片
    await sendSuccessCard(messageId, {
      title: docContent.title,
      author: docContent.author,
      source: '飞书云文档',
      docUrl: docResult.url,
      wikiUrl: wikiResult.url,
      originalUrl: url,
    });

    logger.info(`飞书文档转存完成: ${docContent.title}`);
    return { title: docContent.title, docUrl: docResult.url };

  } catch (error) {
    logger.error('处理飞书文档失败', error);
    await larkClient.replyMessage(
      messageId,
      `❌ 转存失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    return null;
  }
}

/**
 * 处理飞书知识库链接并返回标题（用于有感而发）
 */
async function processFeishuWikiAndGetTitle(
  url: string,
  messageId: string,
  senderId: string
): Promise<{ title: string } | null> {
  logger.info(`处理飞书知识库(获取标题): ${url}`);

  try {
    const wikiToken = extractFeishuWikiToken(url);
    if (!wikiToken) {
      return null;
    }

    // 获取知识库节点信息
    const { getWikiNode } = await import('../services/lark-wiki');
    const nodeInfo = await getWikiNode(wikiToken);

    if (nodeInfo) {
      logger.info(`知识库文档: ${nodeInfo.title}`);
      return { title: nodeInfo.title || '飞书知识库文档' };
    }

    return { title: '飞书知识库文档' };
  } catch (error) {
    logger.warn('获取知识库标题失败', error);
    return { title: '飞书知识库文档' };
  }
}

/**
 * 处理飞书云文档链接
 */
async function processFeishuDoc(
  url: string,
  messageId: string,
  senderId: string
): Promise<void> {
  logger.info(`处理飞书文档: ${url}`);

  try {
    // 提取文档 token
    const docToken = extractFeishuDocToken(url);
    if (!docToken) {
      await larkClient.replyMessage(
        messageId,
        '❌ 无法解析飞书文档链接，请检查链接格式'
      );
      return;
    }

    await larkClient.replyMessage(messageId, '⏳ 正在读取并复制文档到知识库...');

    // 1. 读取源文档内容（包括提取的元数据）
    const docContent = await copyDocumentContent(docToken);
    logger.info(`文档标题: ${docContent.title}, 作者: ${docContent.author}, 发布时间: ${docContent.publishTime}`);

    // 2. 创建新文档（复制内容）
    const meta = {
      title: docContent.title,
      author: docContent.author,
      publishTime: docContent.publishTime,
      source: '飞书云文档',
      originalUrl: url,
      summary: '',
    };
    const docResult = await createDocument(docContent.title, docContent.markdown, meta);
    logger.info(`新文档已创建: ${docResult.url}`);

    // 3. 将新文档添加到知识库
    const wikiResult = await addDocumentToWiki(docResult.documentId);
    logger.info(`已添加到知识库: ${wikiResult.url}`);

    // 4. 记录到多维表格
    const recordResult = await createArticleRecord({
      meta: {
        title: docContent.title,
        author: docContent.author,
        publishTime: docContent.publishTime,
        source: '飞书云文档',
        originalUrl: url,
        summary: docContent.markdown.slice(0, 200) + (docContent.markdown.length > 200 ? '...' : ''),
      },
      docUrl: docResult.url,
      collectTime: new Date(),
    });

    // 5. 发送成功卡片
    await sendSuccessCard(messageId, {
      title: docContent.title,
      author: docContent.author,
      source: '飞书云文档',
      docUrl: docResult.url,
      wikiUrl: wikiResult.url,
      originalUrl: url,
    });

    logger.info(`飞书文档转存完成: ${docContent.title}`);
  } catch (error) {
    logger.error('处理飞书文档失败', error);
    await larkClient.replyMessage(
      messageId,
      `❌ 转存失败\n\n错误: ${error instanceof Error ? error.message : '未知错误'}\n\n` +
      `请确保：\n1. 文档链接有效\n2. 机器人有权限访问该文档（至少需要阅读权限）`
    );
  }
}

/**
 * 处理飞书知识库链接
 */
async function processFeishuWiki(
  url: string,
  messageId: string,
  senderId: string
): Promise<void> {
  logger.info(`处理飞书知识库链接: ${url}`);

  try {
    const wikiToken = extractFeishuWikiToken(url);
    if (!wikiToken) {
      await larkClient.replyMessage(
        messageId,
        '❌ 无法解析知识库链接'
      );
      return;
    }

    await larkClient.replyMessage(messageId, '⏳ 正在读取并复制文档到知识库...');

    // 1. 获取文档 token
    const wikiDocInfo = await getDocTokenFromWikiNode(wikiToken);
    logger.info(`知识库文档: ${wikiDocInfo.title}, docToken: ${wikiDocInfo.documentId}`);

    // 2. 读取文档内容
    const docContent = await copyDocumentContent(wikiDocInfo.documentId);
    logger.info(`文档: 作者="${docContent.author}", 发布时间="${docContent.publishTime}"`);

    // 3. 创建新文档
    const meta = {
      title: docContent.title,
      author: docContent.author,
      publishTime: docContent.publishTime,
      source: '飞书知识库',
      originalUrl: url,
      summary: '',
    };
    const docResult = await createDocument(docContent.title, docContent.markdown, meta);
    logger.info(`新文档已创建: ${docResult.url}`);

    // 4. 将新文档添加到知识库
    const wikiResult = await addDocumentToWiki(docResult.documentId);
    logger.info(`已添加到知识库: ${wikiResult.url}`);

    // 5. 记录到多维表格
    await createArticleRecord({
      meta: {
        title: docContent.title,
        author: docContent.author,
        publishTime: docContent.publishTime,
        source: '飞书知识库',
        originalUrl: url,
        summary: docContent.markdown.slice(0, 200) + (docContent.markdown.length > 200 ? '...' : ''),
      },
      docUrl: docResult.url,
      collectTime: new Date(),
    });

    // 6. 发送成功卡片
    await sendSuccessCard(messageId, {
      title: docContent.title,
      author: docContent.author,
      source: '飞书知识库',
      docUrl: docResult.url,
      wikiUrl: wikiResult.url,
      originalUrl: url,
    });

    logger.info(`知识库文档转存完成: ${docContent.title}`);
  } catch (error) {
    logger.error('处理知识库链接失败', error);
    await larkClient.replyMessage(
      messageId,
      `❌ 转存失败\n\n错误: ${error instanceof Error ? error.message : '未知错误'}\n\n` +
      `请确保机器人有权限访问该文档`
    );
  }
}

/**
 * 从 URL 推断来源
 */
function inferSourceFromUrl(url: string): string {
  if (url.includes('mp.weixin.qq.com')) return '微信公众号';
  if (url.includes('zhihu.com')) return '知乎';
  if (url.includes('juejin.cn')) return '掘金';
  if (url.includes('csdn.net')) return 'CSDN';
  if (url.includes('jianshu.com')) return '简书';
  if (url.includes('36kr.com')) return '36氪';
  if (url.includes('infoq.cn')) return 'InfoQ';
  if (url.includes('ruanyifeng.com')) return '阮一峰博客';
  return '网络文章';
}

/**
 * 处理文章 URL（使用 Browser Use AI 抓取）
 */
async function processArticleUrl(
  url: string,
  messageId: string,
  senderId: string
): Promise<{ title: string; existed: boolean } | null> {
  const cleanedUrl = cleanUrl(url);
  logger.info(`处理文章: ${cleanedUrl}`);

  try {
    // 1. 检查是否已收藏
    const existing = await findRecordByUrl(cleanedUrl);
    if (existing) {
      const existingTitle = existing.fields['标题'] || '未知';
      await larkClient.replyMessage(
        messageId,
        `⚠️ 这篇文章已经收藏过了\n\n` +
          `标题: ${existingTitle}\n` +
          `收藏时间: ${formatDate(existing.fields['收藏时间'])}`
      );
      return { title: existingTitle, existed: true };
    }

    // 2. 发送处理中提示
    await larkClient.replyMessage(
      messageId, 
      '🤖 正在抓取完整文章内容，请稍候...\n（完整抓取可能需要 1-2 分钟）'
    );

    // 3. 使用 Browser Use 抓取文章内容
    const fetchResult = await fetchArticleWithBrowser(cleanedUrl, 240000); // 4 分钟超时
    logger.info(`文章抓取成功: ${fetchResult.title}`);

    // 4. 验证抓取结果
    if (!fetchResult.title || !fetchResult.content || fetchResult.content.length < 100) {
      throw new Error(`抓取内容无效: 标题=${fetchResult.title || '空'}, 内容长度=${fetchResult.content?.length || 0}`);
    }
    
    logger.info(`文章内容长度: ${fetchResult.content.length} 字符`);

    // 5. 构建元数据
    const source = inferSourceFromUrl(cleanedUrl);
    const meta = {
      title: fetchResult.title,
      author: fetchResult.author || '',
      publishTime: fetchResult.publishTime,
      source,
      originalUrl: cleanedUrl,
      summary: fetchResult.content.slice(0, 200) + (fetchResult.content.length > 200 ? '...' : ''),
    };

    // 6. 创建云文档（包含图片上传）
    await updateStatus(messageId, '📝 正在创建云文档...');
    
    // 如果有图片，传递图片信息给 createDocument
    const docResult = await createDocumentWithImages(
      meta.title,
      fetchResult.content,
      meta,
      fetchResult.images || []
    );

    // 7. 添加到知识库
    await updateStatus(messageId, '📚 正在添加到知识库...');
    const wikiResult = await addDocumentToWiki(docResult.documentId);

    // 8. 写入多维表格
    await updateStatus(messageId, '📊 正在记录元信息...');
    await createArticleRecord({
      meta,
      docUrl: docResult.url,
      collectTime: new Date(),
    });

    // 9. 发送成功卡片
    await sendSuccessCard(messageId, {
      title: meta.title,
      author: meta.author,
      source: meta.source,
      docUrl: docResult.url,
      wikiUrl: wikiResult.url,
      originalUrl: cleanedUrl,
    });

    logger.info(`文章处理完成: ${meta.title}`);
    return { title: meta.title, existed: false };
  } catch (error) {
    logger.error('处理文章失败', error);
    
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    // 检查是否是 Python 环境问题
    const pythonEnv = checkPythonEnv();
    let errorTip = '';
    
    if (!pythonEnv.available) {
      errorTip = `\n\n🔧 **服务配置问题**\n服务器 Python 环境未正确配置，请联系管理员。`;
    } else if (errorMessage.includes('ENOENT') || errorMessage.includes('spawn')) {
      errorTip = `\n\n🔧 **服务配置问题**\n抓取脚本无法执行，请联系管理员。`;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
      errorTip = `\n\n⏱️ **抓取超时**\n该网站可能有反爬限制或响应较慢。`;
    }
    
    // 发送错误提示
    await larkClient.replyMessage(
      messageId,
      `❌ 抓取失败\n\n` +
        `链接: ${cleanedUrl}\n` +
        `错误: ${errorMessage}` +
        errorTip +
        `\n\n💡 **建议**：\n` +
        `1. 如果是微信文章，可以使用「飞书剪存」功能保存后，将飞书文档链接发给我\n` +
        `2. 可以直接复制文章内容（200字以上）发送给我保存`
    );
    return null;
  }
}

/**
 * 更新处理状态（编辑原消息）
 */
async function updateStatus(messageId: string, status: string): Promise<void> {
  // 注意：飞书 API 不支持编辑已发送的消息
  // 这里只记录日志，实际可以考虑使用卡片更新
  logger.debug(`状态更新: ${status}`);
}

/**
 * 发送成功卡片
 */
async function sendSuccessCard(
  messageId: string,
  data: {
    title: string;
    author: string;
    source: string;
    docUrl: string;
    wikiUrl: string;
    originalUrl: string;
  }
): Promise<void> {
  const card = {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: '✅ 文章收藏成功',
      },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**${data.title}**`,
        },
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**来源**: ${data.source}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**作者**: ${data.author || '未知'}`,
            },
          },
        ],
      },
      {
        tag: 'hr',
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '📄 查看文档',
            },
            type: 'primary',
            url: data.docUrl,
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '📚 知识库',
            },
            type: 'default',
            url: data.wikiUrl,
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '🔗 原文',
            },
            type: 'default',
            url: data.originalUrl,
          },
        ],
      },
    ],
  };

  await larkClient.replyInteractiveCard(messageId, card);
}

/**
 * 处理命令
 */
async function handleCommand(
  text: string,
  messageId: string,
  senderId: string
): Promise<void> {
  const command = text.trim().toLowerCase();

  if (command === '/帮助' || command === '/help') {
    await larkClient.replyMessage(
      messageId,
      '📖 **文章收藏助手使用指南**\n\n' +
        '**基本用法**\n' +
        '直接发送文章链接，我会自动：\n' +
        '1. 抓取文章内容\n' +
        '2. 创建飞书云文档\n' +
        '3. 添加到知识库\n' +
        '4. 记录到多维表格\n\n' +
        '**支持的链接**\n' +
        '• 微信公众号文章\n' +
        '• 知乎、掘金、CSDN 文章\n' +
        '• 其他网页文章\n\n' +
        '**命令列表**\n' +
        '• /帮助 - 显示帮助信息\n' +
        '• /状态 - 查看服务状态'
    );
    return;
  }

  if (command === '/状态' || command === '/status') {
    await larkClient.replyMessage(
      messageId,
      '✅ **服务状态**\n\n' +
        '• 文章抓取服务: 正常\n' +
        '• 云文档服务: 正常\n' +
        '• 知识库服务: 正常\n' +
        '• 多维表格服务: 正常'
    );
    return;
  }

  // 未知命令
  await larkClient.replyMessage(
    messageId,
    `❓ 未知命令: ${text}\n\n使用 /帮助 查看可用命令。`
  );
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return '未知';
  try {
    return new Date(timestamp).toLocaleString('zh-CN');
  } catch {
    return '未知';
  }
}

/**
 * 处理小红书笔记链接
 */
async function processXiaohongshuNote(
  url: string,
  messageId: string,
  senderId: string
): Promise<{ title: string } | null> {
  logger.info(`处理小红书笔记: ${url}`);

  try {
    // 1. 检查 OCR 配置
    if (!baiduOCRConfig.enabled) {
      await larkClient.replyMessage(
        messageId,
        '❌ 小红书功能未配置\n\n请在 .env 中配置 BAIDU_OCR_API_KEY'
      );
      return null;
    }

    // 2. 发送处理中提示
    await larkClient.replyMessage(
      messageId,
      '📕 正在处理小红书笔记...\n\n• 提取图片中...'
    );

    // 3. 获取小红书笔记信息
    const fetchResult = await fetchXhsNote(url, true);

    // 检查是否是视频笔记
    if (fetchResult.isVideo) {
      await larkClient.replyMessage(
        messageId,
        '📹 暂不支持视频笔记\n\n请发送图文笔记，或直接截图发送给我。'
      );
      return null;
    }

    // 获取笔记基本信息（即使提取失败也尝试使用部分信息）
    const noteInfo = fetchResult.data || {
      noteId: '',
      type: 'image' as const,
      title: '',
      description: '',
      author: '未知',
      images: [],
      originalUrl: url,
      expandedUrl: url,
    };

    const hasImages = noteInfo.images.length > 0 && noteInfo.images.some(img => img.localPath);
    
    logger.info(`小红书笔记提取: ${noteInfo.title || '无标题'}, ${noteInfo.images.length} 张图片, 有本地图片: ${hasImages}`);

    // 如果完全没有获取到任何信息，提示降级
    if (!fetchResult.success && !noteInfo.title && !noteInfo.author) {
      await larkClient.replyMessage(
        messageId,
        `📕 小红书链接已记录，但无法自动提取内容（反爬限制）\n\n` +
        `💡 **请发送截图**：\n` +
        `在小红书 App 中截图发送给我，我可以识别图片中的文字并保存。\n\n` +
        `🔗 原始链接: ${url}`
      );
      return null;
    }

    // 4. OCR 识别图片（如果有）
    let ocrResults: OcrResult[] = [];
    let ocrText = '';

    if (hasImages) {
      await larkClient.replyMessage(
        messageId,
        `📕 正在处理小红书笔记...\n\n• 提取图片: ✅ ${noteInfo.images.length} 张\n• OCR 识别中...`
      );

      const imagePaths = noteInfo.images
        .filter(img => img.localPath)
        .map(img => img.localPath as string);

      ocrResults = await recognizeImages(imagePaths, {
        apiKey: baiduOCRConfig.apiKey,
        prompt: '请识别这张图片中的所有文字信息，保持原有排版。直接输出文字内容，不要添加解释。',
      });
      ocrText = mergeOcrResults(ocrResults);
      logger.info(`OCR 识别完成，总文本长度: ${ocrText.length}`);
    } else {
      await larkClient.replyMessage(
        messageId,
        `📕 正在处理小红书笔记...\n\n• 图片提取受限（将保存基本信息）\n• 创建文档中...`
      );
    }

    // 5. 确定标题（优先使用提取到的标题，其次使用 OCR 首行，最后使用默认值）
    const title = noteInfo.title || 
      (ocrResults[0]?.text?.split('\n')[0]?.substring(0, 50)) || 
      `小红书笔记 - ${new Date().toLocaleDateString('zh-CN')}`;

    // 6. 构建文档内容
    const docContent = buildXhsDocContent(noteInfo, ocrText, hasImages);

    // 7. 创建飞书文档
    // 构建图片信息用于上传（如果有）
    const imageInfos = hasImages 
      ? noteInfo.images
          .filter(img => img.localPath)
          .map(img => ({
            index: img.index,
            url: img.url,
            path: img.localPath as string,
            alt: `小红书图片 ${img.index + 1}`,
          }))
      : [];

    const docResult = await createDocumentWithImages(
      title,
      docContent,
      {
        title,
        author: noteInfo.author,
        publishTime: noteInfo.publishTime || null,
        source: '小红书',
        originalUrl: url,
        summary: ocrText.substring(0, 200) + (ocrText.length > 200 ? '...' : ''),
      },
      imageInfos
    );

    // 8. 添加到知识库
    const wikiResult = await addDocumentToWiki(docResult.documentId);

    // 9. 写入多维表格
    await createXhsArticleRecord({
      title,
      author: noteInfo.author,
      source: '小红书',
      originalUrl: url,
      summary: ocrText.substring(0, 200) + (ocrText.length > 200 ? '...' : ''),
      docUrl: docResult.url,
      imageCount: noteInfo.images.length,
      collectTime: new Date(),
    });

    // 10. 清理临时文件
    cleanupTempImages(noteInfo.images);

    // 11. 发送成功卡片
    await sendXhsSuccessCard(messageId, {
      title,
      author: noteInfo.author,
      imageCount: hasImages ? noteInfo.images.length : 0,
      docUrl: docResult.url,
      wikiUrl: wikiResult.url,
      originalUrl: url,
      needScreenshot: !hasImages,
    });

    logger.info(`小红书笔记处理完成: ${title}`);
    return { title };

  } catch (error) {
    logger.error('处理小红书笔记失败', error);
    
    await larkClient.replyMessage(
      messageId,
      `❌ 处理失败\n\n${error instanceof Error ? error.message : '未知错误'}\n\n` +
      `💡 **替代方案**：\n` +
      `请直接截图发送给我，我可以识别图片中的文字。`
    );
    return null;
  }
}

/**
 * 构建小红书文档内容
 */
function buildXhsDocContent(noteInfo: XhsNoteInfo, ocrText: string, hasImages: boolean = true): string {
  const lines: string[] = [];

  // 笔记描述
  if (noteInfo.description) {
    lines.push(noteInfo.description);
    lines.push('');
  }

  if (hasImages && noteInfo.images.length > 0) {
    // 原始图片标记（会被替换为实际图片）
    lines.push('## 原始图片');
    lines.push('');
    for (let i = 0; i < noteInfo.images.length; i++) {
      if (noteInfo.images[i].localPath) {
        lines.push(`![IMG:${i}](LOCAL:${noteInfo.images[i].localPath})`);
        lines.push('');
      }
    }
  } else {
    // 没有图片时的提示（使用普通文本，避免空引用块）
    lines.push('## 图片');
    lines.push('');
    lines.push('⚠️ 图片未能自动提取（小红书反爬限制）');
    lines.push('');
    lines.push('💡 请在小红书 App 中截图，然后发送给机器人补充内容。');
    lines.push('');
  }

  // OCR 识别内容
  if (ocrText) {
    lines.push('---');
    lines.push('');
    lines.push('## OCR 识别内容');
    lines.push('');
    lines.push(ocrText);
  }

  return lines.join('\n');
}

/**
 * 写入小红书文章记录到多维表格
 */
async function createXhsArticleRecord(data: {
  title: string;
  author: string;
  source: string;
  originalUrl: string;
  summary: string;
  docUrl: string;
  imageCount: number;
  collectTime: Date;
}): Promise<void> {
  try {
    const { default: config } = await import('../config');
    
    // 构建字段数据
    const fields: Record<string, any> = {
      [config.FIELD_TITLE]: data.title,
      [config.FIELD_AUTHOR]: data.author,
      [config.FIELD_SOURCE]: data.source,
      [config.FIELD_SUMMARY]: data.summary,
      [config.FIELD_DOC_URL]: {
        text: '查看文档',
        link: data.docUrl,
      },
      [config.FIELD_ORIGINAL_URL]: {
        text: '原文链接',
        link: data.originalUrl,
      },
      [config.FIELD_COLLECT_TIME]: data.collectTime.getTime(),
    };

    // 添加扩展字段（如果配置了）
    if (extendedFieldConfig.contentType) {
      fields[extendedFieldConfig.contentType] = '小红书';
    }
    if (extendedFieldConfig.imageCount) {
      fields[extendedFieldConfig.imageCount] = data.imageCount;
    }

    await larkClient.post(
      `/bitable/v1/apps/${config.BITABLE_APP_TOKEN}/tables/${config.BITABLE_TABLE_ID}/records`,
      { fields }
    );

    logger.info('小红书记录写入成功');
  } catch (error) {
    logger.warn('写入多维表格失败（不影响文档保存）', error);
  }
}

/**
 * 发送小红书成功卡片
 */
async function sendXhsSuccessCard(
  messageId: string,
  data: {
    title: string;
    author: string;
    imageCount: number;
    docUrl: string;
    wikiUrl: string;
    originalUrl: string;
    needScreenshot?: boolean;
  }
): Promise<void> {
  const elements: any[] = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**${data.title}**`,
      },
    },
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: `**作者**: @${data.author}`,
          },
        },
        {
          is_short: true,
          text: {
            tag: 'lark_md',
            content: data.imageCount > 0 ? `**图片**: ${data.imageCount} 张` : `**图片**: 待补充`,
          },
        },
      ],
    },
  ];

  // 如果需要截图，添加提示
  if (data.needScreenshot) {
    elements.push({
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content: '💡 图片未能自动获取，请发送小红书截图补充内容',
        },
      ],
    });
  }

  elements.push({ tag: 'hr' });
  elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '📄 查看文档',
        },
        type: 'primary',
        url: data.docUrl,
      },
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '📚 知识库',
        },
        type: 'default',
        url: data.wikiUrl,
      },
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '🔗 原文',
        },
        type: 'default',
        url: data.originalUrl,
      },
    ],
  });

  const card = {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: data.needScreenshot ? '📕 小红书笔记已记录（待补充图片）' : '📕 小红书笔记收藏成功',
      },
      template: data.needScreenshot ? 'orange' : 'red',
    },
    elements,
  };

  await larkClient.replyInteractiveCard(messageId, card);
}
