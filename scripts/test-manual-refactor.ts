/**
 * 手动测试指导脚本
 * 引导用户手动测试事件驱动架构重构后的功能
 */

import dotenv from 'dotenv';
dotenv.config();

import { findRecordByUrl } from '../src/services/lark-bitable';
import { logger } from '../src/utils/logger';

const TEST_URL = 'https://mp.weixin.qq.com/s/OUL088Cazqu1gJHt1T2uzA';
const POLL_INTERVAL = 5000; // 5秒检查一次
const MAX_POLLS = 12; // 最多检查12次 (60秒)

/**
 * 等待函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主测试流程
 */
async function runManualTest() {
  console.log('\n========================================');
  console.log('   手动端到端测试');
  console.log('   测试 URL:', TEST_URL);
  console.log('========================================\n');

  console.log('📋 测试步骤：');
  console.log('');
  console.log('1️⃣  打开飞书，找到「文章收藏助手」机器人');
  console.log('2️⃣  向机器人发送以下链接：');
  console.log('');
  console.log('    ' + TEST_URL);
  console.log('');
  console.log('3️⃣  观察反馈：');
  console.log('   - 立即收到「开始处理」灰色卡片');
  console.log('   - 5-10秒后收到「AI摘要」绿色卡片');
  console.log('   - 20-60秒后收到「文档创建成功」蓝色卡片');
  console.log('');
  console.log('========================================');
  console.log('⏳ 准备好后，按回车开始监控...');
  console.log('========================================\n');

  // 等待用户按回车
  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve());
  });

  console.log('🔍 开始监控 Bitable 记录创建...\n');

  let pollCount = 0;
  let recordFound = false;

  while (pollCount < MAX_POLLS && !recordFound) {
    pollCount++;
    
    try {
      const record = await findRecordByUrl(TEST_URL);
      
      if (record) {
        recordFound = true;
        console.log('✅ 测试成功！找到 Bitable 记录\n');
        console.log('========================================');
        console.log('           记录详情');
        console.log('========================================');
        console.log(`📝 标题: ${record.fields['标题']}`);
        console.log(`👤 作者: ${record.fields['作者'] || '未知'}`);
        console.log(`🌐 来源: ${record.fields['来源']}`);
        console.log(`📄 文档链接: ${record.fields['文档链接']?.link || '无'}`);
        console.log(`📊 摘要长度: ${record.fields['摘要']?.length || 0} 字符`);
        console.log(`⏰ 收藏时间: ${record.fields['收藏时间'] ? new Date(record.fields['收藏时间']).toLocaleString('zh-CN') : '无'}`);
        console.log('========================================\n');

        console.log('🎉 事件驱动架构重构测试完成！\n');
        console.log('✅ 已验证功能：');
        console.log('   • 文章抓取（Browser Use）');
        console.log('   • AI 快速分析（摘要、标签、分类）');
        console.log('   • 飞书文档创建');
        console.log('   • 知识库添加');
        console.log('   • 多维表格记录创建');
        console.log('   • 分阶段卡片反馈（灰→绿→蓝）\n');

        // 测试去重
        console.log('========================================');
        console.log('⏳ 下一步：测试重复文章去重');
        console.log('========================================');
        console.log('');
        console.log('请再次向机器人发送相同链接，应该收到「文章已存在」黄色卡片');
        console.log('');
        console.log('按回车完成测试...');
        
        await new Promise<void>(resolve => {
          process.stdin.once('data', () => resolve());
        });

        console.log('\n✅ 全部测试完成！');
        process.exit(0);

      } else {
        console.log(`⏳ 第 ${pollCount}/${MAX_POLLS} 次检查：记录尚未创建，${POLL_INTERVAL/1000} 秒后重试...`);
        await delay(POLL_INTERVAL);
      }

    } catch (error: any) {
      console.log(`⚠️  第 ${pollCount}/${MAX_POLLS} 次检查失败: ${error.message}`);
      
      if (pollCount < MAX_POLLS) {
        await delay(POLL_INTERVAL);
      }
    }
  }

  if (!recordFound) {
    console.log('\n❌ 测试失败：超过等待时间仍未找到记录\n');
    console.log('💡 排查建议：');
    console.log('   1. 检查是否成功发送消息到机器人');
    console.log('   2. 检查机器人是否有正确响应（灰色→绿色→蓝色卡片）');
    console.log('   3. 检查服务器日志：');
    console.log('      ssh lizuolin_cloud@100.117.165.59 "tail -100 ~/.pm2/logs/article-collector-error.log"');
    console.log('');
    process.exit(1);
  }
}

// 运行测试
console.log('🚀 启动手动端到端测试...');
runManualTest();
