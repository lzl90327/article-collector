import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';
import { FeishuService } from '../../services/FeishuService';
import { WeChatService } from '../../services/WeChatService';

interface PublishConfig {
  platform: 'feishu' | 'wechat' | 'both';
  format: 'article' | 'note';
  visibility: 'public' | 'private' | 'restricted';
}

interface PublishResult {
  platform: string;
  status: 'success' | 'failed';
  url?: string;
  error?: string;
  docToken?: string;
  mediaId?: string;
}

/**
 * Phase 5: Publish
 * 发布阶段 - 发布到飞书/微信
 */
export class PublishPhaseHandler extends PhaseHandler {
  private feishuService: FeishuService | null = null;
  private wechatService: WeChatService | null = null;

  constructor(feishuService?: FeishuService, wechatService?: WeChatService) {
    super('5');
    this.feishuService = feishuService || null;
    this.wechatService = wechatService || null;
  }

  /**
   * 设置发布服务
   */
  setServices(feishuService?: FeishuService, wechatService?: WeChatService): void {
    if (feishuService) this.feishuService = feishuService;
    if (wechatService) this.wechatService = wechatService;
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'publishSubstate', 'configure');

    switch (currentSubstate) {
      case 'configure':
        return this.handleConfigure(context);
      case 'preview':
        return this.handlePreview(context);
      case 'publishing':
        return this.handlePublishing(context);
      case 'completed':
        return this.handleCompleted(context);
      default:
        return this.handleConfigure(context);
    }
  }

  /**
   * 配置发布选项
   */
  private async handleConfigure(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.publish_config) {
      // 检查是否有配置好的服务
      const availablePlatforms = [];
      if (this.feishuService) availablePlatforms.push('feishu');
      if (this.wechatService) availablePlatforms.push('wechat');
      if (availablePlatforms.length >= 2) availablePlatforms.push('both');

      if (availablePlatforms.length === 0) {
        return this.errorResult('未配置发布服务，请先配置飞书或微信服务');
      }

      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'publish_config',
          `📤 发布配置

` +
          `请选择发布平台：
` +
          availablePlatforms.map(p => {
            const labels: Record<string, string> = {
              'feishu': '1. feishu - 发布到飞书文档',
              'wechat': '2. wechat - 发布到微信公众号',
              'both': '3. both - 同时发布到两个平台'
            };
            return labels[p];
          }).join('\n') +
          `

输入格式：平台|格式|可见性
示例：feishu|article|public`
        ),
        messages: ['等待发布配置']
      };
    }

    // 解析配置
    const [platform, format, visibility] = input.publish_config.split('|');

    if (!platform || !['feishu', 'wechat', 'both'].includes(platform)) {
      return this.errorResult('无效的平台选择，请选择 feishu、wechat 或 both');
    }

    // 验证平台可用性
    if (platform === 'feishu' && !this.feishuService) {
      return this.errorResult('飞书服务未配置');
    }
    if (platform === 'wechat' && !this.wechatService) {
      return this.errorResult('微信服务未配置');
    }
    if (platform === 'both' && (!this.feishuService || !this.wechatService)) {
      return this.errorResult('需要同时配置飞书和微信服务');
    }

    const config: PublishConfig = {
      platform: platform as any,
      format: format || 'article',
      visibility: visibility || 'public'
    };

    this.setFieldValue(state, 'publish_config', config);
    this.setFieldValue(state, 'publishSubstate', 'preview');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'preview_confirm',
        `发布配置：
` +
        `• 平台：${config.platform}
` +
        `• 格式：${config.format}
` +
        `• 可见性：${config.visibility}

` +
        `输入 confirm 继续发布，或 reconfigure 重新配置：`
      ),
      messages: ['配置已保存，等待确认']
    };
  }

  /**
   * 预览并确认
   */
  private async handlePreview(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.preview_confirm) {
      const config = this.getFieldValue(state, 'publish_config');
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'preview_confirm',
          `发布配置：
` +
          `• 平台：${config?.platform}
` +
          `• 格式：${config?.format}
` +
          `• 可见性：${config?.visibility}

` +
          `输入 confirm 继续发布，或 reconfigure 重新配置：`
        )
      };
    }

    const action = input.preview_confirm;

    if (action === 'confirm') {
      this.setFieldValue(state, 'publishSubstate', 'publishing');
      return this.handlePublishing(context);
    }

    if (action === 'reconfigure') {
      this.setFieldValue(state, 'publishSubstate', 'configure');
      return this.handleConfigure(context);
    }

    return this.errorResult('无效的操作');
  }

  /**
   * 执行发布
   */
  private async handlePublishing(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const config: PublishConfig = this.getFieldValue(state, 'publish_config');
    const draftContent = this.getFieldValue(state, 'current_draft')?.content ||
                        this.getFieldValue(state, 'journal_content') || '';
    const title = this.getFieldValue(state, 'article_title') ||
                  this.getFieldValue(state, 'thesis') ||
                  '未命名文章';

    // 执行实际发布
    const publishResults = await this.executePublish(title, draftContent, config);

    this.setFieldValue(state, 'publish_results', publishResults);
    this.setFieldValue(state, 'publishSubstate', 'completed');

    const successCount = publishResults.filter(r => r.status === 'success').length;
    const failedCount = publishResults.filter(r => r.status === 'failed').length;

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'publish_complete',
        `${successCount > 0 ? '✅' : '❌'} 发布完成！

` +
        publishResults.map(r => {
          if (r.status === 'success') {
            return `• ${r.platform}: ✅ 成功${r.url ? '\n  ' + r.url : ''}`;
          } else {
            return `• ${r.platform}: ❌ 失败\n  错误：${r.error}`;
          }
        }).join('\n') +
        `

输入 done 完成发布流程：`
      ),
      messages: successCount > 0 ? ['发布成功'] : ['发布失败']
    };
  }

  /**
   * 发布完成
   */
  private async handleCompleted(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const config = this.getFieldValue(state, 'publish_config');
    const results: PublishResult[] = this.getFieldValue(state, 'publish_results', []);

    // 创建 published_article artifact
    const publishArtifact = await this.createArtifact(
      context,
      'published_article',
      {
        platforms: results.map((r: any) => r.platform),
        urls: results.map((r: any) => r.url).filter(Boolean),
        published_at: new Date().toISOString(),
        config,
        results
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:5:completed');

    return {
      success: true,
      artifacts: [publishArtifact],
      nextPhaseId: '5.5', // 进入观点提炼阶段
      messages: ['发布完成，进入观点提炼阶段']
    };
  }

  /**
   * 执行实际发布
   */
  private async executePublish(
    title: string,
    content: string,
    config: PublishConfig
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    const platforms = config.platform === 'both' ? ['feishu', 'wechat'] : [config.platform];

    for (const platform of platforms) {
      try {
        if (platform === 'feishu' && this.feishuService) {
          const result = await this.feishuService.publishArticle(title, content, {
            metadata: {
              format: config.format,
              visibility: config.visibility,
              published_at: new Date().toISOString()
            }
          });

          results.push({
            platform: 'feishu',
            status: result.success ? 'success' : 'failed',
            url: result.url,
            docToken: result.docToken,
            error: result.error
          });
        } else if (platform === 'wechat' && this.wechatService) {
          const result = await this.wechatService.publishArticle(title, content, {
            author: 'MindFlow',
            digest: content.substring(0, 100) + '...'
          });

          results.push({
            platform: 'wechat',
            status: result.success ? 'success' : 'failed',
            mediaId: result.mediaId,
            error: result.error
          });
        } else {
          results.push({
            platform,
            status: 'failed',
            error: '服务未配置'
          });
        }
      } catch (error) {
        results.push({
          platform,
          status: 'failed',
          error: error instanceof Error ? error.message : '发布失败'
        });
      }
    }

    return results;
  }
}
