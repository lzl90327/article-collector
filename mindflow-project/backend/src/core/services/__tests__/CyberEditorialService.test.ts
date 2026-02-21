import { CyberEditorialService } from '../CyberEditorialService';
import { DeepSeekService } from '../DeepSeekService';

// Mock DeepSeekService
jest.mock('../DeepSeekService');

describe('CyberEditorialService', () => {
  let cyberEditorialService: CyberEditorialService;
  let mockDeepSeekService: jest.Mocked<DeepSeekService>;

  beforeEach(() => {
    mockDeepSeekService = {
      chatCompletion: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<DeepSeekService>;

    cyberEditorialService = new CyberEditorialService({
      deepSeekService: mockDeepSeekService,
      minScore: 6,
    });
  });

  describe('auditArticle', () => {
    it('should perform multi-dimensional audit', async () => {
      // Mock successful audit response
      mockDeepSeekService.chatCompletion.mockResolvedValue({
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              score: 8,
              criticisms: ['逻辑不够严密'],
              suggestions: ['增加数据支撑'],
            }),
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      });

      const content = '这是一篇测试文章';
      const brief = {
        thesis: '测试主题',
        target_audience: '测试读者',
      };

      const report = await cyberEditorialService.auditArticle(content, brief);

      expect(report).toBeDefined();
      expect(report.checks).toHaveLength(5); // 5个默认角色
      expect(report.overall_score).toBeGreaterThan(0);
      expect(report.passed).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should handle audit errors gracefully', async () => {
      // Mock failed audit
      mockDeepSeekService.chatCompletion.mockRejectedValue(new Error('API Error'));

      const content = '这是一篇测试文章';
      const brief = {
        thesis: '测试主题',
        target_audience: '测试读者',
      };

      const report = await cyberEditorialService.auditArticle(content, brief);

      // 即使出错也应该返回一个报告（降级方案）
      expect(report).toBeDefined();
      expect(report.checks).toHaveLength(5);
    });
  });

  describe('checkBriefAlignment', () => {
    it('should check alignment between content and brief', async () => {
      mockDeepSeekService.chatCompletion.mockResolvedValue({
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              thesis_match: true,
              audience_match: true,
              goal_match: true,
            }),
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 30,
          total_tokens: 130,
        },
      });

      const content = '这是一篇测试文章';
      const brief = {
        thesis: '测试主题',
        target_audience: '测试读者',
      };

      const alignment = await cyberEditorialService.checkBriefAlignment(content, brief);

      expect(alignment).toBeDefined();
      expect(alignment.thesis_match).toBe(true);
      expect(alignment.audience_match).toBe(true);
      expect(alignment.goal_match).toBe(true);
    });
  });

  describe('streamAudit', () => {
    it('should stream audit progress', async () => {
      mockDeepSeekService.chatCompletion.mockResolvedValue({
        id: 'test-id',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              score: 7,
              criticisms: [],
              suggestions: [],
            }),
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
        },
      });

      const content = '这是一篇测试文章';
      const brief = {
        thesis: '测试主题',
        target_audience: '测试读者',
      };

      const events: Array<{ role: string; status: string }> = [];
      for await (const event of cyberEditorialService.streamAudit(content, brief)) {
        events.push(event);
      }

      // 应该有 5 个角色 * 2 个事件 (start + complete)
      expect(events.length).toBe(10);
      expect(events.filter(e => e.status === 'start').length).toBe(5);
      expect(events.filter(e => e.status === 'complete').length).toBe(5);
    });
  });
});
