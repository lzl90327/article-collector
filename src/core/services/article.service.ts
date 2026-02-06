/**
 * 核心业务服务 - 文章处理
 * 平台无关的业务逻辑，通过事件总线与外界通信
 */
import { eventBus, ArticleEvent, type Article, type QuickAnalysis } from '../events';
import { IArticleStorage } from '../interfaces';
import { fetchArticleWithBrowser } from '../../services/browser-fetcher';
import { quickSummaryService } from '../../services/quick-summary';
import { redisQueue } from '../../services/redis-queue';
import { logger } from '../../utils/logger';
import config from '../../config';

export class ArticleService {
  constructor(private storage: IArticleStorage) {}

  /**
   * 处理文章 URL
   * 核心业务流程，发射事件通知外部系统
   */
  async processArticle(url: string, userId: string, messageId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. 发射处理开始事件
      eventBus.publishArticleEvent(ArticleEvent.PROCESSING_STARTED, {
        userId,
        messageId,
        article: { originalUrl: url, title: '', content: '' },
        timestamp: new Date(),
      });

      // 2. 检查文章是否已存在
      const existingDoc = await this.storage.checkArticleExists(url);
      if (existingDoc) {
        logger.info(`[ArticleService] 文章已存在: ${url}`);
        eventBus.publishArticleEvent(ArticleEvent.ALREADY_EXISTS, {
          userId,
          messageId,
          article: { originalUrl: url, title: '', content: '' },
          documentInfo: existingDoc,
          timestamp: new Date(),
        });
        return;
      }

    // 3. 网页抓取
    logger.info(`[ArticleService] 开始抓取文章: ${url}`);
    const fetchResult = await fetchArticleWithBrowser(url);
    const scrapingTime = Date.now() - startTime;
    logger.info(`[ArticleService] 网页抓取完成，耗时: ${scrapingTime}ms`);

    // 构造 Article 对象
    const article: Article = {
      originalUrl: url,
      title: fetchResult.title,
      content: fetchResult.content,
      images: (fetchResult.images || []).map(img => img.path), // 转换为字符串数组
      metadata: {
        author: fetchResult.author,
        publishDate: fetchResult.publishTime || undefined,
      },
    };

    eventBus.publishArticleEvent(ArticleEvent.SCRAPING_COMPLETED, {
      userId,
      messageId,
      article,
      timestamp: new Date(),
    });

    // 4. 快速 AI 分析（与文档创建并行）
    const analysisPromise = this.performQuickAnalysis(article, userId, messageId);

    // 5. 创建文档（并行）
    const documentPromise = this.storage.createDocument(
      article,
      { summary: '', tags: [], category: '未分类' }, // 临时占位
      userId
    );

    // 6. 等待 AI 分析完成
    const quickAnalysis = await analysisPromise;
    const analysisTime = Date.now() - startTime;
    logger.info(`[ArticleService] AI 分析完成，总耗时: ${analysisTime}ms`);

    // 发射快速分析完成事件（此时文档可能还在创建）
    eventBus.publishArticleEvent(ArticleEvent.QUICK_ANALYSIS_COMPLETED, {
      userId,
      messageId,
      article,
      quickAnalysis,
      timestamp: new Date(),
    });

    // 7. 等待文档创建完成
    const documentInfo = await documentPromise;
    const documentTime = Date.now() - startTime;
    logger.info(`[ArticleService] 文档创建完成，总耗时: ${documentTime}ms`);

    // 8. 创建 Bitable 记录
    const bitableRecordId = await this.storage.createBitableRecord(
      article,
      quickAnalysis,
      documentInfo
    );
    documentInfo.bitableRecordId = bitableRecordId;

    // 发射文档创建完成事件
    eventBus.publishArticleEvent(ArticleEvent.DOCUMENT_CREATED, {
      userId,
      messageId,
      article,
      quickAnalysis,
      documentInfo,
      timestamp: new Date(),
    });

    // 9. 投递深度分析任务到 Redis 队列
    if (config.REFINERY_ENABLED) {
      await redisQueue.publishTask({
        type: 'article_analysis' as any, // TaskType枚举兼容
        data: {
          url: article.originalUrl,
          title: article.title,
          content: article.content,
          author: article.metadata?.author || '',
          publishTime: article.metadata?.publishDate || null,
          recordId: bitableRecordId,
          messageId,
        },
        createdAt: new Date().toISOString(),
      });
      logger.info(`[ArticleService] 深度分析任务已投递`);
    }

      const totalTime = Date.now() - startTime;
      logger.info(`[ArticleService] 文章处理完成，总耗时: ${totalTime}ms`);
    } catch (error: any) {
      logger.error(`[ArticleService] 文章处理失败: ${url}`, error);
      eventBus.publishArticleEvent(ArticleEvent.PROCESSING_FAILED, {
        userId,
        messageId,
        article: { originalUrl: url, title: '', content: '' },
        error: {
          message: error.message || '未知错误',
          details: error,
        },
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * 执行快速 AI 分析
   */
  private async performQuickAnalysis(
    article: Article,
    userId: string,
    messageId: string
  ): Promise<QuickAnalysis> {
    try {
      const [summary, tags, category] = await Promise.all([
        quickSummaryService.generateQuickSummary(article.title, article.content),
        quickSummaryService.generateTags(article.title, article.content),
        quickSummaryService.generateCategory(article.title, article.content),
      ]);

      return { summary, tags, category };
    } catch (error) {
      logger.error('[ArticleService] AI 分析失败，使用默认值', error);
      return {
        summary: article.content.substring(0, 200),
        tags: [],
        category: '未分类',
      };
    }
  }
}
