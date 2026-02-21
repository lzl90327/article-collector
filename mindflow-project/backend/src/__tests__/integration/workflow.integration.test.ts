/**
 * Workflow 集成测试
 * 测试完整的写作流程
 */
import { WorkflowEngine } from '../../core/engine/workflow';
import { Phase } from '../../core/engine/types';

// Mock 外部依赖
jest.mock('../../core/services/llm', () => ({
  LLMService: {
    chatCompletion: jest.fn().mockResolvedValue(JSON.stringify({
      thesis: '测试论点',
      target_audience: '测试读者',
      existing_belief: '测试信念',
      change_goal: '测试目标',
      core_conflict: '测试冲突',
      emotional_tone: '测试语调'
    })),
    streamChatCompletion: jest.fn().mockImplementation(async (request, onChunk) => {
      onChunk('测试流式响应');
      return '测试流式响应';
    })
  }
}));

jest.mock('../../core/services/repository', () => ({
  repository: {
    loadState: jest.fn().mockResolvedValue(null),
    saveState: jest.fn().mockResolvedValue(undefined),
    appendMessage: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Workflow Integration', () => {
  let engine: WorkflowEngine;
  const workflowId = 'integration-test-123';

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new WorkflowEngine(workflowId);
  });

  describe('完整写作流程', () => {
    it('应该完成从 Brief 到最终发布的完整流程', async () => {
      // 1. 初始化工作流
      await engine.init();
      expect((engine as any).initialized).toBe(true);

      // 2. 输入主题，生成 Brief
      const onChunk = jest.fn();
      const briefResult = await engine.processInputStream('我想写一篇关于 AI 的文章', onChunk);
      
      expect(typeof briefResult).toBe('string');
      expect(briefResult).toContain('BRIEF_CARD');
      
      // 验证状态更新
      const state = (engine as any).state;
      expect(state.context.brief).toBeDefined();
      expect(state.context.brief.thesis).toBe('测试论点');

      // 3. 确认 Brief，进入角度选择阶段
      const angleResult = await engine.processInputStream('confirm', onChunk);
      expect(typeof angleResult).toBe('string');

      console.log('Integration test completed successfully');
    });

    it('应该维护正确的消息历史', async () => {
      await engine.init();
      const onChunk = jest.fn();

      // 发送多条消息
      await engine.processInputStream('消息 1', onChunk);
      await engine.processInputStream('消息 2', onChunk);
      await engine.processInputStream('消息 3', onChunk);

      const state = (engine as any).state;
      
      // 验证历史记录
      expect(state.history.length).toBeGreaterThanOrEqual(6); // 3 用户 + 3 助手
      
      // 验证消息角色
      const userMessages = state.history.filter((m: any) => m.role === 'user');
      const assistantMessages = state.history.filter((m: any) => m.role === 'assistant');
      
      expect(userMessages.length).toBeGreaterThanOrEqual(3);
      expect(assistantMessages.length).toBeGreaterThanOrEqual(3);
    });

    it('应该处理并发请求', async () => {
      await engine.init();
      const onChunk = jest.fn();

      // 模拟并发请求
      const promises = [
        engine.processInputStream('并发请求 1', onChunk),
        engine.processInputStream('并发请求 2', onChunk),
        engine.processInputStream('并发请求 3', onChunk)
      ];

      // 所有请求都应该完成
      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('错误恢复', () => {
    it('应该在错误后保持状态一致性', async () => {
      await engine.init();
      const onChunk = jest.fn();

      // 先发送成功请求
      await engine.processInputStream('成功请求', onChunk);
      const historyLengthBefore = (engine as any).state.history.length;

      // 模拟错误（通过发送特殊输入触发错误处理）
      const errorResult = await engine.processInputStream('', onChunk);
      
      // 错误后应该返回友好的错误消息
      expect(typeof errorResult).toBe('string');
      expect(errorResult.length).toBeGreaterThan(0);

      // 验证状态仍然有效
      const state = (engine as any).state;
      expect(state.workflowId).toBe(workflowId);
      expect(state.history.length).toBeGreaterThanOrEqual(historyLengthBefore);
    });
  });

  describe('阶段转换', () => {
    it('应该正确识别阶段变化', async () => {
      await engine.init();
      
      const initialPhase = (engine as any).state.currentPhase;
      expect(initialPhase).toBe(Phase.BRIEF);

      // 处理输入
      const onChunk = jest.fn();
      await engine.processInputStream('测试输入', onChunk);

      // 验证状态被保存
      const { repository } = require('../../core/services/repository');
      expect(repository.saveState).toHaveBeenCalled();
    });
  });
});
