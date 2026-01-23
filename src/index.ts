/**
 * 文章收藏助手 - 飞书机器人
 * 主入口：长连接客户端 + 事件分发
 */

import dotenv from 'dotenv';
dotenv.config();

import config from './config';
import { logger } from './utils/logger';
import { handleTextMessage } from './handlers/message';

// 导入飞书 SDK
const { WSClient, EventDispatcher, LoggerLevel } = require('@larksuiteoapi/node-sdk');

// ============ 事件去重机制 ============
const processedEvents = new Map<string, number>();
const processedMessages = new Map<string, number>();
const EVENT_CACHE_TTL = 5 * 60 * 1000;  // 5 分钟
const MESSAGE_CACHE_TTL = 24 * 60 * 60 * 1000;  // 24 小时
const CACHE_CLEANUP_INTERVAL = 60 * 1000;  // 1 分钟清理一次

// 检查事件是否已处理
function isEventProcessed(eventId: string): boolean {
  if (!eventId) return false;
  return processedEvents.has(eventId);
}

// 检查消息是否已处理
function isMessageProcessed(messageId: string): boolean {
  if (!messageId) return false;
  return processedMessages.has(messageId);
}

// 标记事件为已处理
function markEventProcessed(eventId: string): void {
  if (!eventId) return;
  processedEvents.set(eventId, Date.now());
}

// 标记消息为已处理
function markMessageProcessed(messageId: string): void {
  if (!messageId) return;
  processedMessages.set(messageId, Date.now());
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  let cleanedEvents = 0;
  let cleanedMessages = 0;

  for (const [eventId, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_CACHE_TTL) {
      processedEvents.delete(eventId);
      cleanedEvents++;
    }
  }

  for (const [messageId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_CACHE_TTL) {
      processedMessages.delete(messageId);
      cleanedMessages++;
    }
  }

  if (cleanedEvents > 0 || cleanedMessages > 0) {
    logger.debug(
      `清理缓存: 事件 ${cleanedEvents} 个, 消息 ${cleanedMessages} 个`
    );
  }
}, CACHE_CLEANUP_INTERVAL);

// ============ 创建事件分发器 ============
const eventDispatcher = new EventDispatcher({
  loggerLevel: LoggerLevel.INFO,
});

// 注册消息接收事件
eventDispatcher.register({
  'im.message.receive_v1': async (event: any) => {
    // 事件去重
    const eventId = event.event_id || event.header?.event_id;
    if (isEventProcessed(eventId)) {
      logger.debug(`跳过重复事件: ${eventId}`);
      return;
    }
    markEventProcessed(eventId);

    // 消息去重
    const messageId = event.message?.message_id;
    if (isMessageProcessed(messageId)) {
      logger.debug(`跳过已处理消息: ${messageId}`);
      return;
    }

    const messageType = event.message?.message_type;
    logger.info(`收到消息: type=${messageType}, event_id=${eventId}`);

    // 只处理文本消息
    if (messageType === 'text') {
      markMessageProcessed(messageId);
      try {
        await handleTextMessage(event);
      } catch (error) {
        logger.error('处理消息失败', error);
      }
    } else {
      // 其他消息类型，提示用户
      logger.info(`不支持的消息类型: ${messageType}`);
      try {
        const { larkClient } = await import('./services/lark-client');
        await larkClient.replyMessage(
          messageId,
          '📎 请发送文章链接（文本消息）\n\n目前暂不支持图片、文件等其他消息类型。'
        );
      } catch (err) {
        logger.error('发送提示消息失败', err);
      }
    }
  },

  // 注册卡片交互回调事件
  'card.action.trigger': async (event: any) => {
    const eventId = event.event_id || event.header?.event_id;
    if (isEventProcessed(eventId)) {
      logger.debug(`跳过重复卡片事件: ${eventId}`);
      return;
    }
    markEventProcessed(eventId);

    logger.info(`收到卡片交互: event_id=${eventId}`);

    try {
      const { handleCardAction } = await import('./handlers/card-action');
      await handleCardAction(event);
    } catch (error) {
      logger.error('处理卡片交互失败', error);
    }
  },
});

// ============ 创建 WebSocket 客户端 ============
const wsClient = new WSClient({
  appId: config.LARK_APP_ID,
  appSecret: config.LARK_APP_SECRET,
  loggerLevel: LoggerLevel.INFO,
});

// ============ 启动服务 ============
logger.info('=====================================');
logger.info('   文章收藏助手 - 飞书机器人');
logger.info('=====================================');
logger.info('');
logger.info('正在建立长连接...');

wsClient.start({
  eventDispatcher: eventDispatcher,
});

logger.info('');
logger.info('✅ 长连接客户端已启动');
logger.info('');
logger.info('📌 配置信息:');
logger.info(`   - 知识库空间: ${config.WIKI_SPACE_ID}`);
logger.info(`   - 多维表格: ${config.BITABLE_APP_TOKEN}`);
logger.info('');
logger.info('💡 使用说明:');
logger.info('   1. 在飞书开放平台启用「使用长连接接收事件」');
logger.info('   2. 订阅 im.message.receive_v1 事件');
logger.info('   3. 给机器人发送文章链接即可收藏');
logger.info('');
logger.info('按 Ctrl+C 停止服务');

// ============ 优雅关闭 ============
process.on('SIGINT', () => {
  logger.info('');
  logger.info('正在关闭服务...');
  try {
    if (typeof (wsClient as any).stop === 'function') {
      (wsClient as any).stop();
    } else if (typeof (wsClient as any).close === 'function') {
      (wsClient as any).close();
    }
  } catch (e) {
    // 忽略关闭错误
  }
  logger.info('✅ 服务已停止');
  process.exit(0);
});

// 未捕获异常处理
process.on('unhandledRejection', (error) => {
  logger.error('未处理的 Promise 拒绝:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});
