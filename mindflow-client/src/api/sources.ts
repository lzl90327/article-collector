import { get, post } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface Source {
  id: string;
  title: string;
  url: string;
  type: 'article' | 'video' | 'audio' | 'image';
  tags: string[];
  summary?: string;
  createdAt: string;
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
export const syncSources = async (): Promise<{ count: number; error?: string }> => {
  return post(API_ENDPOINTS.sources.sync);
};
