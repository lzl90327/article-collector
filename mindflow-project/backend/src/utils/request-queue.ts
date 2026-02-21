import { logger } from './logger';

interface QueueItem<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
  maxRetries: number;
}

class RequestQueue<T> {
  private queue: QueueItem<T>[] = [];
  private running: number = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  async add(fn: () => Promise<T>, options: { maxRetries?: number } = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        id: Math.random().toString(36).substring(7),
        fn,
        resolve,
        reject,
        retries: 0,
        maxRetries: options.maxRetries || 3,
      };

      this.queue.push(item);
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      if (item.retries < item.maxRetries) {
        item.retries++;
        logger.warn(`请求失败，第 ${item.retries} 次重试: ${item.id}`);
        this.queue.unshift(item);
      } else {
        item.reject(error);
      }
    } finally {
      this.running--;
      // 继续处理队列
      setImmediate(() => this.process());
    }
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

// 全局请求队列
export const globalRequestQueue = new RequestQueue(5);
