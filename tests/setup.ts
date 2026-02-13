/**
 * Jest 测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// 模拟 console 方法以减少测试输出噪音
global.console = {
  ...console,
  // 保留 error 和 warn，但屏蔽 info 和 debug
  info: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

// 清理所有定时器
afterEach(() => {
  jest.clearAllTimers();
});

// 全局清理
afterAll(() => {
  jest.restoreAllMocks();
});
