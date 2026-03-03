import Taro from '@tarojs/taro';

// API 基础配置
const API_BASE_URL = 'http://127.0.0.1:3001';

// 获取存储的 token
async function getToken(): Promise<string | null> {
  try {
    const res = await Taro.getStorage({ key: 'token' });
    return res.data as string;
  } catch {
    return null;
  }
}

// 处理 401 未授权错误
async function handleUnauthorized() {
  try {
    await Taro.removeStorage({ key: 'token' });
  } catch {}

  Taro.showToast({
    title: '登录已过期，请重新登录',
    icon: 'none',
    duration: 2000
  });

  setTimeout(() => {
    Taro.navigateTo({
      url: '/pages/login/index'
    });
  }, 1500);
}

// 通用请求函数
export async function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: unknown
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${API_BASE_URL}${url}`,
      method,
      data,
      header: headers,
      success: async (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else if (res.statusCode === 401) {
          await handleUnauthorized();
          reject(new Error('登录已过期'));
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        Taro.showToast({
          title: `网络错误: ${err.errMsg || '未知'}`,
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

// ==================== 文章相关 API ====================

export interface Article {
  id: string;
  title: string;
  content?: string;
  status: string;
  phase: string;
  feishuWikiToken?: string;
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

export interface SyncFeishuResponse {
  wikiToken: string;
  url: string;
}

/**
 * 获取文章列表
 */
export function getArticles(page = 1, pageSize = 20, status?: string) {
  let url = `/api/articles?page=${page}&pageSize=${pageSize}`;
  if (status) {
    url += `&status=${status}`;
  }
  return request<ArticleListResponse>(url, 'GET');
}

/**
 * 获取文章详情
 */
export function getArticle(id: string) {
  return request<{ data: Article }>(`/api/articles/${id}`, 'GET');
}

/**
 * 保存文章
 */
export function saveArticle(data: {
  id?: string;
  title: string;
  content: string;
  status?: string;
  phase?: string;
}) {
  return request<{ data: Article }>('/api/articles/save', 'POST', data);
}

/**
 * 同步文章到飞书
 */
export function syncArticleToFeishu(articleId: string) {
  return request<SyncFeishuResponse>(`/api/articles/${articleId}/sync-feishu`, 'POST');
}

// ==================== 素材相关 API ====================

export interface Source {
  id: string;
  title: string;
  url: string;
  type: string;
  feishuDocUrl?: string;
  createdAt: string;
}

/**
 * 获取素材列表
 */
export function getSources(page = 1, pageSize = 20) {
  return request<{ items: Source[]; total: number }>(
    `/api/sources?page=${page}&pageSize=${pageSize}`,
    'GET'
  );
}

/**
 * 同步素材到飞书
 */
export function syncSourceToFeishu(sourceId: string) {
  return request<{ url: string }>(`/api/sources/${sourceId}/sync`, 'POST');
}

// ==================== 同步状态 API ====================

export interface SyncStatus {
  [key: string]: {
    lastSyncAt: string;
    recordCount: number;
    status: string;
    error?: string;
  };
}

/**
 * 获取同步状态
 */
export function getSyncStatus() {
  return request<SyncStatus>('/api/sync/status', 'GET');
}
