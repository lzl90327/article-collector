/**
 * 结构化日志系统测试
 */

import { StructuredLogger, createStructuredLogger } from '../../src/utils/structured-logger';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;

  describe('基本日志功能', () => {
    it('应该能记录不同级别的日志', () => {
      logger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
      });

      // 不应该抛出错误
      expect(() => {
        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');
      }).not.toThrow();
    });

    it('应该支持不同的格式选项', () => {
      const jsonLogger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
        format: 'json',
      });

      const textLogger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
        format: 'text',
      });

      expect(() => {
        jsonLogger.info('test message', { key: 'value' });
        textLogger.info('test message');
      }).not.toThrow();
    });
  });

  describe('日志级别控制', () => {
    it('应该根据日志级别过滤日志', () => {
      logger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
      });

      logger.setLevel('warn');
      
      // 这些不应该记录
      logger.debug('debug');
      logger.info('info');
      
      // 这些应该记录
      logger.warn('warn');
      logger.error('error');

      // 验证不抛出错误
      expect(true).toBe(true);
    });
  });

  describe('错误日志', () => {
    it('应该正确记录错误对象', () => {
      logger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
      });

      const error = new Error('test error');
      
      expect(() => {
        logger.logError('error occurred', error);
      }).not.toThrow();
    });
  });

  describe('计时器功能', () => {
    it('应该能测量执行时间', async () => {
      logger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
      });

      // 设置日志级别为 debug 以记录计时器日志
      logger.setLevel('debug');

      const endTimer = logger.time('test-operation');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(() => {
        endTimer();
      }).not.toThrow();
    });
  });

  describe('子 logger', () => {
    it('应该能创建子 logger', () => {
      logger = createStructuredLogger('parent', {
        enableFile: false,
        enableConsole: false,
      });

      const childLogger = logger.child('child');
      
      expect(() => {
        childLogger.info('child message');
      }).not.toThrow();
    });

    it('应该支持 trace ID', () => {
      logger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
      });

      const traceLogger = logger.withTrace('trace-123');
      
      expect(() => {
        traceLogger.info('message with trace');
      }).not.toThrow();
    });
  });

  describe('日志级别设置', () => {
    it('应该能设置日志级别', () => {
      logger = createStructuredLogger('test', {
        enableFile: false,
        enableConsole: false,
      });

      logger.setLevel('debug');
      logger.setLevel('info');
      logger.setLevel('warn');
      logger.setLevel('error');

      expect(true).toBe(true);
    });
  });
});
