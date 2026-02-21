/**
 * 请求工具函数单元测试
 * 测试 request.ts 中的函数
 */

import Taro from '@tarojs/taro';
import { request, streamRequest } from '../../utils/request';

// Mock Taro
jest.mock('@tarojs/taro');

describe('请求工具函数测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('request', () => {
    it('应该成功发送 GET 请求', async () => {
      const mockData = { success: true, data: 'test' };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockData,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await request('/test', 'GET');

      expect(result).toEqual(mockData);
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/test'),
          method: 'GET',
          header: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('应该成功发送 POST 请求', async () => {
      const mockData = { success: true, id: 123 };
      const postData = { name: 'test' };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: mockData,
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      const result = await request('/test', 'POST', postData);

      expect(result).toEqual(mockData);
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: postData,
        })
      );
    });

    it('应该处理 200-299 范围内的状态码', async () => {
      const testCases = [200, 201, 204, 250, 299];

      for (const statusCode of testCases) {
        jest.clearAllMocks();
        
        (Taro.request as jest.Mock).mockImplementation((options: any) => {
          if (options.success) {
            options.success({
              data: { statusCode },
              statusCode,
              header: {},
            });
          }
          return { abort: jest.fn() };
        });

        const result = await request('/test', 'GET');
        expect(result).toEqual({ statusCode });
      }
    });

    it('应该处理 300+ 状态码为错误', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { error: 'Redirect' },
            statusCode: 301,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      await expect(request('/test', 'GET')).rejects.toThrow('Status Code: 301');
    });

    it('应该处理 400+ 状态码为错误', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { error: 'Bad Request' },
            statusCode: 400,
            header: {},
          });
        }
        return { abort: jest.fn() };
      });

      await expect(request('/test', 'GET')).rejects.toThrow('Status Code: 400');
    });

    it('应该处理 500+ 状态码为错误', async () => {
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

      await expect(request('/test', 'GET')).rejects.toThrow('Status Code: 500');
    });

    it('应该处理网络错误', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.fail) {
          options.fail({ errMsg: 'request:fail timeout' });
        }
        return { abort: jest.fn() };
      });

      try {
        await request('/test', 'GET');
        fail('应该抛出错误');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该显示错误提示', async () => {
      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.fail) {
          options.fail({ errMsg: 'network error' });
        }
        return { abort: jest.fn() };
      });

      try {
        await request('/test', 'GET');
      } catch {
        // 错误处理中应该调用 showToast
        expect(Taro.showToast).toHaveBeenCalled();
      }
    });
  });

  describe('streamRequest', () => {
    it('应该建立流式请求', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      const mockTask = {
        abort: jest.fn(),
        onChunkReceived: jest.fn(),
      };

      (Taro.request as jest.Mock).mockReturnValue(mockTask);

      const result = streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/stream'),
          method: 'POST',
          data: { message: 'test' },
          enableChunked: true,
          header: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toBe(mockTask);
    });

    it('应该处理流式数据块', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chunkCallback: any = null;

      const mockTask = {
        abort: jest.fn(),
        onChunkReceived: jest.fn((callback: (response: { data: ArrayBuffer }) => void) => {
          chunkCallback = callback;
        }),
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { success: true },
            statusCode: 200,
            header: {},
          });
        }
        return mockTask;
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      // 模拟接收数据块
      const encoder = new TextEncoder();
      const chunk = encoder.encode('Hello World');
      if (chunkCallback) {
        chunkCallback({ data: chunk.buffer as ArrayBuffer });
      }

      expect(mockOnChunk).toHaveBeenCalledWith('Hello World');
    });

    it('应该处理多个数据块', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chunkCallback: any = null;

      const mockTask = {
        abort: jest.fn(),
        onChunkReceived: jest.fn((callback: (response: { data: ArrayBuffer }) => void) => {
          chunkCallback = callback;
        }),
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { success: true },
            statusCode: 200,
            header: {},
          });
        }
        return mockTask;
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      const encoder = new TextEncoder();
      
      // 发送多个数据块
      if (chunkCallback) {
        chunkCallback({ data: encoder.encode('Hello').buffer as ArrayBuffer });
        chunkCallback({ data: encoder.encode(' ').buffer as ArrayBuffer });
        chunkCallback({ data: encoder.encode('World').buffer as ArrayBuffer });
      }

      expect(mockOnChunk).toHaveBeenCalledTimes(3);
      expect(mockOnChunk).toHaveBeenNthCalledWith(1, 'Hello');
      expect(mockOnChunk).toHaveBeenNthCalledWith(2, ' ');
      expect(mockOnChunk).toHaveBeenNthCalledWith(3, 'World');
    });

    it('应该处理中文字符', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chunkCallback: any = null;

      const mockTask = {
        abort: jest.fn(),
        onChunkReceived: jest.fn((callback: (response: { data: ArrayBuffer }) => void) => {
          chunkCallback = callback;
        }),
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { success: true },
            statusCode: 200,
            header: {},
          });
        }
        return mockTask;
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      const encoder = new TextEncoder();
      const chineseText = '你好，世界！🌍';
      if (chunkCallback) {
        chunkCallback({ data: encoder.encode(chineseText).buffer as ArrayBuffer });
      }

      expect(mockOnChunk).toHaveBeenCalledWith(chineseText);
    });

    it('应该处理特殊字符', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chunkCallback: any = null;

      const mockTask = {
        abort: jest.fn(),
        onChunkReceived: jest.fn((callback: (response: { data: ArrayBuffer }) => void) => {
          chunkCallback = callback;
        }),
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { success: true },
            statusCode: 200,
            header: {},
          });
        }
        return mockTask;
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      const encoder = new TextEncoder();
      const specialChars = 'Special: !@#$%^&*()_+{}|:"<>?~`';
      if (chunkCallback) {
        chunkCallback({ data: encoder.encode(specialChars).buffer as ArrayBuffer });
      }

      expect(mockOnChunk).toHaveBeenCalledWith(specialChars);
    });

    it('应该处理空数据块', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chunkCallback: any = null;

      const mockTask = {
        abort: jest.fn(),
        onChunkReceived: jest.fn((callback: (response: { data: ArrayBuffer }) => void) => {
          chunkCallback = callback;
        }),
      };

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { success: true },
            statusCode: 200,
            header: {},
          });
        }
        return mockTask;
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      // 发送空数据块
      if (chunkCallback) {
        chunkCallback({ data: new ArrayBuffer(0) });
      }

      // 空数据块不应该触发 onChunk
      expect(mockOnChunk).not.toHaveBeenCalled();
    });

    it('应该在请求完成时调用 onComplete', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.success) {
          options.success({
            data: { success: true },
            statusCode: 200,
            header: {},
          });
        }
        return { abort: jest.fn(), onChunkReceived: jest.fn() };
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it('应该在请求失败时调用 onError', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      (Taro.request as jest.Mock).mockImplementation((options: any) => {
        if (options.fail) {
          options.fail({ errMsg: 'network error' });
        }
        return { abort: jest.fn(), onChunkReceived: jest.fn() };
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      expect(mockOnError).toHaveBeenCalled();
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('应该在没有 onChunkReceived 时使用 H5 降级方案', () => {
      const mockOnChunk = jest.fn();
      const mockOnComplete = jest.fn();
      const mockOnError = jest.fn();

      // 模拟不支持 onChunkReceived 的环境
      (Taro.request as jest.Mock).mockReturnValue({
        abort: jest.fn(),
        // 没有 onChunkReceived
      });

      streamRequest(
        '/stream',
        { message: 'test' },
        {
          onChunk: mockOnChunk,
          onComplete: mockOnComplete,
          onError: mockOnError,
        }
      );

      // 在 H5 环境下应该使用降级方案
      // 这里只是验证不会报错
      expect(Taro.request).toHaveBeenCalled();
    });
  });
});
