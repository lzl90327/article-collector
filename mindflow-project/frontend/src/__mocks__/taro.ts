/**
 * Taro API Mock
 * 用于测试时模拟 Taro 的各种 API
 */

// ============================================================================
// 环境检测
// ============================================================================

export const ENV_TYPE = {
  WEAPP: 'WEAPP',
  WEB: 'WEB',
  RN: 'RN',
  SWAN: 'SWAN',
  ALIPAY: 'ALIPAY',
  TT: 'TT',
  QQ: 'QQ',
  JD: 'JD',
};

export const getEnv = jest.fn(() => ENV_TYPE.WEB);

// ============================================================================
// 导航 API
// ============================================================================

export const navigateTo = jest.fn((options) => {
  if (options?.success) {
    options.success();
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve();
});

export const redirectTo = jest.fn((options) => {
  if (options?.success) {
    options.success();
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve();
});

export const navigateBack = jest.fn((options) => {
  if (options?.success) {
    options.success();
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve();
});

// ============================================================================
// 界面 API
// ============================================================================

export const showToast = jest.fn((options) => {
  if (options?.success) {
    options.success();
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve();
});

export const showLoading = jest.fn((options) => {
  if (options?.success) {
    options.success();
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve();
});

export const hideLoading = jest.fn(() => Promise.resolve());

export const showModal = jest.fn((options) => {
  if (options?.success) {
    options.success({ confirm: true, cancel: false });
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve({ confirm: true, cancel: false });
});

export const showActionSheet = jest.fn((options) => {
  if (options?.success) {
    options.success({ tapIndex: 0 });
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve({ tapIndex: 0 });
});

// ============================================================================
// 网络 API
// ============================================================================

export const request = jest.fn((options) => {
  const mockTask = {
    abort: jest.fn(),
    onChunkReceived: jest.fn(),
    offChunkReceived: jest.fn(),
  };

  // 默认不自动调用回调，由测试控制
  return mockTask;
});

export const downloadFile = jest.fn((options) => {
  if (options?.success) {
    options.success({ tempFilePath: '/mock/path/file.txt' });
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve({ tempFilePath: '/mock/path/file.txt' });
});

export const uploadFile = jest.fn((options) => {
  if (options?.success) {
    options.success({ data: '{}', statusCode: 200 });
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve({ data: '{}', statusCode: 200 });
});

// ============================================================================
// 数据缓存 API
// ============================================================================

const mockStorage: Record<string, string> = {};

export const setStorage = jest.fn((options) => {
  if (options?.key) {
    mockStorage[options.key] = JSON.stringify(options.data);
  }
  if (options?.success) {
    options.success();
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve();
});

export const getStorage = jest.fn((options) => {
  const data = options?.key ? mockStorage[options.key] : undefined;
  const result = { data: data ? JSON.parse(data) : null };
  
  if (options?.success) {
    options.success(result);
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve(result);
});

export const removeStorage = jest.fn((options) => {
  if (options?.key) {
    delete mockStorage[options.key];
  }
  if (options?.success) {
    options.success();
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve();
});

export const clearStorage = jest.fn(() => {
  Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  return Promise.resolve();
});

// ============================================================================
// 系统信息 API
// ============================================================================

export const getSystemInfo = jest.fn((options) => {
  const info = {
    brand: 'mock',
    model: 'mock-model',
    system: 'mock-system',
    platform: 'mock-platform',
    screenWidth: 375,
    screenHeight: 667,
    windowWidth: 375,
    windowHeight: 667,
    statusBarHeight: 20,
    pixelRatio: 2,
  };
  
  if (options?.success) {
    options.success(info);
  }
  if (options?.complete) {
    options.complete();
  }
  return Promise.resolve(info);
});

export const getSystemInfoSync = jest.fn(() => ({
  brand: 'mock',
  model: 'mock-model',
  system: 'mock-system',
  platform: 'mock-platform',
  screenWidth: 375,
  screenHeight: 667,
  windowWidth: 375,
  windowHeight: 667,
  statusBarHeight: 20,
  pixelRatio: 2,
}));

// ============================================================================
// 生命周期 Hooks
// ============================================================================

export const useDidShow = jest.fn((callback) => callback());
export const useDidHide = jest.fn((callback) => callback());
export const useReady = jest.fn((callback) => callback());
export const useLoad = jest.fn((callback) => callback());
export const useUnload = jest.fn((callback) => callback());
export const usePullDownRefresh = jest.fn((callback) => callback());
export const useReachBottom = jest.fn((callback) => callback());
export const useShareAppMessage = jest.fn((callback) => callback());
export const usePageScroll = jest.fn((callback) => callback());
export const useResize = jest.fn((callback) => callback());
export const useTabItemTap = jest.fn((callback) => callback());
export const useScope = jest.fn(() => ({}));

// ============================================================================
// 路由 Hooks
// ============================================================================

export const useRouter = jest.fn(() => ({
  params: { id: 'test-workflow-id' },
  path: '/pages/workflow/index',
  scene: 0,
  query: {},
  shareTicket: '',
  referrerInfo: {},
}));

// ============================================================================
// 其他 API
// ============================================================================

export const nextTick = jest.fn((callback) => {
  if (callback) {
    Promise.resolve().then(callback);
  }
  return Promise.resolve();
});

export const eventCenter = {
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  trigger: jest.fn(),
};

export const Events = new (class {
  on = jest.fn();
  once = jest.fn();
  off = jest.fn();
  trigger = jest.fn();
})();

// ============================================================================
// 默认导出
// ============================================================================

const Taro = {
  ENV_TYPE,
  getEnv,
  navigateTo,
  redirectTo,
  navigateBack,
  showToast,
  showLoading,
  hideLoading,
  showModal,
  showActionSheet,
  request,
  downloadFile,
  uploadFile,
  setStorage,
  getStorage,
  removeStorage,
  clearStorage,
  getSystemInfo,
  getSystemInfoSync,
  useDidShow,
  useDidHide,
  useReady,
  useLoad,
  useUnload,
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  usePageScroll,
  useResize,
  useTabItemTap,
  useScope,
  useRouter,
  nextTick,
  eventCenter,
  Events,
};

export default Taro;
