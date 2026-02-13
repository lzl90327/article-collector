/**
 * 性能监控和指标收集模块
 * 支持请求耗时统计、吞吐量计算、系统资源监控
 * 便于性能分析和容量规划
 */

import { EventEmitter } from 'events';

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  values: number[];
}

interface MetricSnapshot {
  timestamp: number;
  metrics: Record<string, MetricValue>;
  counters: Record<string, number>;
  gauges: Record<string, number>;
}

interface MetricsOptions {
  maxHistorySize?: number;
  snapshotIntervalMs?: number;
  enableAutoSnapshot?: boolean;
}

type MetricType = 'histogram' | 'counter' | 'gauge';

class MetricsCollector extends EventEmitter {
  private histograms = new Map<string, number[]>();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private history: MetricSnapshot[] = [];
  private options: Required<MetricsOptions>;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(options: MetricsOptions = {}) {
    super();
    this.options = {
      maxHistorySize: options.maxHistorySize || 100,
      snapshotIntervalMs: options.snapshotIntervalMs || 60000, // 1分钟
      enableAutoSnapshot: options.enableAutoSnapshot ?? true,
    };

    if (this.options.enableAutoSnapshot) {
      this.startAutoSnapshot();
    }
  }

  /**
   * 记录直方图指标（耗时、大小等）
   */
  histogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    const values = this.histograms.get(name)!;
    values.push(value);

    // 限制存储的原始值数量，避免内存无限增长
    if (values.length > 10000) {
      values.splice(0, values.length - 10000);
    }

    this.emit('metric', { type: 'histogram', name, value });
  }

  /**
   * 增加计数器
   */
  counter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    this.emit('metric', { type: 'counter', name, value: current + value });
  }

  /**
   * 设置仪表盘值
   */
  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
    this.emit('metric', { type: 'gauge', name, value });
  }

  /**
   * 计算直方图统计值
   */
  private calculateHistogram(values: number[]): MetricValue {
    if (values.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, avg: 0, values: [] };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / count,
      values: sorted.slice(-100), // 只保留最新的100个值
    };
  }

  /**
   * 获取当前指标快照
   */
  snapshot(): MetricSnapshot {
    const metrics: Record<string, MetricValue> = {};

    this.histograms.forEach((values, name) => {
      metrics[name] = this.calculateHistogram(values);
    });

    const snapshot: MetricSnapshot = {
      timestamp: Date.now(),
      metrics,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
    };

    return snapshot;
  }

  /**
   * 保存快照到历史记录
   */
  saveSnapshot(): void {
    const snapshot = this.snapshot();
    this.history.push(snapshot);

    // 限制历史记录大小
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
    }

    this.emit('snapshot', snapshot);
  }

  /**
   * 启动自动快照
   */
  startAutoSnapshot(): void {
    if (this.snapshotTimer) return;

    this.snapshotTimer = setInterval(() => {
      this.saveSnapshot();
    }, this.options.snapshotIntervalMs);
  }

  /**
   * 停止自动快照
   */
  stopAutoSnapshot(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  /**
   * 获取历史记录
   */
  getHistory(): MetricSnapshot[] {
    return [...this.history];
  }

  /**
   * 获取特定指标的百分位数
   */
  percentile(name: string, p: number): number | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 获取指标报告
   */
  getReport(): string {
    const snapshot = this.snapshot();
    const lines: string[] = [];
    lines.push('=== 性能指标报告 ===');
    lines.push(`时间: ${new Date(snapshot.timestamp).toISOString()}`);
    lines.push('');

    // 直方图指标
    if (Object.keys(snapshot.metrics).length > 0) {
      lines.push('【直方图指标】');
      Object.entries(snapshot.metrics).forEach(([name, stats]) => {
        lines.push(`  ${name}:`);
        lines.push(`    次数: ${stats.count}, 平均: ${stats.avg.toFixed(2)}ms`);
        lines.push(`    最小: ${stats.min}ms, 最大: ${stats.max}ms`);
        const p50 = this.percentile(name, 50);
        const p95 = this.percentile(name, 95);
        const p99 = this.percentile(name, 99);
        if (p50 !== null) lines.push(`    P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
      });
      lines.push('');
    }

    // 计数器
    if (Object.keys(snapshot.counters).length > 0) {
      lines.push('【计数器】');
      Object.entries(snapshot.counters).forEach(([name, value]) => {
        lines.push(`  ${name}: ${value}`);
      });
      lines.push('');
    }

    // 仪表盘
    if (Object.keys(snapshot.gauges).length > 0) {
      lines.push('【仪表盘】');
      Object.entries(snapshot.gauges).forEach(([name, value]) => {
        lines.push(`  ${name}: ${value}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
    this.history = [];
  }

  /**
   * 装饰器：测量函数执行时间
   */
  measure<T extends (...args: any[]) => any>(
    name: string,
    fn: T
  ): T {
    const self = this;
    return function (this: any, ...args: Parameters<T>): ReturnType<T> {
      const start = Date.now();
      try {
        const result = fn.apply(this, args);
        // 处理 Promise
        if (result instanceof Promise) {
          return result.finally(() => {
            self.histogram(name, Date.now() - start);
          }) as ReturnType<T>;
        }
        self.histogram(name, Date.now() - start);
        return result;
      } catch (error) {
        self.histogram(name, Date.now() - start);
        throw error;
      }
    } as T;
  }

  /**
   * 销毁收集器
   */
  destroy(): void {
    this.stopAutoSnapshot();
    this.removeAllListeners();
    this.reset();
  }
}

// 全局指标收集器实例
export const metrics = new MetricsCollector();

// 便捷函数
export function recordTiming(name: string, duration: number): void {
  metrics.histogram(name, duration);
}

export function incrementCounter(name: string, value: number = 1): void {
  metrics.counter(name, value);
}

export function setGauge(name: string, value: number): void {
  metrics.gauge(name, value);
}

export { MetricsCollector };
export type { MetricValue, MetricSnapshot, MetricsOptions };
