/**
 * 本地测试小宇宙播客处理流程
 * 模拟飞书消息事件
 */

import dotenv from 'dotenv';
dotenv.config();

import { handleTextMessage } from './src/handlers/message';
import { logger } from './src/utils/logger';

const TEST_URL = 'https://www.xiaoyuzhoufm.com/episode/696b3454109824f9e1f73e62';

// 模拟飞书消息事件
function createMockMessageEvent(text: string, userId: string, messageId: string, eventId: string) {
  return {
    event_id: eventId,
    header: {
      event_id: eventId,
      token: 'test-token',
      create_time: Date.now().toString(),
    },
    message: {
      message_id: messageId,
      chat_type: 'p2p',
      chat_id: 'test-chat-123',
      sender: {
        sender_id: {
          open_id: userId,
          union_id: userId,
          user_id: userId,
        },
        sender_type: 'user',
      },
      create_time: Date.now().toString(),
      message_type: 'text',
      content: JSON.stringify({ text }),
    },
  };
}

async function testPodcastWorkflow() {
  console.log('========================================');
  console.log('  小宇宙播客本地测试');
  console.log('========================================\n');

  const eventId = `test-event-${Date.now()}`;
  const messageId = `test-msg-${Date.now()}`;
  const userId = 'test-user-123';

  console.log('测试链接:', TEST_URL);
  console.log('事件ID:', eventId);
  console.log('消息ID:', messageId);
  console.log('');

  const mockEvent = createMockMessageEvent(TEST_URL, userId, messageId, eventId);

  console.log('开始处理...\n');
  const startTime = Date.now();

  try {
    await handleTextMessage(mockEvent);

    const duration = (Date.now() - startTime) / 1000;
    console.log('\n========================================');
    console.log('  ✅ 处理完成!');
    console.log(`  ⏱️  耗时: ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒`);
    console.log('========================================');

    return true;
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    console.log('\n========================================');
    console.log('  ❌ 处理失败!');
    console.log(`  错误: ${error.message}`);
    console.log(`  ⏱️  耗时: ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒`);
    console.log('========================================');
    logger.error('本地测试失败', error);
    return false;
  }
}

async function main() {
  const success = await testPodcastWorkflow();
  process.exit(success ? 0 : 1);
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n用户取消测试');
  process.exit(0);
});

main().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
