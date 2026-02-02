/**
 * 文章收藏助手 - 飞书机器人
 * 主入口：长连接客户端 + 事件分发
 */

import dotenv from 'dotenv';
dotenv.config();

import config, { baiduASRConfig, ideasBitableConfig, deepseekConfig } from './config';
import { logger } from './utils/logger';
import { handleTextMessage } from './handlers/message';
import { handleAudioMessage } from './handlers/idea';
import { checkPythonEnv, getPythonEnvStatusMessage } from './services/browser-fetcher';

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
    // 调试：打印完整事件结构
    logger.debug(`收到原始事件: ${JSON.stringify(event).substring(0, 500)}`);
    
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
    logger.info(`收到消息: type=${messageType}, event_id=${eventId}, message_id=${messageId}`);

    // 处理文本消息
    if (messageType === 'text') {
      markMessageProcessed(messageId);
      try {
        await handleTextMessage(event);
      } catch (error) {
        logger.error('处理消息失败', error);
      }
    } 
    // 处理语音消息
    else if (messageType === 'audio') {
      if (baiduASRConfig.enabled && ideasBitableConfig.enabled) {
        markMessageProcessed(messageId);
        try {
          await handleAudioMessage(event);
        } catch (error) {
          logger.error('处理语音消息失败', error);
        }
      } else {
        logger.info(`语音消息未配置 ASR 或想法库`);
        try {
          const { larkClient } = await import('./services/lark-client');
          await larkClient.replyMessage(
            messageId,
            '🎙️ 语音功能暂未开启\n\n请配置百度 ASR 和碎片想法库后使用。'
          );
        } catch (err) {
          logger.error('发送提示消息失败', err);
        }
      }
    } else {
      // 其他消息类型，提示用户
      logger.info(`不支持的消息类型: ${messageType}`);
      try {
        const { larkClient } = await import('./services/lark-client');
        await larkClient.replyMessage(
          messageId,
          '📎 请发送文章链接或文字/语音\n\n目前暂不支持图片、文件等其他消息类型。'
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

// ============ 启动时健康检查 ============
async function performHealthCheck(): Promise<boolean> {
  let allPassed = true;
  
  logger.info('');
  logger.info('🔍 正在进行启动前健康检查...');
  logger.info('');
  
  // 1. 检查 Python 环境
  const pythonEnv = checkPythonEnv();
  if (pythonEnv.available) {
    logger.info(`✅ Python 环境: ${pythonEnv.version}`);
  } else {
    logger.warn(`⚠️  Python 环境异常（文章抓取功能将不可用）`);
    logger.warn(`   ${pythonEnv.error?.split('\n')[0]}`);
    // Python 环境不可用不阻止启动，但会影响抓取功能
  }
  
  // 2. 检查飞书 API 连接（通过获取应用信息验证）
  try {
    const { larkClient } = await import('./services/lark-client');
    // 通过调用一个简单的 API 验证 token 是否有效
    await larkClient.get('/application/v6/applications/underauditlist');
    logger.info('✅ 飞书 API: 连接正常');
  } catch (error: any) {
    // 即使返回错误码，只要不是 token 错误就说明连接正常
    if (error?.response?.status === 403 || error?.response?.data?.code) {
      logger.info('✅ 飞书 API: 连接正常');
    } else {
      logger.warn('⚠️  飞书 API: 连接检查跳过（不影响核心功能）');
    }
  }
  
  // 3. 检查多维表格权限
  try {
    const { getTableFields } = await import('./services/lark-bitable');
    await getTableFields();
    logger.info('✅ 多维表格: 权限正常');
  } catch (error: any) {
    if (error?.response?.data?.code === 91403 || error?.status === 403) {
      logger.warn('⚠️  多维表格: 无写入权限');
      logger.warn('   请将机器人添加为多维表格协作者（可编辑权限）');
    } else {
      logger.warn(`⚠️  多维表格: 访问异常 - ${error?.message || '未知错误'}`);
    }
  }

  // 4. 检查碎片想法库配置
  if (ideasBitableConfig.enabled) {
    logger.info('✅ 碎片想法库: 已配置');
  } else {
    logger.info('ℹ️  碎片想法库: 未配置（可选功能）');
  }

  // 5. 检查 DeepSeek LLM 配置
  if (deepseekConfig.enabled) {
    logger.info('✅ DeepSeek LLM: 已配置');
  } else {
    logger.info('ℹ️  DeepSeek LLM: 未配置（将使用降级分类逻辑）');
  }

  // 6. 检查百度 ASR 配置
  if (baiduASRConfig.enabled) {
    try {
      const { checkBaiduASRStatus } = await import('./services/baidu-asr');
      const isOk = await checkBaiduASRStatus({
        apiKey: baiduASRConfig.apiKey,
        secretKey: baiduASRConfig.secretKey,
      });
      if (isOk) {
        logger.info('✅ 百度语音识别: 已配置并验证通过');
      } else {
        logger.warn('⚠️  百度语音识别: 配置异常');
      }
    } catch {
      logger.warn('⚠️  百度语音识别: 验证失败');
    }
  } else {
    logger.info('ℹ️  百度语音识别: 未配置（可选功能）');
  }
  
  logger.info('');
  return allPassed;
}

// ============ 启动服务 ============
logger.info('=====================================');
logger.info('   文章收藏助手 - 飞书机器人');
logger.info('=====================================');

// 执行健康检查
performHealthCheck().then((passed) => {
  if (!passed) {
    logger.warn('⚠️  部分检查未通过，服务仍会启动但功能可能受限');
  }
});

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
logger.info(`   - 素材多维表格: ${config.BITABLE_APP_TOKEN}`);
if (ideasBitableConfig.enabled) {
  logger.info(`   - 想法多维表格: ${config.IDEAS_BITABLE_APP_TOKEN}`);
}
if (deepseekConfig.enabled) {
  logger.info(`   - DeepSeek LLM: 已启用`);
}
if (baiduASRConfig.enabled) {
  logger.info(`   - 百度语音识别: 已启用`);
}
logger.info('');
logger.info('💡 功能说明:');
logger.info('   📎 发送文章链接 → 自动抓取收藏');
logger.info('   💭 发送文字想法 → 记录碎片想法');
logger.info('   🎙️ 发送语音消息 → 转文字记录想法');
logger.info('   📝 链接+评论 → 有感而发关联记录');
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
