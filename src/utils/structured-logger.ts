/**
 * 结构化日志系统
 * 支持 JSON 格式输出、日志轮转、日志级别控制
 * 便于日志收集和分析
 */

import fs from 'fs';
import path from 'path';
import { logger as consoleLogger } from './logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
  traceId?: string;
  duration?: number;
}

interface LoggerOptions {
  logDir?: string;
  maxFileSize?: number; // MB
  maxFiles?: number;
  enableConsole?: boolean;
  enableFile?: boolean;
  format?: 'json' | 'text';
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class StructuredLogger {
  private level: LogLevel;
  private module: string;
  private options: Required<LoggerOptions>;
  private currentFile: string | null = null;
  private currentFileSize: number = 0;
  private traceId: string | null = null;

  constructor(module: string = 'app', options: LoggerOptions = {}) {
    this.module = module;
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.options = {
      logDir: options.logDir || path.join(process.cwd(), 'logs'),
      maxFileSize: options.maxFileSize || 10, // 10MB
      maxFiles: options.maxFiles || 7,
      enableConsole: options.enableConsole ?? true,
      enableFile: options.enableFile ?? true,
      format: options.format || 'json',
    };

    if (this.options.enableFile) {
      this.ensureLogDirectory();
      this.rotateLogFile();
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  private rotateLogFile(): void {
    if (!this.options.enableFile) return;

    // 确保目录存在
    this.ensureLogDirectory();

    const date = new Date().toISOString().split('T')[0];
    const baseFileName = `${this.module}-${date}.log`;
    this.currentFile = path.join(this.options.logDir, baseFileName);

    // 检查文件大小，如果超过限制则创建新文件
    if (fs.existsSync(this.currentFile)) {
      const stats = fs.statSync(this.currentFile);
      this.currentFileSize = stats.size / (1024 * 1024); // 转换为 MB

      if (this.currentFileSize >= this.options.maxFileSize) {
        const timestamp = Date.now();
        const newFileName = `${this.module}-${date}-${timestamp}.log`;
        this.currentFile = path.join(this.options.logDir, newFileName);
        this.currentFileSize = 0;
      }
    }

    // 清理旧日志文件
    this.cleanupOldLogs();
  }

  private cleanupOldLogs(): void {
    if (!fs.existsSync(this.options.logDir)) return;

    const files = fs.readdirSync(this.options.logDir)
      .filter(f => f.startsWith(`${this.module}-`) && f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: path.join(this.options.logDir, f),
        mtime: fs.statSync(path.join(this.options.logDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // 保留最新的 maxFiles 个文件
    if (files.length > this.options.maxFiles) {
      files.slice(this.options.maxFiles).forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          consoleLogger.warn(`删除旧日志文件失败: ${file.name}`);
        }
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.options.format === 'json') {
      return JSON.stringify(entry);
    }
    // 文本格式
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const traceStr = entry.traceId ? ` [${entry.traceId}]` : '';
    const durationStr = entry.duration ? ` (${entry.duration}ms)` : '';
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]${traceStr} ${entry.message}${durationStr}${contextStr}`;
  }

  private writeLog(entry: LogEntry): void {
    const formatted = this.formatLogEntry(entry);

    // 控制台输出
    if (this.options.enableConsole) {
      const consoleMethod = entry.level === 'error' ? console.error :
                           entry.level === 'warn' ? console.warn :
                           entry.level === 'debug' ? console.debug : console.info;
      consoleMethod(formatted);
    }

    // 文件输出
    if (this.options.enableFile && this.currentFile) {
      try {
        fs.appendFileSync(this.currentFile, formatted + '\n');
        this.currentFileSize += Buffer.byteLength(formatted) / (1024 * 1024);

        // 检查是否需要轮转
        if (this.currentFileSize >= this.options.maxFileSize) {
          this.rotateLogFile();
        }
      } catch (e) {
        consoleLogger.error('写入日志文件失败', e);
      }
    }
  }

  private createLogEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      context,
      traceId: this.traceId || undefined,
    };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.writeLog(this.createLogEntry('debug', message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.writeLog(this.createLogEntry('info', message, context));
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.writeLog(this.createLogEntry('warn', message, context));
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.writeLog(this.createLogEntry('error', message, context));
    }
  }

  logError(message: string, error: Error | unknown): void {
    if (!this.shouldLog('error')) return;

    const context: Record<string, unknown> = {};
    if (error instanceof Error) {
      context.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else {
      context.error = error;
    }

    this.writeLog(this.createLogEntry('error', message, context));
  }

  time(label: string): () => void {
    const start = Date.now();
    // 只在 debug 级别记录开始日志
    if (this.shouldLog('debug')) {
      this.writeLog(this.createLogEntry('debug', `[TIMER] ${label} started`));
    }

    return () => {
      const duration = Date.now() - start;
      // 只在 debug 级别记录结束日志
      if (this.shouldLog('debug')) {
        const entry = this.createLogEntry('debug', `[TIMER] ${label} completed`, { duration });
        entry.duration = duration;
        this.writeLog(entry);
      }
    };
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setTraceId(traceId: string | null): void {
    this.traceId = traceId;
  }

  withTrace(traceId: string): StructuredLogger {
    const childLogger = new StructuredLogger(this.module, this.options);
    childLogger.setTraceId(traceId);
    childLogger.setLevel(this.level);
    return childLogger;
  }

  child(module: string): StructuredLogger {
    const childLogger = new StructuredLogger(`${this.module}:${module}`, this.options);
    childLogger.setTraceId(this.traceId);
    childLogger.setLevel(this.level);
    return childLogger;
  }
}

// 默认 logger 实例
const defaultOptions: LoggerOptions = {
  enableFile: process.env.ENABLE_FILE_LOG === 'true',
  format: (process.env.LOG_FORMAT as 'json' | 'text') || 'text',
};

export const structuredLogger = new StructuredLogger('app', defaultOptions);

export function createStructuredLogger(module: string, options?: LoggerOptions): StructuredLogger {
  return new StructuredLogger(module, { ...defaultOptions, ...options });
}

export { StructuredLogger };
export type { LogLevel, LogEntry, LoggerOptions };
