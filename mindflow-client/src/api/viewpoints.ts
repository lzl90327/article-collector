import { get, post } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface Viewpoint {
  id: string;
  content: string;
  sourceArticle?: string;
  tags: string[];
  createdAt: string;
}

export interface ViewpointListResponse {
  items: Viewpoint[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const listViewpoints = async (params?: {
  page?: number;
  pageSize?: number;
}): Promise<ViewpointListResponse> => {
  return get<ViewpointListResponse>(API_ENDPOINTS.viewpoints.list, params);
};

export const syncViewpoints = async (): Promise<{ count: number; error?: string }> => {
  return post(API_ENDPOINTS.viewpoints.sync);
};
