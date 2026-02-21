# Phase 2: 小程序页面重构 - 详细实施计划

## 任务概览
- 总任务数: 35
- 预计总时间: 210 分钟 (3.5 小时)
- 检查点: 每 5-7 个任务汇报一次

## 任务组 1: API 客户端封装 (任务 1-5)

### 任务 1: 创建 API 基础配置
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
创建 API 基础配置，包括 baseURL 和请求拦截器

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/config.ts`

#### 代码内容
```typescript
// 根据环境判断 API 地址
const isDev = process.env.NODE_ENV === 'development';

export const API_BASE_URL = isDev 
  ? 'http://localhost:3002/api' 
  : 'https://your-production-api.com/api';

export const API_ENDPOINTS = {
  // 认证
  auth: {
    login: '/auth/login',
    profile: '/auth/profile',
  },
  // 素材
  sources: {
    list: '/sources',
    detail: (id: string) => `/sources/${id}`,
    create: '/sources',
    sync: '/sources/sync',
  },
  // 文章
  articles: {
    list: '/articles',
    detail: (id: string) => `/articles/${id}`,
    sync: '/articles/sync',
  },
  // 想法
  ideas: {
    list: '/ideas',
    create: '/ideas',
  },
  // 观点
  viewpoints: {
    list: '/viewpoints',
    sync: '/viewpoints/sync',
  },
  // 同步状态
  sync: {
    status: '/sync/status',
  },
  // Skill
  skill: {
    config: '/skill/config',
    versions: '/skill/versions',
    compare: '/skill/compare',
  },
};
```

#### 验证步骤
- [ ] 文件可正确导入
- [ ] 包含所有 API 端点

#### 完成标准
- [ ] API 配置已创建

---

### 任务 2: 创建请求拦截器
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 任务 1

#### 目标
创建请求拦截器，自动添加 token 和错误处理

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/interceptors.ts`

#### 代码内容
```typescript
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
```

#### 验证步骤
- [ ] 文件可正确导入
- [ ] 包含 token 自动添加逻辑

#### 完成标准
- [ ] 请求拦截器已创建

---

### 任务 3: 创建认证 API
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 任务 2

#### 目标
创建认证相关的 API 调用函数

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/auth.ts`

#### 代码内容
```typescript
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
```

#### 验证步骤
- [ ] 文件可正确导入
- [ ] 包含登录和退出逻辑

#### 完成标准
- [ ] 认证 API 已创建

---

### 任务 4: 创建素材 API
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 任务 2

#### 目标
创建素材相关的 API 调用函数

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/sources.ts`

#### 代码内容
```typescript
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
```

#### 验证步骤
- [ ] 文件可正确导入
- [ ] 包含所有素材接口

#### 完成标准
- [ ] 素材 API 已创建

---

### 任务 5: 创建其他 API 模块
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 2

