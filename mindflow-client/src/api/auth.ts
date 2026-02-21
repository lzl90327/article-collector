import Taro from '@tarojs/taro';
import { post, put } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    nickname?: string;
    avatar?: string;
  };
}

export interface UserProfile {
  nickname?: string;
  avatar?: string;
}

// 微信登录
export const login = async (code: string): Promise<LoginResponse> => {
  const res = await post<LoginResponse>(API_ENDPOINTS.auth.login, { code });
  // 保存 token
  await Taro.setStorage({ key: 'token', data: res.token });
  // 保存用户信息
  await Taro.setStorage({ key: 'user', data: res.user });
  return res;
};

// 更新用户信息
export const updateProfile = async (profile: UserProfile): Promise<UserProfile> => {
  return put<UserProfile>(API_ENDPOINTS.auth.profile, profile);
};

// 获取本地存储的用户信息
export const getStoredUser = async () => {
  try {
    const res = await Taro.getStorage({ key: 'user' });
    return res.data;
  } catch {
    return null;
  }
};

// 检查是否已登录
export const isLoggedIn = async (): Promise<boolean> => {
  try {
    const token = await Taro.getStorage({ key: 'token' });
    return !!token.data;
  } catch {
    return false;
  }
};

// 退出登录
export const logout = async (): Promise<void> => {
  await Taro.removeStorage({ key: 'token' });
  await Taro.removeStorage({ key: 'user' });
};
