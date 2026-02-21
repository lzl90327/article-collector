#!/usr/bin/env node
/**
 * 小程序 E2E 测试
 * 使用 miniprogram-automator 进行自动化测试
 */

const automator = require('miniprogram-automator');
const path = require('path');

// 测试配置
const CONFIG = {
  projectPath: path.join(__dirname, '../frontend/dist'),
  timeout: 60000,
};

// 测试统计
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

async function test(name, fn) {
  console.log(`\n📝 开始测试: ${name}`);
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'passed' });
    console.log(`✅ ${name} 通过`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
    console.log(`❌ ${name} 失败: ${error.message}`);
  }
}

async function runE2ETests() {
  console.log('🚀 启动小程序 E2E 测试\n');
  console.log(`项目路径: ${CONFIG.projectPath}\n`);

  let miniProgram;

  try {
    // 启动小程序
    console.log('正在启动小程序...');
    miniProgram = await automator.launch({
      projectPath: CONFIG.projectPath,
    });
    console.log('✅ 小程序启动成功\n');

    // 测试 1: 首页加载
    await test('首页加载', async () => {
      const page = await miniProgram.reLaunch('/pages/index/index');
      await page.waitFor(1000);
      
      const title = await page.$('.title');
      if (!title) {
        throw new Error('未找到标题元素');
      }
    });

    // 测试 2: 输入框存在
    await test('输入框存在', async () => {
      const page = await miniProgram.currentPage();
      const input = await page.$('input');
      if (!input) {
        throw new Error('未找到输入框');
      }
    });

    // 测试 3: 输入文字
    await test('输入文字', async () => {
      const page = await miniProgram.currentPage();
      const input = await page.$('input');
      
      // 尝试输入文字
      await input.input('AI 焦虑测试');
      await page.waitFor(500);
      
      // 获取输入值
      const value = await input.property('value');
      if (value !== 'AI 焦虑测试') {
        throw new Error(`输入值不匹配: ${value}`);
      }
    });

    // 测试 4: 点击按钮
    await test('点击开始写作按钮', async () => {
      const page = await miniProgram.currentPage();
      const button = await page.$('button');
      
      if (!button) {
        throw new Error('未找到按钮');
      }
      
      await button.tap();
      await page.waitFor(2000);
    });

    // 测试 5: 页面跳转
    await test('页面跳转到工作流', async () => {
      const page = await miniProgram.currentPage();
      const path = await page.path();
      
      if (!path.includes('workflow')) {
        throw new Error(`未跳转到工作流页面: ${path}`);
      }
    });

    // 关闭小程序
    await miniProgram.close();
    console.log('\n✅ 小程序已关闭');

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    if (miniProgram) {
      await miniProgram.close();
    }
    process.exit(1);
  }

  // 生成报告
  generateReport();
}

function generateReport() {
  console.log('\n📊 测试报告\n');
  console.log('='.repeat(50));
  
  results.tests.forEach((test, index) => {
    const status = test.status === 'passed' ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${test.name}`);
    if (test.error) {
      console.log(`   错误: ${test.error}`);
    }
  });
  
  console.log('='.repeat(50));
  console.log(`通过: ${results.passed}`);
  console.log(`失败: ${results.failed}`);
  console.log(`总计: ${results.tests.length}`);
  
  const passRate = results.tests.length > 0 
    ? (results.passed / results.tests.length * 100).toFixed(1) 
    : 0;
  console.log(`通过率: ${passRate}%`);
  
  console.log('\n✨ E2E 测试完成\n');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// 检查是否安装了 miniprogram-automator
try {
  require.resolve('miniprogram-automator');
  runE2ETests();
} catch (e) {
  console.log('⚠️ 请先安装 miniprogram-automator:');
  console.log('npm install miniprogram-automator --save-dev\n');
  console.log('注意：需要安装微信开发者工具并配置 CLI 路径\n');
  process.exit(1);
}
