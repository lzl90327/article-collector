// 根据环境判断 API 地址
const isDev = process.env.NODE_ENV === 'development';

export const API_BASE_URL = isDev 
  ? 'http://localhost:3002/api' 
  : 'https://your-production-api.com/api';

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
    sync: '/articles/sync',
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
