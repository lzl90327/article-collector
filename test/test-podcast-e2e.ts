/**
 * 端到端测试：测试小宇宙播客处理流程（真实环境，Mock 消息回复）
 * 
 * 用法：npx ts-node test/test-podcast-e2e.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 手动 Mock lark-client
// 我们需要先保存原始的 require
const originalRequire = require;

import { handleTextMessage } from '../src/handlers/message';
import { logger } from '../src/utils/logger';
import { larkClient } from '../src/services/lark-client';

const TEST_URL = 'https://www.xiaoyuzhoufm.com/episode/696b3454109824f9e1f73e62';

async function runTest() {
  console.log('========================================');
  console.log('  小宇宙播客端到端测试 (真实处理)');
  console.log('========================================\n');

  // 覆盖 replyMessage 方法
  // @ts-ignore
  larkClient.replyMessage = async (msgId: string, content: any) => {
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (content.content && typeof content.content === 'string') {
       try {
         const json = JSON.parse(content.content);
         text = json.text || JSON.stringify(json);
       } catch {
         text = content.content;
       }
    } else {
      text = JSON.stringify(content);
    }
    console.log(`\n🤖 [Mock回复] ${text.substring(0, 200)}...\n`);
  };

  // 构造模拟事件
  const mockEvent = {
    event_id: `test-event-${Date.now()}`,
    header: {
      event_id: `test-event-${Date.now()}`,
      create_time: Date.now().toString(),
    },
    message: {
      message_id: `test-msg-${Date.now()}`,
      chat_id: 'test-chat-id',
      message_type: 'text',
      content: JSON.stringify({ text: TEST_URL }),
      sender: {
        sender_id: { user_id: 'test-user' },
        sender_type: 'user'
      }
    }
  };

  console.log(`测试 URL: ${TEST_URL}`);
  console.log('开始处理...\n');

  try {
    await handleTextMessage(mockEvent);
    console.log('\n✅ 测试完成！请检查日志中的转录结果和飞书文档链接。');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

runTest().catch(console.error);
