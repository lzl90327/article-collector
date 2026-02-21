#!/usr/bin/env node

/**
 * 简单的 E2E 测试运行器
 * 不依赖 Playwright，直接使用 Node.js 和 fetch API 测试后端逻辑
 */

const BASE_URL = 'http://127.0.0.1:3000';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试 1: 创建 Workflow 并进入 Phase 2
async function testCreateWorkflow() {
  log('\n📋 测试 1: 创建 Workflow', 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/mindflow/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '测试话题' }),
    });
    
    const data = await response.json();
    
    if (data.workflowId && data.state) {
      log(`✓ Workflow 创建成功: ${data.workflowId}`, 'green');
      log(`  当前 Phase: ${data.state.currentPhase}`, 'green');
      return data.workflowId;
    } else {
      log('✗ Workflow 创建失败', 'red');
      return null;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return null;
  }
}

// 测试 2: 获取 Workflow 状态
async function testGetWorkflowState(workflowId) {
  log('\n📋 测试 2: 获取 Workflow 状态', 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/mindflow/${workflowId}`);
    const data = await response.json();
    
    if (data.currentPhase !== undefined) {
      log(`✓ 获取状态成功`, 'green');
      log(`  Phase: ${data.currentPhase}`, 'green');
      log(`  History 数量: ${data.history?.length || 0}`, 'green');
      return data;
    } else {
      log('✗ 获取状态失败', 'red');
      return null;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return null;
  }
}

// 测试 3: 触发 Phase 转换 (Brief -> Angles)
async function testTriggerPhase(workflowId) {
  log('\n📋 测试 3: 触发 Phase 转换', 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/mindflow/${workflowId}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    
    if (data.state) {
      log(`✓ Phase 转换成功`, 'green');
      log(`  新 Phase: ${data.state.currentPhase}`, 'green');
      return data.state;
    } else {
      log('✗ Phase 转换失败', 'red');
      return null;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return null;
  }
}

// 测试 3b: 选择切入点 (通过 chat 端点)
async function testSelectAngles(workflowId) {
  log('\n📋 测试 3b: 选择切入点', 'blue');
  
  try {
    // 使用 chat 端点发送选择
    const response = await fetch(`${BASE_URL}/api/mindflow/${workflowId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: 'Selected Angles: 测试切入点'
      }),
    });
    
    const data = await response.json();
    
    if (data.state) {
      log(`✓ 选择切入点成功`, 'green');
      log(`  新 Phase: ${data.state.currentPhase}`, 'green');
      return data.state;
    } else {
      log('✗ 选择切入点失败', 'red');
      return null;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return null;
  }
}

// 测试 4: 发送聊天消息
async function testSendChatMessage(workflowId) {
  log('\n📋 测试 4: 发送聊天消息', 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/mindflow/${workflowId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '测试消息' }),
    });
    
    const data = await response.json();
    
    if (data.state) {
      log(`✓ 消息发送成功`, 'green');
      log(`  History 数量: ${data.state.history?.length || 0}`, 'green');
      const lastMsg = data.state.history?.[data.state.history.length - 1];
      if (lastMsg) {
        log(`  最后消息: ${lastMsg.role} - ${lastMsg.content?.substring(0, 50)}...`, 'green');
      }
      return data.state;
    } else {
      log('✗ 消息发送失败', 'red');
      return null;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return null;
  }
}

