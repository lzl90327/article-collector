/**
 * 碎片想法处理器
 * 处理用户发送的碎片化想法和语音消息
 */

import { logger } from '../utils/logger';
import { larkClient } from '../services/lark-client';
import { classifyMessageIntent, MessageIntent } from '../services/deepseek-classifier';
import { transcribeWithBaidu } from '../services/baidu-asr';
import { createIdeaRecord, determineMaturity, IdeasBitableConfig } from '../services/ideas-bitable';
import { 
  ideasBitableConfig, 
  ideasFieldConfig, 
  llmConfig, 
  baiduASRConfig 
} from '../config';

/**
 * 获取想法库完整配置
 */
function getIdeasConfig(): IdeasBitableConfig {
  return {
    appToken: ideasBitableConfig.appToken,
    tableId: ideasBitableConfig.tableId,
    fields: ideasFieldConfig,
  };
}

/**
 * 处理碎片想法（文字消息）
 */
export async function handleIdeaMessage(
  text: string,
  messageId: string,
  senderId: string,
  intent?: MessageIntent
): Promise<void> {
  logger.info(`处理碎片想法: ${text.substring(0, 50)}...`);

  if (!ideasBitableConfig.enabled) {
    await larkClient.replyMessage(
      messageId,
      '❌ 碎片想法功能未配置\n\n请在 .env 中配置 IDEAS_BITABLE_APP_TOKEN 和 IDEAS_BITABLE_TABLE_ID'
    );
    return;
  }

  try {
    // 使用传入的 intent 或创建默认值
    const finalIntent = intent || {
      type: 'idea' as const,
      confidence: 0.8,
      ideaContent: text,
      emotion: '平静',
      scene: '其他',
    };

    // 创建想法记录 - 保存原始文本，而不是 LLM 的摘要
    const config = getIdeasConfig();
    const result = await createIdeaRecord(
      {
        content: text,  // 使用原始文本
        inputType: '文字',
        scene: finalIntent.scene || '其他',
        emotion: finalIntent.emotion || '平静',
        topics: finalIntent.topics,
        maturity: determineMaturity(text),  // 基于原始文本判断成熟度
        recordTime: new Date(),
      },
      config
    );

    logger.info(`碎片想法记录成功: ${result.recordId}`);

    // 发送确认消息（即使失败也不影响记录）
    try {
      const topicsStr = finalIntent.topics?.length ? `\n主题: ${finalIntent.topics.join(', ')}` : '';
      const confirmMsg = `💭 想法已记录！\n\n` +
        `内容: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}\n` +
        `情绪: ${finalIntent.emotion || '平静'} | 成熟度: ${determineMaturity(text)}${topicsStr}`;
      await larkClient.replyMessage(messageId, confirmMsg);
    } catch (replyError) {
      logger.warn('发送确认消息失败（记录已保存）', replyError);
    }

  } catch (error) {
    logger.error('处理碎片想法失败', error);
    await larkClient.replyMessage(messageId, '❌ 记录想法失败，请稍后重试');
  }
}

/**
 * 处理有感而发（文章+评论）
 */
export async function handleArticleWithComment(
  articleUrl: string,
  comment: string,
  messageId: string,
  senderId: string,
  intent?: MessageIntent
): Promise<void> {
  logger.info(`处理有感而发: ${articleUrl}, 评论: ${comment.substring(0, 30)}...`);

  if (!ideasBitableConfig.enabled) {
    await larkClient.replyMessage(
      messageId,
      '❌ 碎片想法功能未配置\n\n请在 .env 中配置 IDEAS_BITABLE_APP_TOKEN 和 IDEAS_BITABLE_TABLE_ID'
    );
    return;
  }

  try {
    // 尝试获取文章标题（简单实现：使用 URL）
    const articleTitle = await fetchArticleTitle(articleUrl);
    logger.info(`获取文章标题: ${articleTitle}, URL: ${articleUrl}`);

    // 创建想法记录，关联文章
    const config = getIdeasConfig();
    const ideaData = {
      content: comment,
      inputType: '文字' as const,
      scene: intent?.scene || '读书',
      emotion: intent?.emotion || '平静',
      relatedArticleUrl: articleUrl,
      relatedArticleTitle: articleTitle,
      topics: intent?.topics,
      maturity: determineMaturity(comment),
      recordTime: new Date(),
    };
    logger.info(`准备写入想法记录，关联URL: ${ideaData.relatedArticleUrl}, 关联标题: ${ideaData.relatedArticleTitle}`);
    
    const result = await createIdeaRecord(ideaData, config);

    logger.info(`有感而发记录成功: ${result.recordId}, 关联: ${articleTitle}`);

    // 发送确认消息
    try {
      await larkClient.replyMessage(
        messageId,
        `💭 有感而发已记录！\n\n` +
        `想法: ${comment.substring(0, 80)}${comment.length > 80 ? '...' : ''}\n` +
        `关联: ${articleTitle}\n` +
        `情绪: ${intent?.emotion || '平静'}\n\n` +
        `📎 如需同时收藏文章，请单独发送链接`
      );
    } catch (replyError) {
      logger.warn('发送确认消息失败（记录已保存）', replyError);
    }

  } catch (error) {
    logger.error('处理有感而发失败', error);
    await larkClient.replyMessage(messageId, '❌ 记录失败，请稍后重试');
  }
}

