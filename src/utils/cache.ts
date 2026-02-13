/**
 * 带 TTL 的内存缓存服务
 * 解决 Map 缓存导致的内存泄漏问题
 */

import { logger } from './logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheOptions {
  ttlMs: number;
  checkIntervalMs?: number;
  maxSize?: number;
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions) {
    this.options = {
      ttlMs: options.ttlMs,
      checkIntervalMs: options.checkIntervalMs || 60000, // 默认 1 分钟检查一次
      maxSize: options.maxSize || 1000, // 默认最大 1000 条
    };
    this.startCleanup();
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T): void {
    // 检查容量限制
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      // 删除最旧的条目
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        logger.warn(`[TTLCache] 达到容量限制，删除最旧条目: ${oldestKey}`);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.options.ttlMs,
    });
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * 删除缓存值
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 检查 key 是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(`[TTLCache] 清理 ${expiredCount} 个过期条目，剩余 ${this.cache.size}`);
    }
  }

  /**
   * 启动定时清理
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.checkIntervalMs);

    // 确保定时器不会阻止进程退出
    this.cleanupTimer.unref();
  }

  /**
   * 停止清理定时器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): { size: number; ttlMs: number; maxSize: number } {
    return {
      size: this.cache.size,
      ttlMs: this.options.ttlMs,
      maxSize: this.options.maxSize,
    };
  }
}

/**
 * 待处理内容缓存项类型
 */
export interface PendingContentItem {
  url?: string;
  comment?: string;
  messageId: string;
  senderId: string;
  timestamp: number;
  timer?: NodeJS.Timeout;
}

/**
 * 创建默认的待处理内容缓存
 * 用于 message handler 中的链接/评论关联
 */
export const pendingContentCache = new TTLCache<PendingContentItem>({
  ttlMs: 30000, // 30 秒 TTL
  checkIntervalMs: 10000, // 10 秒检查一次
  maxSize: 500, // 最多 500 条
});

/**
 * 创建全局内容缓存（替代 __pendingContents）
 */
export const globalContentCache = new TTLCache<{
  title?: string;
  content: string;
  senderId: string;
  timestamp: number;
}>({
  ttlMs: 300000, // 5 分钟 TTL
  checkIntervalMs: 60000, // 1 分钟检查一次
  maxSize: 200, // 最多 200 条
});
