// API 基础配置
// 微信开发者工具中使用 localhost
// 注意：需要在开发者工具中开启"不校验合法域名"选项
export const API_BASE_URL = 'http://localhost:3000/api';

export const API_ENDPOINTS = {
  // 认证
  auth: {
    login: '/auth/login',
    profile: '/auth/profile',
  },
  // 素材
  sources: {
    list: '/sources',
    detail: (id: string) => `/sources/${id}`,
    create: '/sources',
    sync: '/sources/sync',
  },
  // 文章
  articles: {
    list: '/articles',
    detail: (id: string) => `/articles/${id}`,
    save: '/articles/save',
    sync: (id: string) => `/articles/${id}/sync-feishu`,
  },
  // 想法
  ideas: {
    list: '/ideas',
    create: '/ideas',
  },
  // 观点
  viewpoints: {
    list: '/viewpoints',
    sync: '/viewpoints/sync',
  },
  // 同步状态
  sync: {
    status: '/sync/status',
  },
  // Skill 配置
  skill: {
    config: '/skill/config',
    versions: '/skill/versions',
    compare: '/skill/compare',
  },
  // 审阅
  review: {
    submit: '/review/submit',
    report: (articleId: string) => `/review/report/${articleId}`,
    status: (reviewId: string) => `/review/status/${reviewId}`,
    apply: '/review/apply',
  },
};
