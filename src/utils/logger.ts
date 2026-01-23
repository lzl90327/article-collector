/**
 * 日志工具模块
 * 提供统一的日志输出格式和级别控制
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;
  private module: string;

  constructor(module: string = 'app') {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.module = module;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    return `[${timestamp}] [${levelStr}] [${this.module}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * 记录错误对象（包含堆栈信息）
   */
  logError(message: string, error: Error | unknown): void {
    if (error instanceof Error) {
      this.error(message, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      this.error(message, error);
    }
  }

  /**
   * 计时器 - 返回一个函数，调用时输出耗时
   */
  time(label: string): () => void {
    const start = Date.now();
    this.debug(`[TIMER] ${label} started`);
    
    return () => {
      const duration = Date.now() - start;
      this.debug(`[TIMER] ${label} completed in ${duration}ms`);
    };
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// 默认 logger 实例
export const logger = new Logger();

/**
 * 创建带模块名的 logger
 */
export function createLogger(module: string): Logger {
  return new Logger(module);
}

export { Logger };
export default logger;
