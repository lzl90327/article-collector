import { get, post } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface Idea {
  id: string;
  content: string;
  type: 'text' | 'voice';
  audioUrl?: string;
  synced: boolean;
  createdAt: string;
}

export interface IdeaListResponse {
  items: Idea[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateIdeaRequest {
  content: string;
  type: 'text' | 'voice';
  audioUrl?: string;
}

export const listIdeas = async (params?: {
  page?: number;
  pageSize?: number;
}): Promise<IdeaListResponse> => {
  return get<IdeaListResponse>(API_ENDPOINTS.ideas.list, params);
};

export const createIdea = async (data: CreateIdeaRequest): Promise<Idea> => {
  return post<Idea>(API_ENDPOINTS.ideas.create, data);
};
