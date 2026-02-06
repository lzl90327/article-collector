import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * 任务类型
 */
export enum TaskType {
  ARTICLE_ANALYSIS = 'article:analysis', // 文章深度分析
}

/**
 * 任务数据接口
 */
export interface Task {
  type: TaskType;
  data: {
    url: string;
    title: string;
    content: string;
    author: string;
    publishTime: string | null;
    recordId: string; // 多维表格记录 ID
    messageId?: string; // 飞书消息 ID，用于反馈结果
  };
  createdAt: string;
}

/**
 * Redis 队列服务
 */
export class RedisQueue {
  private redis: Redis;
  private readonly queueName = 'knowledge-refinery:tasks';

  constructor() {
    this.redis = new Redis(config.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.info(`Redis 连接重试 (${times})，延迟 ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // 仅在 READONLY 错误时重连
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      logger.info('Redis 连接成功');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis 连接错误', { error: error.message });
    });

    this.redis.on('close', () => {
      logger.warn('Redis 连接已关闭');
    });
  }

  /**
   * 发布任务到队列
   */
  async publishTask(task: Task): Promise<void> {
    try {
      const taskId = `${task.type}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
      
      await this.redis.xadd(
        this.queueName,
        '*', // 自动生成 ID
        'id', taskId,
        'type', task.type,
        'data', JSON.stringify(task.data),
        'createdAt', task.createdAt
      );

      logger.info(`任务已发布到队列: ${taskId}`, {
        type: task.type,
        recordId: task.data.recordId,
      });
    } catch (error) {
      logger.error('发布任务到队列失败', {
        error: error instanceof Error ? error.message : String(error),
        task,
      });
      throw error;
    }
  }

  /**
   * 消费任务（用于 Worker）
   * @param consumerGroup 消费者组名称
   * @param consumerName 消费者名称
   * @param blockMs 阻塞等待时间（毫秒）
   */
  async consumeTask(
    consumerGroup: string,
    consumerName: string,
    blockMs: number = 5000
  ): Promise<Task | null> {
    try {
      // 确保消费者组存在
      await this.ensureConsumerGroup(consumerGroup);

      // 读取消息
      const results = await this.redis.xreadgroup(
        'GROUP',
        consumerGroup,
        consumerName,
        'COUNT',
        '1',
        'BLOCK',
        String(blockMs),
        'STREAMS',
        this.queueName,
        '>'
      ) as any;

      if (!results || results.length === 0) {
        return null;
      }

      const [[, messages]] = results as [[string, [string, string[]][]]];
      if (messages.length === 0) {
        return null;
      }

      const [messageId, fields] = messages[0];
      const fieldMap: Record<string, string> = {};
      
      for (let i = 0; i < fields.length; i += 2) {
        fieldMap[fields[i]] = fields[i + 1];
      }

      const task: Task = {
        type: fieldMap.type as TaskType,
        data: JSON.parse(fieldMap.data),
        createdAt: fieldMap.createdAt,
      };

      // 确认消息已处理
      await this.redis.xack(this.queueName, consumerGroup, messageId);

      logger.info(`任务已从队列消费: ${fieldMap.id}`, {
        type: task.type,
        recordId: task.data.recordId,
      });

      return task;
    } catch (error) {
      logger.error('消费任务失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 确保消费者组存在
   */
  private async ensureConsumerGroup(consumerGroup: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.queueName, consumerGroup, '0', 'MKSTREAM');
      logger.info(`消费者组已创建: ${consumerGroup}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        // 消费者组已存在，忽略错误
        return;
      }
      logger.error('创建消费者组失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 检查 Redis 连接状态
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping 失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 关闭 Redis 连接
   */
  async close(): Promise<void> {
    await this.redis.quit();
    logger.info('Redis 连接已关闭');
  }

  /**
   * 获取队列长度
   */
  async getQueueLength(): Promise<number> {
    try {
      const length = await this.redis.xlen(this.queueName);
      return length;
    } catch (error) {
      logger.error('获取队列长度失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

// 导出单例
export const redisQueue = new RedisQueue();
