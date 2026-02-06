/**
 * 飞书适配器
 * 监听业务事件，转换为飞书消息或交互卡片
 */
import { eventBus, ArticleEvent, type ArticleEventData } from '../../core/events';
import { larkClient } from '../../services/lark-client';
import { logger } from '../../utils/logger';

export class FeishuAdapter {
  /**
   * 初始化适配器，订阅所有业务事件
   */
  initialize(): void {
    logger.info('[FeishuAdapter] 初始化适配器');

    // 订阅处理开始事件
    eventBus.subscribeArticleEvent(ArticleEvent.PROCESSING_STARTED, (data) =>
      this.onProcessingStarted(data)
    );

    // 订阅快速分析完成事件
    eventBus.subscribeArticleEvent(ArticleEvent.QUICK_ANALYSIS_COMPLETED, (data) =>
      this.onQuickAnalysisCompleted(data)
    );

    // 订阅文档创建完成事件
    eventBus.subscribeArticleEvent(ArticleEvent.DOCUMENT_CREATED, (data) =>
      this.onDocumentCreated(data)
    );

    // 订阅记录已存在事件
    eventBus.subscribeArticleEvent(ArticleEvent.ALREADY_EXISTS, (data) =>
      this.onAlreadyExists(data)
    );

    // 订阅处理失败事件
    eventBus.subscribeArticleEvent(ArticleEvent.PROCESSING_FAILED, (data) =>
      this.onProcessingFailed(data)
    );

    logger.info('[FeishuAdapter] 适配器初始化完成');
  }

  /**
   * 处理开始事件 - 暂时不发送消息，保持静默
   */
  private async onProcessingStarted(data: ArticleEventData): Promise<void> {
    logger.info('[FeishuAdapter] 处理开始', { url: data.article?.originalUrl });
    // 可选：发送"正在处理"的消息
  }

  /**
   * 快速分析完成事件 - 发送第一张卡片（快速摘要）
   */
  private async onQuickAnalysisCompleted(data: ArticleEventData): Promise<void> {
    logger.info('[FeishuAdapter] 发送快速摘要卡片');

    if (!data.article || !data.quickAnalysis) {
      logger.warn('[FeishuAdapter] 快速分析数据缺失');
      return;
    }

    try {
      await this.sendQuickSummaryCard(
        data.userId,
        data.article.originalUrl,
        data.article.title,
        data.quickAnalysis.summary,
        data.quickAnalysis.tags,
        data.quickAnalysis.category
      );
    } catch (error) {
      logger.error('[FeishuAdapter] 发送快速摘要卡片失败', error);
    }
  }

  /**
   * 文档创建完成事件 - 发送第二张卡片（文档链接）
   */
  private async onDocumentCreated(data: ArticleEventData): Promise<void> {
    logger.info('[FeishuAdapter] 发送文档成功卡片');

    if (!data.article || !data.documentInfo) {
      logger.warn('[FeishuAdapter] 文档数据缺失');
      return;
    }

    try {
      await this.sendDocumentSuccessCard(
        data.userId,
        data.article.title,
        data.documentInfo.documentUrl
      );
    } catch (error) {
      logger.error('[FeishuAdapter] 发送文档成功卡片失败', error);
    }
  }

  /**
   * 记录已存在事件 - 发送提示消息
   */
  private async onAlreadyExists(data: ArticleEventData): Promise<void> {
    logger.info('[FeishuAdapter] 发送记录已存在消息');

    if (!data.article || !data.documentInfo) {
      logger.warn('[FeishuAdapter] 已存在数据缺失');
      return;
    }

    try {
      await this.sendAlreadyExistsMessage(
        data.userId,
        data.article.title,
        data.documentInfo.documentUrl
      );
    } catch (error) {
      logger.error('[FeishuAdapter] 发送已存在消息失败', error);
    }
  }

  /**
   * 处理失败事件 - 发送错误消息
   */
  private async onProcessingFailed(data: ArticleEventData): Promise<void> {
    logger.info('[FeishuAdapter] 发送处理失败消息');

    if (!data.article || !data.error) {
      logger.warn('[FeishuAdapter] 错误数据缺失');
      return;
    }

    try {
      await this.sendErrorMessage(
        data.userId,
        data.article.originalUrl,
        data.error.message
      );
    } catch (error) {
      logger.error('[FeishuAdapter] 发送错误消息失败', error);
    }
  }

  /**
   * 发送快速摘要卡片（第一张卡片）
   */
  private async sendQuickSummaryCard(
    userId: string,
    url: string,
    title: string,
    summary: string,
    tags: string[],
    category: string
  ): Promise<void> {
    const card = {
      header: {
        template: 'blue',
        title: {
          tag: 'plain_text',
          content: '✅ AI 分析完成',
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**${title}**`,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `📝 **快速摘要**\n${summary}`,
          },
        },
        {
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `🏷️ **标签**\n${tags.join(', ')}`,
              },
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `📂 **分类**\n${category}`,
              },
            },
          ],
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '文档正在生成中，请稍候...',
            },
          ],
        },
      ],
    };

    await larkClient.sendInteractiveCard(userId, card);
  }

  /**
   * 发送文档成功卡片（第二张卡片）
   */
  private async sendDocumentSuccessCard(
    userId: string,
    title: string,
    documentUrl: string
  ): Promise<void> {
    const card = {
      header: {
        template: 'green',
        title: {
          tag: 'plain_text',
          content: '🎉 文档创建成功',
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**${title}**`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: '📖 查看文档',
              },
              type: 'primary',
              url: documentUrl,
            },
          ],
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '深度分析将在后台进行，结果会自动同步到多维表格',
            },
          ],
        },
      ],
    };

    await larkClient.sendInteractiveCard(userId, card);
  }

  /**
   * 发送记录已存在消息
   */
  private async sendAlreadyExistsMessage(
    userId: string,
    title: string,
    documentUrl: string
  ): Promise<void> {
    const card = {
      header: {
        template: 'yellow',
        title: {
          tag: 'plain_text',
          content: '⚠️ 文章已存在',
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**${title}**\n\n这篇文章已经收藏过了`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: '📖 查看文档',
              },
              type: 'default',
              url: documentUrl,
            },
          ],
        },
      ],
    };

    await larkClient.sendInteractiveCard(userId, card);
  }

  /**
   * 发送错误消息
   */
  private async sendErrorMessage(
    userId: string,
    url: string,
    errorMessage: string
  ): Promise<void> {
    const card = {
      header: {
        template: 'red',
        title: {
          tag: 'plain_text',
          content: '❌ 抓取失败',
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**链接**: ${url}\n\n**错误**: ${errorMessage}`,
          },
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content:
                '💡 建议：\n1. 如果是微信文章，可以使用「飞书剪存」功能\n2. 可以直接复制文章内容（200字以上）发送给我',
            },
          ],
        },
      ],
    };

    await larkClient.sendInteractiveCard(userId, card);
  }
}
