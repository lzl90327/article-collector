/**
 * TTLCache 单元测试
 */

import { TTLCache } from '../../src/utils/cache';

describe('TTLCache', () => {
  let cache: TTLCache<string>;

  beforeEach(() => {
    cache = new TTLCache<string>({
      ttlMs: 1000, // 1秒 TTL
      checkIntervalMs: 100, // 100ms 检查一次
      maxSize: 3, // 最多3条
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('基本操作', () => {
    it('应该能设置和获取值', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('应该能检查 key 是否存在', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('应该能删除值', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.delete('key1')).toBe(false);
    });

    it('应该能获取缓存大小', () => {
      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('TTL 过期', () => {
    it('应该在 TTL 后过期', (done) => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      // 等待过期
      setTimeout(() => {
        expect(cache.has('key1')).toBe(false);
        expect(cache.get('key1')).toBeUndefined();
        done();
      }, 1100);
    });

    it('应该自动清理过期条目', (done) => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      setTimeout(() => {
        // 过期后应该被清理
        expect(cache.size()).toBe(0);
        done();
      }, 1200);
    });
  });

  describe('容量限制', () => {
    it('应该在超过容量时删除最旧的条目', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // 添加第4条，应该删除 key1
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
      expect(cache.size()).toBe(3);
    });

    it('更新已有 key 不应该触发删除', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // 更新 key1
      cache.set('key1', 'updated');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.get('key1')).toBe('updated');
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计信息', () => {
      cache.set('key1', 'value1');
      
      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.ttlMs).toBe(1000);
      expect(stats.maxSize).toBe(3);
    });
  });

  describe('destroy', () => {
    it('应该清理所有资源', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.destroy();
      
      expect(cache.size()).toBe(0);
    });
  });
});
