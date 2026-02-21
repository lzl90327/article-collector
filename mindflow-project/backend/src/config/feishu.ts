export const feishuConfig = {
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
  
  // 多维表格 - 素材库总表
  bitable: {
    // 素材库总表 (所有素材都在这里有一条记录)
    sources: {
      appToken: process.env.FEISHU_SOURCES_BITABLE_TOKEN || '',
      tableId: process.env.FEISHU_SOURCES_TABLE_ID || '',
    },
    // 其他库
    viewpointsToken: process.env.FEISHU_VIEWPOINTS_BITABLE_TOKEN || '',
    ideasToken: process.env.FEISHU_IDEAS_BITABLE_TOKEN || '',
  },
  
  // 知识库 - 按类型分库存储素材内容
  wiki: {
    // 文章素材库: https://my.feishu.cn/wiki/E8jHwM9kIip9lnkyLWRcNxGjndb
    article: {
      spaceId: process.env.FEISHU_ARTICLE_WIKI_SPACE_ID || '',
      name: '文章素材库',
    },
    // 视频素材库: https://my.feishu.cn/wiki/NHnMwAwdEiQs3CkQtrEcc7aVnNd
    video: {
      spaceId: process.env.FEISHU_VIDEO_WIKI_SPACE_ID || '',
      name: '视频素材库',
    },
    // 音频素材库: https://my.feishu.cn/wiki/WaqSwTGFsiYucYkeDfYcR3zEnpq
    audio: {
      spaceId: process.env.FEISHU_AUDIO_WIKI_SPACE_ID || '',
      name: '音频素材库',
    },
    // 图文素材库: https://my.feishu.cn/wiki/PnIFwaInriDX9mkC2yFcUNS5npe
    image: {
      spaceId: process.env.FEISHU_IMAGE_WIKI_SPACE_ID || '',
      name: '图文素材库',
    },
    // AI 对话库: https://my.feishu.cn/wiki/WEPMwJe6ai2bVNkQBQ7cpvojn2d
    dialogue: {
      spaceId: process.env.FEISHU_DIALOGUE_WIKI_SPACE_ID || '',
      name: 'AI 对话库',
    },
    // 周报库: https://my.feishu.cn/wiki/G8rrw6U63ihrB4kcb5gcsrALnWb
    weekly: {
      spaceId: process.env.FEISHU_WEEKLY_WIKI_SPACE_ID || '',
      name: '周报库',
    },
    // 发表文章库: https://my.feishu.cn/wiki/QKngwsFAdiiiBrkcXUdc0hcqnDf
    articleLibrary: {
      spaceId: process.env.FEISHU_ARTICLE_LIBRARY_SPACE_ID || '',
      name: '发表文章库',
    }
  }
};

export interface FeishuTableRecord {
  record_id: string;
  fields: Record<string, any>;
  created_time?: string;
  updated_time?: string;
}

// 素材类型映射 - 对应知识库
export const SOURCE_TYPE_MAPPING = {
  'article': { 
    name: '文章', 
    wikiConfig: feishuConfig.wiki.article,
    bitableField: '文章素材库',
  },
  'video': { 
    name: '视频', 
    wikiConfig: feishuConfig.wiki.video,
    bitableField: '视频素材库',
  },
  'audio': { 
    name: '音频', 
    wikiConfig: feishuConfig.wiki.audio,
    bitableField: '音频素材库',
  },
  'image': { 
    name: '图文', 
    wikiConfig: feishuConfig.wiki.image,
    bitableField: '图文素材库',
  },
  'book': { 
    name: '图书', 
    wikiConfig: feishuConfig.wiki.article, // 图书也放入文章库
    bitableField: '图书',
  },
  'paper': { 
    name: '论文', 
    wikiConfig: feishuConfig.wiki.article, // 论文也放入文章库
    bitableField: '论文',
  },
} as const;

export type SourceType = keyof typeof SOURCE_TYPE_MAPPING;