#### 目标
创建文章、想法、观点、同步状态、Skill 的 API 调用函数

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/articles.ts`
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/ideas.ts`
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/viewpoints.ts`
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/sync.ts`
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/skill.ts`

#### 代码内容 - articles.ts
```typescript
import { get, post } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface Article {
  id: string;
  title: string;
  content?: string;
  status: 'draft' | 'published';
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

export const listArticles = async (params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ArticleListResponse> => {
  return get<ArticleListResponse>(API_ENDPOINTS.articles.list, params);
};

export const getArticleDetail = async (id: string): Promise<Article> => {
  return get<Article>(API_ENDPOINTS.articles.detail(id));
};

export const syncArticles = async (): Promise<{ count: number; error?: string }> => {
  return post(API_ENDPOINTS.articles.sync);
};
```

#### 代码内容 - ideas.ts
```typescript
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
```

#### 代码内容 - viewpoints.ts
```typescript
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
```

#### 代码内容 - sync.ts
```typescript
import { get } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface SyncStatus {
  lastSyncAt: string;
  recordCount: number;
  status: 'success' | 'failed' | 'syncing';
  error?: string;
}

export const getSyncStatus = async (): Promise<Record<string, SyncStatus>> => {
  return get<Record<string, SyncStatus>>(API_ENDPOINTS.sync.status);
};
```

#### 代码内容 - skill.ts
```typescript
import { get } from './interceptors';
import { API_ENDPOINTS } from './config';

export interface SkillConfig {
  version: string;
  name: string;
  config: any;
}

export interface SkillVersion {
  id: string;
  version: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export const getSkillConfig = async (): Promise<SkillConfig> => {
  return get<SkillConfig>(API_ENDPOINTS.skill.config);
};

export const getSkillVersions = async (): Promise<SkillVersion[]> => {
  return get<SkillVersion[]>(API_ENDPOINTS.skill.versions);
};

export const compareSkillVersions = async (v1: string, v2: string): Promise<any> => {
  return get(API_ENDPOINTS.skill.compare, { v1, v2 });
};
```

#### 验证步骤
- [ ] 所有文件可正确导入
- [ ] 包含所有 API 接口

#### 完成标准
- [ ] 所有 API 模块已创建

---

### 任务 6: 创建 API 索引文件
**优先级**: P0
**预计时间**: 2 分钟
**依赖**: 任务 3-5

#### 目标
创建 API 模块的统一导出文件

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/api/index.ts`

#### 代码内容
```typescript
export * from './auth';
export * from './sources';
export * from './articles';
export * from './ideas';
export * from './viewpoints';
export * from './sync';
export * from './skill';
```

#### 验证步骤
- [ ] 文件可正确导入

#### 完成标准
- [ ] API 索引文件已创建

---

## 任务组 2: 登录页面 (任务 7-10)

### 任务 7: 创建登录页面
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 3

#### 目标
创建微信登录页面

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/pages/login/index.tsx`
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/pages/login/index.scss`

#### 代码内容 - index.tsx
```tsx
import { View, Button, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { login } from '../../api';
import './index.scss';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // 获取微信登录 code
      const { code } = await Taro.login({
        provider: 'weixin',
      });

      // 调用后端登录
      await login(code);

      Taro.showToast({
        title: '登录成功',
        icon: 'success',
      });

      // 返回上一页或跳转到首页
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('登录失败:', error);
      Taro.showToast({
        title: '登录失败',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='login-page'>
      <View className='logo-section'>
        <Text className='logo-text'>MindFlow</Text>
        <Text className='slogan'>记录思考，沉淀知识</Text>
      </View>

      <View className='login-section'>
        <Button
          className='login-btn'
          type='primary'
          loading={loading}
          onClick={handleLogin}
        >
          微信一键登录
        </Button>

        <Text className='agreement-text'>
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  );
}
```

#### 代码内容 - index.scss
```scss
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;

  .logo-section {
    text-align: center;
    margin-bottom: 100px;

    .logo-text {
      font-size: 48px;
      font-weight: bold;
      color: #fff;
      display: block;
      margin-bottom: 20px;
    }

    .slogan {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.8);
    }
  }

  .login-section {
    width: 100%;

    .login-btn {
      width: 100%;
      height: 48px;
      line-height: 48px;
      background: #07c160;
      border-radius: 24px;
      font-size: 16px;
      margin-bottom: 20px;
    }

    .agreement-text {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      text-align: center;
      display: block;
    }
  }
}
```

#### 验证步骤
- [ ] 页面可正常访问
- [ ] 点击登录按钮触发微信登录

#### 完成标准
- [ ] 登录页面已创建

---

### 任务 8: 更新 app.config.ts 添加登录页面
**优先级**: P0
**预计时间**: 2 分钟
**依赖**: 任务 7

#### 目标
在 app.config.ts 中添加登录页面配置

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/app.config.ts`

#### 代码内容
```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/sources/index',
    'pages/artifacts/index',
    'pages/profile/index',
    'pages/login/index',  // 添加登录页面
    'pages/editor/index',
  ],
  // ... 其他配置
});
```

#### 验证步骤
- [ ] 登录页面已添加到 pages 列表

#### 完成标准
- [ ] app.config.ts 已更新

---

### 任务 9: 创建用户协议页面
**优先级**: P1
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
创建用户协议页面

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/pages/agreement/index.tsx`

