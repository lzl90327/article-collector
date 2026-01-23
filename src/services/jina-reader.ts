/**
 * Jina Reader 文章抓取服务
 * 使用 Jina Reader API 抓取网页内容并转换为 Markdown
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { inferSourceFromUrl } from '../utils/url-parser';
import type { FetchResult, ArticleMeta } from '../types/article';
import config from '../config';

const JINA_READER_BASE_URL = 'https://r.jina.ai';

/**
 * 抓取失败的错误类型
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly errorType: 'captcha' | 'forbidden' | 'timeout' | 'network' | 'unknown',
    public readonly url: string,
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/**
 * 检测是否是需要特殊处理的网站
 */
function isRestrictedSite(url: string): { restricted: boolean; siteName: string } {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('mp.weixin.qq.com')) {
    return { restricted: true, siteName: '微信公众号' };
  }
  if (lowerUrl.includes('zhihu.com')) {
    return { restricted: true, siteName: '知乎' };
  }
  if (lowerUrl.includes('weibo.com') || lowerUrl.includes('weibo.cn')) {
    return { restricted: true, siteName: '微博' };
  }
  return { restricted: false, siteName: '' };
}

/**
 * 使用 Jina Reader 抓取文章内容
 */
export async function fetchArticle(url: string): Promise<FetchResult> {
  logger.info(`开始抓取文章: ${url}`);
  
  // 检测是否是受限网站
  const { restricted, siteName } = isRestrictedSite(url);
  if (restricted) {
    logger.warn(`检测到受限网站: ${siteName}，尝试抓取...`);
  }
  
  try {
    const headers: Record<string, string> = {
      'Accept': 'text/markdown',
      'x-respond-with': 'markdown',
    };
    
    // 如果配置了 API Key，添加到请求头
    if (config.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${config.JINA_API_KEY}`;
    }
    
    const response = await axios.get(`${JINA_READER_BASE_URL}/${url}`, {
      headers,
      timeout: 60000, // 60 秒超时
    });
    
    const content = response.data as string;
    
    // 检查是否被防爬机制拦截
    const blockPatterns = [
      { pattern: '环境异常', type: 'captcha' as const },
      { pattern: '完成验证后即可继续访问', type: 'captcha' as const },
      { pattern: 'requiring CAPTCHA', type: 'captcha' as const },
      { pattern: 'error 403: Forbidden', type: 'forbidden' as const },
      { pattern: 'error 401', type: 'forbidden' as const },
      { pattern: '请完成安全验证', type: 'captcha' as const },
      { pattern: '系统检测到您的请求异常', type: 'captcha' as const },
    ];
    
    for (const { pattern, type } of blockPatterns) {
      if (content.includes(pattern)) {
        const suggestion = restricted
          ? `${siteName}有防爬机制，建议使用以下方式：\n1. 复制文章内容直接发送给我\n2. 使用飞书剪存功能保存\n3. 尝试其他来源的文章`
          : '该网站有防爬机制，请尝试复制文章内容直接发送给我';
        
        throw new FetchError(
          `${siteName || '该网站'}需要验证，无法自动抓取`,
          type,
          url,
          suggestion
        );
      }
    }
    
    logger.debug(`抓取完成，内容长度: ${content.length}`);
    
    // 解析元信息（改进的标题提取）
    const meta = parseMetaFromMarkdown(content, url);
    
    return {
      meta,
      content: cleanMarkdownContent(content),
    };
  } catch (error) {
    // 如果已经是 FetchError，直接抛出
    if (error instanceof FetchError) {
      throw error;
    }
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      logger.error(`抓取失败: ${error.message}`, { status, url });
      
      // 超时处理
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        const suggestion = restricted
          ? `${siteName}响应超时，可能被限制访问。建议：\n1. 复制文章内容直接发送给我\n2. 使用飞书剪存功能保存`
          : '请求超时，请稍后重试或尝试其他文章';
        
        throw new FetchError('请求超时', 'timeout', url, suggestion);
      }
      
      // 403 处理
      if (status === 403) {
        throw new FetchError(
          '访问被拒绝',
          'forbidden',
          url,
          restricted ? `${siteName}拒绝访问，建议复制文章内容直接发送给我` : '该网站拒绝访问'
        );
      }
      
      throw new FetchError(
        `文章抓取失败: ${status || error.message}`,
        'network',
        url
      );
    }
    throw error;
  }
}

/**
 * 从 Markdown 内容中解析元信息
 * Jina Reader 返回的格式通常是：
 * Title: 文章标题
 * URL Source: https://...
 * Published Time: ...
 * Markdown Content:
 * ...正文...
 */
function parseMetaFromMarkdown(markdown: string, url: string): ArticleMeta {
  const lines = markdown.split('\n');
  
  // 1. 优先从 Jina 元数据提取标题
  let title = '';
  let jinaPublishTime = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 提取 Title: 字段
    if (trimmed.startsWith('Title:')) {
      const titleValue = trimmed.substring(6).trim();
      // 过滤掉无效的标题
      if (titleValue && 
          !titleValue.includes('error') && 
          !titleValue.includes('Error') &&
          !titleValue.includes('Forbidden') &&
          titleValue.length > 2) {
        title = titleValue;
      }
    }
    
    // 提取 Published Time: 字段
    if (trimmed.startsWith('Published Time:')) {
      jinaPublishTime = trimmed.substring(15).trim();
    }
    
    // 遇到 Markdown Content: 或正文开始，停止解析元数据
    if (trimmed.startsWith('Markdown Content:') || trimmed.startsWith('# ')) {
      break;
    }
  }
  
  // 2. 如果没有从元数据获取到标题，尝试从正文提取
  if (!title) {
    // 查找 Markdown Content: 之后的第一个标题
    let inContent = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Markdown Content:')) {
        inContent = true;
        continue;
      }
      if (inContent && trimmed.startsWith('# ')) {
        title = trimmed.substring(2).trim();
        break;
      }
      // 如果没有 Markdown Content: 标记，直接查找第一个 # 标题
      if (!inContent && trimmed.startsWith('# ')) {
        title = trimmed.substring(2).trim();
        break;
      }
    }
  }
  
  // 3. 最后的兜底：使用正文前 50 个字符
  if (!title) {
    // 移除元数据部分，只保留正文
    const contentStart = markdown.indexOf('Markdown Content:');
    const textPart = contentStart > 0 
      ? markdown.substring(contentStart + 17) 
      : markdown;
    const textContent = textPart
      .replace(/^Title:.*$/gm, '')
      .replace(/^URL Source:.*$/gm, '')
      .replace(/^Published Time:.*$/gm, '')
      .replace(/^Warning:.*$/gm, '')
      .replace(/[#*_`\[\]()]/g, '')
      .trim();
    title = textContent.substring(0, 50) + (textContent.length > 50 ? '...' : '');
  }
  
  // 清理标题
  title = cleanTitle(title);
  
  // 尝试提取作者（常见模式）
  const author = extractAuthor(markdown);
  
  // 尝试提取发布时间（优先使用 Jina 元数据）
  const publishTime = jinaPublishTime 
    ? parseJinaPublishTime(jinaPublishTime) 
    : extractPublishTime(markdown);
  
  // 生成摘要（取正文前 200 个字符）
  const summary = generateSummary(markdown);
  
  // 推断来源
  const source = inferSourceFromUrl(url);
  
  return {
    title,
    author,
    publishTime,
    source,
    originalUrl: url,
    summary,
  };
}

