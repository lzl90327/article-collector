/**
 * 飞书云文档服务
 * 创建和管理飞书云文档
 */

import { larkClient } from './lark-client';
import { logger } from '../utils/logger';
import type { ArticleMeta } from '../types/article';
import type { ImageInfo } from './browser-fetcher';

/**
 * 创建云文档响应
 */
interface CreateDocResponse {
  code: number;
  msg: string;
  data?: {
    document: {
      document_id: string;
      title: string;
    };
  };
}

/**
 * 创建块响应
 */
interface CreateBlockResponse {
  code: number;
  msg: string;
  data?: {
    children: Array<{
      block_id: string;
    }>;
  };
}

/**
 * 图片 Token 映射类型
 */
export type ImageTokenMap = Record<number, string>;  // { 图片索引: file_token }

/**
 * 创建飞书云文档
 * @param title 文档标题
 * @param content Markdown 格式的内容
 * @param meta 文章元信息
 * @param imageTokens 图片 token 映射（可选）
 * @returns 文档 ID 和 URL
 */
export async function createDocument(
  title: string,
  content: string,
  meta: ArticleMeta,
  imageTokens?: ImageTokenMap
): Promise<{ documentId: string; url: string }> {
  logger.info(`创建云文档: ${title}`);

  try {
    // 1. 创建空文档
    const createRes = await larkClient.post<CreateDocResponse>(
      '/docx/v1/documents',
      {
        title,
        folder_token: '', // 创建在根目录，后续移动到知识库
      }
    );

    if (createRes.code !== 0) {
      throw new Error(`创建文档失败: ${createRes.msg}`);
    }

    const documentId = createRes.data!.document.document_id;
    logger.debug(`文档创建成功: ${documentId}`);

    // 2. 获取文档根 block
    const docInfo = await larkClient.get(`/docx/v1/documents/${documentId}`);
    const rootBlockId = docInfo.data?.document?.document_id;

    // 3. 添加文档内容（传递图片 token 映射）
    await addDocumentContent(documentId, rootBlockId || documentId, content, meta, imageTokens);

    // 4. 返回文档信息
    const url = `https://feishu.cn/docx/${documentId}`;
    logger.info(`文档创建完成: ${url}`);

    return { documentId, url };
  } catch (error) {
    logger.error('创建云文档失败', error);
    throw error;
  }
}

/**
 * 创建飞书云文档（包含图片上传）
 * @param title 文档标题
 * @param content Markdown 格式的内容
 * @param meta 文章元信息
 * @param images 图片信息列表
 * @returns 文档 ID 和 URL
 */
export async function createDocumentWithImages(
  title: string,
  content: string,
  meta: ArticleMeta,
  images: ImageInfo[]
): Promise<{ documentId: string; url: string }> {
  logger.info(`创建云文档（含图片）: ${title}, 图片数: ${images.length}`);

  try {
    // 1. 创建空文档
    const createRes = await larkClient.post<CreateDocResponse>(
      '/docx/v1/documents',
      {
        title,
        folder_token: '',
      }
    );

    if (createRes.code !== 0) {
      throw new Error(`创建文档失败: ${createRes.msg}`);
    }

    const documentId = createRes.data!.document.document_id;
    logger.debug(`文档创建成功: ${documentId}`);

    // 2. 上传图片（使用文档 ID 作为 parent_node）
    const imageTokens: ImageTokenMap = {};
    
    if (images.length > 0) {
      logger.info(`开始上传 ${images.length} 张图片...`);
      
      for (const imgInfo of images) {
        try {
          const token = await larkClient.uploadImage(imgInfo.path, documentId);
          if (token) {
            imageTokens[imgInfo.index] = token;
            logger.debug(`图片 ${imgInfo.index} 上传成功: ${token}`);
          }
        } catch (e) {
          logger.warn(`图片 ${imgInfo.index} 上传失败`, e);
        }
        
        // 清理临时文件
        try {
          const fs = await import('fs');
          if (fs.existsSync(imgInfo.path)) {
            fs.unlinkSync(imgInfo.path);
          }
        } catch (e) {
          // 忽略清理失败
        }
      }
      
      logger.info(`图片上传完成: ${Object.keys(imageTokens).length}/${images.length} 成功`);
    }

    // 3. 获取文档根 block
    const docInfo = await larkClient.get(`/docx/v1/documents/${documentId}`);
    const rootBlockId = docInfo.data?.document?.document_id;

    // 4. 添加文档内容（包含图片块）
    await addDocumentContent(documentId, rootBlockId || documentId, content, meta, imageTokens);

    // 5. 返回文档信息
    const url = `https://feishu.cn/docx/${documentId}`;
    logger.info(`文档创建完成: ${url}`);

    return { documentId, url };
  } catch (error) {
    logger.error('创建云文档失败', error);
    throw error;
  }
}

/**
 * 延迟函数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 添加文档内容
 */
async function addDocumentContent(
  documentId: string,
  parentBlockId: string,
  content: string,
  meta: ArticleMeta,
  imageTokens?: ImageTokenMap
): Promise<void> {
  // 构建文档块结构（传递图片 token 映射）
  const blocks = buildDocumentBlocks(content, meta, imageTokens);

  // 批量创建块，添加延迟避免触发限流
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    try {
      await larkClient.post(
        `/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`,
        {
          children: [block],
          index: -1, // 追加到末尾
        }
      );
      // 每个请求之间添加延迟，避免触发飞书 API 限流 (429)
      if (i < blocks.length - 1) {
        await delay(200);
      }
    } catch (error: any) {
      // 如果是限流错误，等待后重试一次
      if (error?.response?.status === 429) {
        logger.warn('触发限流，等待 2 秒后重试...', { block: block.block_type });
        await delay(2000);
        try {
          await larkClient.post(
            `/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`,
            {
              children: [block],
              index: -1,
            }
          );
        } catch (retryError) {
          logger.warn('重试后仍失败，跳过', { block: block.block_type, error: retryError });
        }
      } else {
        logger.warn('添加块失败，跳过', { block: block.block_type, error });
      }
    }
  }
}

