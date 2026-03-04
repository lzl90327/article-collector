import Taro from '@tarojs/taro';
import { API_BASE_URL } from './config';

// 获取存储的 token
const getToken = async (): Promise<string | null> => {
  try {
    const res = await Taro.getStorage({ key: 'token' });
    return res.data;
  } catch {
    return null;
  }
};

// 请求拦截
export const request = async <T>(
  url: string,
  options: Taro.request.Option = {}
): Promise<T> => {
  const token = await getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.header,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await Taro.request({
      url: `${API_BASE_URL}${url}`,
      method: options.method || 'GET',
      data: options.data,
      header: headers,
      timeout: 30000,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data as T;
    } else if (res.statusCode === 401) {
      // 暂时禁用跳转登录，方便功能测试
      // TODO: 功能测试完成后恢复
      console.warn('收到 401 响应，但暂时不跳转登录页（测试模式）');
      throw new Error('登录已过期（测试模式：已禁用跳转）');
    } else {
      throw new Error((res.data as any)?.error || '请求失败');
    }
  } catch (error) {
    console.error('API 请求失败:', error);
    throw error;
  }
};

// GET 请求封装
export const get = <T>(url: string, params?: Record<string, any>) => {
  // 过滤掉 undefined 和空字符串的参数
  const filteredParams = params 
    ? Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
    : [];
  
  const queryString = filteredParams.length > 0
    ? '?' + filteredParams
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  return request<T>(`${url}${queryString}`, { method: 'GET' });
};

// POST 请求封装
export const post = <T>(url: string, data?: any) => {
  return request<T>(url, { method: 'POST', data });
};

// PUT 请求封装
export const put = <T>(url: string, data?: any) => {
  return request<T>(url, { method: 'PUT', data });
};

// DELETE 请求封装
export const del = <T>(url: string) => {
  return request<T>(url, { method: 'DELETE' });
};
