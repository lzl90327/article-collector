
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env') });

// 手动 Mock lark-client (避免真实发送消息)
const larkClientModule = require('./src/services/lark-client');
larkClientModule.larkClient.replyMessage = async (msgId: string, content: any) => {
  console.log(`\n🤖 [Mock飞书回复] ${typeof content === 'string' ? content : JSON.stringify(content)}\n`);
};

import { bilibiliService } from './src/services/bilibili-service';
import { logger } from './src/utils/logger';

// 测试 URL (默认使用用户提供的 BVID)
const TEST_URL = process.argv[2] || 'https://www.bilibili.com/video/BV1m6FszwE4g';

async function runTest() {
  console.log('========================================');
  console.log('  B站视频转录真实环境测试脚本');
  console.log('========================================\n');
  console.log(`目标 URL: ${TEST_URL}`);
  console.log('正在开始处理...\n');

  try {
    const startTime = Date.now();
    
    // 调用真实的服务逻辑
    // messageId 传 'test-msg-id' 以触发中间状态通知的 Mock 回复
    const result = await bilibiliService.processVideo(TEST_URL, 'test-msg-id');

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n========================================');
    console.log(`✅ 处理完成! 耗时: ${duration}秒`);
    console.log('========================================\n');
    
    console.log(`📺 标题: ${result.videoInfo.title}`);
    console.log(`👤 作者: ${result.videoInfo.author}`);
    console.log(`⏱️ 时长: ${Math.floor(result.videoInfo.duration / 60)}分${result.videoInfo.duration % 60}秒`);
    
    console.log('\n📝 字幕/转录预览 (前 200 字):');
    console.log('----------------------------------------');
    console.log(result.subtitle.substring(0, 200) + '...');
    console.log('----------------------------------------');
    
    console.log(`\n📄 飞书文档链接: ${result.docUrl}`);
    console.log(`🔑 文档 Token: ${result.docToken}`);

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error);
    if (error.response) {
      console.error('API 响应:', error.response.data);
    }
  }
}

runTest().catch(console.error);