/**
 * 处理有感而发（直接传入标题，用于飞书文档）
 */
export async function handleArticleWithCommentDirect(
  comment: string,
  articleUrl: string,
  articleTitle: string,
  messageId: string,
  senderId: string
): Promise<void> {
  logger.info(`处理有感而发(直接): ${articleTitle}, 评论: ${comment.substring(0, 30)}...`);

  if (!ideasBitableConfig.enabled) {
    return;
  }

  try {
    const config = getIdeasConfig();
    const result = await createIdeaRecord(
      {
        content: comment,
        inputType: '文字',
        scene: '读书',
        emotion: '平静',
        relatedArticleUrl: articleUrl,
        relatedArticleTitle: articleTitle,
        maturity: determineMaturity(comment),
        recordTime: new Date(),
      },
      config
    );

    logger.info(`有感而发记录成功: ${result.recordId}, 关联: ${articleTitle}`);

    // 发送确认消息
    try {
      await larkClient.replyMessage(
        messageId,
        `💭 有感而发已记录！\n\n` +
        `想法: ${comment.substring(0, 80)}${comment.length > 80 ? '...' : ''}\n` +
        `关联: ${articleTitle}`
      );
    } catch (replyError) {
      logger.warn('发送确认消息失败（记录已保存）', replyError);
    }

  } catch (error) {
    logger.error('处理有感而发失败', error);
  }
}

/**
 * 处理语音消息
 */
export async function handleAudioMessage(event: any): Promise<void> {
  const message = event.message;
  const messageId = message?.message_id;
  const senderId = event.sender?.sender_id?.open_id;

  logger.info(`处理语音消息: ${messageId}`);

  // 检查配置
  if (!baiduASRConfig.enabled) {
    await larkClient.replyMessage(
      messageId,
      '❌ 语音识别功能未配置\n\n请在 .env 中配置 BAIDU_ASR_API_KEY 和 BAIDU_ASR_SECRET_KEY'
    );
    return;
  }

  if (!ideasBitableConfig.enabled) {
    await larkClient.replyMessage(
      messageId,
      '❌ 碎片想法功能未配置\n\n请在 .env 中配置 IDEAS_BITABLE_APP_TOKEN 和 IDEAS_BITABLE_TABLE_ID'
    );
    return;
  }

  try {
    // 1. 提示处理中
    await larkClient.replyMessage(messageId, '🎙️ 正在识别语音...');

    // 2. 解析语音消息内容
    let content: any;
    try {
      content = JSON.parse(message.content);
    } catch {
      content = message.content;
    }
    
    const fileKey = content.file_key;
    const duration = content.duration || 0; // 毫秒

    if (!fileKey) {
      await larkClient.replyMessage(messageId, '❌ 无法获取语音文件');
      return;
    }

    // 3. 下载语音文件
    const audioBuffer = await downloadAudioFile(messageId, fileKey);
    logger.info(`语音文件下载完成, 大小: ${audioBuffer.length} 字节`);

    // 4. 调用百度 ASR
    const transcription = await transcribeWithBaidu(
      audioBuffer,
      {
        apiKey: baiduASRConfig.apiKey,
        secretKey: baiduASRConfig.secretKey,
      }
    );

    if (!transcription) {
      await larkClient.replyMessage(
        messageId,
        '❌ 语音识别失败，请重试或使用文字输入'
      );
      return;
    }

    // 5. 使用 LLM 分类意图（如果配置了）
    let intent: MessageIntent | undefined;
    if (llmConfig.enabled) {
      intent = await classifyMessageIntent(
        transcription,
        'audio',
        llmConfig.apiKey
      );
    }

    // 6. 保存为想法
    const config = getIdeasConfig();
    const result = await createIdeaRecord(
      {
        content: transcription,
        inputType: '语音',
        scene: intent?.scene || '其他',
        emotion: intent?.emotion || '平静',
        voiceDuration: Math.round(duration / 1000),
        topics: intent?.topics,
        maturity: determineMaturity(transcription),
        recordTime: new Date(),
      },
      config
    );

    // 7. 发送确认卡片
    await sendIdeaConfirmCard(messageId, {
      content: transcription,
      emotion: intent?.emotion,
      scene: intent?.scene,
      topics: intent?.topics,
      inputType: '语音',
      voiceDuration: Math.round(duration / 1000),
    });

    logger.info(`语音想法记录成功: ${result.recordId}`);

  } catch (error) {
    logger.error('处理语音消息失败', error);
    await larkClient.replyMessage(
      messageId,
      '❌ 语音处理失败，请稍后重试或使用文字输入'
    );
  }
}

