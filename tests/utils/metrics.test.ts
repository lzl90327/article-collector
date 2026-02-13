/**
 * 性能监控和指标收集测试
 */

import { MetricsCollector, metrics, recordTiming, incrementCounter, setGauge } from '../../src/utils/metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ enableAutoSnapshot: false });
  });

  afterEach(() => {
    collector.destroy();
  });

  describe('直方图指标', () => {
    it('应该能记录直方图数据', () => {
      collector.histogram('response_time', 100);
      collector.histogram('response_time', 200);
      collector.histogram('response_time', 150);

      const snapshot = collector.snapshot();
      expect(snapshot.metrics.response_time.count).toBe(3);
      expect(snapshot.metrics.response_time.sum).toBe(450);
      expect(snapshot.metrics.response_time.avg).toBe(150);
      expect(snapshot.metrics.response_time.min).toBe(100);
      expect(snapshot.metrics.response_time.max).toBe(200);
    });

    it('应该能计算百分位数', () => {
      // 添加 1-100 的数据
      for (let i = 1; i <= 100; i++) {
        collector.histogram('percentile_test', i);
      }

      expect(collector.percentile('percentile_test', 50)).toBe(50);
      expect(collector.percentile('percentile_test', 90)).toBe(90);
      expect(collector.percentile('percentile_test', 95)).toBe(95);
      expect(collector.percentile('percentile_test', 99)).toBe(99);
    });

    it('应该限制存储的原始值数量', () => {
      // 添加超过 10000 个值
      for (let i = 0; i < 10100; i++) {
        collector.histogram('large_dataset', i);
      }

      const snapshot = collector.snapshot();
      // 只保留最新的 100 个值
      expect(snapshot.metrics.large_dataset.values.length).toBe(100);
    });
  });

  describe('计数器', () => {
    it('应该能递增计数器', () => {
      collector.counter('requests', 1);
      collector.counter('requests', 2);
      collector.counter('requests', 3);

      const snapshot = collector.snapshot();
      expect(snapshot.counters.requests).toBe(6);
    });

    it('默认递增 1', () => {
      collector.counter('events');
      collector.counter('events');

      const snapshot = collector.snapshot();
      expect(snapshot.counters.events).toBe(2);
    });
  });

  describe('仪表盘', () => {
    it('应该能设置仪表盘值', () => {
      collector.gauge('active_connections', 10);
      collector.gauge('active_connections', 5);

      const snapshot = collector.snapshot();
      expect(snapshot.gauges.active_connections).toBe(5);
    });
  });

  describe('测量装饰器', () => {
    it('应该能测量同步函数执行时间', () => {
      const measuredFn = collector.measure('sync_operation', () => {
        // 模拟一些工作
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += i;
        }
        return sum;
      });

      measuredFn();

      const snapshot = collector.snapshot();
      expect(snapshot.metrics.sync_operation.count).toBe(1);
      expect(snapshot.metrics.sync_operation.avg).toBeGreaterThan(0);
    });

    it('应该能测量异步函数执行时间', async () => {
      const measuredFn = collector.measure('async_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      });

      await measuredFn();

      const snapshot = collector.snapshot();
      expect(snapshot.metrics.async_operation.count).toBe(1);
      // 放宽时间检查，因为执行时间可能有波动
      expect(snapshot.metrics.async_operation.avg).toBeGreaterThanOrEqual(80);
    });
  });

  describe('报告生成', () => {
    it('应该能生成报告', () => {
      collector.histogram('response_time', 100);
      collector.counter('requests', 10);
      collector.gauge('active', 5);

      const report = collector.getReport();
      expect(report).toContain('性能指标报告');
      expect(report).toContain('response_time');
      expect(report).toContain('requests');
      expect(report).toContain('active');
    });
  });

  describe('历史记录', () => {
    it('应该能保存历史快照', () => {
      collector.histogram('test', 100);
      collector.saveSnapshot();

      collector.histogram('test', 200);
      collector.saveSnapshot();

      const history = collector.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].metrics.test.avg).toBe(100);
      expect(history[1].metrics.test.avg).toBe(150);
    });

    it('应该限制历史记录大小', () => {
      // 创建新的收集器，设置较小的历史记录限制
      const smallCollector = new MetricsCollector({
        maxHistorySize: 5,
        enableAutoSnapshot: false,
      });

      for (let i = 0; i < 10; i++) {
        smallCollector.histogram('test', i);
        smallCollector.saveSnapshot();
      }

      const history = smallCollector.getHistory();
      expect(history.length).toBe(5);

      smallCollector.destroy();
    });
  });

  describe('事件监听', () => {
    it('应该在记录指标时触发事件', (done) => {
      collector.on('metric', (data) => {
        expect(data.type).toBe('histogram');
        expect(data.name).toBe('test_metric');
        expect(data.value).toBe(100);
        done();
      });

      collector.histogram('test_metric', 100);
    });

    it('应该在保存快照时触发事件', (done) => {
      collector.on('snapshot', (snapshot) => {
        expect(snapshot.timestamp).toBeDefined();
        done();
      });

      collector.saveSnapshot();
    });
  });

  describe('全局实例', () => {
    it('应该提供便捷函数', () => {
      recordTiming('global_test', 100);
      incrementCounter('global_counter');
      setGauge('global_gauge', 50);

      const snapshot = metrics.snapshot();
      expect(snapshot.metrics.global_test).toBeDefined();
      expect(snapshot.counters.global_counter).toBe(1);
      expect(snapshot.gauges.global_gauge).toBe(50);
    });
  });
});
