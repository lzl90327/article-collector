import { get, post } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface Article {
  id: string;
  title: string;
  content?: string;
  status: 'draft' | 'published';
  phase?: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleListResponse {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SaveArticleRequest {
  id?: string;
  title: string;
  content: string;
  status?: 'draft' | 'published';
  phase?: string;
}

export interface SaveArticleResponse {
  id: string;
  title: string;
  content: string;
  status: string;
  updatedAt: string;
}

// 获取文章列表
export const listArticles = async (params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ArticleListResponse> => {
  return get<ArticleListResponse>(API_ENDPOINTS.articles.list, params);
};

// 获取文章详情
export const getArticleDetail = async (id: string): Promise<Article> => {
  return get<Article>(API_ENDPOINTS.articles.detail(id));
};

// 保存文章（创建或更新）
export const saveArticle = async (data: SaveArticleRequest): Promise<SaveArticleResponse> => {
  return post<SaveArticleResponse>(API_ENDPOINTS.articles.save, data);
};

// 同步文章
export const syncArticles = async (): Promise<{ count: number; error?: string }> => {
  return post(API_ENDPOINTS.articles.sync);
};
