/**
 * 断路器模式实现
 * 用于增强外部服务调用的稳定性
 * 当服务出现故障时，快速失败，避免级联故障
 */

import { logger } from './logger';
import { metrics } from './metrics';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold?: number;      // 触发断路的失败次数阈值
  successThreshold?: number;      // 半开状态下恢复所需的连续成功次数
  timeoutMs?: number;             // 断路器打开后的超时时间
  resetTimeoutMs?: number;        // 半开状态的测试窗口时间
  monitoredErrorTypes?: string[]; // 需要监控的错误类型
  ignoredErrorTypes?: string[];   // 忽略的错误类型
}

interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  stateChanges: number;
}

class CircuitBreaker {
  private name: string;
  private options: Required<CircuitBreakerOptions>;
  private state: CircuitState = 'CLOSED';
  private metrics: CircuitBreakerMetrics = {
    failures: 0,
    successes: 0,
    lastFailureTime: null,
    consecutiveSuccesses: 0,
    consecutiveFailures: 0,
    stateChanges: 0,
  };
  private halfOpenTimer: NodeJS.Timeout | null = null;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 3,
      timeoutMs: options.timeoutMs ?? 60000,
      resetTimeoutMs: options.resetTimeoutMs ?? 30000,
      monitoredErrorTypes: options.monitoredErrorTypes ?? [],
      ignoredErrorTypes: options.ignoredErrorTypes ?? [],
    };
  }

  /**
   * 执行受保护的函数
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    const startTime = Date.now();

    try {
      // 检查断路器状态
      if (this.state === 'OPEN') {
        // 检查是否应该进入半开状态
        if (this.shouldAttemptReset()) {
          this.transitionTo('HALF_OPEN');
        } else {
          // 断路器打开，快速失败
          metrics.counter(`circuit_breaker.${this.name}.rejected`);
          throw new CircuitBreakerError(
            `断路器 "${this.name}" 已打开，请求被拒绝`,
            this.name,
            this.state
          );
        }
      }

      // 执行实际调用
      const result = await fn();
      this.onSuccess();
      
      metrics.histogram(`circuit_breaker.${this.name}.duration`, Date.now() - startTime);
      
      return result;
    } catch (error) {
      // 判断是否应该记录为失败
      if (this.shouldRecordFailure(error)) {
        this.onFailure();
      }

      // 如果有降级函数，执行降级
      if (fallback) {
        logger.warn(`断路器 "${this.name}" 执行失败，使用降级方案`, error);
        metrics.counter(`circuit_breaker.${this.name}.fallback`);
        return fallback();
      }

      throw error;
    }
  }

  /**
   * 同步执行受保护的函数
   */
  executeSync<T>(fn: () => T, fallback?: () => T): T {
    const startTime = Date.now();

    try {
      if (this.state === 'OPEN') {
        if (this.shouldAttemptReset()) {
          this.transitionTo('HALF_OPEN');
        } else {
          metrics.counter(`circuit_breaker.${this.name}.rejected`);
          throw new CircuitBreakerError(
            `断路器 "${this.name}" 已打开，请求被拒绝`,
            this.name,
            this.state
          );
        }
      }

      const result = fn();
      this.onSuccess();
      
      metrics.histogram(`circuit_breaker.${this.name}.duration`, Date.now() - startTime);
      
      return result;
    } catch (error) {
      if (this.shouldRecordFailure(error)) {
        this.onFailure();
      }

      if (fallback) {
        logger.warn(`断路器 "${this.name}" 执行失败，使用降级方案`, error);
        metrics.counter(`circuit_breaker.${this.name}.fallback`);
        return fallback();
      }

      throw error;
    }
  }

  /**
   * 处理成功
   */
  private onSuccess(): void {
    this.metrics.successes++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN') {
      if (this.metrics.consecutiveSuccesses >= this.options.successThreshold) {
        this.transitionTo('CLOSED');
        logger.info(`断路器 "${this.name}" 已关闭，服务恢复正常`);
      }
    }

    metrics.counter(`circuit_breaker.${this.name}.success`);
  }

  /**
   * 处理失败
   */
  private onFailure(): void {
    this.metrics.failures++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();

    if (this.state === 'CLOSED' && this.metrics.consecutiveFailures >= this.options.failureThreshold) {
      this.transitionTo('OPEN');
      logger.warn(`断路器 "${this.name}" 已打开，连续失败 ${this.metrics.consecutiveFailures} 次`);
    } else if (this.state === 'HALF_OPEN') {
      // 半开状态下失败，立即回到打开状态
      this.transitionTo('OPEN');
      logger.warn(`断路器 "${this.name}" 半开测试失败，重新打开`);
    }

    metrics.counter(`circuit_breaker.${this.name}.failure`);
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.metrics.stateChanges++;

    // 清除半开定时器
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }

    // 重置连续计数
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.consecutiveFailures = 0;

    logger.info(`断路器 "${this.name}" 状态变更: ${oldState} -> ${newState}`);
    metrics.counter(`circuit_breaker.${this.name}.state_change`, 1);
  }

  /**
   * 是否应该尝试重置（进入半开状态）
   */
  private shouldAttemptReset(): boolean {
    if (this.metrics.lastFailureTime === null) return true;
    return Date.now() - this.metrics.lastFailureTime >= this.options.timeoutMs;
  }

  /**
   * 是否应该记录为失败
   */
  private shouldRecordFailure(error: unknown): boolean {
    if (error instanceof CircuitBreakerError) {
      return false; // 断路器自身的错误不记录
    }

    if (error instanceof Error) {
      // 检查是否在忽略列表中
      if (this.options.ignoredErrorTypes.some(type => error.name.includes(type))) {
        return false;
      }

      // 如果设置了监控列表，只监控指定的错误类型
      if (this.options.monitoredErrorTypes.length > 0) {
        return this.options.monitoredErrorTypes.some(type => error.name.includes(type));
      }
    }

    return true;
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取指标
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * 强制打开断路器（用于手动干预）
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
    logger.info(`断路器 "${this.name}" 被强制打开`);
  }

  /**
   * 强制关闭断路器
   */
  forceClose(): void {
    this.transitionTo('CLOSED');
    logger.info(`断路器 "${this.name}" 被强制关闭`);
  }

  /**
   * 获取健康报告
   */
  getHealthReport(): string {
    const lines: string[] = [];
    lines.push(`断路器: ${this.name}`);
    lines.push(`  状态: ${this.state}`);
    lines.push(`  成功: ${this.metrics.successes}`);
    lines.push(`  失败: ${this.metrics.failures}`);
    lines.push(`  连续成功: ${this.metrics.consecutiveSuccesses}`);
    lines.push(`  连续失败: ${this.metrics.consecutiveFailures}`);
    lines.push(`  状态变更: ${this.metrics.stateChanges}`);
    
    if (this.metrics.lastFailureTime) {
      const timeSinceLastFailure = Date.now() - this.metrics.lastFailureTime;
      lines.push(`  上次失败: ${Math.floor(timeSinceLastFailure / 1000)}s 前`);
    }

    return lines.join('\n');
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      stateChanges: 0,
    };
    this.transitionTo('CLOSED');
  }
}

