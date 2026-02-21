/**
 * 周度认知简报服务测试
 * Phase 0.8: Weekly Cognitive Digest Tests
 */

import {
  generateWeeklyDigest,
  getLatestWeeklyDigest,
  getWeeklyDigestHistory,
  selectDeepDiveMaterials,
  MaterialScore,
  ScoredMaterial,
  WeeklyDigest,
} from '../../services/weekly-digest.service';

// Mock 依赖
jest.mock('../../services/feishu.materials.service', () => ({
  getMaterials: jest.fn(),
}));

jest.mock('../../services/feishu.wiki.service', () => ({
  createWikiDocument: jest.fn(),
}));

jest.mock('../../services/deepseek.service', () => ({
  chatCompletion: jest.fn(),
}));

jest.mock('../../lib/prisma', () => ({
  prisma: {
    weeklyDigest: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { getMaterials } from '../../services/feishu.materials.service';
import { createWikiDocument } from '../../services/feishu.wiki.service';
import { chatCompletion } from '../../services/deepseek.service';
import { prisma } from '../../lib/prisma';

const mockedGetMaterials = getMaterials as jest.MockedFunction<typeof getMaterials>;
const mockedCreateWikiDocument = createWikiDocument as jest.MockedFunction<typeof createWikiDocument>;
const mockedChatCompletion = chatCompletion as jest.MockedFunction<typeof chatCompletion>;
const mockedPrismaWeeklyDigest = prisma.weeklyDigest as any;

describe('WeeklyDigest Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateWeeklyDigest', () => {
    it('应该成功生成周度认知简报', async () => {
      // Arrange - 需要至少3个素材才能触发主题聚类
      const mockMaterials = [
        {
          id: 'rec-001',
          title: 'AI产品经理的底层逻辑',
          author: '纯银',
          source: '即刻',
          summary: '探讨AI时代产品经理的思维转变...',
          collectTime: new Date().toISOString(),
        },
        {
          id: 'rec-002',
          title: '银发经济的AI入口',
          author: '行业观察',
          source: '36氪',
          summary: '深入分析银发经济中AI产品的切入点...',
          collectTime: new Date().toISOString(),
        },
        {
          id: 'rec-003',
          title: '大模型时代的认知外包',
          author: '认知科学',
          source: '得到',
          summary: '探讨大模型对人类认知方式的影响...',
          collectTime: new Date().toISOString(),
        },
      ];

      mockedGetMaterials.mockResolvedValue(mockMaterials);

      // Mock DeepSeek 评分响应
      mockedChatCompletion
        .mockResolvedValueOnce({
          content: JSON.stringify({
            coreClaim: 'AI时代产品经理需要从工具思维转向伙伴思维',
            scores: { D: 4, R: 5, C: 4, H: 4 },
            reasoning: '有明确立场，与产品工作直接相关',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            coreClaim: '银发经济的真正入口是子女而非老人',
            scores: { D: 5, R: 4, C: 5, H: 4 },
            reasoning: '有数据支撑，可形成对抗性讨论',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            coreClaim: '大模型改变了人类的认知方式',
            scores: { D: 4, R: 5, C: 4, H: 3 },
            reasoning: '有学术支撑，与认知科学相关',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            clusters: [
              {
                theme: 'AI 产品思维',
                materialIndices: [1, 2],
                connection: '都在讨论AI产品的用户切入点',
              },
            ],
            crossThemeTension: 'AI产品需要在技术创新和用户需求之间找到平衡',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            gentleChallenge: '是否所有产品经理都需要这种思维转变？',
            stimulusQuestion: '如果AI工具普及，产品经理的核心价值会在哪里？',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            gentleChallenge: '是否所有银发经济都遵循这个逻辑？',
            stimulusQuestion: '如果子女不介入，老人会如何选择AI产品？',
          }),
        });

      mockedCreateWikiDocument.mockResolvedValue({
        id: 'doc-001',
        title: '周报-2026-02-21',
        nodeToken: 'node-001',
        objType: 'doc',
        url: 'https://feishu.cn/wiki/doc-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockedPrismaWeeklyDigest.upsert.mockResolvedValue({});

      // Act
      const result = await generateWeeklyDigest('user-001', 7);

      // Assert
      expect(result).toBeDefined();
      expect(result.materialsCount).toBe(3);
      expect(result.materials).toHaveLength(3);
      expect(result.themeClusters).toHaveLength(1);
      expect(result.feishuDocUrl).toBe('https://feishu.cn/wiki/doc-001');

      // 验证评分计算
      const firstMaterial = result.materials[0];
      expect(firstMaterial.scores).toBeDefined();
      expect(firstMaterial.total).toBeGreaterThan(0);
    });

    it('当没有素材时应该抛出错误', async () => {
      // Arrange
      mockedGetMaterials.mockResolvedValue([]);

      // Act & Assert
      await expect(generateWeeklyDigest('user-001', 7)).rejects.toThrow('No materials found');
    });

    it('应该正确计算 D/R/C/H 加权总分', async () => {
      // Arrange
      const scores: MaterialScore = { D: 5, R: 4, C: 3, H: 4 };
      const expectedTotal = 5 * 0.3 + 4 * 0.3 + 3 * 0.2 + 4 * 0.2; // 1.5 + 1.2 + 0.6 + 0.8 = 4.1

      const mockMaterials = [
        {
          id: 'rec-001',
          title: '测试素材',
          author: '测试作者',
          source: '测试来源',
          summary: '测试摘要',
          collectTime: new Date().toISOString(),
        },
      ];

      mockedGetMaterials.mockResolvedValue(mockMaterials);
      mockedChatCompletion
        .mockResolvedValueOnce({
          content: JSON.stringify({
            coreClaim: '测试核心主张',
            scores,
            reasoning: '测试理由',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ clusters: [], crossThemeTension: '素材主题较为单一' }),
        });

      mockedCreateWikiDocument.mockResolvedValue({
        id: 'doc-001',
        title: '周报',
        nodeToken: 'node-001',
        objType: 'doc',
        url: 'https://feishu.cn/wiki/doc-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockedPrismaWeeklyDigest.upsert.mockResolvedValue({});

      // Act
      const result = await generateWeeklyDigest('user-001', 7);

      // Assert
      expect(result.materials[0].total).toBeCloseTo(expectedTotal, 1);
    });

    it('应该根据评分规则正确推荐素材', async () => {
      // Arrange
      const mockMaterials = [
        {
          id: 'rec-001',
          title: '高分素材',
          author: '作者A',
          source: '来源A',
          summary: '摘要A',
          collectTime: new Date().toISOString(),
        },
        {
          id: 'rec-002',
          title: '低分素材',
          author: '作者B',
          source: '来源B',
          summary: '摘要B',
          collectTime: new Date().toISOString(),
        },
      ];

      mockedGetMaterials.mockResolvedValue(mockMaterials);
      mockedChatCompletion
        .mockResolvedValueOnce({
          content: JSON.stringify({
            coreClaim: '高分核心主张',
            scores: { D: 5, R: 5, C: 5, H: 5 },
            reasoning: '高分理由',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            coreClaim: '低分核心主张',
            scores: { D: 1, R: 2, C: 2, H: 1 },
            reasoning: '低分理由',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ clusters: [], crossThemeTension: '素材主题较为单一' }),
        });

      mockedCreateWikiDocument.mockResolvedValue({
        id: 'doc-001',
        title: '周报',
        nodeToken: 'node-001',
        objType: 'doc',
        url: 'https://feishu.cn/wiki/doc-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockedPrismaWeeklyDigest.upsert.mockResolvedValue({});

      // Act
      const result = await generateWeeklyDigest('user-001', 7);

      // Assert
      const highScoreMaterial = result.materials.find(m => m.id === 'rec-001');
      const lowScoreMaterial = result.materials.find(m => m.id === 'rec-002');

      expect(highScoreMaterial?.recommendation).toBe('deep_dive');
      expect(lowScoreMaterial?.recommendation).toBe('skip');
    });
  });

  describe('getLatestWeeklyDigest', () => {
    it('应该返回最新的周报', async () => {
      // Arrange
      const mockDigest = {
        id: 'weekly-digest-2026-02-21',
        user_id: 'user-001',
        week_start: new Date('2026-02-14'),
        week_end: new Date('2026-02-21'),
        materials_count: 5,
        materials_json: [],
        theme_clusters_json: [],
        cross_theme_tension: '测试张力',
        contrarian_questions_json: [],
        deep_dive_candidates_json: [],
        feishu_doc_url: 'https://feishu.cn/wiki/doc-001',
        created_at: new Date(),
      };

      mockedPrismaWeeklyDigest.findFirst.mockResolvedValue(mockDigest);

      // Act
      const result = await getLatestWeeklyDigest('user-001');

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe('weekly-digest-2026-02-21');
      expect(result?.materialsCount).toBe(5);
    });

    it('当没有周报时应该返回 null', async () => {
      // Arrange
      mockedPrismaWeeklyDigest.findFirst.mockResolvedValue(null);

      // Act
      const result = await getLatestWeeklyDigest('user-001');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getWeeklyDigestHistory', () => {
    it('应该返回周报历史列表', async () => {
      // Arrange
      const mockHistory = [
        {
          id: 'weekly-digest-2026-02-21',
          week_start: new Date('2026-02-14'),
          week_end: new Date('2026-02-21'),
          created_at: new Date(),
        },
        {
          id: 'weekly-digest-2026-02-14',
          week_start: new Date('2026-02-07'),
          week_end: new Date('2026-02-14'),
          created_at: new Date(),
        },
      ];

      mockedPrismaWeeklyDigest.findMany.mockResolvedValue(mockHistory);

      // Act
      const result = await getWeeklyDigestHistory('user-001', 10);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('weekly-digest-2026-02-21');
    });

    it('应该限制返回数量', async () => {
      // Arrange
      mockedPrismaWeeklyDigest.findMany.mockResolvedValue([]);

      // Act
      await getWeeklyDigestHistory('user-001', 5);

      // Assert
      expect(mockedPrismaWeeklyDigest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('selectDeepDiveMaterials', () => {
    it('应该成功选择深挖素材', async () => {
      // Arrange
      const mockMaterials: ScoredMaterial[] = [
        {
          id: 'rec-001',
          title: '素材1',
          author: '作者1',
          source: '来源1',
          summary: '摘要1',
          collectTime: new Date().toISOString(),
          scores: { D: 5, R: 5, C: 5, H: 5 },
          total: 5.0,
          recommendation: 'deep_dive',
          coreClaim: '核心主张1',
        },
        {
          id: 'rec-002',
          title: '素材2',
          author: '作者2',
          source: '来源2',
          summary: '摘要2',
          collectTime: new Date().toISOString(),
          scores: { D: 4, R: 4, C: 4, H: 4 },
          total: 4.0,
          recommendation: 'deep_dive',
          coreClaim: '核心主张2',
        },
      ];

      mockedPrismaWeeklyDigest.findUnique.mockResolvedValue({
        id: 'weekly-digest-001',
        materials_json: mockMaterials,
      });
      mockedPrismaWeeklyDigest.update.mockResolvedValue({});

      // Act
      const result = await selectDeepDiveMaterials('weekly-digest-001', [1, 2]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.selected).toHaveLength(2);
      expect(result.message).toContain('已选择 2 篇素材');
    });

    it('当周报不存在时应该返回错误', async () => {
      // Arrange
      mockedPrismaWeeklyDigest.findUnique.mockResolvedValue(null);

      // Act
      const result = await selectDeepDiveMaterials('non-existent', [1]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('周报不存在');
    });

    it('当素材序号无效时应该返回错误', async () => {
      // Arrange
      mockedPrismaWeeklyDigest.findUnique.mockResolvedValue({
        id: 'weekly-digest-001',
        materials_json: [],
      });

      // Act
      const result = await selectDeepDiveMaterials('weekly-digest-001', [1]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('未找到选中的素材');
    });
  });
});
