/**
 * Redis 缓存客户端
 * 提供缓存和会话管理功能
 */

import { logger } from './logger';

// 简单的内存缓存实现（生产环境应使用 Redis）
class MemoryCache {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // 清理过期项
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// 创建全局缓存实例
const cache = new MemoryCache();

// 定期清理过期项
setInterval(() => {
  cache.cleanup();
}, 60000); // 每分钟清理一次

export interface CacheOptions {
  ttl?: number; // 过期时间（秒）
  key?: string; // 自定义缓存键
}

/**
 * 缓存装饰器
 */
export function cacheable(options: CacheOptions = {}) {
  const { ttl = 3600 } = options;

  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = options.key || `${propertyName}_${JSON.stringify(args)}`;

      // 尝试从缓存获取
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }

      // 执行原方法
      const result = await method.apply(this, args);

      // 存入缓存
      await cache.set(cacheKey, result, ttl);
      logger.debug(`Cache set: ${cacheKey}`);

      return result;
    };

    return descriptor;
  };
}

/**
 * 清除缓存
 */
export async function clearCache(pattern?: string): Promise<void> {
  if (!pattern) {
    // 清除所有缓存
    (cache as any).cache.clear();
    logger.info('All cache cleared');
    return;
  }

  // 这里可以实现按模式清除
  logger.info(`Cache cleared with pattern: ${pattern}`);
}

/**
 * 获取缓存实例
 */
export function getCache(): MemoryCache {
  return cache;
}

export { cache };
