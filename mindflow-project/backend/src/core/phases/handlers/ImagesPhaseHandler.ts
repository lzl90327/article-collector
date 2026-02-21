import { PhaseHandler, PhaseContext, PhaseHandlerResult } from '../PhaseHandler';

interface ImageAsset {
  id: string;
  prompt: string;
  description: string;
  position: 'cover' | 'inline' | 'end';
  generatedUrl?: string;
  status: 'pending' | 'generated' | 'confirmed';
}

/**
 * Phase 4.8: Images
 * 配图生成阶段 - 为文章生成配图
 */
export class ImagesPhaseHandler extends PhaseHandler {
  constructor() {
    super('4.8');
  }

  async execute(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    const currentSubstate = this.getFieldValue(state, 'imagesSubstate', 'planning');

    switch (currentSubstate) {
      case 'planning':
        return this.handlePlanning(context);
      case 'generating':
        return this.handleGenerating(context);
      case 'await_review':
        return this.handleAwaitReview(context);
      case 'confirmed':
        return this.handleConfirmed(context);
      default:
        return this.handlePlanning(context);
    }
  }

  /**
   * 规划配图
   */
  private async handlePlanning(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const draftContent = this.getFieldValue(state, 'current_draft')?.content ||
                        this.getFieldValue(state, 'journal_content') || '';

    // 模拟分析文章内容，规划配图
    const plannedImages: ImageAsset[] = [
      {
        id: 'img_cover',
        prompt: 'A minimalist illustration of AI and human collaboration, clean design, soft colors',
        description: '封面图：AI与人类协作的极简插画',
        position: 'cover',
        status: 'pending'
      },
      {
        id: 'img_inline_1',
        prompt: 'Abstract representation of writing process, flowing lines, modern style',
        description: '插图1：写作流程的抽象表现',
        position: 'inline',
        status: 'pending'
      }
    ];

    this.setFieldValue(state, 'planned_images', plannedImages);
    this.setFieldValue(state, 'imagesSubstate', 'generating');

    return {
      success: true,
      artifacts: [],
      pendingInput: this.createPendingInput(
        'user_input',
        'image_plan_confirm',
        `🎨 配图规划\n\n` +
        `根据文章内容，建议添加以下配图：\n\n` +
        plannedImages.map((img, i) => 
          `${i + 1}. ${img.description}\n   位置：${img.position}\n   提示词：${img.prompt.substring(0, 50)}...`
        ).join('\n\n') +
        `\n\n输入 generate 开始生成，或 modify 修改规划：`
      ),
      messages: ['配图规划完成']
    };
  }

  /**
   * 生成配图
   */
  private async handleGenerating(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || input.image_plan_confirm !== 'generate') {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'image_plan_confirm',
          '输入 generate 开始生成配图，或 modify 修改规划：'
        )
      };
    }

    const plannedImages: ImageAsset[] = this.getFieldValue(state, 'planned_images', []);

    // 模拟生成图片
    // 实际应该调用 DALL-E 或其他图像生成 API
    const generatedImages = plannedImages.map(img => ({
      ...img,
      generatedUrl: `https://example.com/generated/${img.id}.png`,
      status: 'generated' as const
    }));

    this.setFieldValue(state, 'generated_images', generatedImages);
    this.setFieldValue(state, 'imagesSubstate', 'await_review');

    // 创建 image_assets artifact
    const imagesArtifact = await this.createArtifact(
      context,
      'image_assets',
      {
        images: generatedImages,
        generated_at: new Date().toISOString()
      },
      true
    );

    return {
      success: true,
      artifacts: [imagesArtifact],
      pendingInput: this.createPendingInput(
        'user_input',
        'images_review',
        `🎨 配图已生成\n\n` +
        generatedImages.map((img, i) => 
          `${i + 1}. ${img.description}\n   预览：${img.generatedUrl}`
        ).join('\n\n') +
        `\n\n输入 confirm 确认使用，或 regenerate 重新生成：`
      ),
      messages: ['配图生成完成']
    };
  }

  /**
   * 等待用户审核配图
   */
  private async handleAwaitReview(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state, input } = context;

    if (!input || !input.images_review) {
      return {
        success: true,
        artifacts: [],
        pendingInput: this.createPendingInput(
          'user_input',
          'images_review',
          '输入 confirm 确认，regenerate 重新生成，或 skip 跳过：'
        )
      };
    }

    const action = input.images_review;

    if (action === 'confirm') {
      this.setFieldValue(state, 'imagesSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    if (action === 'regenerate') {
      this.setFieldValue(state, 'imagesSubstate', 'generating');
      return this.handleGenerating(context);
    }

    if (action === 'skip') {
      this.setFieldValue(state, 'imagesSubstate', 'confirmed');
      return this.handleConfirmed(context);
    }

    return this.errorResult('无效的操作');
  }

  /**
   * 确认配图完成
   */
  private async handleConfirmed(context: PhaseContext): Promise<PhaseHandlerResult> {
    const { state } = context;

    const images = this.getFieldValue(state, 'generated_images', []);

    // 创建最终的 image_assets artifact
    const finalArtifact = await this.createArtifact(
      context,
      'image_assets',
      {
        images: images.map((img: ImageAsset) => ({ ...img, status: 'confirmed' })),
        confirmed_at: new Date().toISOString()
      },
      false
    );

    // 标记 Phase 完成
    this.completeAction(state, 'phase:4.8:completed');

    return {
      success: true,
      artifacts: [finalArtifact],
      nextPhaseId: '5', // 进入发布阶段
      messages: ['配图完成，进入发布阶段']
    };
  }
}