/**
 * 清理标题
 */
function cleanTitle(title: string): string {
  return title
    // 移除常见的网站后缀
    .replace(/\s*[-|–—]\s*(知乎|微信|公众号|简书|掘金|CSDN|博客园|InfoQ|36氪).*$/i, '')
    .replace(/\s*[-|–—]\s*\w+\s*(博客|Blog|网站|官网).*$/i, '')
    // 移除开头的特殊字符
    .replace(/^[\s\-|–—:：]+/, '')
    // 移除结尾的特殊字符
    .replace(/[\s\-|–—:：]+$/, '')
    // 限制长度
    .substring(0, 100)
    .trim();
}

/**
 * 解析 Jina 返回的发布时间格式
 * 格式通常是: "Wed, 17 Sep 2025 05:44:41 GMT"
 */
function parseJinaPublishTime(timeStr: string): string | null {
  if (!timeStr) return null;
  
  try {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // 继续尝试其他格式
  }
  
  // 尝试提取日期部分
  const datePatterns = [
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
    /(\d{1,2}\s+\w+\s+\d{4})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = timeStr.match(pattern);
    if (match) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch {
        continue;
      }
    }
  }
  
  return null;
}

/**
 * 提取作者信息
 */
export function extractAuthor(markdown: string): string {
  // 常见的作者标记模式
  const authorPatterns = [
    /作者[：:]\s*([^\n]+)/i,
    /Author[：:]\s*([^\n]+)/i,
    /by\s+([^\n]+)/i,
    /文\s*[/|／]\s*([^\n]+)/,
  ];
  
  for (const pattern of authorPatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 50); // 限制长度
    }
  }
  
  return '';
}

