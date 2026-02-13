/**
 * 优雅关闭机制
 * 确保服务在关闭时能够：
 * 1. 停止接收新请求
 * 2. 等待正在处理的请求完成
 * 3. 清理资源
 * 4. 正确关闭连接
 */

import { logger } from './logger';
import { metrics } from './metrics';

type ShutdownHook = () => Promise<void> | void;
type SignalHandler = (signal: string) => void;

interface GracefulShutdownOptions {
  timeoutMs?: number;
  exitCode?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

interface ShutdownState {
  isShuttingDown: boolean;
  activeRequests: number;
  startTime: number;
}

class GracefulShutdown {
  private hooks: Array<{ name: string; hook: ShutdownHook; priority: number }> = [];
  private options: Required<GracefulShutdownOptions>;
  private state: ShutdownState = {
    isShuttingDown: false,
    activeRequests: 0,
    startTime: Date.now(),
  };
  private shutdownPromise: Promise<void> | null = null;

  constructor(options: GracefulShutdownOptions = {}) {
    this.options = {
      timeoutMs: options.timeoutMs || 30000, // 默认30秒超时
      exitCode: options.exitCode || 0,
      logLevel: options.logLevel || 'info',
    };
  }

  /**
   * 注册关闭钩子
   * @param name 钩子名称（用于日志）
   * @param hook 关闭时要执行的函数
   * @param priority 优先级（数字越小越先执行）
   */
  register(name: string, hook: ShutdownHook, priority: number = 10): () => void {
    this.hooks.push({ name, hook, priority });
    // 按优先级排序
    this.hooks.sort((a, b) => a.priority - b.priority);

    // 返回取消注册函数
    return () => {
      const index = this.hooks.findIndex(h => h.name === name);
      if (index > -1) {
        this.hooks.splice(index, 1);
      }
    };
  }

  /**
   * 开始处理请求
   */
  startRequest(): () => void {
    this.state.activeRequests++;
    
    return () => {
      this.state.activeRequests = Math.max(0, this.state.activeRequests - 1);
    };
  }

  /**
   * 包装异步函数，自动追踪请求
   */
  wrapRequest<T>(fn: () => Promise<T>): Promise<T> {
    const endRequest = this.startRequest();
    
    return fn().finally(() => {
      endRequest();
    });
  }

  /**
   * 检查是否正在关闭
   */
  isShuttingDown(): boolean {
    return this.state.isShuttingDown;
  }

  /**
   * 获取活跃请求数
   */
  getActiveRequests(): number {
    return this.state.activeRequests;
  }

  /**
   * 执行关闭流程
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.state.isShuttingDown) {
      logger.warn('关闭流程已在进行中...');
      return this.shutdownPromise!;
    }

    this.state.isShuttingDown = true;
    this.shutdownPromise = this.doShutdown(signal);
    
    return this.shutdownPromise;
  }

  /**
   * 实际执行关闭
   */
  private async doShutdown(signal?: string): Promise<void> {
    const startTime = Date.now();
    
    logger.info('');
    logger.info('=====================================');
    logger.info(`正在优雅关闭服务...${signal ? ` (信号: ${signal})` : ''}`);
    logger.info(`当前活跃请求: ${this.state.activeRequests}`);
    logger.info('=====================================');
    logger.info('');

    // 等待活跃请求完成（最多等待 timeoutMs/2）
    const waitTimeout = Math.floor(this.options.timeoutMs / 2);
    await this.waitForActiveRequests(waitTimeout);

    // 执行所有关闭钩子
    const hookResults = await this.executeHooks();

    // 输出关闭报告
    const duration = Date.now() - startTime;
    logger.info('');
    logger.info('=====================================');
    logger.info('关闭流程完成');
    logger.info(`耗时: ${duration}ms`);
    logger.info(`成功: ${hookResults.success.length}, 失败: ${hookResults.failed.length}`);
    logger.info('=====================================');

    // 如果有失败的钩子，记录错误
    if (hookResults.failed.length > 0) {
      logger.error('以下关闭钩子执行失败:');
      hookResults.failed.forEach(({ name, error }) => {
        logger.error(`  - ${name}: ${error}`);
      });
    }

    // 输出性能指标报告
    logger.info('');
    logger.info(metrics.getReport());
  }

  /**
   * 等待活跃请求完成
   */
  private async waitForActiveRequests(timeoutMs: number): Promise<void> {
    if (this.state.activeRequests === 0) {
      return;
    }

    logger.info(`等待 ${this.state.activeRequests} 个活跃请求完成 (最多 ${timeoutMs}ms)...`);

    const startTime = Date.now();
    
    while (this.state.activeRequests > 0 && Date.now() - startTime < timeoutMs) {
      await this.sleep(100);
    }

    if (this.state.activeRequests > 0) {
      logger.warn(`超时！仍有 ${this.state.activeRequests} 个请求未完成`);
    } else {
      logger.info('所有请求已完成');
    }
  }

  /**
   * 执行所有关闭钩子
   */
  private async executeHooks(): Promise<{
    success: string[];
    failed: Array<{ name: string; error: string }>;
  }> {
    const success: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    const hookTimeout = Math.floor(this.options.timeoutMs / 2 / this.hooks.length);

    for (const { name, hook } of this.hooks) {
      try {
        logger.info(`执行关闭钩子: ${name}...`);
        
        // 设置单个钩子的超时
        await Promise.race([
          this.executeHook(hook),
          this.createTimeout(hookTimeout, `钩子 "${name}" 超时`),
        ]);
        
        success.push(name);
        logger.info(`✓ ${name} 完成`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({ name, error: errorMessage });
        logger.error(`✗ ${name} 失败: ${errorMessage}`);
      }
    }

    return { success, failed };
  }

  /**
   * 执行单个钩子
   */
  private async executeHook(hook: ShutdownHook): Promise<void> {
    const result = hook();
    if (result instanceof Promise) {
      await result;
    }
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 设置进程信号处理器
   */
  setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`收到信号: ${signal}`);
        await this.shutdown(signal);
        process.exit(this.options.exitCode);
      });
    });

    // 处理未捕获的异常
    process.on('uncaughtException', async (error) => {
      logger.error('未捕获的异常:', error);
      await this.shutdown('uncaughtException');
      process.exit(1);
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', async (reason) => {
      logger.error('未处理的 Promise 拒绝:', reason);
      await this.shutdown('unhandledRejection');
      process.exit(1);
    });

    logger.info('优雅关闭信号处理器已设置');
  }

  /**
   * 获取服务运行时间
   */
  getUptime(): number {
    return Date.now() - this.state.startTime;
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): {
    healthy: boolean;
    uptime: number;
    activeRequests: number;
    isShuttingDown: boolean;
  } {
    return {
      healthy: !this.state.isShuttingDown,
      uptime: this.getUptime(),
      activeRequests: this.state.activeRequests,
      isShuttingDown: this.state.isShuttingDown,
    };
  }
}

// 导出单例
export const gracefulShutdown = new GracefulShutdown();

// 便捷函数
export function registerShutdownHook(name: string, hook: ShutdownHook, priority?: number): () => void {
  return gracefulShutdown.register(name, hook, priority);
}

export function startRequest(): () => void {
  return gracefulShutdown.startRequest();
}

export function wrapRequest<T>(fn: () => Promise<T>): Promise<T> {
  return gracefulShutdown.wrapRequest(fn);
}

export { GracefulShutdown };
export type { ShutdownHook, SignalHandler, GracefulShutdownOptions, ShutdownState };
