/**
 * 消息处理器
 * 处理用户发送的文章链接
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
} from '../utils/url-parser';
import { fetchArticleWithBrowser } from '../services/browser-fetcher';
import { extractAuthor, extractPublishTime } from '../services/jina-reader';
import { createDocument } from '../services/lark-doc';
import { addDocumentToWiki } from '../services/lark-wiki';
import { createArticleRecord, findRecordByUrl } from '../services/lark-bitable';
import { larkClient } from '../services/lark-client';
import { copyDocumentContent, getDocTokenFromWikiNode } from '../services/feishu-doc-copy';
import type { SaveResult, ProcessStatus } from '../types/article';

// 等待用户发送内容的状态缓存（简单实现）
const pendingContentRequests = new Map<string, { url: string; timestamp: number }>();
const PENDING_TIMEOUT = 5 * 60 * 1000; // 5 分钟超时

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
  
  // 优先检测飞书文档/知识库链接
  for (const url of urls) {
    const parsed = parseUrl(url);
    
    // 处理飞书云文档
    if (parsed.type === UrlType.FEISHU_DOC) {
      await processFeishuDoc(url, messageId, senderId);
      return;
    }
    
    // 处理飞书知识库（已经在知识库中）
    if (parsed.type === UrlType.FEISHU_WIKI) {
      await processFeishuWiki(url, messageId, senderId);
      return;
    }
  }
  
  const articleUrls = urls.filter(isValidArticleUrl);

  // 情况1：包含有效的文章链接
  if (articleUrls.length > 0) {
    for (const url of articleUrls) {
      await processArticleUrl(url, messageId, senderId);
    }
    return;
  }

  // 情况2：长文本内容（可能是用户复制的文章）
  const MIN_CONTENT_LENGTH = 200; // 最小内容长度
  if (text.length >= MIN_CONTENT_LENGTH) {
    await handleDirectContent(text, messageId, senderId);
    return;
  }

  // 情况3：短文本，显示帮助信息
  await larkClient.replyMessage(
    messageId,
    '👋 你好！我是文章收藏助手。\n\n' +
      '📎 **发送文章链接**，我会自动抓取内容并保存到飞书云文档和知识库。\n\n' +
      '📝 **直接发送文章内容**（200字以上），我也可以帮你保存。\n\n' +
      '支持的链接类型：\n' +
      '• 微信公众号文章\n' +
      '• 知乎、掘金、CSDN 等技术文章\n' +
      '• 其他网页文章\n\n' +
      '⚠️ 微信/知乎等网站可能有防爬限制，如遇问题可直接复制内容发送。\n\n' +
      '使用 /帮助 查看更多命令。'
  );
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
): Promise<void> {
  const cleanedUrl = cleanUrl(url);
  logger.info(`处理文章: ${cleanedUrl}`);

  try {
    // 1. 检查是否已收藏
    const existing = await findRecordByUrl(cleanedUrl);
    if (existing) {
      await larkClient.replyMessage(
        messageId,
        `⚠️ 这篇文章已经收藏过了\n\n` +
          `标题: ${existing.fields['标题'] || '未知'}\n` +
          `收藏时间: ${formatDate(existing.fields['收藏时间'])}`
      );
      return;
    }

    // 2. 发送处理中提示（Browser Use 需要较长时间）
    await larkClient.replyMessage(
      messageId, 
      '🤖 AI 正在智能抓取文章内容，请稍候...\n（首次抓取可能需要 30-60 秒）'
    );

    // 3. 使用 Browser Use 抓取文章内容
    const fetchResult = await fetchArticleWithBrowser(cleanedUrl, 180000); // 3 分钟超时
    logger.info(`文章抓取成功: ${fetchResult.title}`);

    // 4. 构建元数据
    const source = inferSourceFromUrl(cleanedUrl);
    const meta = {
      title: fetchResult.title || '未命名文章',
      author: fetchResult.author || '',
      publishTime: fetchResult.publishTime,
      source,
      originalUrl: cleanedUrl,
      summary: fetchResult.content.slice(0, 200) + (fetchResult.content.length > 200 ? '...' : ''),
    };

    // 5. 创建云文档
    await updateStatus(messageId, '📝 正在创建云文档...');
    const docResult = await createDocument(
      meta.title,
      fetchResult.content,
      meta
    );

    // 6. 添加到知识库
    await updateStatus(messageId, '📚 正在添加到知识库...');
    const wikiResult = await addDocumentToWiki(docResult.documentId);

    // 7. 写入多维表格
    await updateStatus(messageId, '📊 正在记录元信息...');
    await createArticleRecord({
      meta,
      docUrl: docResult.url,
      collectTime: new Date(),
    });

    // 8. 发送成功卡片
    await sendSuccessCard(messageId, {
      title: meta.title,
      author: meta.author,
      source: meta.source,
      docUrl: docResult.url,
      wikiUrl: wikiResult.url,
      originalUrl: cleanedUrl,
    });

    logger.info(`文章处理完成: ${meta.title}`);
  } catch (error) {
    logger.error('处理文章失败', error);
    
    // 发送错误提示
    await larkClient.replyMessage(
      messageId,
      `❌ 抓取失败\n\n` +
        `链接: ${cleanedUrl}\n` +
        `错误: ${error instanceof Error ? error.message : '未知错误'}\n\n` +
        `💡 建议：\n` +
        `1. 如果是微信文章，可以使用「飞书剪存」功能保存后，将飞书文档链接发给我\n` +
        `2. 可以直接复制文章内容（200字以上）发送给我保存`
    );
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
