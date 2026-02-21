/**
 * Brief Phase 测试
 */

import { BriefPhase, PhaseContext, PhaseRegistry } from '../../phases';
import { prisma } from '../../lib/prisma';

// Mock DeepSeek 服务
jest.mock('../../services/deepseek.service', () => ({
  generateBrief: jest.fn().mockResolvedValue({
    thesis: '测试核心论点',
    targetAudience: '测试读者',
    existingBelief: '测试认知',
    changeGoal: '测试改变',
    keywords: ['关键词1', '关键词2'],
  }),
}));

describe('BriefPhase', () => {
  let phase: BriefPhase;
  let mockSession: any;
  let mockJob: any;

  beforeEach(() => {
    phase = new BriefPhase();
    mockSession = {
      id: 'session-1',
      state_json: {},
    };
    mockJob = {
      id: 'job-1',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('应该成功生成 Brief', async () => {
      const context: PhaseContext = {
        session: mockSession,
        artifacts: [],
        job: mockJob,
        inputs: {
          topic: '测试话题',
        },
      };

      const result = await phase.execute(context);

      expect(result.success).toBe(true);
      expect(result.nextPhase).toBe('-1');
      expect(result.nextSubstate).toBe('brief_pending');
      expect(result.messages).toHaveLength(1);
      expect(result.artifacts).toHaveLength(1);
    });

    it('缺少 topic 应该返回错误', async () => {
      const context: PhaseContext = {
        session: mockSession,
        artifacts: [],
        job: mockJob,
        inputs: {},
      };

      const result = await phase.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required input');
    });

    it('空 topic 应该返回错误', async () => {
      const context: PhaseContext = {
        session: mockSession,
        artifacts: [],
        job: mockJob,
        inputs: {
          topic: '   ',
        },
      };

      const result = await phase.execute(context);

      expect(result.success).toBe(false);
    });
  });

  describe('confirmBrief', () => {
    it('确认 Brief 应该进入下一阶段', async () => {
      const context: PhaseContext = {
        session: mockSession,
        artifacts: [],
        job: mockJob,
        inputs: {},
      };

      const result = await phase.confirmBrief(context, true);

      expect(result.success).toBe(true);
      expect(result.nextPhase).toBe('2');
      expect(result.nextSubstate).toBe('idle');
    });

    it('拒绝 Brief 应该返回收集状态', async () => {
      const context: PhaseContext = {
        session: mockSession,
        artifacts: [],
        job: mockJob,
        inputs: {},
      };

      const result = await phase.confirmBrief(context, false);

      expect(result.success).toBe(true);
      expect(result.nextSubstate).toBe('collecting');
    });
  });
});

describe('PhaseRegistry', () => {
  it('应该能获取 BriefPhase', () => {
    const phase = PhaseRegistry.get('-1');
    expect(phase).toBeDefined();
    expect(phase?.getName()).toBe('Brief');
  });
});
