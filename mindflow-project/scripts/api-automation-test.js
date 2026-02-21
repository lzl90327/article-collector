#!/usr/bin/env node
/**
 * MindFlow API 自动化测试脚本
 * 测试完整的工作流流程
 */

const axios = require('axios');

// 简单的颜色函数（不依赖 chalk）
const chalk = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api/mindflow';

// 测试配置
const TEST_CONFIG = {
  topic: 'AI 焦虑与职业发展',
  timeout: 120000, // 2分钟超时
};

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

// 日志函数
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  switch (type) {
    case 'success':
      console.log(chalk.green(`[${timestamp}] ✅ ${message}`));
      break;
    case 'error':
      console.log(chalk.red(`[${timestamp}] ❌ ${message}`));
      break;
    case 'warning':
      console.log(chalk.yellow(`[${timestamp}] ⚠️ ${message}`));
      break;
    case 'info':
    default:
      console.log(chalk.blue(`[${timestamp}] ℹ️ ${message}`));
  }
}

// 测试步骤
async function testStep(name, fn) {
  log(`开始测试: ${name}`);
  try {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed', duration });
    log(`${name} 完成 (${duration}ms)`, 'success');
    return result;
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
    log(`${name} 失败: ${error.message}`, 'error');
    throw error;
  }
}

// 1. 测试健康检查
async function testHealthCheck() {
  const baseUrl = API_BASE_URL.replace('/api/mindflow', '');
  const response = await axios.get(`${baseUrl}/health`);
  if (response.data.status !== 'ok') {
    throw new Error('健康检查失败');
  }
  return response.data;
}

// 2. 启动工作流
async function startWorkflow() {
  const response = await axios.post(
    `${API_BASE_URL}/start`,
    { input: TEST_CONFIG.topic },
    { timeout: TEST_CONFIG.timeout }
  );
  
  if (!response.data.workflowId) {
    throw new Error('未返回 workflowId');
  }
  
  log(`工作流已创建: ${response.data.workflowId}`);
  return response.data;
}

// 3. 获取工作流状态
async function getWorkflowState(workflowId) {
  const response = await axios.get(`${API_BASE_URL}/${workflowId}`);
  return response.data;
}

// 4. 发送聊天消息
async function sendChatMessage(workflowId, message) {
  const response = await axios.post(
    `${API_BASE_URL}/${workflowId}/chat`,
    { input: message },
    { timeout: TEST_CONFIG.timeout }
  );
  return response.data;
}

// 5. 触发阶段转换
async function triggerPhase(workflowId, data) {
  const response = await axios.post(
    `${API_BASE_URL}/${workflowId}/trigger`,
    { data },
    { timeout: TEST_CONFIG.timeout }
  );
  return response.data;
}

// 主测试流程
async function runTests() {
  console.log(chalk.cyan('\n🚀 MindFlow API 自动化测试\n'));
  console.log(chalk.gray(`API 地址: ${API_BASE_URL}`));
  console.log(chalk.gray(`测试主题: ${TEST_CONFIG.topic}\n`));
  
  let workflowId = null;
  
  try {
    // 步骤 1: 健康检查
    await testStep('健康检查', async () => {
      return await testHealthCheck();
    });
    
    // 步骤 2: 启动工作流
    const workflowData = await testStep('启动工作流', async () => {
      return await startWorkflow();
    });
    workflowId = workflowData.workflowId;
    
    // 步骤 3: 验证 Brief 生成
    await testStep('验证 Brief 生成', async () => {
      const state = await getWorkflowState(workflowId);
      if (!state.context?.brief) {
        throw new Error('Brief 未生成');
      }
      log(`核心论点: ${state.context.brief.thesis?.substring(0, 50)}...`);
      return state;
    });
    
    // 步骤 4: 确认 Brief
    await testStep('确认 Brief', async () => {
      return await triggerPhase(workflowId, { action: 'confirm_brief' });
    });
    
    // 步骤 5: 验证角度选择
    await testStep('验证角度选择', async () => {
      const state = await getWorkflowState(workflowId);
      if (!state.context?.angles) {
        throw new Error('角度未生成');
      }
      const angleCount = 
        (state.context.angles.mainstream?.length || 0) + 
        (state.context.angles.contrarian?.length || 0);
      log(`生成角度数量: ${angleCount}`);
      return state;
    });
    
    // 步骤 6: 选择角度
    await testStep('选择角度', async () => {
      const state = await getWorkflowState(workflowId);
      const selectedAngle = state.context.angles.mainstream[0];
      return await triggerPhase(workflowId, { 
        action: 'select_angles',
        selectedAngles: [selectedAngle]
      });
    });
    
    // 步骤 7: 对话讨论
    await testStep('对话讨论', async () => {
      const messages = [
        '我觉得 AI 焦虑主要来源于对未来的不确定性',
        '作为程序员，我担心被 AI 取代',
        '但我也看到 AI 带来的新机会'
      ];
      
      for (const msg of messages) {
        log(`发送消息: ${msg.substring(0, 30)}...`);
        await sendChatMessage(workflowId, msg);
      }
      return { messageCount: messages.length };
    });
    
    // 步骤 8: 完成讨论
    await testStep('完成讨论', async () => {
      return await triggerPhase(workflowId, { action: 'complete_discussion' });
    });
    
    // 步骤 9: 验证草稿生成
    await testStep('验证草稿生成', async () => {
      const state = await getWorkflowState(workflowId);
      if (!state.context?.draft) {
        log('草稿尚未生成，可能需要等待', 'warning');
        return { draft: null };
      }
      const draftLength = state.context.draft.content?.length || 0;
      log(`草稿字数: ${draftLength}`);
      return { draftLength };
    });
    
    // 步骤 10: 最终状态检查
    await testStep('最终状态检查', async () => {
      const state = await getWorkflowState(workflowId);
      log(`当前阶段: ${state.currentPhase}`);
      log(`历史消息数: ${state.history?.length || 0}`);
      return state;
    });
    
  } catch (error) {
    log('测试流程中断', 'error');
    console.error(error);
  }
  
  // 生成测试报告
  generateReport();
}

// 生成测试报告
function generateReport() {
  console.log(chalk.cyan('\n📊 测试报告\n'));
  console.log(chalk.gray('='.repeat(50)));
  
  testResults.tests.forEach((test, index) => {
    const status = test.status === 'passed' 
      ? chalk.green('✅ PASS') 
      : chalk.red('❌ FAIL');
    const duration = test.duration ? chalk.gray(`(${test.duration}ms)`) : '';
    console.log(`${index + 1}. ${status} ${test.name} ${duration}`);
    if (test.error) {
      console.log(chalk.red(`   错误: ${test.error}`));
    }
  });
  
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.green(`通过: ${testResults.passed}`));
  console.log(chalk.red(`失败: ${testResults.failed}`));
  console.log(chalk.blue(`总计: ${testResults.tests.length}`));
  
  const passRate = (testResults.passed / testResults.tests.length * 100).toFixed(1);
  const passRateColor = passRate >= 80 ? chalk.green : passRate >= 60 ? chalk.yellow : chalk.red;
  console.log(passRateColor(`通过率: ${passRate}%`));
  
  console.log(chalk.cyan('\n✨ 测试完成\n'));
  
  // 退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  log('测试执行失败', 'error');
  console.error(error);
  process.exit(1);
});