/**
 * 构建文档块结构
 * 将 Markdown 转换为飞书文档块
 */
function buildDocumentBlocks(content: string, meta: ArticleMeta, imageTokens?: ImageTokenMap): any[] {
  const blocks: any[] = [];

  // 添加元信息块（使用普通文本块，因为 callout 格式复杂容易出错）
  blocks.push({
    block_type: 2, // text
    text: {
      style: {
        background_color: 14, // 浅灰色背景
      },
      elements: [
        {
          text_run: {
            content: `📕 来源: ${meta.source} | 作者: ${meta.author || '未知'} | 原文: `,
          },
        },
        {
          text_run: {
            content: meta.originalUrl,
            text_element_style: {
              link: {
                url: meta.originalUrl,
              },
            },
          },
        },
      ],
    },
  });

  // 添加分割线
  blocks.push({
    block_type: 22, // divider
    divider: {},
  });

  // 解析 Markdown 内容并转换为块（传递图片 token 映射）
  const contentBlocks = parseMarkdownToBlocks(content, imageTokens);
  blocks.push(...contentBlocks);

  return blocks;
}

/**
 * 解析 Markdown 为飞书文档块
 * 支持段落、标题、列表、图片
 */
function parseMarkdownToBlocks(markdown: string, imageTokens?: ImageTokenMap): any[] {
  const blocks: any[] = [];
  const lines = markdown.split('\n');
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('\n').trim();
      if (text) {
        blocks.push(createTextBlock(text));
      }
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行：结束当前段落
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // 图片标记：![IMG:N](LOCAL:path) 或 ![IMG:N](TOKEN:xxx)
    const imageMatch = trimmed.match(/!\[IMG:(\d+)\]\((LOCAL|TOKEN):([^)]+)\)/);
    if (imageMatch) {
      flushParagraph();
      const imgIndex = parseInt(imageMatch[1]);
      const imgType = imageMatch[2];
      const imgValue = imageMatch[3];
      
      // 如果有 token 映射，使用 token；否则跳过
      let fileToken: string | null = null;
      if (imgType === 'TOKEN') {
        fileToken = imgValue;
      } else if (imageTokens && imageTokens[imgIndex]) {
        fileToken = imageTokens[imgIndex];
      }
      
      if (fileToken) {
        blocks.push(createImageBlock(fileToken));
        logger.debug(`添加图片块: index=${imgIndex}, token=${fileToken}`);
      } else {
        // 没有 token，添加占位文字
        blocks.push(createTextBlock(`[图片 ${imgIndex + 1}]`));
      }
      continue;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      blocks.push(createHeadingBlock(text, level));
      continue;
    }

    // 分割线
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ block_type: 22, divider: {} });
      continue;
    }

    // 无序列表
    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      const text = trimmed.replace(/^[-*+]\s+/, '');
      blocks.push(createBulletBlock(text));
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const text = trimmed.replace(/^\d+\.\s+/, '');
      blocks.push(createOrderedBlock(text));
      continue;
    }

    // 引用（跳过空引用）
    if (trimmed.startsWith('>')) {
      flushParagraph();
      const text = trimmed.replace(/^>\s*/, '').trim();
      if (text) {
        blocks.push(createQuoteBlock(text));
      }
      continue;
    }

    // 代码块标记
    if (trimmed.startsWith('```')) {
      flushParagraph();
      // 简化处理：跳过代码块
      continue;
    }

    // 普通文本
    currentParagraph.push(line);
  }

  flushParagraph();
  return blocks;
}

/**
 * 创建文本块
 */
function createTextBlock(text: string): any {
  // 确保内容不为空（飞书 API 不接受空内容）
  const content = text.trim() || ' ';
  return {
    block_type: 2, // text
    text: {
      elements: [
        {
          text_run: {
            content,
          },
        },
      ],
    },
  };
}

/**
 * 创建标题块
 */
function createHeadingBlock(text: string, level: number): any {
  // 飞书支持 heading1-heading9
  const blockType = level <= 9 ? level + 2 : 11; // heading1=3, heading9=11

  return {
    block_type: blockType,
    [`heading${Math.min(level, 9)}`]: {
      elements: [
        {
          text_run: {
            content: text,
          },
        },
      ],
    },
  };
}

/**
 * 创建无序列表块
 */
function createBulletBlock(text: string): any {
  return {
    block_type: 12, // bullet
    bullet: {
      elements: [
        {
          text_run: {
            content: text,
          },
        },
      ],
    },
  };
}

/**
 * 创建有序列表块
 */
function createOrderedBlock(text: string): any {
  return {
    block_type: 13, // ordered
    ordered: {
      elements: [
        {
          text_run: {
            content: text,
          },
        },
      ],
    },
  };
}

/**
 * 创建引用块（改用带背景色的文本块，避免 quote 格式兼容问题）
 */
function createQuoteBlock(text: string): any {
  // 确保内容不为空
  const content = text.trim() || ' ';
  return {
    block_type: 2, // text
    text: {
      style: {
        background_color: 15, // 浅蓝色背景表示引用
      },
      elements: [
        {
          text_run: {
            content: `> ${content}`,
          },
        },
      ],
    },
  };
}

/**
 * 创建图片块
 */
function createImageBlock(fileToken: string): any {
  return {
    block_type: 27, // image
    image: {
      token: fileToken,
      width: 800,  // 默认宽度
      height: 600, // 默认高度（飞书会自动调整比例）
    },
  };
}
