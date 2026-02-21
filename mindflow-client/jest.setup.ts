/**
 * Jest 测试环境设置文件
 * 在每个测试文件运行前执行
 */

import '@testing-library/jest-dom';

// ============================================================================
// 全局 Mock
// ============================================================================

// Mock Taro 环境变量
// @ts-ignore
process.env.TARO_ENV = 'h5';
// @ts-ignore
process.env.NODE_ENV = 'test';

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// ============================================================================
// 测试工具函数
// ============================================================================

/**
 * 创建 Mock 工作流状态
 */
export const createMockWorkflowState = (overrides = {}) => ({
  workflowId: 'test-workflow-id',
  currentPhase: -1 as const,
  context: {
    brief: {
      thesis: '测试核心主张',
      target_audience: '测试目标读者',
      existing_belief: '测试读者现状',
      change_goal: '测试改变目标',
    },
  },
  history: [],
  ...overrides,
});

/**
 * 创建 Mock 消息
 */
export const createMockMessage = (overrides = {}) => ({
  role: 'user' as const,
  content: '测试消息内容',
  timestamp: Date.now(),
  ...overrides,
});

/**
 * 创建 Mock Brief
 */
export const createMockBrief = (overrides = {}) => ({
  thesis: '测试核心主张',
  target_audience: '测试目标读者',
  existing_belief: '测试读者现状',
  change_goal: '测试改变目标',
  ...overrides,
});

/**
 * 创建 Mock Angles
 */
export const createMockAngles = (overrides = {}) => ({
  mainstream: [
    {
      title: '主流角度1',
      argument: '主流论证1',
      score: { R: 8, N: 7, C: 9 },
    },
    {
      title: '主流角度2',
      argument: '主流论证2',
      score: { R: 7, N: 8, C: 8 },
    },
  ],
  contrarian: [
    {
      title: '异见角度1',
      argument: '异见论证1',
      score: { R: 6, N: 9, C: 7 },
    },
  ],
  ...overrides,
});

/**
 * 创建 Mock 审计报告
 */
export const createMockAuditReport = (overrides = {}) => ({
  auditor_role: '测试审计员',
  score: 8.5,
  criticisms: ['批评1', '批评2'],
  suggestions: ['建议1', '建议2'],
  ...overrides,
});

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 等待指定时间
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 等待下一个事件循环
 */
export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * 模拟异步操作完成
 */
export const actAsync = async (callback: () => void | Promise<void>) => {
  await callback();
  await flushPromises();
};

// ============================================================================
// 全局测试生命周期
// ============================================================================

beforeAll(() => {
  // 在所有测试开始前执行
  console.log('🧪 测试开始...');
});

afterAll(() => {
  // 在所有测试结束后执行
  console.log('✅ 测试完成！');
});

beforeEach(() => {
  // 在每个测试开始前执行
  jest.clearAllMocks();
});

afterEach(() => {
  // 在每个测试结束后执行
  jest.restoreAllMocks();
});

// ============================================================================
// 测试匹配器扩展
// ============================================================================

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidWorkflowState(): R;
    }
  }
}

expect.extend({
  toBeValidWorkflowState(received) {
    const hasValidStructure =
      received &&
      typeof received.workflowId === 'string' &&
      typeof received.currentPhase === 'number' &&
      typeof received.context === 'object' &&
      Array.isArray(received.history);

    if (hasValidStructure) {
      return {
        message: () => `expected ${received} not to be a valid workflow state`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid workflow state`,
        pass: false,
      };
    }
  },
});
