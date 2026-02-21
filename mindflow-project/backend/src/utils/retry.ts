import { logger } from './logger';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  timeout: number;
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  timeout: 10000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config };
  let lastError: any;

  for (let i = 0; i <= finalConfig.maxRetries; i++) {
    try {
      // 使用 Promise.race 实现超时
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('请求超时')), finalConfig.timeout)
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error;

      // 判断是否可重试
      if (!isRetryableError(error) || i === finalConfig.maxRetries) {
        throw error;
      }

      // 计算退避时间
      const delay = finalConfig.retryDelay * Math.pow(finalConfig.backoffMultiplier, i);
      logger.warn(`请求失败，${delay}ms 后重试 (${i + 1}/${finalConfig.maxRetries})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryableError(error: any): boolean {
  // 网络错误、超时、限流等可重试
  if (error.code === 'ECONNRESET') return true;
  if (error.code === 'ETIMEDOUT') return true;
  if (error.response?.status === 429) return true; // 限流
  if (error.response?.status >= 500) return true; // 服务器错误
  if (error.message === '请求超时') return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
