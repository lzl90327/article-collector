/**
 * 文章相关类型定义
 */

/**
 * 文章元信息（旧版兼容）
 */
export interface ArticleMeta {
  /** 文章标题 */
  title: string;
  /** 作者 */
  author: string;
  /** 发布时间 */
  publishTime: string | null;
  /** 来源（如：微信公众号名称） */
  source: string;
  /** 原文链接 */
  originalUrl: string;
  /** 文章摘要 */
  summary: string;
}

/**
 * 文章元信息类型定义（新版）
 */
export interface ArticleMetadata {
  /** 文章标题 */
  title: string;
  /** 文章作者 */
  author: string | null;
  /** 发布时间 */
  publishedAt: Date | null;
  /** 来源平台 */
  source: string;
  /** 原文链接 */
  originalUrl: string;
  /** 文章摘要 */
  summary: string | null;
  /** 文章描述 */
  description: string | null;
}

/**
 * 抓取的文章内容
 */
export interface ArticleContent {
  /** 文章元信息 */
  metadata: ArticleMetadata;
  /** Markdown 格式的正文内容 */
  markdown: string;
  /** 纯文本内容 */
  text: string | null;
  /** 文章中的图片 URL 列表 */
  images: string[];
}

/**
 * 抓取结果（旧版兼容）
 */
export interface FetchResult {
  /** 元信息 */
  meta: ArticleMeta;
  /** Markdown 格式的正文内容 */
  content: string;
  /** 原始 HTML（可选） */
  rawHtml?: string;
}

/**
 * Jina Reader API 响应格式
 */
export interface JinaReaderResponse {
  /** 响应状态码 */
  code: number;
  /** 响应状态 */
  status: number;
  /** 响应数据 */
  data: {
    /** 文章标题 */
    title: string;
    /** 文章描述 */
    description: string;
    /** 原文 URL */
    url: string;
    /** Markdown 内容 */
    content: string;
    /** 发布日期 */
    publishedTime?: string;
    /** 作者 */
    author?: string;
    /** 站点名称 */
    siteName?: string;
    /** 文章图片 */
    images?: {
      src: string;
      alt?: string;
    }[];
  };
}

/**
 * 多维表格记录字段
 */
export interface BitableRecord {
  /** 标题 */
  title: string;
  /** 作者 */
  author: string;
  /** 发布时间 */
  publishedAt: number | null;
  /** 来源 */
  source: string;
  /** 原文链接 */
  originalUrl: string;
  /** 摘要 */
  summary: string;
  /** 文档链接 */
  docUrl: string;
  /** 收藏时间 */
  collectedAt: number;
}

/**
 * 保存结果（旧版兼容）
 */
export interface SaveResult {
  /** 是否成功 */
  success: boolean;
  /** 飞书云文档 URL */
  docUrl?: string;
  /** 知识库节点 URL */
  wikiUrl?: string;
  /** 多维表格记录 ID */
  recordId?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 文章处理结果
 */
export interface ArticleProcessResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 文章内容 */
  article?: ArticleContent;
  /** 创建的云文档 URL */
  docUrl?: string;
  /** 知识库节点 URL */
  wikiUrl?: string;
  /** 多维表格记录 ID */
  recordId?: string;
}

/**
 * 处理状态
 */
export type ProcessStatus = 
  | 'pending'      // 等待处理
  | 'fetching'     // 正在抓取
  | 'creating_doc' // 正在创建文档
  | 'adding_wiki'  // 正在添加到知识库
  | 'recording'    // 正在记录到表格
  | 'completed'    // 完成
  | 'failed';      // 失败
