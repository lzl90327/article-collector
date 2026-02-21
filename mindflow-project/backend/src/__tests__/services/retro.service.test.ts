/**
 * 发布后复盘服务测试
 * Phase 6: Post-publish Retro Tests
 */

import {
  createRetroCard,
  getRetroCard,
  getRetroHistory,
  updateRetroCard,
  deleteRetroCard,
  analyzeObjections,
  generateNextHypothesis,
  formatRetroCardMarkdown,
  ArticleMetrics,
  Objection,
  DecisionItem,
  RetroCard,
} from '../../services/retro.service';

// Mock 依赖
jest.mock('../../services/deepseek.service', () => ({
  chatCompletion: jest.fn(),
}));

jest.mock('../../lib/prisma', () => ({
  prisma: {
    retroCard: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { chatCompletion } from '../../services/deepseek.service';
import { prisma } from '../../lib/prisma';

const mockedChatCompletion = chatCompletion as jest.MockedFunction<typeof chatCompletion>;
const mockedPrismaRetroCard = prisma.retroCard as any;

describe('Retro Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRetroCard', () => {
    it('应该成功创建复盘卡片', async () => {
      // Arrange
      const mockData = {
        articleId: 'article-001',
        articleTitle: 'AI产品经理的底层逻辑',
        publishDate: '2026-02-15',
        metrics: {
          reads: 5000,
          likes: 200,
          shares: 50,
          comments: 30,
          collections: 100,
        } as ArticleMetrics,
        top3Objections: [
          {
            point: 'AI工具无法完全替代产品经理的判断',
            source: 'comment' as const,
            validity: 'valid' as const,
            note: '有道理的反对意见',
          },
        ] as Objection[],
        keepItems: [
          {
            type: 'keep' as const,
            content: '案例分析部分',
            reason: '读者反馈这部分最有价值',
          },
        ] as DecisionItem[],
        changeItems: [
          {
            type: 'change' as const,
            content: '开头太长',
            reason: '跳出率数据显示开头流失严重',
          },
        ] as DecisionItem[],
        nextHypothesis: '下一篇可以尝试更短的开头',
      };

      mockedPrismaRetroCard.upsert.mockResolvedValue({});

      // Act
      const result = await createRetroCard(mockData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(`retro-${mockData.articleId}`);
      expect(result.articleTitle).toBe(mockData.articleTitle);
      expect(result.metrics.reads).toBe(5000);
      expect(result.top3Objections).toHaveLength(1);
      expect(result.keepItems).toHaveLength(1);
      expect(result.changeItems).toHaveLength(1);
    });

    it('应该正确处理最小数据集', async () => {
      // Arrange
      const mockData = {
        articleId: 'article-002',
        articleTitle: '测试文章',
        publishDate: '2026-02-15',
        metrics: {
          reads: 100,
          likes: 10,
          shares: 2,
          comments: 5,
        } as ArticleMetrics,
      };

      mockedPrismaRetroCard.upsert.mockResolvedValue({});

      // Act
      const result = await createRetroCard(mockData);

      // Assert
      expect(result).toBeDefined();
      expect(result.top3Objections).toEqual([]);
      expect(result.keepItems).toEqual([]);
      expect(result.changeItems).toEqual([]);
      expect(result.nextHypothesis).toBe('');
    });
  });

  describe('analyzeObjections', () => {
    it('应该成功分析评论中的反对意见', async () => {
      // Arrange
      const comments = [
        '这篇文章写得不错，但我觉得AI不会完全替代产品经理',
        '作者的观点很有道理，学习了',
        '不同意，AI工具只是辅助，核心判断还是靠人',
        '写得太长了，开头可以精简',
      ];
      const articleContent = 'AI时代产品经理需要转变思维...';

      mockedChatCompletion.mockResolvedValue({
        content: '```json\n[\n  {\n    "point": "AI工具无法完全替代产品经理的核心判断",\n    "source": "comment",\n    "validity": "valid",\n    "note": "读者对AI替代论有合理质疑"\n  },\n  {\n    "point": "文章开头过长，影响阅读体验",\n    "source": "comment",\n    "validity": "valid",\n    "note": "结构优化建议"\n  }\n]\n```',
      });

      // Act
      const result = await analyzeObjections(comments, articleContent);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].point).toContain('AI');
      expect(result[0].validity).toBe('valid');
    });

    it('空评论列表应该返回空数组', async () => {
      // Act
      const result = await analyzeObjections([], '文章内容');

      // Assert
      expect(result).toEqual([]);
    });

    it('AI 调用失败时应该返回空数组', async () => {
      // Arrange
      mockedChatCompletion.mockRejectedValue(new Error('AI error'));

      // Act
      const result = await analyzeObjections(['评论1'], '文章内容');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('generateNextHypothesis', () => {
    it('应该成功生成下一篇假设', async () => {
      // Arrange
      const mockCard: RetroCard = {
        id: 'retro-001',
        articleId: 'article-001',
        articleTitle: '测试文章',
        publishDate: '2026-02-15',
        metrics: {
          reads: 5000,
          likes: 200,
          shares: 50,
          comments: 30,
        },
        top3Objections: [
          {
            point: '开头太长',
            source: 'comment',
            validity: 'valid',
          },
        ],
        keepItems: [
          {
            type: 'keep',
            content: '案例分析',
            reason: '读者好评',
          },
        ],
        changeItems: [
          {
            type: 'change',
            content: '开头长度',
            reason: '跳出率高',
          },
        ],
        nextHypothesis: '',
        createdAt: new Date().toISOString(),
      };

      mockedChatCompletion.mockResolvedValue({
        content: '基于开头跳出率高的数据，下一篇可以尝试将开头压缩到200字以内，预期降低跳出率10%，验证方式：对比两篇文章的平均阅读时长。',
      });

      // Act
      const result = await generateNextHypothesis(mockCard);

      // Assert
      expect(result).toContain('基于');
      expect(result).toContain('下一篇');
      expect(result).toContain('验证方式');
    });

    it('AI 调用失败时应该返回默认假设', async () => {
      // Arrange
      const mockCard: RetroCard = {
        id: 'retro-001',
        articleId: 'article-001',
        articleTitle: '测试文章',
        publishDate: '2026-02-15',
        metrics: { reads: 100, likes: 10, shares: 2, comments: 5 },
        top3Objections: [],
        keepItems: [],
        changeItems: [],
        nextHypothesis: '',
        createdAt: new Date().toISOString(),
      };

      mockedChatCompletion.mockRejectedValue(new Error('AI error'));

      // Act
      const result = await generateNextHypothesis(mockCard);

      // Assert
      expect(result).toContain('调整结构');
      expect(result).toContain('阅读完成率');
    });
  });

  describe('getRetroCard', () => {
    it('应该返回复盘卡片', async () => {
      // Arrange
      const mockRecord = {
        id: 'retro-article-001',
        article_id: 'article-001',
        article_title: '测试文章',
        publish_date: new Date('2026-02-15'),
        metrics_json: { reads: 1000, likes: 50, shares: 10, comments: 20 },
        top3_objections_json: [],
        keep_items_json: [],
        change_items_json: [],
        next_hypothesis: '下一篇假设',
        created_at: new Date(),
      };

      mockedPrismaRetroCard.findUnique.mockResolvedValue(mockRecord);

      // Act
      const result = await getRetroCard('article-001');

      // Assert
      expect(result).toBeDefined();
      expect(result?.articleTitle).toBe('测试文章');
      expect(result?.metrics.reads).toBe(1000);
    });

    it('卡片不存在时应该返回 null', async () => {
      // Arrange
      mockedPrismaRetroCard.findUnique.mockResolvedValue(null);

      // Act
      const result = await getRetroCard('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getRetroHistory', () => {
    it('应该返回复盘历史列表', async () => {
      // Arrange
      const mockRecords = [
        {
          id: 'retro-001',
          article_title: '文章1',
          publish_date: new Date('2026-02-15'),
          metrics_json: { reads: 1000, likes: 50, shares: 10, comments: 20 },
          created_at: new Date(),
        },
        {
          id: 'retro-002',
          article_title: '文章2',
          publish_date: new Date('2026-02-10'),
          metrics_json: { reads: 2000, likes: 100, shares: 20, comments: 30 },
          created_at: new Date(),
        },
      ];

      mockedPrismaRetroCard.findMany.mockResolvedValue(mockRecords);

      // Act
      const result = await getRetroHistory(10);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].articleTitle).toBe('文章1');
      expect(result[1].metrics.reads).toBe(2000);
    });

    it('应该限制返回数量', async () => {
      // Arrange
      mockedPrismaRetroCard.findMany.mockResolvedValue([]);

      // Act
      await getRetroHistory(5);

      // Assert
      expect(mockedPrismaRetroCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('updateRetroCard', () => {
    it('应该成功更新复盘卡片', async () => {
      // Arrange
      const existingRecord = {
        id: 'retro-article-001',
        article_id: 'article-001',
        article_title: '原标题',
        publish_date: new Date('2026-02-15'),
        metrics_json: { reads: 1000, likes: 50, shares: 10, comments: 20 },
        top3_objections_json: [],
        keep_items_json: [],
        change_items_json: [],
        next_hypothesis: '',
        created_at: new Date(),
      };

      mockedPrismaRetroCard.findUnique
        .mockResolvedValueOnce(existingRecord)
        .mockResolvedValueOnce({
          ...existingRecord,
          article_title: '新标题',
        });
      mockedPrismaRetroCard.update.mockResolvedValue({});

      // Act
      const result = await updateRetroCard('article-001', {
        articleTitle: '新标题',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.articleTitle).toBe('新标题');
    });

    it('卡片不存在时应该返回 null', async () => {
      // Arrange
      mockedPrismaRetroCard.findUnique.mockResolvedValue(null);

      // Act
      const result = await updateRetroCard('non-existent', {
        articleTitle: '新标题',
      });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteRetroCard', () => {
    it('应该成功删除复盘卡片', async () => {
      // Arrange
      mockedPrismaRetroCard.delete.mockResolvedValue({});

      // Act
      const result = await deleteRetroCard('article-001');

      // Assert
      expect(result).toBe(true);
    });

    it('删除失败时应该返回 false', async () => {
      // Arrange
      mockedPrismaRetroCard.delete.mockRejectedValue(new Error('Delete failed'));

      // Act
      const result = await deleteRetroCard('article-001');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('formatRetroCardMarkdown', () => {
    it('应该正确格式化为 Markdown', () => {
      // Arrange
      const mockCard: RetroCard = {
        id: 'retro-001',
        articleId: 'article-001',
        articleTitle: '测试文章',
        publishDate: '2026-02-15',
        metrics: {
          reads: 5000,
          likes: 200,
          shares: 50,
          comments: 30,
          collections: 100,
        },
        top3Objections: [
          {
            point: 'AI工具无法完全替代产品经理',
            source: 'comment',
            validity: 'valid',
            note: '有道理的反对',
          },
        ],
        keepItems: [
          {
            type: 'keep',
            content: '案例分析',
            reason: '读者好评',
          },
        ],
        changeItems: [
          {
            type: 'change',
            content: '开头太长',
            reason: '跳出率高',
          },
        ],
        nextHypothesis: '下一篇可以尝试更短的开头',
        createdAt: new Date().toISOString(),
      };

      // Act
      const markdown = formatRetroCardMarkdown(mockCard);

      // Assert
      expect(markdown).toContain('# 复盘卡片：测试文章');
      expect(markdown).toContain('发布日期：2026-02-15');
      expect(markdown).toContain('阅读量 | 5000');
      expect(markdown).toContain('AI工具无法完全替代产品经理');
      expect(markdown).toContain('案例分析');
      expect(markdown).toContain('开头太长');
      expect(markdown).toContain('下一篇可以尝试更短的开头');
    });
  });
});
