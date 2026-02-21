/**
 * 苏格拉底式提问服务测试
 * Phase 1.2: Socratic Questioning Tests
 */

import {
  createSocraticSession,
  getSession,
  getCurrentQuestion,
  answerAndProgress,
  endSession,
  getSessionSummary,
  switchToPingPong,
  getActiveSessions,
  SocraticSession,
  SocraticQuestion,
} from '../../services/socratic.service';

// Mock 依赖
jest.mock('../../services/deepseek.service', () => ({
  chatCompletion: jest.fn(),
}));

jest.mock('../../lib/prisma', () => ({
  prisma: {
    socraticSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { chatCompletion } from '../../services/deepseek.service';
import { prisma } from '../../lib/prisma';

const mockedChatCompletion = chatCompletion as jest.MockedFunction<typeof chatCompletion>;
const mockedPrismaSocraticSession = prisma.socraticSession as any;

describe('Socratic Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSocraticSession', () => {
    it('应该成功创建苏格拉底式提问会话', async () => {
      // Arrange
      const topic = 'AI产品经理的底层逻辑';

      mockedChatCompletion.mockResolvedValue({
        content: '关于"AI产品经理的底层逻辑"，你能先解释一下"底层逻辑"具体指什么吗？',
      });

      mockedPrismaSocraticSession.create.mockResolvedValue({});

      // Act
      const session = await createSocraticSession(topic);

      // Assert
      expect(session).toBeDefined();
      expect(session.topic).toBe(topic);
      expect(session.currentDepth).toBe(1);
      expect(session.questions).toHaveLength(1);
      expect(session.questions[0].level).toBe('clarification');
      expect(session.isActive).toBe(true);
    });

    it('AI生成失败时应该使用默认问题', async () => {
      // Arrange
      const topic = '测试主题';

      mockedChatCompletion.mockRejectedValue(new Error('AI error'));
      mockedPrismaSocraticSession.create.mockResolvedValue({});

      // Act
      const session = await createSocraticSession(topic);

      // Assert
      expect(session).toBeDefined();
      expect(session.questions[0].question).toContain('测试主题');
    });
  });

  describe('answerAndProgress', () => {
    it('应该保存回答并生成下一个问题', async () => {
      // Arrange
      const mockQuestions: SocraticQuestion[] = [
        {
          id: 'q-001',
          level: 'clarification',
          question: '这是什么意思？',
          context: '测试主题',
          depth: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      mockedPrismaSocraticSession.findUnique.mockResolvedValue({
        id: 'socratic-123',
        topic: '测试主题',
        current_depth: 1,
        questions_json: mockQuestions,
        is_active: true,
        created_at: new Date(),
      });

      mockedChatCompletion.mockResolvedValue({
        content: '你的前提假设是什么？',
      });

      mockedPrismaSocraticSession.update.mockResolvedValue({});

      // Act
      const result = await answerAndProgress('socratic-123', '我的理解是...');

      // Assert
      expect(result.session).toBeDefined();
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion?.level).toBe('assumption');
      expect(result.nextQuestion?.depth).toBe(2);
    });

    it('达到最大深度时应该结束会话', async () => {
      // Arrange
      const mockQuestions: SocraticQuestion[] = [
        {
          id: 'q-006',
          level: 'implication',
          question: '如果这样，会怎样？',
          context: '测试主题',
          depth: 6,
          answer: '会这样...',
          createdAt: new Date().toISOString(),
        },
      ];

      mockedPrismaSocraticSession.findUnique.mockResolvedValue({
        id: 'socratic-123',
        topic: '测试主题',
        current_depth: 6,
        questions_json: mockQuestions,
        is_active: true,
        created_at: new Date(),
      });

      mockedPrismaSocraticSession.update.mockResolvedValue({});

      // Act
      const result = await answerAndProgress('socratic-123', '最终回答');

      // Assert
      expect(result.session).toBeDefined();
      expect(result.nextQuestion).toBeNull();
      expect(result.session?.isActive).toBe(false);
    });

    it('会话不存在时应该返回null', async () => {
      // Arrange
      mockedPrismaSocraticSession.findUnique.mockResolvedValue(null);

      // Act
      const result = await answerAndProgress('non-existent', '回答');

      // Assert
      expect(result.session).toBeNull();
      expect(result.nextQuestion).toBeNull();
    });

    it('会话已结束时应该返回null', async () => {
      // Arrange
      mockedPrismaSocraticSession.findUnique.mockResolvedValue({
        id: 'socratic-123',
        is_active: false,
      });

      // Act
      const result = await answerAndProgress('socratic-123', '回答');

      // Assert
      expect(result.session).toBeNull();
      expect(result.nextQuestion).toBeNull();
    });
  });

  describe('getCurrentQuestion', () => {
    it('应该返回当前问题', async () => {
      // Arrange
      const mockQuestions: SocraticQuestion[] = [
        {
          id: 'q-001',
          level: 'clarification',
          question: '这是什么意思？',
          context: '测试主题',
          depth: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      mockedPrismaSocraticSession.findUnique.mockResolvedValue({
        id: 'socratic-123',
        is_active: true,
        questions_json: mockQuestions,
      });

      // Act
      const question = await getCurrentQuestion('socratic-123');

      // Assert
      expect(question).toBeDefined();
      expect(question?.id).toBe('q-001');
    });

    it('会话不存在时应该返回null', async () => {
      // Arrange
      mockedPrismaSocraticSession.findUnique.mockResolvedValue(null);

      // Act
      const question = await getCurrentQuestion('non-existent');

      // Assert
      expect(question).toBeNull();
    });
  });

  describe('getSession', () => {
    it('应该返回会话详情', async () => {
      // Arrange
      const mockQuestions: SocraticQuestion[] = [
        {
          id: 'q-001',
          level: 'clarification',
          question: '这是什么意思？',
          context: '测试主题',
          depth: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      mockedPrismaSocraticSession.findUnique.mockResolvedValue({
        id: 'socratic-123',
        topic: '测试主题',
        current_depth: 1,
        questions_json: mockQuestions,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Act
      const session = await getSession('socratic-123');

      // Assert
      expect(session).toBeDefined();
      expect(session?.topic).toBe('测试主题');
      expect(session?.questions).toHaveLength(1);
    });

    it('会话不存在时应该返回null', async () => {
      // Arrange
      mockedPrismaSocraticSession.findUnique.mockResolvedValue(null);

      // Act
      const session = await getSession('non-existent');

      // Assert
      expect(session).toBeNull();
    });
  });

  describe('endSession', () => {
    it('应该成功结束会话', async () => {
      // Arrange
      mockedPrismaSocraticSession.update.mockResolvedValue({});

      // Act
      const result = await endSession('socratic-123');

      // Assert
      expect(result).toBe(true);
    });

    it('结束失败时应该返回false', async () => {
      // Arrange
      mockedPrismaSocraticSession.update.mockRejectedValue(new Error('Update failed'));

      // Act
      const result = await endSession('socratic-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getSessionSummary', () => {
    it('应该返回会话摘要', async () => {
      // Arrange
      const mockQuestions: SocraticQuestion[] = [
        {
          id: 'q-001',
          level: 'clarification',
          question: '这是什么意思？',
          context: '测试主题',
          depth: 1,
          answer: '这是...',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'q-002',
          level: 'assumption',
          question: '你的前提是什么？',
          context: '测试主题',
          depth: 2,
          answer: '前提是...',
          createdAt: new Date().toISOString(),
        },
      ];

      mockedPrismaSocraticSession.findUnique.mockResolvedValue({
        id: 'socratic-123',
        topic: '测试主题',
        current_depth: 2,
        questions_json: mockQuestions,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockedChatCompletion.mockResolvedValue({
        content: '核心洞察：通过探讨明确了核心概念和假设。',
      });

      // Act
      const summary = await getSessionSummary('socratic-123');

      // Assert
      expect(summary).toBeDefined();
      expect(summary?.topic).toBe('测试主题');
      expect(summary?.totalQuestions).toBe(2);
      expect(summary?.answeredQuestions).toBe(2);
      expect(summary?.depthReached).toBe(2);
    });

    it('会话不存在时应该返回null', async () => {
      // Arrange
      mockedPrismaSocraticSession.findUnique.mockResolvedValue(null);

      // Act
      const summary = await getSessionSummary('non-existent');

      // Assert
      expect(summary).toBeNull();
    });
  });

  describe('switchToPingPong', () => {
    it('应该成功切换到乒乓球模式', async () => {
      // Arrange
      const mockQuestions: SocraticQuestion[] = [
        {
          id: 'q-001',
          level: 'clarification',
          question: '这是什么意思？',
          context: '测试主题',
          depth: 1,
          answer: '这是...',
          createdAt: new Date().toISOString(),
        },
      ];

      mockedPrismaSocraticSession.findUnique.mockResolvedValue({
        id: 'socratic-123',
        topic: '测试主题',
        current_depth: 1,
        questions_json: mockQuestions,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockedPrismaSocraticSession.update.mockResolvedValue({});

      mockedChatCompletion.mockResolvedValue({
        content: '```json\n{\n  "summary": "已获取核心概念",\n  "insights": ["洞察1", "洞察2"]\n}\n```',
      });

      // Act
      const result = await switchToPingPong('socratic-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.insights).toHaveLength(2);
    });

    it('会话不存在时应该返回失败', async () => {
      // Arrange
      mockedPrismaSocraticSession.findUnique.mockResolvedValue(null);

      // Act
      const result = await switchToPingPong('non-existent');

      // Assert
      expect(result.success).toBe(false);
      expect(result.summary).toBe('会话不存在');
    });
  });

  describe('getActiveSessions', () => {
    it('应该返回活跃会话列表', async () => {
      // Arrange
      mockedPrismaSocraticSession.findMany.mockResolvedValue([
        {
          id: 'socratic-001',
          topic: '主题1',
          current_depth: 2,
          created_at: new Date(),
        },
        {
          id: 'socratic-002',
          topic: '主题2',
          current_depth: 3,
          created_at: new Date(),
        },
      ]);

      // Act
      const sessions = await getActiveSessions(10);

      // Assert
      expect(sessions).toHaveLength(2);
      expect(sessions[0].topic).toBe('主题1');
      expect(sessions[1].currentDepth).toBe(3);
    });

    it('应该限制返回数量', async () => {
      // Arrange
      mockedPrismaSocraticSession.findMany.mockResolvedValue([]);

      // Act
      await getActiveSessions(5);

      // Assert
      expect(mockedPrismaSocraticSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });
});