/**
 * 下载飞书语音文件
 */
async function downloadAudioFile(messageId: string, fileKey: string): Promise<Buffer> {
  // 使用飞书 SDK 下载资源文件
  const axios = (await import('axios')).default;
  const config = (await import('../config')).default;
  
  // 获取 access_token
  const tokenResponse = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: config.LARK_APP_ID,
      app_secret: config.LARK_APP_SECRET,
    }
  );
  const accessToken = tokenResponse.data.tenant_access_token;

  // 下载资源
  const response = await axios.get(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${fileKey}`,
    {
      params: { type: 'file' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    }
  );

  return Buffer.from(response.data);
}

/**
 * 获取文章标题（简单实现）
 */
async function fetchArticleTitle(url: string): Promise<string> {
  // 简单实现：从 URL 中提取域名作为标题
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    
    // 常见网站的友好名称
    const hostNames: Record<string, string> = {
      'mp.weixin.qq.com': '微信公众号文章',
      'www.zhihu.com': '知乎文章',
      'zhuanlan.zhihu.com': '知乎专栏',
      'juejin.cn': '掘金文章',
      'www.csdn.net': 'CSDN文章',
      '36kr.com': '36氪文章',
    };

    return hostNames[host] || `来自 ${host} 的文章`;
  } catch {
    return '关联文章';
  }
}

/**
 * 发送想法确认卡片
 */
async function sendIdeaConfirmCard(
  messageId: string,
  data: {
    content: string;
    emotion?: string;
    scene?: string;
    topics?: string[];
    inputType: string;
    voiceDuration?: number;
  }
): Promise<void> {
  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { 
        tag: 'plain_text', 
        content: data.inputType === '语音' ? '🎙️ 语音想法已记录' : '💭 想法已记录' 
      },
      template: 'turquoise',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**内容**: ${data.content.substring(0, 200)}${data.content.length > 200 ? '...' : ''}`,
        },
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**情绪**: ${data.emotion || '平静'}`,
            },
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**场景**: ${data.scene || '其他'}`,
            },
          },
        ],
      },
      ...(data.voiceDuration ? [{
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**语音时长**: ${data.voiceDuration}秒`,
        },
      }] : []),
      ...(data.topics && data.topics.length > 0 ? [{
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**主题**: ${data.topics.join(', ')}`,
        },
      }] : []),
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: '💡 发送 /汇总 可以查看今日想法分析',
          },
        ],
      },
    ],
  };

  await larkClient.replyInteractiveCard(messageId, card);
}

/**
 * 发送有感而发确认卡片
 */
async function sendArticleWithCommentCard(
  messageId: string,
  data: {
    content: string;
    articleUrl: string;
    articleTitle: string;
    emotion?: string;
  }
): Promise<void> {
  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '💭 有感而发已记录' },
      template: 'turquoise',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**你的想法**: ${data.content.substring(0, 150)}${data.content.length > 150 ? '...' : ''}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**关联文章**: [${data.articleTitle}](${data.articleUrl})`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**情绪**: ${data.emotion || '平静'}`,
        },
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📚 同时收藏这篇文章' },
            type: 'primary',
            value: JSON.stringify({
              action: 'save_related_article',
              url: data.articleUrl,
            }),
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '✅ 仅记录想法' },
            type: 'default',
            value: JSON.stringify({ action: 'dismiss' }),
          },
        ],
      },
    ],
  };

  await larkClient.replyInteractiveCard(messageId, card);
}
