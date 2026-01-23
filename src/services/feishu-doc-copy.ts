/**
 * 飞书文档复制服务
 * 用于读取已存在的飞书文档内容，创建副本到知识库
 */

import { larkClient } from './lark-client';
import { logger } from '../utils/logger';
import { extractAuthor, extractPublishTime } from './jina-reader';
import config from '../config';

/**
 * 获取文档元信息
 */
interface GetDocMetaResponse {
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
 * 文档块响应
 */
interface GetDocBlocksResponse {
  code: number;
  msg: string;
  data?: {
    items: DocBlock[];
    page_token?: string;
    has_more?: boolean;
  };
}

/**
 * 文档块
 */
interface DocBlock {
  block_id: string;
  block_type: number;
  parent_id: string;
  children?: string[];
  page?: { elements: TextElement[] };
  text?: { elements: TextElement[] };
  heading1?: { elements: TextElement[] };
  heading2?: { elements: TextElement[] };
  heading3?: { elements: TextElement[] };
  heading4?: { elements: TextElement[] };
  heading5?: { elements: TextElement[] };
  heading6?: { elements: TextElement[] };
  heading7?: { elements: TextElement[] };
  heading8?: { elements: TextElement[] };
  heading9?: { elements: TextElement[] };
  bullet?: { elements: TextElement[] };
  ordered?: { elements: TextElement[] };
  code?: { elements: TextElement[]; language?: number };
  quote?: { elements: TextElement[] };
  divider?: Record<string, never>;
  image?: { token: string; width?: number; height?: number };
}

interface TextElement {
  text_run?: {
    content: string;
    text_element_style?: {
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      underline?: boolean;
      inline_code?: boolean;
      link?: { url: string };
    };
  };
  mention_doc?: {
    token: string;
    title: string;
  };
}

/**
 * 获取飞书文档的元信息
 */
export async function getDocumentMeta(docToken: string): Promise<{
  title: string;
  documentId: string;
}> {
  try {
    const response = await larkClient.get<GetDocMetaResponse>(
      `/docx/v1/documents/${docToken}`
    );

    if (response.code !== 0) {
      throw new Error(`获取文档信息失败: ${response.msg}`);
    }

    return {
      title: response.data?.document?.title || '未命名文档',
      documentId: response.data?.document?.document_id || docToken,
    };
  } catch (error) {
    logger.error('获取文档元信息失败', error);
    throw error;
  }
}

/**
 * 获取文档的所有内容块
 */
export async function getDocumentBlocks(docToken: string): Promise<DocBlock[]> {
  const allBlocks: DocBlock[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const params: Record<string, any> = {
        document_revision_id: -1, // 获取最新版本
        page_size: 500,
      };
      if (pageToken) {
        params.page_token = pageToken;
      }

      const response = await larkClient.get<GetDocBlocksResponse>(
        `/docx/v1/documents/${docToken}/blocks`,
        params
      );

      if (response.code !== 0) {
        throw new Error(`获取文档内容失败: ${response.msg}`);
      }

      if (response.data?.items) {
        allBlocks.push(...response.data.items);
      }

      pageToken = response.data?.page_token;
    } while (pageToken);

    logger.info(`获取到 ${allBlocks.length} 个文档块`);
    return allBlocks;
  } catch (error) {
    logger.error('获取文档块失败', error);
    throw error;
  }
}

/**
 * 将文档块转换为 Markdown 文本
 */
export function blocksToMarkdown(blocks: DocBlock[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const content = extractBlockContent(block);
    if (content) {
      lines.push(content);
    }
  }

  return lines.join('\n\n');
}

/**
 * 提取块内容为 Markdown
 */
function extractBlockContent(block: DocBlock): string {
  const blockType = block.block_type;

  // Block types: 1=page, 2=text, 3=heading1, ..., 11=heading9, 12=bullet, 13=ordered,
  // 14=code, 15=quote, 22=divider, 27=image

  let elements: TextElement[] | undefined;
  let prefix = '';

  switch (blockType) {
    case 1: // page (root)
      return '';
    case 2: // text
      elements = block.text?.elements;
      break;
    case 3: // heading1
      elements = block.heading1?.elements;
      prefix = '# ';
      break;
    case 4: // heading2
      elements = block.heading2?.elements;
      prefix = '## ';
      break;
    case 5: // heading3
      elements = block.heading3?.elements;
      prefix = '### ';
      break;
    case 6: // heading4
      elements = block.heading4?.elements;
      prefix = '#### ';
      break;
    case 7: // heading5
      elements = block.heading5?.elements;
      prefix = '##### ';
      break;
    case 8: // heading6
      elements = block.heading6?.elements;
      prefix = '###### ';
      break;
    case 9: // heading7
    case 10: // heading8
    case 11: // heading9
      elements = block.heading7?.elements || block.heading8?.elements || block.heading9?.elements;
      prefix = '###### ';
      break;
    case 12: // bullet
      elements = block.bullet?.elements;
      prefix = '- ';
      break;
    case 13: // ordered
      elements = block.ordered?.elements;
      prefix = '1. ';
      break;
    case 14: // code
      elements = block.code?.elements;
      const lang = getLanguageName(block.code?.language);
      const codeContent = elementsToText(elements || []);
      return '```' + lang + '\n' + codeContent + '\n```';
    case 15: // quote
      elements = block.quote?.elements;
      prefix = '> ';
      break;
    case 22: // divider
      return '---';
    case 27: // image
      if (block.image?.token) {
        return `![image](${block.image.token})`;
      }
      return '';
    default:
      return '';
  }

  if (!elements || elements.length === 0) {
    return '';
  }

  return prefix + elementsToMarkdown(elements);
}

