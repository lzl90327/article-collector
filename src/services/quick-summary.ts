import { qwenService } from './qwen-service';

/**
 * 快速摘要服务
 * 复用 QwenService 的能力，提供给 ArticleService 使用
 */
export const quickSummaryService = {
  generateQuickSummary: (title: string, content: string) => qwenService.generateSummary(title, content),
  generateTags: (title: string, content: string) => qwenService.generateTags(title, content),
  generateCategory: (title: string, content: string) => qwenService.generateCategory(title, content),
};
