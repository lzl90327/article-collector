/**
 * 性能监控和指标收集
 * 用于监控系统性能和业务指标
 */

import { logger } from './logger';

interface MetricRecord {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface PerformanceMetrics {
  // LLM 调用指标
  llmCalls: number;
  llmErrors: number;
  llmLatency: number[];

  // 工作流指标
  workflowsCreated: number;
  workflowsCompleted: number;
  phaseTransitions: Record<string, number>;

  // API 指标
  apiRequests: number;
  apiErrors: number;
  apiLatency: number[];

  // 缓存指标
  cacheHits: number;
  cacheMisses: number;
}

class MetricsCollector {
  private metrics: PerformanceMetrics = {
    llmCalls: 0,
    llmErrors: 0,
    llmLatency: [],
    workflowsCreated: 0,
    workflowsCompleted: 0,
    phaseTransitions: {},
    apiRequests: 0,
    apiErrors: 0,
    apiLatency: [],
    cacheHits: 0,
    cacheMisses: 0
  };

  private records: MetricRecord[] = [];
  private readonly maxRecords = 1000;

  /**
   * 记录 LLM 调用
   */
  recordLLMCall(latencyMs: number, success: boolean, provider: string): void {
    this.metrics.llmCalls++;
    this.metrics.llmLatency.push(latencyMs);

    // 只保留最近 100 个延迟记录
    if (this.metrics.llmLatency.length > 100) {
      this.metrics.llmLatency.shift();
    }

    if (!success) {
      this.metrics.llmErrors++;
    }

    this.addRecord('llm_call', latencyMs, { provider, success: String(success) });
  }

  /**
   * 记录工作流创建
   */
  recordWorkflowCreated(): void {
    this.metrics.workflowsCreated++;
    this.addRecord('workflow_created', 1);
  }

  /**
   * 记录工作流完成
   */
  recordWorkflowCompleted(): void {
    this.metrics.workflowsCompleted++;
    this.addRecord('workflow_completed', 1);
  }

  /**
   * 记录阶段转换
   */
  recordPhaseTransition(fromPhase: string, toPhase: string): void {
    const key = `${fromPhase}_to_${toPhase}`;
    this.metrics.phaseTransitions[key] = (this.metrics.phaseTransitions[key] || 0) + 1;
    this.addRecord('phase_transition', 1, { from: fromPhase, to: toPhase });
  }

  /**
   * 记录 API 请求
   */
  recordAPIRequest(latencyMs: number, success: boolean, endpoint: string): void {
    this.metrics.apiRequests++;
    this.metrics.apiLatency.push(latencyMs);

    if (this.metrics.apiLatency.length > 100) {
      this.metrics.apiLatency.shift();
    }

    if (!success) {
      this.metrics.apiErrors++;
    }

    this.addRecord('api_request', latencyMs, { endpoint, success: String(success) });
  }

  /**
   * 记录缓存命中/未命中
   */
  recordCacheHit(): void {
    this.metrics.cacheHits++;
    this.addRecord('cache_hit', 1);
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
    this.addRecord('cache_miss', 1);
  }

  /**
   * 添加指标记录
   */
  addRecord(name: string, value: number, tags?: Record<string, string>): void {
    this.records.push({
      name,
      value,
      timestamp: Date.now(),
      tags
    });

    // 限制记录数量
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  /**
   * 获取平均延迟
   */
  getAverageLatency(latencies: number[]): number {
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  /**
   * 获取百分位延迟
   */
  getPercentileLatency(latencies: number[], percentile: number): number {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 获取当前指标快照
   */
  getMetricsSnapshot(): Record<string, any> {
    const llmAvgLatency = this.getAverageLatency(this.metrics.llmLatency);
    const apiAvgLatency = this.getAverageLatency(this.metrics.apiLatency);

    return {
      timestamp: new Date().toISOString(),
      llm: {
        totalCalls: this.metrics.llmCalls,
        errorCount: this.metrics.llmErrors,
        errorRate: this.metrics.llmCalls > 0 ? (this.metrics.llmErrors / this.metrics.llmCalls) : 0,
        avgLatency: llmAvgLatency,
        p95Latency: this.getPercentileLatency(this.metrics.llmLatency, 95),
        p99Latency: this.getPercentileLatency(this.metrics.llmLatency, 99)
      },
      workflow: {
        created: this.metrics.workflowsCreated,
        completed: this.metrics.workflowsCompleted,
        completionRate: this.metrics.workflowsCreated > 0
          ? (this.metrics.workflowsCompleted / this.metrics.workflowsCreated)
          : 0,
        phaseTransitions: this.metrics.phaseTransitions
      },
      api: {
        totalRequests: this.metrics.apiRequests,
        errorCount: this.metrics.apiErrors,
        errorRate: this.metrics.apiRequests > 0 ? (this.metrics.apiErrors / this.metrics.apiRequests) : 0,
        avgLatency: apiAvgLatency,
        p95Latency: this.getPercentileLatency(this.metrics.apiLatency, 95),
        p99Latency: this.getPercentileLatency(this.metrics.apiLatency, 99)
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
          ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses))
          : 0
      }
    };
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): { healthy: boolean; checks: Record<string, boolean> } {
    const snapshot = this.getMetricsSnapshot();

    const checks = {
      llmErrorRate: snapshot.llm.errorRate < 0.1, // LLM 错误率 < 10%
      apiErrorRate: snapshot.api.errorRate < 0.05, // API 错误率 < 5%
      llmLatency: snapshot.llm.avgLatency < 30000, // LLM 平均延迟 < 30s
      apiLatency: snapshot.api.avgLatency < 1000   // API 平均延迟 < 1s
    };

    return {
      healthy: Object.values(checks).every(v => v),
      checks
    };
  }

  /**
   * 计数器方法（兼容旧代码）
   */
  counter(name: string, value: number = 1): void {
    this.addRecord(name, value);
  }

  /**
   * 直方图方法（兼容旧代码）
   */
  histogram(name: string, value: number): void {
    this.addRecord(name, value);
  }

  /**
   * 获取报告（兼容旧代码）
   */
  getReport(): Record<string, any> {
    return this.getMetricsSnapshot();
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = {
      llmCalls: 0,
      llmErrors: 0,
      llmLatency: [],
      workflowsCreated: 0,
      workflowsCompleted: 0,
      phaseTransitions: {},
      apiRequests: 0,
      apiErrors: 0,
      apiLatency: [],
      cacheHits: 0,
      cacheMisses: 0
    };
    this.records = [];
  }

  /**
   * 定期报告
   */
  startReporting(intervalMs: number = 60000): void {
    setInterval(() => {
      const snapshot = this.getMetricsSnapshot();
      const health = this.getHealthStatus();

      logger.info('Performance Metrics Report', {
        metrics: snapshot,
        health: health
      });

      // 如果健康检查失败，记录警告
      if (!health.healthy) {
        logger.warn('Health check failed', { checks: health.checks });
      }
    }, intervalMs);
  }
}

// 导出单例
export const metrics = new MetricsCollector();

/**
 * 性能监控装饰器
 */
export function monitorPerformance(metricName: string, tags?: Record<string, string>) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      let success = true;

      try {
        const result = await method.apply(this, args);
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const latency = Date.now() - start;
        metrics.addRecord(metricName, latency, { ...tags, success: String(success) });
      }
    };

    return descriptor;
  };
}