/**
 * 断路器错误
 */
class CircuitBreakerError extends Error {
  public readonly circuitName: string;
  public readonly circuitState: CircuitState;

  constructor(message: string, circuitName: string, circuitState: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.circuitName = circuitName;
    this.circuitState = circuitState;
  }
}

// 断路器管理器
class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * 获取或创建断路器
   */
  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

  /**
   * 移除断路器
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * 获取所有断路器状态
   */
  getAllStates(): Record<string, { state: CircuitState; metrics: CircuitBreakerMetrics }> {
    const states: Record<string, { state: CircuitState; metrics: CircuitBreakerMetrics }> = {};
    this.breakers.forEach((breaker, name) => {
      states[name] = {
        state: breaker.getState(),
        metrics: breaker.getMetrics(),
      };
    });
    return states;
  }

  /**
   * 获取所有健康报告
   */
  getAllHealthReports(): string {
    const reports: string[] = [];
    this.breakers.forEach((breaker) => {
      reports.push(breaker.getHealthReport());
      reports.push('');
    });
    return reports.join('\n');
  }

  /**
   * 重置所有断路器
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// 导出单例
export const circuitBreakerManager = new CircuitBreakerManager();

// 便捷函数
export function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions,
  fallback?: () => T
): Promise<T> {
  const breaker = circuitBreakerManager.get(name, options);
  return breaker.execute(fn, fallback);
}

export { CircuitBreaker, CircuitBreakerManager, CircuitBreakerError };
export type { CircuitState, CircuitBreakerOptions, CircuitBreakerMetrics };
