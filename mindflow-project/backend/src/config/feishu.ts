export const feishuConfig = {
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
  // 多维表格 - 按类型分库
  bitable: {
    // 素材库 - 按类型分表
    sources: {
      article: {
        appToken: process.env.FEISHU_ARTICLE_SOURCES_TOKEN || '',
        tableId: process.env.FEISHU_ARTICLE_SOURCES_TABLE_ID || '',
      },
      video: {
        appToken: process.env.FEISHU_VIDEO_SOURCES_TOKEN || '',
        tableId: process.env.FEISHU_VIDEO_SOURCES_TABLE_ID || '',
      },
      audio: {
        appToken: process.env.FEISHU_AUDIO_SOURCES_TOKEN || '',
        tableId: process.env.FEISHU_AUDIO_SOURCES_TABLE_ID || '',
      },
      image: {
        appToken: process.env.FEISHU_IMAGE_SOURCES_TOKEN || '',
        tableId: process.env.FEISHU_IMAGE_SOURCES_TABLE_ID || '',
      },
      book: {
        appToken: process.env.FEISHU_BOOK_SOURCES_TOKEN || '',
        tableId: process.env.FEISHU_BOOK_SOURCES_TABLE_ID || '',
      },
      paper: {
        appToken: process.env.FEISHU_PAPER_SOURCES_TOKEN || '',
        tableId: process.env.FEISHU_PAPER_SOURCES_TABLE_ID || '',
      },
    },
    // 其他库
    viewpointsToken: process.env.FEISHU_VIEWPOINTS_BITABLE_TOKEN || '',
    ideasToken: process.env.FEISHU_IDEAS_BITABLE_TOKEN || '',
  },
  // 知识库
  wiki: {
    articleSpaceId: process.env.FEISHU_ARTICLE_WIKI_SPACE_ID || '',
    dialogueSpaceId: process.env.FEISHU_DIALOGUE_WIKI_SPACE_ID || '',
    weeklySpaceId: process.env.FEISHU_WEEKLY_WIKI_SPACE_ID || '',
    // 文章库 - 用于发布同步
    articleLibrary: {
      spaceId: process.env.FEISHU_ARTICLE_LIBRARY_SPACE_ID || '',
      folderToken: process.env.FEISHU_ARTICLE_LIBRARY_FOLDER_TOKEN || '',
    }
  }
};

export interface FeishuTableRecord {
  record_id: string;
  fields: Record<string, any>;
  created_time?: string;
  updated_time?: string;
}

// 素材类型映射
export const SOURCE_TYPE_MAPPING = {
  'article': { name: '文章', config: feishuConfig.bitable.sources.article },
  'video': { name: '视频', config: feishuConfig.bitable.sources.video },
  'audio': { name: '音频', config: feishuConfig.bitable.sources.audio },
  'image': { name: '图片', config: feishuConfig.bitable.sources.image },
  'book': { name: '图书', config: feishuConfig.bitable.sources.book },
  'paper': { name: '论文', config: feishuConfig.bitable.sources.paper },
} as const;

export type SourceType = keyof typeof SOURCE_TYPE_MAPPING;