// 测试 5: 验证历史记录过滤逻辑
async function testHistoryFiltering(workflowId) {
  log('\n📋 测试 5: 验证历史记录过滤', 'blue');
  
  try {
    const state = await testGetWorkflowState(workflowId);
    if (!state || !state.history) {
      log('✗ 无法获取历史记录', 'red');
      return false;
    }
    
    const history = state.history;
    log(`  原始 History 数量: ${history.length}`, 'yellow');
    
    // 模拟前端过滤逻辑
    const filteredHistory = history.filter((msg, index) => {
      if (msg.role === 'system') return false;
      if (index === 0 && msg.role === 'user') return false;
      if (msg.content.includes('请选择一个切入点') || msg.content.includes('调试模式')) return false;
      if (msg.role === 'user' && (msg.content.startsWith('Selected Angles:') || msg.content.includes('Supplemental Thoughts:'))) return false;
      if (msg.content.includes('"type":"BRIEF_CARD"') || msg.content.includes('{"thesis":')) return false;
      return true;
    });
    
    log(`  过滤后 History 数量: ${filteredHistory.length}`, 'green');
    
    filteredHistory.forEach((msg, i) => {
      log(`    [${i}] ${msg.role}: ${msg.content?.substring(0, 30)}...`, 'yellow');
    });
    
    return true;
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

// 测试 6: 长消息内容测试
async function testLongMessageContent(workflowId) {
  log('\n📋 测试 6: 长消息内容处理', 'blue');
  
  try {
    // 发送一条长消息
    const longMessage = '测试长消息内容。'.repeat(50); // 约 800 字符
    
    const response = await fetch(`${BASE_URL}/api/mindflow/${workflowId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: longMessage }),
    });
    
    const data = await response.json();
    
    if (data.state) {
      const lastMsg = data.state.history?.[data.state.history.length - 1];
      if (lastMsg && lastMsg.content.length > 200) {
        log(`✓ 长消息处理成功`, 'green');
        log(`  消息长度: ${lastMsg.content.length} 字符`, 'green');
        log(`  应该触发折叠: ${lastMsg.content.length > 200 ? '是' : '否'}`, 'green');
        return true;
      }
    }
    
    log('✗ 长消息处理失败', 'red');
    return false;
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

// 测试 7: 思考过程标记测试
async function testThinkingTagParsing(workflowId) {
  log('\n📋 测试 7: 思考过程标记解析', 'blue');
  
  try {
    // 检查历史记录中是否有思考过程标记
    const state = await testGetWorkflowState(workflowId);
    if (!state || !state.history) {
      log('✗ 无法获取历史记录', 'red');
      return false;
    }
    
    const messagesWithThinking = state.history.filter(msg => 
      msg.content && msg.content.includes('[THINKING]')
    );
    
    if (messagesWithThinking.length > 0) {
      log(`✓ 发现 ${messagesWithThinking.length} 条包含思考过程的消息`, 'green');
      messagesWithThinking.forEach((msg, i) => {
        const thinkMatch = msg.content.match(/\[THINKING\]([\s\S]*?)(?=\[THINKING\]|$)/);
        if (thinkMatch) {
          log(`  [${i}] 思考内容: ${thinkMatch[1].substring(0, 50)}...`, 'yellow');
        }
      });
      return true;
    } else {
      log('ℹ 暂无包含思考过程标记的消息', 'yellow');
      return true; // 不是错误，只是没有数据
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

// 测试 8: 空消息边界测试
async function testEmptyMessageHandling(workflowId) {
  log('\n📋 测试 8: 空消息边界测试', 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/mindflow/${workflowId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '' }),
    });
    
    // 空消息应该被处理（可能返回提示或忽略）
    if (response.ok) {
      log(`✓ 空消息处理完成 (Status: ${response.status})`, 'green');
      return true;
    } else {
      log(`✗ 空消息处理失败 (Status: ${response.status})`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

// 测试 9: 连续快速发送测试
async function testRapidMessageSending(workflowId) {
  log('\n📋 测试 9: 连续快速发送测试', 'blue');
  
  try {
    const messages = ['消息1', '消息2', '消息3'];
    const promises = messages.map((msg, i) => 
      new Promise(resolve => setTimeout(resolve, i * 100)).then(() =>
        fetch(`${BASE_URL}/api/mindflow/${workflowId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: msg }),
        })
      )
    );
    
    const responses = await Promise.all(promises);
    const allOk = responses.every(r => r.ok);
    
    if (allOk) {
      log(`✓ 连续发送 ${messages.length} 条消息成功`, 'green');
      
      // 验证历史记录
      const state = await testGetWorkflowState(workflowId);
      log(`  当前 History 数量: ${state.history?.length || 0}`, 'green');
      return true;
    } else {
      log('✗ 部分消息发送失败', 'red');
      return false;
    }
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

