/**
 * 断路器模式测试
 */

import { CircuitBreaker, CircuitBreakerError, circuitBreakerManager, withCircuitBreaker } from '../../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
    });
  });

  afterEach(() => {
    breaker.reset();
  });

  describe('基本功能', () => {
    it('初始状态应该是 CLOSED', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('应该能成功执行函数', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('应该传播错误', async () => {
      await expect(
        breaker.execute(async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });
  });

  describe('状态转换', () => {
    it('应该在连续失败后打开', async () => {
      // 连续失败 3 次
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('应该在超时后进入半开状态', async () => {
      // 先让断路器打开
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 下一次请求应该进入半开状态
      try {
        await breaker.execute(async () => {
          throw new Error('error');
        });
      } catch {
        // 忽略错误
      }

      expect(breaker.getState()).toBe('OPEN'); // 失败后回到 OPEN
    });

    it('应该在半开状态下连续成功后关闭', async () => {
      // 先让断路器打开
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 连续成功 2 次
      await breaker.execute(async () => 'success1');
      await breaker.execute(async () => 'success2');

      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('降级方案', () => {
    it('应该执行降级函数', async () => {
      const result = await breaker.execute(
        async () => {
          throw new Error('primary failed');
        },
        () => 'fallback'
      );

      expect(result).toBe('fallback');
    });

    it('应该在断路器打开时使用降级', async () => {
      // 让断路器打开
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      const result = await breaker.execute(
        async () => 'primary',
        () => 'fallback'
      );

      expect(result).toBe('fallback');
    });
  });

  describe('指标统计', () => {
    it('应该统计成功次数', async () => {
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      const metrics = breaker.getMetrics();
      expect(metrics.successes).toBe(2);
      expect(metrics.consecutiveSuccesses).toBe(2);
    });

    it('应该统计失败次数', async () => {
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(2);
      expect(metrics.consecutiveFailures).toBe(2);
    });

    it('应该记录状态变更次数', async () => {
      // 让断路器打开
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.stateChanges).toBeGreaterThan(0);
    });
  });

  describe('手动控制', () => {
    it('应该能强制打开', () => {
      breaker.forceOpen();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('应该能强制关闭', async () => {
      // 先让断路器打开
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      breaker.forceClose();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('应该能重置', async () => {
      await breaker.execute(async () => 'success');
      breaker.reset();

      const metrics = breaker.getMetrics();
      expect(metrics.successes).toBe(0);
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('同步执行', () => {
    it('应该能执行同步函数', () => {
      const result = breaker.executeSync(() => 'success');
      expect(result).toBe('success');
    });

    it('应该处理同步函数的错误', () => {
      expect(() => {
        breaker.executeSync(() => {
          throw new Error('sync error');
        });
      }).toThrow('sync error');
    });

    it('同步函数也应该触发状态变更', () => {
      // 连续失败 3 次
      for (let i = 0; i < 3; i++) {
        try {
          breaker.executeSync(() => {
            throw new Error('error');
          });
        } catch {
          // 忽略错误
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('CircuitBreakerError', () => {
    it('应该包含断路器名称和状态', () => {
      const error = new CircuitBreakerError('test message', 'test-breaker', 'OPEN');
      expect(error.message).toBe('test message');
      expect(error.circuitName).toBe('test-breaker');
      expect(error.circuitState).toBe('OPEN');
      expect(error.name).toBe('CircuitBreakerError');
    });
  });

  describe('CircuitBreakerManager', () => {
    afterEach(() => {
      circuitBreakerManager.resetAll();
    });

    it('应该能获取或创建断路器', () => {
      const breaker1 = circuitBreakerManager.get('test');
      const breaker2 = circuitBreakerManager.get('test');
      expect(breaker1).toBe(breaker2);
    });

    it('应该能移除断路器', () => {
      circuitBreakerManager.get('test');
      expect(circuitBreakerManager.remove('test')).toBe(true);
      expect(circuitBreakerManager.remove('test')).toBe(false);
    });

    it('应该能获取所有状态', () => {
      circuitBreakerManager.get('breaker1');
      circuitBreakerManager.get('breaker2');

      const states = circuitBreakerManager.getAllStates();
      expect(Object.keys(states)).toContain('breaker1');
      expect(Object.keys(states)).toContain('breaker2');
    });

    it('应该能重置所有断路器', async () => {
      const b1 = circuitBreakerManager.get('b1');
      const b2 = circuitBreakerManager.get('b2');

      await b1.execute(async () => 'success');
      await b2.execute(async () => 'success');

      circuitBreakerManager.resetAll();

      expect(b1.getMetrics().successes).toBe(0);
      expect(b2.getMetrics().successes).toBe(0);
    });
  });

  describe('便捷函数', () => {
    it('withCircuitBreaker 应该能执行函数', async () => {
      const result = await withCircuitBreaker('test-fn', async () => 'success');
      expect(result).toBe('success');
    });
  });
});
