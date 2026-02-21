export const feishuConfig = {
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
  // 多维表格
  bitable: {
    sourcesToken: process.env.FEISHU_SOURCES_BITABLE_TOKEN || '',
    viewpointsToken: process.env.FEISHU_VIEWPOINTS_BITABLE_TOKEN || '',
    ideasToken: process.env.FEISHU_IDEAS_BITABLE_TOKEN || '',
  },
  // 知识库
  wiki: {
    articleSpaceId: process.env.FEISHU_ARTICLE_WIKI_SPACE_ID || '',
    dialogueSpaceId: process.env.FEISHU_DIALOGUE_WIKI_SPACE_ID || '',
    weeklySpaceId: process.env.FEISHU_WEEKLY_WIKI_SPACE_ID || '',
  }
};

export interface FeishuTableRecord {
  record_id: string;
  fields: Record<string, any>;
  created_time?: string;
  updated_time?: string;
}
