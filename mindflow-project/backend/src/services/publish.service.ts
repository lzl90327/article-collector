import { prisma } from '../lib/prisma';
import { feishuWiki } from './feishu.wiki';
import { feishuConfig } from '../config/feishu';
import { logger } from '../utils/logger';

export interface PublishResult {
  success: boolean;
  wechat?: {
    draftId?: string;
    url?: string;
    error?: string;
  };
  feishu?: {
    docToken?: string;
    url?: string;
    error?: string;
  };
  error?: string;
}

class PublishService {
  /**
   * 发布文章
   * 同步到微信公众号草稿箱和飞书云文档
   */
  async publishArticle(articleId: string, userId: string): Promise<PublishResult> {
    try {
      // 1. 获取文章
      const article = await prisma.article.findFirst({
        where: { id: articleId, userId },
      });

      if (!article) {
        return { success: false, error: '文章不存在' };
      }

      if (article.status !== 'draft') {
        return { success: false, error: '文章已发布' };
      }

      const result: PublishResult = {
        success: true,
      };

      // 2. 同步到微信公众号草稿箱
      try {
        const wechatResult = await this.syncToWeChatDraft(article);
        result.wechat = wechatResult;
        logger.info(`文章同步到微信公众号草稿箱成功: ${article.title}`);
      } catch (error: any) {
        result.wechat = { error: error.message };
        logger.error(`文章同步到微信公众号草稿箱失败`, error);
      }

      // 3. 同步到飞书云文档
      try {
        const feishuResult = await this.syncToFeishuDoc(article);
        result.feishu = feishuResult;
        logger.info(`文章同步到飞书云文档成功: ${article.title}`);
      } catch (error: any) {
        result.feishu = { error: error.message };
        logger.error(`文章同步到飞书云文档失败`, error);
      }

      // 4. 更新文章状态
      if (result.wechat?.draftId || result.feishu?.docToken) {
        await prisma.article.update({
          where: { id: articleId },
          data: {
            status: 'published',
            wechatDraftId: result.wechat?.draftId,
            feishuDocToken: result.feishu?.docToken,
            updatedAt: new Date(),
          },
        });
      }

      return result;
    } catch (error: any) {
      logger.error('发布文章失败', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 同步到微信公众号草稿箱
   */
  private async syncToWeChatDraft(article: any): Promise<{ draftId?: string; url?: string; error?: string }> {
    // TODO: 实现微信公众号 API 调用
    // 需要配置 WECHAT_APPID 和 WECHAT_SECRET
    // 调用微信草稿箱创建接口

    // 模拟实现
    logger.info(`准备同步到微信公众号草稿箱: ${article.title}`);

    // 实际实现需要调用微信 API:
    // const accessToken = await this.getWeChatAccessToken();
    // const draftId = await this.createWeChatDraft(accessToken, article);

    return {
      draftId: `mock_draft_${Date.now()}`,
      url: 'https://mp.weixin.qq.com',
      error: '微信公众号 API 未配置',
    };
  }

  /**
   * 同步到飞书云文档
   */
  private async syncToFeishuDoc(article: any): Promise<{ docToken?: string; url?: string; error?: string }> {
    const config = feishuConfig.wiki.articleLibrary;

    if (!config.spaceId || !config.folderToken) {
      return {
        error: '飞书文章库配置缺失',
      };
    }

    try {
      // 将 Markdown 转换为飞书文档格式
      const content = this.convertMarkdownToFeishuDoc(article.content || '');

      // 创建飞书文档
      const result = await feishuWiki.createDocument({
        spaceId: config.spaceId,
        folderToken: config.folderToken,
        title: article.title,
        content,
      });

      return {
        docToken: result.wikiToken,
        url: result.url,
      };
    } catch (error: any) {
      return {
        error: error.message,
      };
    }
  }

  /**
   * 获取微信 Access Token
   */
  private async getWeChatAccessToken(): Promise<string> {
    // TODO: 实现微信 Access Token 获取
    // 调用微信 API: https://api.weixin.qq.com/cgi-bin/token
    return 'mock_access_token';
  }

  /**
   * 创建微信草稿
   */
  private async createWeChatDraft(accessToken: string, article: any): Promise<string> {
    // TODO: 实现微信草稿创建
    // 调用微信 API: https://api.weixin.qq.com/cgi-bin/draft/add
    return 'mock_draft_id';
  }

  /**
   * 将 Markdown 转换为飞书文档格式
   */
  private convertMarkdownToFeishuDoc(markdown: string): string {
    // 简单的 Markdown 到飞书文档格式转换
    // 实际项目中可能需要更复杂的转换逻辑
    return markdown;
  }
}

export const publishService = new PublishService();
