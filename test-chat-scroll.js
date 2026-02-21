/**
 * ChatInterface 滚动功能自动化测试脚本
 * 在浏览器控制台中运行
 */

// 测试配置
const TEST_CONFIG = {
  messageCount: 5,
  longMessageLength: 500,
  scrollDelay: 500,
};

// 日志工具
const logger = {
  info: (msg, data) => console.log(`[Test] ${msg}`, data || ''),
  error: (msg, error) => console.error(`[Test Error] ${msg}`, error),
  success: (msg) => console.log(`[Test ✓] ${msg}`),
  fail: (msg) => console.log(`[Test ✗] ${msg}`),
};

// 获取 ScrollView 元素
function getScrollView() {
  return document.querySelector('.chat-history');
}

// 获取所有消息元素
function getMessages() {
  return document.querySelectorAll('.message-row');
}

// 获取滚动位置
function getScrollPosition() {
  const scrollView = getScrollView();
  return {
    scrollTop: scrollView?.scrollTop || 0,
    scrollHeight: scrollView?.scrollHeight || 0,
    clientHeight: scrollView?.clientHeight || 0,
  };
}

// 检查是否在底部
function isScrolledToBottom() {
  const { scrollTop, scrollHeight, clientHeight } = getScrollPosition();
  const threshold = 50; // 允许 50px 误差
  return scrollHeight - scrollTop - clientHeight < threshold;
}

// 测试1: 检查初始状态
function testInitialState() {
  logger.info('测试1: 检查初始状态');
  const messages = getMessages();
  const scrollPos = getScrollPosition();
  
  logger.info(`消息数量: ${messages.length}`);
  logger.info(`滚动位置:`, scrollPos);
  
  if (messages.length === 0) {
    logger.info('暂无消息，等待发送消息');
    return true;
  }
  
  return true;
}

// 测试2: 模拟发送消息
async function testSendMessage() {
  logger.info('测试2: 模拟发送消息');
  
  const input = document.querySelector('.chat-input');
  const sendBtn = document.querySelector('.send-btn');
  
  if (!input || !sendBtn) {
    logger.error('未找到输入框或发送按钮');
    return false;
  }
  
  // 记录发送前的消息数
  const beforeCount = getMessages().length;
  logger.info(`发送前消息数: ${beforeCount}`);
  
  // 输入消息
  const testMessage = `测试消息 ${Date.now()}`;
  input.value = testMessage;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  // 记录发送前的滚动位置
  const beforeScroll = getScrollPosition();
  logger.info('发送前滚动位置:', beforeScroll);
  
  // 点击发送
  sendBtn.click();
  
  // 等待消息渲染
  await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.scrollDelay));
  
  // 检查消息是否添加
  const afterCount = getMessages().length;
  logger.info(`发送后消息数: ${afterCount}`);
  
  if (afterCount <= beforeCount) {
    logger.fail('消息未添加到列表');
    return false;
  }
  
  // 检查滚动位置
  const afterScroll = getScrollPosition();
  logger.info('发送后滚动位置:', afterScroll);
  
  if (isScrolledToBottom()) {
    logger.success('新消息后自动滚动到底部');
    return true;
  } else {
    logger.fail('新消息后未自动滚动到底部');
    logger.info(`距离底部: ${afterScroll.scrollHeight - afterScroll.scrollTop - afterScroll.clientHeight}px`);
    return false;
  }
}

// 测试3: 测试长消息折叠
async function testLongMessageFold() {
  logger.info('测试3: 测试长消息折叠');
  
  // 查找折叠提示
  const expandHint = document.querySelector('.expand-hint');
  
  if (!expandHint) {
    logger.info('暂无长消息需要折叠');
    return true;
  }
  
  logger.info('发现长消息折叠提示');
  
  // 记录展开前的滚动位置
  const beforeScroll = getScrollPosition();
  logger.info('展开前滚动位置:', beforeScroll);
  
  // 点击展开
  expandHint.click();
  
  // 等待展开动画
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // 检查滚动位置
  const afterScroll = getScrollPosition();
  logger.info('展开后滚动位置:', afterScroll);
  
  if (isScrolledToBottom()) {
    logger.success('展开后自动滚动到底部');
    return true;
  } else {
    logger.fail('展开后未自动滚动到底部');
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.clear();
  logger.info('========== ChatInterface 自动化测试开始 ==========');
  
  const results = [];
  
  results.push({ name: '初始状态', result: testInitialState() });
  results.push({ name: '发送消息', result: await testSendMessage() });
  results.push({ name: '长消息展开', result: await testLongMessageFold() });
  
  logger.info('========== 测试结果汇总 ==========');
  results.forEach(({ name, result }) => {
    if (result) {
      logger.success(`${name}: 通过`);
    } else {
      logger.fail(`${name}: 失败`);
    }
  });
  
  const passed = results.filter(r => r.result).length;
  const total = results.length;
  logger.info(`总计: ${passed}/${total} 通过`);
  
  return results;
}

// 导出到全局
window.ChatScrollTest = {
  run: runAllTests,
  getScrollPosition,
  isScrolledToBottom,
  getMessages,
};

logger.info('测试脚本已加载，运行 window.ChatScrollTest.run() 开始测试');
