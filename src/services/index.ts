/**
 * 服务模块统一导出
 */

// Jina Reader 文章抓取服务
export { fetchArticle } from './jina-reader';

// 飞书云文档服务
export { createDocument } from './lark-doc';

// 飞书知识库服务
export {
  addDocumentToWiki,
  getWikiNode,
  listWikiNodes,
  moveWikiNode,
} from './lark-wiki';
export type { WikiNode, AddToWikiResult } from './lark-wiki';

// 飞书多维表格服务
export {
  createArticleRecord,
  findRecordByUrl,
  updateArticleRecord,
  getTableFields,
} from './lark-bitable';
export type { ArticleRecord } from './lark-bitable';

// 飞书客户端
export { larkClient } from './lark-client';

// DeepSeek LLM 分类服务
export { classifyMessageIntent } from './deepseek-classifier';
export type { MessageIntent } from './deepseek-classifier';

// 百度语音识别服务
export { transcribeWithBaidu, checkBaiduASRStatus } from './baidu-asr';

// 碎片想法库服务
export {
  createIdeaRecord,
  getTodayIdeas,
  getUnsummarizedIdeas,
  markIdeasAsSummarized,
  determineMaturity,
} from './ideas-bitable';
export type { IdeaRecord, IdeasBitableConfig } from './ideas-bitable';
