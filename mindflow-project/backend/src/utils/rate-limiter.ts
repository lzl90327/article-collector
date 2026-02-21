import { logger } from './logger';

interface RateLimiterConfig {
  maxRequests: number;  // 最大请求数
  windowMs: number;     // 时间窗口（毫秒）
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // 清理过期的请求记录
    this.requests = this.requests.filter(time => now - time < this.config.windowMs);

    // 检查是否超过限制
    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.config.windowMs - (now - oldestRequest);

      logger.warn(`触发限流，等待 ${waitTime}ms`);
      await this.sleep(waitTime);
      return this.acquire(); // 递归重试
    }

    // 记录本次请求
    this.requests.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      currentRequests: this.requests.length,
      maxRequests: this.config.maxRequests,
      remaining: this.config.maxRequests - this.requests.length,
    };
  }
}

// 飞书 API 限流器：每秒 20 次
export const feishuRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 1000,
});

// 微信 API 限流器：每秒 10 次
export const wechatRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 1000,
});