/**
 * 将文本元素转换为 Markdown
 */
function elementsToMarkdown(elements: TextElement[]): string {
  return elements
    .map((el) => {
      if (el.text_run) {
        let text = el.text_run.content || '';
        const style = el.text_run.text_element_style;

        if (style) {
          if (style.bold) text = `**${text}**`;
          if (style.italic) text = `*${text}*`;
          if (style.strikethrough) text = `~~${text}~~`;
          if (style.inline_code) text = `\`${text}\``;
          if (style.link?.url) {
            // 解码 URL
            try {
              const decodedUrl = decodeURIComponent(style.link.url);
              text = `[${text}](${decodedUrl})`;
            } catch {
              text = `[${text}](${style.link.url})`;
            }
          }
        }

        return text;
      }

      if (el.mention_doc) {
        return `[${el.mention_doc.title}](https://feishu.cn/docx/${el.mention_doc.token})`;
      }

      return '';
    })
    .join('');
}

/**
 * 将文本元素转换为纯文本
 */
function elementsToText(elements: TextElement[]): string {
  return elements
    .map((el) => el.text_run?.content || '')
    .join('');
}

/**
 * 获取代码块语言名称
 */
function getLanguageName(langCode?: number): string {
  const langMap: Record<number, string> = {
    1: 'plaintext',
    2: 'abap',
    3: 'ada',
    4: 'apache',
    5: 'apex',
    6: 'assembly',
    7: 'bash',
    8: 'csharp',
    9: 'cpp',
    10: 'c',
    11: 'cobol',
    12: 'css',
    13: 'coffeescript',
    14: 'd',
    15: 'dart',
    16: 'delphi',
    17: 'django',
    18: 'dockerfile',
    19: 'erlang',
    20: 'fortran',
    21: 'foxpro',
    22: 'go',
    23: 'groovy',
    24: 'html',
    25: 'htmlbars',
    26: 'http',
    27: 'haskell',
    28: 'json',
    29: 'java',
    30: 'javascript',
    31: 'julia',
    32: 'kotlin',
    33: 'latex',
    34: 'lisp',
    35: 'logo',
    36: 'lua',
    37: 'matlab',
    38: 'makefile',
    39: 'markdown',
    40: 'nginx',
    41: 'objectivec',
    42: 'php',
    43: 'pascal',
    44: 'perl',
    45: 'powershell',
    46: 'prolog',
    47: 'protobuf',
    48: 'python',
    49: 'r',
    50: 'ruby',
    51: 'rust',
    52: 'sas',
    53: 'scss',
    54: 'sql',
    55: 'scala',
    56: 'scheme',
    57: 'scratch',
    58: 'shell',
    59: 'swift',
    60: 'thrift',
    61: 'typescript',
    62: 'vbnet',
    63: 'vbscript',
    64: 'visual-basic',
    65: 'verilog',
    66: 'vhdl',
    67: 'xml',
    68: 'yaml',
  };

  return langMap[langCode || 0] || '';
}

/**
 * 复制飞书文档内容
 * 读取源文档内容，返回标题、Markdown 内容和提取的元数据
 */
export async function copyDocumentContent(
  sourceDocToken: string
): Promise<{
  title: string;
  markdown: string;
  sourceUrl: string;
  author: string;
  publishTime: string | null;
}> {
  logger.info(`读取飞书文档内容: ${sourceDocToken}`);

  try {
    // 1. 获取文档元信息
    const meta = await getDocumentMeta(sourceDocToken);
    logger.info(`文档标题: ${meta.title}`);

    // 2. 获取文档所有块
    const blocks = await getDocumentBlocks(sourceDocToken);

    // 3. 转换为 Markdown
    const markdown = blocksToMarkdown(blocks);
    logger.debug(`转换后的 Markdown 长度: ${markdown.length}`);

    // 4. 从内容中提取作者和发布时间
    const author = extractAuthor(markdown);
    const publishTime = extractPublishTime(markdown);
    
    logger.info(`提取的元数据: 作者="${author}", 发布时间="${publishTime}"`);

    const sourceUrl = `https://feishu.cn/docx/${sourceDocToken}`;

    return {
      title: meta.title,
      markdown,
      sourceUrl,
      author,
      publishTime,
    };
  } catch (error) {
    logger.error('读取飞书文档内容失败', error);
    throw error;
  }
}

/**
 * 从知识库节点获取文档 token
 */
export async function getDocTokenFromWikiNode(wikiToken: string): Promise<{
  documentId: string;
  title: string;
}> {
  try {
    const response = await larkClient.get(
      '/wiki/v2/spaces/get_node',
      { token: wikiToken }
    );

    if (response.code !== 0) {
      throw new Error(`获取知识库节点失败: ${response.msg}`);
    }

    const node = response.data?.node;
    if (!node) {
      throw new Error('知识库节点不存在');
    }

    return {
      documentId: node.obj_token || '',
      title: node.title || '未命名文档',
    };
  } catch (error) {
    logger.error('获取知识库节点文档失败', error);
    throw error;
  }
}