/**
 * 提取发布时间
 */
export function extractPublishTime(markdown: string): string | null {
  // 常见的日期格式
  const datePatterns = [
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/,
    /(\d{4}\.\d{1,2}\.\d{1,2})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      // 尝试标准化日期格式
      try {
        const dateStr = match[1]
          .replace(/[年月]/g, '-')
          .replace(/[日\.]/g, '')
          .replace(/\//g, '-');
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch {
        return match[1];
      }
    }
  }
  
  return null;
}

/**
 * 生成文章摘要
 */
function generateSummary(markdown: string): string {
  // 移除 Markdown 语法，提取纯文本
  let text = markdown
    // 移除标题
    .replace(/^#+\s+.+$/gm, '')
    // 移除图片
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // 移除链接但保留文字
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]+`/g, '')
    // 移除粗体/斜体标记
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // 移除引用标记
    .replace(/^>\s+/gm, '')
    // 移除水平线
    .replace(/^[-*_]{3,}$/gm, '')
    // 合并多个空行
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // 取前 200 个字符作为摘要
  if (text.length > 200) {
    // 尝试在句子结束处截断
    const truncated = text.substring(0, 200);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？')
    );
    if (lastPeriod > 100) {
      return truncated.substring(0, lastPeriod + 1);
    }
    return truncated + '...';
  }
  
  return text;
}

/**
 * 清理 Markdown 内容
 * 移除可能导致问题的内容
 */
function cleanMarkdownContent(markdown: string): string {
  return markdown
    // 移除可能的 HTML 注释
    .replace(/<!--[\s\S]*?-->/g, '')
    // 移除多余的空行
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ============ 新版 API（类风格，兼容其他服务） ============

import type { ArticleContent, ArticleMetadata } from '../types/article';

/**
 * Jina Reader 服务配置选项
 */
export interface JinaReaderOptions {
  /** Jina API Key（可选，用于增加配额） */
  apiKey?: string;
  /** 请求超时时间（毫秒） */
  timeout?: number;
}

/**
 * Jina Reader 服务类
 */
export class JinaReaderService {
  private apiKey?: string;
  private timeout: number;

  constructor(options: JinaReaderOptions = {}) {
    this.apiKey = options.apiKey || config.JINA_API_KEY;
    this.timeout = options.timeout || 30000;
  }

  /**
   * 抓取文章内容
   * @param url 文章 URL
   * @returns 文章内容（新版格式）
   */
  async fetchArticle(url: string): Promise<ArticleContent> {
    // 调用原有函数获取结果
    const result = await fetchArticle(url);
    
    // 转换为新版格式
    return this.convertToArticleContent(result);
  }

  /**
   * 将旧版结果转换为新版格式
   */
  private convertToArticleContent(result: FetchResult): ArticleContent {
    const metadata: ArticleMetadata = {
      title: result.meta.title,
      author: result.meta.author || null,
      publishedAt: result.meta.publishTime ? new Date(result.meta.publishTime) : null,
      source: result.meta.source,
      originalUrl: result.meta.originalUrl,
      summary: result.meta.summary || null,
      description: null,
    };

    // 提取图片链接
    const images: string[] = [];
    const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = imgRegex.exec(result.content)) !== null) {
      if (match[1] && match[1].startsWith('http')) {
        images.push(match[1]);
      }
    }

    return {
      metadata,
      markdown: result.content,
      text: generateSummary(result.content),
      images,
    };
  }
}

/**
 * 创建 Jina Reader 服务实例
 */
export function createJinaReaderService(options?: JinaReaderOptions): JinaReaderService {
  return new JinaReaderService(options);
}
