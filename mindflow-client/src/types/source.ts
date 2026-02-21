/**
 * Source 类型定义
 * 素材管理相关类型
 */

/** 素材类型 */
export type SourceType = 'article' | 'note' | 'link';

/** 素材 */
export interface Source {
  id: string;
  type: SourceType;
  title: string;
  content?: string;
  summary?: string;
  url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

/** 创建素材请求 */
export interface CreateSourceRequest {
  type: SourceType;
  title: string;
  content?: string;
  summary?: string;
  url?: string;
  tags?: string[];
}

/** 创建素材响应 */
export interface CreateSourceResponse {
  success: boolean;
  data: {
    source: Source;
  };
}

/** 获取素材列表请求参数 */
export interface ListSourcesParams {
  type?: SourceType;
  limit?: number;
  offset?: number;
}

/** 获取素材列表响应 */
export interface ListSourcesResponse {
  success: boolean;
  data: {
    sources: Source[];
    total: number;
  };
}

/** 删除素材响应 */
export interface DeleteSourceResponse {
  success: boolean;
  data: {
    success: boolean;
  };
}
