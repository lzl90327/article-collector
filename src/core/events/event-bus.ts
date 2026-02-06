/**
 * 核心事件总线
 * 基于 EventEmitter 实现的中央事件分发器
 * 所有业务事件通过此总线进行发布和订阅
 */
import { EventEmitter } from 'events';
import { ArticleEvent, ArticleEventData } from './article.events';
import { logger } from '../../utils/logger';

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(20); // 提高监听器上限
  }

  /**
   * 单例模式获取事件总线实例
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 发布文章相关事件
   */
  public publishArticleEvent(event: ArticleEvent, data: ArticleEventData): void {
    logger.info(`[EventBus] 发布事件: ${event}`, {
      eventType: event,
      articleUrl: data.article?.originalUrl,
      userId: data.userId,
    });
    this.emit(event, data);
  }

  /**
   * 订阅文章相关事件
   */
  public subscribeArticleEvent(
    event: ArticleEvent,
    handler: (data: ArticleEventData) => void | Promise<void>
  ): void {
    logger.info(`[EventBus] 订阅事件: ${event}`);
    this.on(event, async (data: ArticleEventData) => {
      try {
        await handler(data);
      } catch (error) {
        logger.error(`[EventBus] 事件处理失败: ${event}`, error);
      }
    });
  }

  /**
   * 取消订阅
   */
  public unsubscribeArticleEvent(
    event: ArticleEvent,
    handler: (data: ArticleEventData) => void | Promise<void>
  ): void {
    this.off(event, handler);
  }
}

// 导出单例
export const eventBus = EventBus.getInstance();
