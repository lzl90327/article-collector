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
      // Token 过期，清除并跳转登录
      await Taro.removeStorage({ key: 'token' });
      Taro.navigateTo({ url: '/pages/login/index' });
      throw new Error('登录已过期');
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
  const queryString = params 
    ? '?' + Object.entries(params)
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