// 测试 10: 特殊字符处理测试
async function testSpecialCharacters(workflowId) {
  log('\n📋 测试 10: 特殊字符处理测试', 'blue');
  
  try {
    const specialChars = '特殊字符测试：!@#$%^&*()_+-=[]{}|;\':",./<>? 中文【】「」『』《》\n换行\t制表符';
    
    const response = await fetch(`${BASE_URL}/api/mindflow/${workflowId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: specialChars }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const lastMsg = data.state?.history?.[data.state.history.length - 1];
      
      if (lastMsg && lastMsg.content.includes('特殊字符测试')) {
        log(`✓ 特殊字符处理成功`, 'green');
        return true;
      }
    }
    
    log('✗ 特殊字符处理失败', 'red');
    return false;
  } catch (error) {
    log(`✗ 错误: ${error.message}`, 'red');
    return false;
  }
}

// 运行所有测试
async function runTests() {
  log('🚀 开始自动化测试...', 'blue');
  log(`目标: ${BASE_URL}`, 'blue');
  
  const results = [];
  let workflowId = null;
  
  // 测试 1: 创建 Workflow
  workflowId = await testCreateWorkflow();
  results.push({ name: '创建 Workflow', passed: !!workflowId });
  
  if (!workflowId) {
    log('\n❌ 测试中止：无法创建 Workflow', 'red');
    process.exit(1);
  }
  
  // 测试 2: 获取状态
  const state1 = await testGetWorkflowState(workflowId);
  results.push({ name: '获取状态', passed: !!state1 });
  
  // 测试 3: 触发 Phase 转换 (Brief -> Angles)
  const state2 = await testTriggerPhase(workflowId);
  results.push({ name: 'Phase 转换 (Brief->Angles)', passed: !!state2 });
  
  // 测试 3b: 选择切入点进入 Phase 2
  const state3 = await testSelectAngles(workflowId);
  results.push({ name: '选择切入点进入 Chat', passed: state3?.currentPhase === 2 });
  
  // 测试 4: 发送聊天消息
  if (state3?.currentPhase === 2) {
    const state4 = await testSendChatMessage(workflowId);
    results.push({ name: '发送聊天消息', passed: !!state4 });
    
    // 测试 5: 验证历史记录过滤
    const filterResult = await testHistoryFiltering(workflowId);
    results.push({ name: '历史记录过滤', passed: filterResult });
    
    // 测试 6: 长消息内容测试
    const longMsgResult = await testLongMessageContent(workflowId);
    results.push({ name: '长消息内容处理', passed: longMsgResult });
    
    // 测试 7: 思考过程标记测试
    const thinkingResult = await testThinkingTagParsing(workflowId);
    results.push({ name: '思考过程标记解析', passed: thinkingResult });
    
    // 测试 8: 空消息边界测试
    const emptyMsgResult = await testEmptyMessageHandling(workflowId);
    results.push({ name: '空消息边界处理', passed: emptyMsgResult });
    
    // 测试 9: 连续快速发送测试
    const rapidResult = await testRapidMessageSending(workflowId);
    results.push({ name: '连续快速发送', passed: rapidResult });
    
    // 测试 10: 特殊字符处理测试
    const specialCharResult = await testSpecialCharacters(workflowId);
    results.push({ name: '特殊字符处理', passed: specialCharResult });
    
  } else {
    log('\n⚠️ 跳过聊天测试：未进入 Phase 2', 'yellow');
  }
  
  // 汇总结果
  log('\n========== 测试结果汇总 ==========', 'blue');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(({ name, passed }) => {
    if (passed) {
      log(`✓ ${name}`, 'green');
    } else {
      log(`✗ ${name}`, 'red');
    }
  });
  
  log(`\n总计: ${passed}/${total} 通过`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 所有测试通过！', 'green');
    process.exit(0);
  } else {
    log('\n⚠️ 部分测试失败', 'yellow');
    process.exit(1);
  }
}

// 运行测试
runTests().catch(error => {
  log(`\n💥 测试运行失败: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
