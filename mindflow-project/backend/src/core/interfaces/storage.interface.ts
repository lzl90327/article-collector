/**
 * 存储接口定义
 * 抽象所有存储操作，实现平台无关性
 */
import { Article, QuickAnalysis, DocumentInfo } from '../events/article.events';

/**
 * 文章存储接口
 */
export interface IArticleStorage {
  /**
   * 检查文章是否已存在
   * @param url 文章 URL
   * @returns 如果存在则返回文档信息，否则返回 null
   */
  checkArticleExists(url: string): Promise<DocumentInfo | null>;

  /**
   * 创建文档并存储文章
   * @param article 文章数据
   * @param quickAnalysis 快速分析结果
   * @param userId 用户 ID
   * @returns 文档信息
   */
  createDocument(
    article: Article,
    quickAnalysis: QuickAnalysis,
    userId: string
  ): Promise<DocumentInfo>;

  /**
   * 创建 Bitable 记录
   * @param article 文章数据
   * @param quickAnalysis 快速分析结果
   * @param documentInfo 文档信息
   * @returns 记录 ID
   */
  createBitableRecord(
    article: Article,
    quickAnalysis: QuickAnalysis,
    documentInfo: DocumentInfo
  ): Promise<string>;
}
