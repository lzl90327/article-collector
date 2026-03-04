import { get, post } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface Source {
  id: string;
  title: string;
  url: string;
  type: 'article' | 'video' | 'audio' | 'image';
  tags: string[];
  summary?: string;
  viewpoints?: string; // JSON 字符串，核心观点数组
  content?: string; // 完整内容
  images?: string; // JSON 字符串，图片信息数组 [{token, url, expiresAt}]
  feishuWikiToken?: string; // 飞书文档 token
  aiStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface SourceListResponse {
  items: Source[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateSourceRequest {
  title: string;
  url: string;
  type: string;
  tags?: string[];
  summary?: string;
}

// 获取素材列表
export const listSources = async (params?: {
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<SourceListResponse> => {
  return get<SourceListResponse>(API_ENDPOINTS.sources.list, params);
};

// 获取素材详情
export const getSourceDetail = async (id: string): Promise<Source> => {
  return get<Source>(API_ENDPOINTS.sources.detail(id));
};

// 创建素材
export const createSource = async (data: CreateSourceRequest): Promise<Source> => {
  return post<Source>(API_ENDPOINTS.sources.create, data);
};

// 手动同步素材
export const syncSources = async (): Promise<{
  success: boolean;
  count: number;
  items: Source[];
  message?: string;
  error?: string;
}> => {
  return post(API_ENDPOINTS.sources.sync);
};
