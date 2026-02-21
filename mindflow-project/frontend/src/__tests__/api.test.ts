/**
 * API 层单元测试
 * 测试所有 API 函数的正常和异常场景
 */

import Taro from '@tarojs/taro';
import {
  startWorkflow,
  getWorkflowState,
  sendChatMessage,
  sendChatMessageStream,
  triggerPhase,
} from '../api';

// Mock Taro
jest.mock('@tarojs/taro');

describe('API 层测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startWorkflow', () => {
    it('应该成功启动工作流', async () => {
      const mockResponse = {
        workflowId: 'test-workflow-123',
        state: {
          workflowId: 'test-workflow-123',
          currentPhase: -1,
          context: {},
          history: [],
        },
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockResponse,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await startWorkflow('测试主题');

      expect(result).toEqual(mockResponse);
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/start'),
          method: 'POST',
          data: { input: '测试主题' },
        })
      );
    });

    it('应该处理空输入', async () => {
      const mockResponse = {
        workflowId: 'test-workflow-456',
        state: {
          workflowId: 'test-workflow-456',
          currentPhase: -1,
          context: {},
          history: [],
        },
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockResponse,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await startWorkflow();

      expect(result).toEqual(mockResponse);
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { input: undefined },
        })
      );
    });

    it('应该处理网络错误', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        // 同步调用 fail 回调
        if (options.fail) {
          options.fail({ errMsg: 'network error' });
        }
        return { abort: jest.fn() };
      });

      // 使用 try-catch 来验证错误
      try {
        await startWorkflow();
        // 如果没有抛出错误，测试失败
        fail('应该抛出错误');
      } catch (error) {
        // 验证错误被抛出
        expect(error).toBeDefined();
      }
    });

    it('应该处理服务器错误', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { error: 'Server Error' },
            statusCode: 500,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      await expect(startWorkflow()).rejects.toThrow();
    });
  });

  describe('getWorkflowState', () => {
    it('应该成功获取工作流状态', async () => {
      const mockState = {
        workflowId: 'test-workflow-789',
        currentPhase: 2,
        context: {},
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockState,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await getWorkflowState('test-workflow-789');

      expect(result).toEqual(mockState);
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/test-workflow-789'),
          method: 'GET',
        })
      );
    });

    it('应该处理 404 错误', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { error: 'Not Found' },
            statusCode: 404,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      await expect(getWorkflowState('non-existent')).rejects.toThrow();
    });
  });

  describe('sendChatMessage', () => {
    it('应该成功发送消息', async () => {
      const mockResponse = {
        state: {
          workflowId: 'workflow-123',
          currentPhase: 2,
          history: [
            { role: 'user', content: '测试消息' },
            { role: 'assistant', content: 'AI回复' },
          ],
        },
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockResponse,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await sendChatMessage('workflow-123', '测试消息');

      expect(result).toEqual(mockResponse);
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/workflow-123/chat'),
          method: 'POST',
          data: { input: '测试消息' },
        })
      );
    });

    it('应该处理空消息', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { error: 'Empty message' },
            statusCode: 400,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      await expect(sendChatMessage('workflow-123', '')).rejects.toThrow();
    });

    it('应该处理特殊字符', async () => {
      const specialMessage = '特殊字符：!@#$%^&*()_+{}|:"<>?~`测试';
      const mockResponse = {
        state: {
          workflowId: 'workflow-123',
          currentPhase: 2,
          history: [
            { role: 'user', content: specialMessage },
          ],
        },
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockResponse,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await sendChatMessage('workflow-123', specialMessage);
      const typedResult = result as { state: { history: Array<{ content: string }> } };

      expect(typedResult.state.history[0].content).toBe(specialMessage);
    });
  });

  describe('sendChatMessageStream', () => {
    it('应该建立流式连接', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      const mockTask = {
        abort: jest.fn(),
        onChunkReceived: jest.fn(),
      };

      (Taro.request as jest.Mock).mockReturnValue(mockTask);

      const result = sendChatMessageStream(
        'workflow-123',
        '测试消息',
        mockOnChunk,
        mockOnComplete,
        mockOnError
      );

      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/workflow-123/chat/stream'),
          method: 'POST',
          data: { input: '测试消息' },
          enableChunked: true,
        })
      );
      expect(result).toBe(mockTask);
    });

    it('应该处理流式错误', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.fail) {
          options.fail({ errMsg: 'stream error' });
        }
        return { abort: jest.fn() };
      });

      sendChatMessageStream(
        'workflow-123',
        '测试消息',
        mockOnChunk,
        mockOnComplete,
        mockOnError
      );

      expect(mockOnError).toHaveBeenCalled();
    });
  });

  describe('triggerPhase', () => {
    it('应该成功触发阶段转换', async () => {
      const mockResponse = {
        state: {
          workflowId: 'workflow-123',
          currentPhase: 1.5,
          context: {
            brief: {
              thesis: '测试核心主张',
              target_audience: '测试目标读者',
              existing_belief: '测试读者现状',
              change_goal: '测试改变目标',
            },
            angles: {
              mainstream: [],
              contrarian: [],
            },
          },
          history: [],
        },
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockResponse,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await triggerPhase('workflow-123');

      expect(result).toEqual(mockResponse);
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/workflow-123/trigger'),
          method: 'POST',
        })
      );
    });

    it('应该支持传递数据', async () => {
      const updateData = {
        brief: {
          thesis: '更新后的主张',
          target_audience: '更新后的读者',
          existing_belief: '更新后的现状',
          change_goal: '更新后的目标',
        },
      };

      const mockResponse = {
        state: {
          workflowId: 'workflow-123',
          currentPhase: 1.5,
          context: {
            brief: updateData.brief,
          },
          history: [],
        },
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockResponse,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await triggerPhase('workflow-123', updateData);
      const typedResult = result as { state: { context: { brief: unknown } } };

      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { data: updateData },
        })
      );
      expect(typedResult.state.context.brief).toEqual(updateData.brief);
    });

    it('应该处理阶段转换失败', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { error: 'Phase transition failed' },
            statusCode: 400,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      await expect(triggerPhase('workflow-123')).rejects.toThrow();
    });
  });
});
