/**
 * 错误处理模块单元测试
 */

import {
  AppError,
  ErrorCode,
  ErrorMessageMap,
  getUserFriendlyMessage,
  safeJsonParse,
  withErrorHandling,
} from '../../src/utils/errors';

describe('AppError', () => {
  describe('构造函数', () => {
    it('应该创建带有正确属性的错误', () => {
      const error = new AppError('测试错误', ErrorCode.NETWORK_ERROR, true, { url: 'http://test.com' });

      expect(error.name).toBe('AppError');
      expect(error.message).toBe('测试错误');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.userMessage).toBe(ErrorMessageMap[ErrorCode.NETWORK_ERROR]);
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual({ url: 'http://test.com' });
    });

    it('应该使用默认值', () => {
      const error = new AppError('测试错误');

      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(error.retryable).toBe(false);
      expect(error.context).toBeUndefined();
    });
  });

  describe('静态工厂方法', () => {
    it('AppError.network 应该创建网络错误', () => {
      const error = AppError.network('连接失败', { host: 'api.example.com' });

      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual({ host: 'api.example.com' });
    });

    it('AppError.timeout 应该创建超时错误', () => {
      const error = AppError.timeout('抓取', 5000);

      expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(error.message).toContain('抓取');
      expect(error.message).toContain('5000ms');
      expect(error.context).toEqual({ operation: '抓取', timeoutMs: 5000 });
    });

    it('AppError.lark 应该根据状态码创建相应错误', () => {
      const error403 = AppError.lark('禁止访问', 403);
      expect(error403.code).toBe(ErrorCode.LARK_PERMISSION_ERROR);

      const error429 = AppError.lark('请求过多', 429);
      expect(error429.code).toBe(ErrorCode.LARK_RATE_LIMIT);
      expect(error429.retryable).toBe(true);

      const error500 = AppError.lark('服务器错误', 500);
      expect(error500.code).toBe(ErrorCode.LARK_API_ERROR);
    });

    it('AppError.fetch 应该创建抓取错误', () => {
      const error = AppError.fetch('无法访问', 'http://example.com', false);

      expect(error.code).toBe(ErrorCode.FETCH_ERROR);
      expect(error.context).toEqual({ url: 'http://example.com' });
      expect(error.retryable).toBe(false);
    });

    it('AppError.storage 应该创建存储错误', () => {
      const error = AppError.storage('写入失败', { table: 'articles' });

      expect(error.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(error.context).toEqual({ table: 'articles' });
    });
  });

  describe('toLogObject', () => {
    it('应该返回可序列化的日志对象', () => {
      const error = new AppError('测试', ErrorCode.UNKNOWN_ERROR, false, { key: 'value' });
      const logObj = error.toLogObject();

      expect(logObj.errorName).toBe('AppError');
      expect(logObj.errorCode).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(logObj.message).toBe('测试');
      expect(logObj.context).toEqual({ key: 'value' });
      expect(logObj.stack).toBeDefined();
    });
  });
});

describe('getUserFriendlyMessage', () => {
  it('应该返回 AppError 的用户消息', () => {
    const error = new AppError('内部错误', ErrorCode.NETWORK_ERROR);
    expect(getUserFriendlyMessage(error)).toBe(ErrorMessageMap[ErrorCode.NETWORK_ERROR]);
  });

  it('应该识别超时错误', () => {
    const error = new Error('请求超时');
    expect(getUserFriendlyMessage(error)).toBe(ErrorMessageMap[ErrorCode.TIMEOUT_ERROR]);
  });

  it('应该识别网络错误', () => {
    const error = new Error('ECONNREFUSED');
    expect(getUserFriendlyMessage(error)).toBe(ErrorMessageMap[ErrorCode.NETWORK_ERROR]);
  });

  it('应该识别权限错误', () => {
    const error = new Error('403 Forbidden');
    expect(getUserFriendlyMessage(error)).toBe(ErrorMessageMap[ErrorCode.LARK_PERMISSION_ERROR]);
  });

  it('应该处理未知错误类型', () => {
    expect(getUserFriendlyMessage('字符串错误')).toBe(ErrorMessageMap[ErrorCode.UNKNOWN_ERROR]);
    expect(getUserFriendlyMessage(null)).toBe(ErrorMessageMap[ErrorCode.UNKNOWN_ERROR]);
    expect(getUserFriendlyMessage(undefined)).toBe(ErrorMessageMap[ErrorCode.UNKNOWN_ERROR]);
  });
});

describe('safeJsonParse', () => {
  it('应该成功解析有效 JSON', () => {
    const result = safeJsonParse('{"key": "value"}', {});
    expect(result).toEqual({ key: 'value' });
  });

  it('应该在解析失败时返回 fallback', () => {
    const fallback = { default: true };
    const result = safeJsonParse('无效 JSON', fallback);
    expect(result).toBe(fallback);
  });

  it('应该处理空字符串', () => {
    const fallback = { default: true };
    const result = safeJsonParse('', fallback);
    expect(result).toBe(fallback);
  });
});

describe('withErrorHandling', () => {
  it('应该正常返回成功的结果', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const wrapped = withErrorHandling(fn, ErrorCode.UNKNOWN_ERROR);

    const result = await wrapped('arg1', 'arg2');

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('应该包装非 AppError 错误', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('原始错误'));
    const wrapped = withErrorHandling(fn, ErrorCode.FETCH_ERROR);

    await expect(wrapped()).rejects.toThrow(AppError);
    await expect(wrapped()).rejects.toMatchObject({
      code: ErrorCode.FETCH_ERROR,
      message: '原始错误',
    });
  });

  it('应该透传 AppError', async () => {
    const originalError = new AppError('已知错误', ErrorCode.LLM_ERROR);
    const fn = jest.fn().mockRejectedValue(originalError);
    const wrapped = withErrorHandling(fn, ErrorCode.FETCH_ERROR);

    await expect(wrapped()).rejects.toBe(originalError);
  });
});
