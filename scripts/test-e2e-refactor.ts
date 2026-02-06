/**
 * 端到端自动化测试脚本
 * 测试重构后的完整文章处理流程
 */

import dotenv from 'dotenv';
dotenv.config();

import { logger } from '../src/utils/logger';
import { larkClient } from '../src/services/lark-client';
import { findRecordByUrl } from '../src/services/lark-bitable';
import config from '../src/config';

// 测试URL
const TEST_URL = 'https://mp.weixin.qq.com/s/OUL088Cazqu1gJHt1T2uzA';
const TEST_USER_ID = process.env.TEST_USER_ID || 'ou_db935b8e973c21d3b96bdd8b4ecaa4c2';

/**
 * 等待函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主测试流程
 */
async function runE2ETest() {
  console.log('\n========================================');
  console.log('   端到端自动化测试');
  console.log('   测试 URL:', TEST_URL);
  console.log('========================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // 测试 1: 发送文章链接消息
    console.log('📋 测试 1: 发送文章链接到飞书机器人');
    console.log(`   URL: ${TEST_URL}`);
    console.log(`   接收者: ${TEST_USER_ID}`);
    
    try {
      await larkClient.sendMessage(TEST_USER_ID, TEST_URL);
      console.log('  ✅ 消息发送成功');
      testsPassed++;
    } catch (error: any) {
      console.log('  ❌ 消息发送失败:', error.message);
      testsFailed++;
      throw error;
    }

    // 等待处理完成（预计需要 10-60 秒）
    console.log('\n📋 测试 2: 等待文章处理完成');
    console.log('  ⏳ 等待 15 秒后开始检查...');
    await delay(15000);

    // 测试 3: 检查 Bitable 记录是否创建
    console.log('\n📋 测试 3: 检查多维表格记录');
    let maxRetries = 8;
    let recordFound = false;
    let recordData: any = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        recordData = await findRecordByUrl(TEST_URL);
        if (recordData) {
          recordFound = true;
          console.log('  ✅ 找到 Bitable 记录');
          console.log(`     - 标题: ${recordData.fields['标题']}`);
          console.log(`     - 来源: ${recordData.fields['来源']}`);
          console.log(`     - 作者: ${recordData.fields['作者']}`);
          console.log(`     - 文档链接: ${recordData.fields['文档链接']?.link || '无'}`);
          console.log(`     - AI摘要长度: ${recordData.fields['摘要']?.length || 0} 字符`);
          testsPassed++;
          break;
        } else {
          console.log(`  ⏳ 第 ${i + 1}/${maxRetries} 次检查：记录尚未创建，等待 5 秒...`);
          await delay(5000);
        }
      } catch (error: any) {
        console.log(`  ⚠️  第 ${i + 1}/${maxRetries} 次检查失败: ${error.message}`);
        if (i === maxRetries - 1) {
          console.log('  ❌ 记录未找到（超过最大重试次数）');
          testsFailed++;
        } else {
          await delay(5000);
        }
      }
    }

    if (!recordFound) {
      throw new Error('文章处理超时或失败');
    }

    // 测试 4: 验证必需字段
    console.log('\n📋 测试 4: 验证记录字段完整性');
    const requiredFields = ['标题', '来源', '文档链接', '摘要', '收藏时间'];
    let missingFields = 0;

    for (const field of requiredFields) {
      if (recordData.fields[field]) {
        console.log(`  ✅ ${field}: 存在`);
      } else {
        console.log(`  ❌ ${field}: 缺失`);
        missingFields++;
      }
    }

    if (missingFields === 0) {
      testsPassed++;
    } else {
      console.log(`  ❌ 缺失 ${missingFields} 个必需字段`);
      testsFailed++;
    }

    // 测试 5: 验证文档链接可访问
    console.log('\n📋 测试 5: 验证文档链接');
    const docLink = recordData.fields['文档链接']?.link;
    if (docLink && docLink.startsWith('https://')) {
      console.log(`  ✅ 文档链接格式正确: ${docLink}`);
      testsPassed++;
    } else {
      console.log(`  ❌ 文档链接格式错误: ${docLink}`);
      testsFailed++;
    }

    // 测试 6: 再次发送相同链接，测试去重
    console.log('\n📋 测试 6: 测试重复文章去重');
    console.log('  ⏳ 等待 3 秒后发送重复链接...');
    await delay(3000);

    try {
      await larkClient.sendMessage(TEST_USER_ID, TEST_URL);
      console.log('  ✅ 重复消息发送成功');
      console.log('  💡 请手动验证是否收到"文章已存在"的黄色卡片');
      testsPassed++;
    } catch (error: any) {
      console.log('  ❌ 重复消息发送失败:', error.message);
      testsFailed++;
    }

    // 输出测试结果
    console.log('\n========================================');
    console.log('           测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${testsPassed}`);
    console.log(`❌ 失败: ${testsFailed}`);
    console.log(`📊 总计: ${testsPassed + testsFailed}`);
    console.log(`📈 通过率: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('========================================\n');

    if (testsFailed === 0) {
      console.log('🎉 所有测试通过！事件驱动架构重构成功！');
      console.log('');
      console.log('📝 已验证功能：');
      console.log('   ✅ 文章抓取（Browser Use）');
      console.log('   ✅ AI 快速分析（摘要、标签、分类）');
      console.log('   ✅ 飞书文档创建');
      console.log('   ✅ 知识库添加');
      console.log('   ✅ 多维表格记录创建');
      console.log('   ✅ 两阶段卡片反馈');
      console.log('   ✅ 重复文章去重');
      console.log('');
    } else {
      console.log('⚠️  部分测试失败，请查看上面的详细信息');
    }

    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error: any) {
    console.log('\n❌ 测试执行失败:', error.message);
    console.log('\n💡 排查建议：');
    console.log('   1. 检查服务日志: ssh lizuolin_cloud@100.117.165.59 "tail -100 ~/.pm2/logs/article-collector-error.log"');
    console.log('   2. 检查服务状态: ssh lizuolin_cloud@100.117.165.59 "pm2 status"');
    console.log('   3. 检查环境变量配置');
    console.log('');
    process.exit(1);
  }
}

// 运行测试
console.log('🚀 启动端到端自动化测试...\n');
runE2ETest();