#### 代码内容
```tsx
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function AgreementPage() {
  return (
    <View className='agreement-page'>
      <View className='header'>
        <Text className='title'>用户协议</Text>
      </View>
      <ScrollView className='content' scrollY>
        <Text className='text'>
          欢迎使用 MindFlow 小程序！

          1. 服务条款
          本协议是您与 MindFlow 之间关于使用本小程序服务的协议。

          2. 账号注册
          您需要使用微信账号登录本小程序。

          3. 用户行为规范
          您在使用本服务时应遵守相关法律法规。

          4. 隐私保护
          我们重视您的隐私保护，具体请参见《隐私政策》。

          5. 免责声明
          本小程序按"现状"提供，我们不承担任何明示或暗示的保证责任。

          6. 协议修改
          我们有权随时修改本协议，修改后的协议将在小程序内公布。
        </Text>
      </ScrollView>
    </View>
  );
}
```

#### 验证步骤
- [ ] 页面可正常访问

#### 完成标准
- [ ] 用户协议页面已创建

---

### 任务 10: 创建隐私政策页面
**优先级**: P1
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
创建隐私政策页面

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/pages/privacy/index.tsx`

#### 代码内容
```tsx
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function PrivacyPage() {
  return (
    <View className='privacy-page'>
      <View className='header'>
        <Text className='title'>隐私政策</Text>
      </View>
      <ScrollView className='content' scrollY>
        <Text className='text'>
          MindFlow 隐私政策

          1. 信息收集
          我们收集的信息包括：
          - 微信 openid（用于身份识别）
          - 昵称和头像（用于展示）
          - 您创建的想法和素材

          2. 信息使用
          我们使用您的信息用于：
          - 提供小程序服务
          - 同步数据到飞书
          - 改善用户体验

          3. 信息共享
          我们不会将您的个人信息出售给第三方。

          4. 信息安全
          我们采取合理的安全措施保护您的信息。

          5. 您的权利
          您可以随时删除您的账户和相关数据。
        </Text>
      </ScrollView>
    </View>
  );
}
```

#### 验证步骤
- [ ] 页面可正常访问

#### 完成标准
- [ ] 隐私政策页面已创建

---

## 任务组 3: 素材库页面重构 (任务 11-18)

### 任务 11: 重构素材列表页面
**优先级**: P0
**预计时间**: 8 分钟
**依赖**: 任务 4

#### 目标
重构素材列表页面，连接真实 API

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/pages/sources/index.tsx`

#### 代码内容
```tsx
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { listSources, syncSources, Source } from '../../api';
import './index.scss';

const TABS = [
  { key: '', label: '全部' },
  { key: 'article', label: '文章' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'image', label: '图文' },
];

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 加载素材列表
  const loadSources = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const res = await listSources({
        type: activeTab || undefined,
        page: pageNum,
        pageSize: 20,
      });

      if (isRefresh || pageNum === 1) {
        setSources(res.items);
      } else {
        setSources(prev => [...prev, ...res.items]);
      }
      
      setHasMore(res.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('加载素材失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, loading]);

  // 初始加载
  useEffect(() => {
    loadSources(1, true);
  }, [activeTab]);

  // 下拉刷新
  usePullDownRefresh(() => {
    setIsRefreshing(true);
    loadSources(1, true);
  });

  // 上拉加载更多
  useReachBottom(() => {
    if (hasMore && !loading) {
      loadSources(page + 1);
    }
  });

  // 手动同步
  const handleSync = async () => {
    Taro.showLoading({ title: '同步中...' });
    try {
      await syncSources();
      Taro.showToast({ title: '同步成功', icon: 'success' });
      loadSources(1, true);
    } catch (error) {
      Taro.showToast({ title: '同步失败', icon: 'error' });
    } finally {
      Taro.hideLoading();
    }
  };

  // 过滤素材
  const filteredSources = sources.filter(source => {
    if (!searchKeyword) return true;
    const keyword = searchKeyword.toLowerCase();
    return (
      source.title.toLowerCase().includes(keyword) ||
      source.tags?.some(tag => tag.toLowerCase().includes(keyword))
    );
  });

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      article: '📄',
      video: '🎬',
      audio: '🎵',
      image: '🖼️',
    };
    return icons[type] || '📄';
  };

  return (
    <View className='sources-page'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='搜索素材...'
          value={searchKeyword}
          onInput={(e) => setSearchKeyword(e.detail.value)}
        />
        <Text className='sync-btn' onClick={handleSync}>🔄</Text>
      </View>

      {/* 分类标签 */}
      <ScrollView className='tab-bar' scrollX>
        {TABS.map(tab => (
          <Text
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Text>
        ))}
      </ScrollView>

      {/* 素材列表 */}
      <ScrollView className='source-list' scrollY>
        {filteredSources.map(source => (
          <View
            key={source.id}
            className='source-card'
            onClick={() => Taro.navigateTo({ url: `/pages/sources/detail?id=${source.id}` })}
          >
            <View className='source-header'>
              <Text className='source-icon'>{getTypeIcon(source.type)}</Text>
              <Text className='source-title'>{source.title}</Text>
            </View>
            
            {source.summary && (
              <Text className='source-summary'>{source.summary}</Text>
            )}
            
            <View className='source-footer'>
              <View className='source-tags'>
                {source.tags?.map((tag, idx) => (
                  <Text key={idx} className='tag'>#{tag}</Text>
                ))}
              </View>
              <Text className='source-date'>
                {new Date(source.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))}

        {/* 加载状态 */}
        {loading && <Text className='loading-text'>加载中...</Text>}
        {!hasMore && sources.length > 0 && (
          <Text className='no-more-text'>没有更多了</Text>
        )}
        {sources.length === 0 && !loading && (
          <Text className='empty-text'>暂无素材</Text>
        )}
      </ScrollView>
    </View>
  );
}
```

