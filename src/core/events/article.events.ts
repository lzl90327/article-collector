/**
 * 文章处理相关的业务事件定义
 * 定义所有文章处理流程中的事件类型和数据结构
 */

/**
 * 文章事件枚举
 */
export enum ArticleEvent {
  // 处理开始
  PROCESSING_STARTED = 'article:processing_started',

  // 网页抓取完成
  SCRAPING_COMPLETED = 'article:scraping_completed',

  // AI 快速分析完成
  QUICK_ANALYSIS_COMPLETED = 'article:quick_analysis_completed',

  // 文档创建完成
  DOCUMENT_CREATED = 'article:document_created',

  // 记录已存在
  ALREADY_EXISTS = 'article:already_exists',

  // 处理失败
  PROCESSING_FAILED = 'article:processing_failed',
}

/**
 * 文章数据接口
 */
export interface Article {
  originalUrl: string;
  title: string;
  content: string;
  images?: string[];
  metadata?: {
    source?: string;
    author?: string;
    publishDate?: string;
  };
}

/**
 * 快速分析结果接口
 */
export interface QuickAnalysis {
  summary: string;
  tags: string[];
  category: string;
}

/**
 * 文档信息接口
 */
export interface DocumentInfo {
  documentUrl: string;
  wikiNodeToken: string;
  bitableRecordId: string;
}

/**
 * 文章事件数据接口
 */
export interface ArticleEventData {
  // 基础信息
  userId: string;
  messageId: string;

  // 文章数据
  article?: Article;

  // 快速分析结果
  quickAnalysis?: QuickAnalysis;

  // 文档信息
  documentInfo?: DocumentInfo;

  // 错误信息
  error?: {
    message: string;
    code?: string;
    details?: any;
  };

  // 时间戳
  timestamp: Date;
}
