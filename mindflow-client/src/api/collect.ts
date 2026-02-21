/**
 * 素材收集 API
 * 调用后端飞书收集接口
 */

import { post, get } from './interceptors';

export interface CollectRequest {
  url: string;
  sourceType?: 'article' | 'video' | 'audio' | 'image';
}

export interface CollectResponse {
  taskId: string;
  status: 'success' | 'processing' | 'failed';
  feishuDocUrl?: string;
  bitableRecordId?: string;
  message?: string;
}

/**
 * 提交素材收集任务
 */
export const collectSource = async (data: CollectRequest): Promise<CollectResponse> => {
  return post<CollectResponse>('/collect', data);
};

/**
 * 查询收集任务状态
 */
export const getCollectStatus = async (taskId: string): Promise<CollectResponse> => {
  return get<CollectResponse>(`/collect/${taskId}`);
};