#### 验证步骤
- [ ] 页面可正常加载素材列表
- [ ] 分类切换正常
- [ ] 搜索功能正常
- [ ] 下拉刷新和上拉加载正常

#### 完成标准
- [ ] 素材列表页面已重构

---

### 任务 12: 更新素材列表样式
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 11

#### 目标
更新素材列表页面的样式

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/pages/sources/index.scss`

#### 代码内容
```scss
.sources-page {
  min-height: 100vh;
  background: #f5f5f5;

  .search-bar {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #eee;

    .search-input {
      flex: 1;
      height: 36px;
      background: #f5f5f5;
      border-radius: 18px;
      padding: 0 16px;
      font-size: 14px;
    }

    .sync-btn {
      margin-left: 12px;
      font-size: 20px;
      padding: 8px;
    }
  }

  .tab-bar {
    white-space: nowrap;
    background: #fff;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;

    .tab-item {
      display: inline-block;
      padding: 6px 16px;
      margin-right: 8px;
      font-size: 14px;
      color: #666;
      background: #f5f5f5;
      border-radius: 16px;

      &.active {
        color: #fff;
        background: #667eea;
      }
    }
  }

  .source-list {
    padding: 12px;

    .source-card {
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

      .source-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;

        .source-icon {
          font-size: 20px;
          margin-right: 8px;
        }

        .source-title {
          flex: 1;
          font-size: 16px;
          font-weight: 500;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .source-summary {
        font-size: 14px;
        color: #666;
        line-height: 1.5;
        margin-bottom: 12px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .source-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .source-tags {
          display: flex;
          flex-wrap: wrap;

          .tag {
            font-size: 12px;
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
            padding: 2px 8px;
            border-radius: 10px;
            margin-right: 6px;
          }
        }

        .source-date {
          font-size: 12px;
          color: #999;
        }
      }
    }

    .loading-text,
    .no-more-text,
    .empty-text {
      text-align: center;
      padding: 20px;
      font-size: 14px;
      color: #999;
    }
  }
}
```

#### 验证步骤
- [ ] 样式正常显示
- [ ] 响应式布局正常

#### 完成标准
- [ ] 素材列表样式已更新

---

### 任务 13: 创建素材详情页面
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 4

#### 目标
创建素材详情页面

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/pages/sources/detail.tsx`

#### 代码内容
```tsx
import { View, Text, Button } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { getSourceDetail, Source } from '../../api';
import './detail.scss';

export default function SourceDetailPage() {
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);

  useLoad((options) => {
    const { id } = options;
    if (id) {
      loadSourceDetail(id);
    }
  });

  const loadSourceDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await getSourceDetail(id);
      setSource(res);
    } catch (error) {
      console.error('加载素材详情失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUrl = () => {
    if (source?.url) {
      Taro.setClipboardData({
        data: source.url,
        success: () => {
          Taro.showToast({ title: '链接已复制', icon: 'success' });
        },
      });
    }
  };

  if (loading) {
    return (
      <View className='source-detail-page'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    );
  }

  if (!source) {
    return (
      <View className='source-detail-page'>
        <Text className='error-text'>素材不存在</Text>
      </View>
    );
  }

  return (
    <View className='source-detail-page'>
      <View className='header'>
        <Text className='title'>{source.title}</Text>
        <Text className='type'>类型: {source.type}</Text>
      </View>

      {source.summary && (
        <View className='section'>
          <Text className='section-title'>摘要</Text>
          <Text className='section-content'>{source.summary}</Text>
        </View>
      )}

      {source.tags && source.tags.length > 0 && (
        <View className='section'>
          <Text className='section-title'>标签</Text>
          <View className='tags'>
            {source.tags.map((tag, idx) => (
              <Text key={idx} className='tag'>#{tag}</Text>
            ))}
          </View>
        </View>
      )}

      <View className='section'>
        <Text className='section-title'>收藏时间</Text>
        <Text className='section-content'>
          {new Date(source.createdAt).toLocaleString()}
        </Text>
      </View>

      {source.url && (
        <Button className='open-btn' onClick={handleOpenUrl}>
          复制链接
        </Button>
      )}
    </View>
  );
}
```

#### 验证步骤
- [ ] 页面可正常访问
- [ ] 素材详情正确显示

#### 完成标准
- [ ] 素材详情页面已创建

---

### 任务 14: 更新 app.config.ts 添加素材详情页
**优先级**: P0
**预计时间**: 2 分钟
**依赖**: 任务 13

#### 目标
在 app.config.ts 中添加素材详情页

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/app.config.ts`

#### 代码内容
```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/sources/index',
    'pages/sources/detail',  // 添加素材详情页
    'pages/artifacts/index',
    'pages/profile/index',
    'pages/login/index',
    'pages/editor/index',
  ],
  // ... 其他配置
});
```

#### 验证步骤
- [ ] 素材详情页已添加到 pages 列表

#### 完成标准
- [ ] app.config.ts 已更新

---

### 任务 15-18: 作品库页面重构
**优先级**: P0
**预计时间**: 15 分钟
**依赖**: 任务 5

#### 目标
重构作品库页面，连接真实 API，显示文章列表和周报

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/pages/artifacts/index.tsx`
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/pages/artifacts/index.scss`

#### 代码内容 - index.tsx
```tsx
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { listArticles, syncArticles, Article } from '../../api';
import './index.scss';

