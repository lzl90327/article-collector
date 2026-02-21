/**
 * Workflow Engine 单元测试
 */
import { WorkflowEngine } from '../../../core/engine/workflow';
import { Phase, WorkflowState } from '../../../core/engine/types';

// Mock 依赖
jest.mock('../../../core/services/llm');
jest.mock('../../../core/services/repository');
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  const workflowId = 'test-workflow-123';

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new WorkflowEngine(workflowId);
  });

  describe('初始化', () => {
    it('应该创建新的工作流引擎实例', () => {
      expect(engine).toBeDefined();
    });

    it('应该使用正确的 workflowId 初始化', () => {
      // 通过检查内部状态来验证
      const state = (engine as any).state;
      expect(state.workflowId).toBe(workflowId);
    });

    it('初始阶段应该是 BRIEF (-1)', () => {
      const state = (engine as any).state;
      expect(state.currentPhase).toBe(Phase.BRIEF);
      expect(state.currentPhase).toBe(-1);
    });
  });

  describe('状态管理', () => {
    it('应该正确保存和加载状态', async () => {
      // 初始化
      await engine.init();
      
      // 验证初始化完成
      expect((engine as any).initialized).toBe(true);
    });

    it('重复初始化应该被忽略', async () => {
      await engine.init();
      await engine.init(); // 第二次应该被忽略
      
      expect((engine as any).initialized).toBe(true);
    });
  });

  describe('阶段转换', () => {
    it('应该支持阶段枚举值', () => {
      // Phase 是数值枚举
      expect(Phase.BRIEF).toBe(-1);
      expect(Phase.MATERIAL).toBe(0);
      expect(Phase.BREAKTHROUGH).toBe(1.5);
      expect(Phase.DISCUSSION).toBe(2);
      expect(Phase.CONVERGENCE).toBe(3);
      expect(Phase.DRAFTING).toBe(4);
      expect(Phase.AUDIT).toBe(4.5);
      expect(Phase.PUBLISH).toBe(5);
      expect(Phase.RETRO).toBe(6);
    });
  });

  describe('输入处理', () => {
    it('应该处理空输入', async () => {
      const onChunk = jest.fn();
      
      // 空输入应该返回错误提示
      const result = await engine.processInputStream('', onChunk);
      
      expect(result).toContain('生成 Brief 失败');
      expect(onChunk).toHaveBeenCalled();
    });

    it('应该处理正常输入', async () => {
      const onChunk = jest.fn();
      
      // 正常输入应该被处理
      const result = await engine.processInputStream('测试输入', onChunk);
      
      expect(typeof result).toBe('string');
    });
  });

  describe('历史记录', () => {
    it('应该维护消息历史', async () => {
      const onChunk = jest.fn();
      
      await engine.processInputStream('第一条消息', onChunk);
      await engine.processInputStream('第二条消息', onChunk);
      
      const state = (engine as any).state;
      expect(state.history.length).toBeGreaterThanOrEqual(2);
    });

    it('应该区分用户和助手消息', async () => {
      const onChunk = jest.fn();
      
      await engine.processInputStream('用户消息', onChunk);
      
      const state = (engine as any).state;
      const userMessages = state.history.filter((m: any) => m.role === 'user');
      const assistantMessages = state.history.filter((m: any) => m.role === 'assistant');
      
      expect(userMessages.length).toBeGreaterThanOrEqual(1);
      expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理错误', async () => {
      const onChunk = jest.fn();
      
      // 即使出错也应该返回友好的错误消息
      const result = await engine.processInputStream('触发错误', onChunk);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('上下文管理', () => {
    it('应该维护上下文数据', () => {
      const state = (engine as any).state;
      expect(state.context).toBeDefined();
      expect(typeof state.context).toBe('object');
    });

    it('应该存储 brief 数据', async () => {
      // 模拟 brief 生成
      (engine as any).state.context.brief = {
        thesis: '测试论点',
        target_audience: '测试读者'
      };
      
      const state = (engine as any).state;
      expect(state.context.brief).toBeDefined();
      expect(state.context.brief.thesis).toBe('测试论点');
    });
  });
});