const TABS = [
  { key: 'articles', label: '文章' },
  { key: 'weekly', label: '周报' },
];

export default function ArtifactsPage() {
  const [activeTab, setActiveTab] = useState('articles');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // 加载文章列表
  const loadArticles = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const res = await listArticles({
        page: pageNum,
        pageSize: 20,
      });

      if (isRefresh || pageNum === 1) {
        setArticles(res.items);
      } else {
        setArticles(prev => [...prev, ...res.items]);
      }
      
      setHasMore(res.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('加载文章失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // 初始加载
  useEffect(() => {
    if (activeTab === 'articles') {
      loadArticles(1, true);
    }
  }, [activeTab]);

  // 下拉刷新
  usePullDownRefresh(() => {
    if (activeTab === 'articles') {
      loadArticles(1, true);
    }
  });

  // 上拉加载更多
  useReachBottom(() => {
    if (activeTab === 'articles' && hasMore && !loading) {
      loadArticles(page + 1);
    }
  });

  // 手动同步
  const handleSync = async () => {
    Taro.showLoading({ title: '同步中...' });
    try {
      await syncArticles();
      Taro.showToast({ title: '同步成功', icon: 'success' });
      loadArticles(1, true);
    } catch (error) {
      Taro.showToast({ title: '同步失败', icon: 'error' });
    } finally {
      Taro.hideLoading();
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const tags: Record<string, { text: string; color: string }> = {
      draft: { text: '草稿', color: '#ff9800' },
      published: { text: '已发布', color: '#4caf50' },
    };
    return tags[status] || { text: status, color: '#999' };
  };

  return (
    <View className='artifacts-page'>
      {/* 标签栏 */}
      <View className='tab-bar'>
        {TABS.map(tab => (
          <Text
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Text>
        ))}
        <Text className='sync-btn' onClick={handleSync}>🔄</Text>
      </View>

      {/* 内容区域 */}
      {activeTab === 'articles' && (
        <ScrollView className='article-list' scrollY>
          {articles.map(article => {
            const statusTag = getStatusTag(article.status);
            return (
              <View
                key={article.id}
                className='article-card'
                onClick={() => Taro.navigateTo({ url: `/pages/artifacts/detail?id=${article.id}` })}
              >
                <View className='article-header'>
                  <Text className='article-title'>{article.title}</Text>
                  <Text
                    className='status-tag'
                    style={{ background: statusTag.color }}
                  >
                    {statusTag.text}
                  </Text>
                </View>
                <View className='article-meta'>
                  <Text className='article-date'>
                    {new Date(article.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          })}

          {loading && <Text className='loading-text'>加载中...</Text>}
          {!hasMore && articles.length > 0 && (
            <Text className='no-more-text'>没有更多了</Text>
          )}
          {articles.length === 0 && !loading && (
            <Text className='empty-text'>暂无文章</Text>
          )}
        </ScrollView>
      )}

      {activeTab === 'weekly' && (
        <View className='weekly-placeholder'>
          <Text className='placeholder-text'>周报功能开发中...</Text>
        </View>
      )}
    </View>
  );
}
```

#### 验证步骤
- [ ] 文章列表可正常加载
- [ ] 标签切换正常
- [ ] 下拉刷新和上拉加载正常

#### 完成标准
- [ ] 作品库页面已重构

---

## 任务组 4: "我的"页面重构 (任务 19-25)

### 任务 19-25: 重构"我的"页面
**优先级**: P0
**预计时间**: 20 分钟
**依赖**: 任务 3, 5

#### 目标
重构"我的"页面，添加想法记录、观点库入口、用户信息展示

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/pages/profile/index.tsx`
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/pages/profile/index.scss`

#### 代码内容 - index.tsx
```tsx
import { View, Text, Button, Input, Textarea } from '@tarojs/components';
import Taro, { useShow } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { getStoredUser, logout, createIdea, isLoggedIn } from '../../api';
import './index.scss';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [isLogin, setIsLogin] = useState(false);
  const [ideaContent, setIdeaContent] = useState('');
  const [showIdeaInput, setShowIdeaInput] = useState(false);

  // 检查登录状态
  useShow(() => {
    checkLoginStatus();
  });

  const checkLoginStatus = async () => {
    const loggedIn = await isLoggedIn();
    setIsLogin(loggedIn);
    if (loggedIn) {
      const userInfo = await getStoredUser();
      setUser(userInfo);
    }
  };

  // 跳转到登录页
  const handleLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' });
  };

  // 退出登录
  const handleLogout = async () => {
    const res = await Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
    });
    if (res.confirm) {
      await logout();
      setUser(null);
      setIsLogin(false);
      Taro.showToast({ title: '已退出登录', icon: 'success' });
    }
  };

  // 提交想法
  const handleSubmitIdea = async () => {
    if (!ideaContent.trim()) {
      Taro.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    try {
      await createIdea({
        content: ideaContent,
        type: 'text',
      });
      Taro.showToast({ title: '记录成功', icon: 'success' });
      setIdeaContent('');
      setShowIdeaInput(false);
    } catch (error) {
      Taro.showToast({ title: '记录失败', icon: 'error' });
    }
  };

  // 菜单项
  const menuItems = [
    { icon: '💡', label: '我的想法', url: '/pages/profile/ideas' },
    { icon: '💭', label: '观点库', url: '/pages/profile/viewpoints' },
    { icon: '⚙️', label: '设置', url: '/pages/profile/settings' },
  ];

  return (
    <View className='profile-page'>
      {/* 用户信息区域 */}
      <View className='user-section'>
        {isLogin && user ? (
          <>
            <View className='avatar'>
              {user.avatar ? (
                <image src={user.avatar} className='avatar-img' />
              ) : (
                <Text className='avatar-placeholder'>👤</Text>
              )}
            </View>
            <Text className='nickname'>{user.nickname || '未设置昵称'}</Text>
            <Button className='logout-btn' size='mini' onClick={handleLogout}>
              退出登录
            </Button>
          </>
        ) : (
          <>
            <View className='avatar'>
              <Text className='avatar-placeholder'>👤</Text>
            </View>
            <Text className='nickname'>游客</Text>
            <Button className='login-btn' type='primary' size='mini' onClick={handleLogin}>
              立即登录
            </Button>
          </>
        )}
      </View>

      {/* 快速记录想法 */}
      <View className='idea-section'>
        <Text className='section-title'>💡 快速记录想法</Text>
        {!showIdeaInput ? (
          <View className='idea-input-placeholder' onClick={() => setShowIdeaInput(true)}>
            <Text className='placeholder-text'>点击记录你的想法...</Text>
          </View>
        ) : (
          <View className='idea-input-wrapper'>
            <Textarea
              className='idea-textarea'
              placeholder='记录你的想法...'
              value={ideaContent}
              onInput={(e) => setIdeaContent(e.detail.value)}
              maxlength={500}
            />
            <View className='idea-actions'>
              <Button className='cancel-btn' size='mini' onClick={() => setShowIdeaInput(false)}>
                取消
              </Button>
              <Button className='submit-btn' type='primary' size='mini' onClick={handleSubmitIdea}>
                提交
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* 菜单列表 */}
      <View className='menu-section'>
        {menuItems.map((item, index) => (
          <View
            key={index}
            className='menu-item'
            onClick={() => Taro.navigateTo({ url: item.url })}
          >
            <Text className='menu-icon'>{item.icon}</Text>
            <Text className='menu-label'>{item.label}</Text>
            <Text className='menu-arrow'>›</Text>
          </View>
        ))}
      </View>

      {/* 同步状态 */}
      <View className='sync-section'>
        <Text className='sync-text'>上次同步: 刚刚</Text>
      </View>
    </View>
  );
}
```

#### 验证步骤
- [ ] 用户信息正确显示
- [ ] 登录/退出功能正常
- [ ] 想法记录功能正常
- [ ] 菜单跳转正常

#### 完成标准
- [ ] "我的"页面已重构

---

## 任务组 5: 工作台页面优化 (任务 26-30)

### 任务 26-30: 优化工作台页面
**优先级**: P1
**预计时间**: 15 分钟
**依赖**: 无

#### 目标
优化工作台页面，显示真实的 Session 数据

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-client/src/pages/index/index.tsx`

#### 代码内容
```tsx
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import './index.scss';

// 模拟 Session 数据（后续替换为真实 API）
const MOCK_SESSIONS = [
  {
    id: '1',
    title: 'AI 写作助手产品分析',
    phase: '3',
    status: '进行中',
    updatedAt: '2024-01-20',
  },
  {
    id: '2',
    title: '个人知识管理方法论',
    phase: '5',
    status: '审核中',
    updatedAt: '2024-01-19',
  },
];

export default function IndexPage() {
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [loading, setLoading] = useState(false);

  // 下拉刷新
  usePullDownRefresh(() => {
    // 后续调用真实 API
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 1000);
  });

  // 创建新 Session
  const handleCreate = () => {
    Taro.navigateTo({ url: '/pages/editor/index' });
  };

  // 继续 Session
  const handleContinue = (sessionId: string) => {
    Taro.navigateTo({ url: `/pages/editor/index?sessionId=${sessionId}` });
  };

  // 获取阶段名称
  const getPhaseName = (phase: string) => {
    const phases: Record<string, string> = {
      '-1': 'Brief',
      '0': '素材',
      '0.5': '切入点',
      '1': '调研',
      '1.5': '突破点',
      '2': '讨论',
      '2.5': '深度调研',
      '3': '收敛',
      '4': '大纲',
      '4.5': '标题',
      '5': '审计',
      '5.5': '修订',
      '6': '发布',
    };
    return phases[phase] || `Phase ${phase}`;
  };

  return (
    <View className='index-page'>
      {/* 头部 */}
      <View className='header'>
        <Text className='title'>工作台</Text>
        <Text className='subtitle'>继续你的创作之旅</Text>
      </View>

      {/* 新建按钮 */}
      <View className='create-section'>
        <Button className='create-btn' type='primary' onClick={handleCreate}>
          + 新建文章
        </Button>
      </View>

      {/* 进行中的 Session */}
      <View className='sessions-section'>
        <Text className='section-title'>进行中的创作</Text>
        
        {sessions.length === 0 ? (
          <View className='empty-state'>
            <Text className='empty-text'>暂无进行中的创作</Text>
            <Text className='empty-subtext'>点击上方按钮开始新的创作</Text>
          </View>
        ) : (
          <ScrollView className='session-list' scrollY>
            {sessions.map(session => (
              <View
                key={session.id}
                className='session-card'
                onClick={() => handleContinue(session.id)}
              >
                <View className='session-header'>
                  <Text className='session-title'>{session.title}</Text>
                  <Text className={`session-status status-${session.status}`}>
                    {session.status}
                  </Text>
                </View>
                <View className='session-meta'>
                  <Text className='session-phase'>
                    当前阶段: {getPhaseName(session.phase)}
                  </Text>
                  <Text className='session-date'>
                    更新于: {session.updatedAt}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 快捷入口 */}
      <View className='quick-actions'>
        <Text className='section-title'>快捷入口</Text>
        <View className='action-grid'>
          <View className='action-item' onClick={() => Taro.switchTab({ url: '/pages/sources/index' })}>
            <Text className='action-icon'>📚</Text>
            <Text className='action-label'>素材库</Text>
          </View>
          <View className='action-item' onClick={() => Taro.switchTab({ url: '/pages/artifacts/index' })}>
            <Text className='action-icon'>📝</Text>
            <Text className='action-label'>作品库</Text>
          </View>
          <View className='action-item' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
            <Text className='action-icon'>💡</Text>
            <Text className='action-label'>想法</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
```

#### 验证步骤
- [ ] 页面正常显示
- [ ] 新建文章按钮正常
- [ ] Session 列表正常显示
- [ ] 快捷入口正常跳转

#### 完成标准
- [ ] 工作台页面已优化

---

## 任务组 6: 公共组件和工具 (任务 31-35)

### 任务 31-35: 创建公共组件
**优先级**: P1
**预计时间**: 15 分钟
**依赖**: 无

#### 目标
创建公共组件：Loading、Empty、ErrorBoundary

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/components/Loading/index.tsx`
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/components/Empty/index.tsx`
- 创建: `/Users/zuolin1/article-collector/mindflow-client/src/components/ErrorBoundary/index.tsx`

#### 代码内容 - Loading.tsx
```tsx
import { View, Text } from '@tarojs/components';
import './index.scss';

interface LoadingProps {
  text?: string;
}

export default function Loading({ text = '加载中...' }: LoadingProps) {
  return (
    <View className='loading-component'>
      <View className='loading-spinner' />
      <Text className='loading-text'>{text}</Text>
    </View>
  );
}
```

#### 代码内容 - Empty.tsx
```tsx
import { View, Text } from '@tarojs/components';
import './index.scss';

interface EmptyProps {
  text?: string;
}

export default function Empty({ text = '暂无数据' }: EmptyProps) {
  return (
    <View className='empty-component'>
      <Text className='empty-icon'>📭</Text>
      <Text className='empty-text'>{text}</Text>
    </View>
  );
}
```

#### 验证步骤
- [ ] 组件可正常使用

#### 完成标准
- [ ] 公共组件已创建

---

## 检查点设置

### 检查点 1: API 客户端完成（任务 1-6）
汇报内容：
- API 基础配置已创建
- 请求拦截器已创建
- 所有 API 模块已创建

### 检查点 2: 登录页面完成（任务 7-10）
汇报内容：
- 登录页面已创建
- 用户协议和隐私政策页面已创建

### 检查点 3: 素材库页面完成（任务 11-14）
汇报内容：
- 素材列表页面已重构
- 素材详情页面已创建

### 检查点 4: 作品库和"我的"页面完成（任务 15-25）
汇报内容：
- 作品库页面已重构
- "我的"页面已重构

### 检查点 5: 工作台和公共组件完成（任务 26-35）
汇报内容：
- 工作台页面已优化
- 公共组件已创建

---

## 完成标准

Phase 2 完成的标志：
- [ ] 所有页面已连接真实 API
- [ ] 登录功能正常工作
- [ ] 素材库、作品库、"我的"页面功能完整
- [ ] 公共组件可正常使用
- [ ] 小程序可正常运行，无明显错误
