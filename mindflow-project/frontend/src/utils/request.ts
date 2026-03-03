import Taro from '@tarojs/taro';

// API Base URL - 本地开发环境
const BASE_URL = 'http://127.0.0.1:3001/api/mindflow';

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
  // 清除过期的 token
  try {
    await Taro.removeStorage({ key: 'token' });
  } catch {
    // 忽略清除错误
  }

  // 显示提示
  Taro.showToast({
    title: '登录已过期，请重新登录',
    icon: 'none',
    duration: 2000
  });

  // 延迟跳转登录页
  setTimeout(() => {
    Taro.navigateTo({
      url: '/pages/login/index'
    });
  }, 1500);
}

// Simple UTF-8 decoder
function decodeUtf8(arrayBuffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(arrayBuffer);
  // Try TextDecoder first (modern environments)
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(uint8Array);
  }

  // Fallback implementation
  let out = "";
  let i = 0;
  const len = uint8Array.length;
  while (i < len) {
    let c = uint8Array[i++];
    switch (c >> 4) {
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        out += String.fromCharCode(((c & 0x1F) << 6) | (uint8Array[i++] & 0x3F));
        break;
      case 14:
        out += String.fromCharCode(((c & 0x0F) << 12) | ((uint8Array[i++] & 0x3F) << 6) | ((uint8Array[i++] & 0x3F) << 6));
        break;
    }
  }
  return out;
}

export const streamRequest = (
  url: string,
  data: unknown,
  callbacks: {
    onChunk: (text: string) => void;
    onComplete: () => void;
    onError: (err: { errMsg: string }) => void;
  }
) => {
  const requestTask = Taro.request({
    url: `${BASE_URL}${url}`,
    method: 'POST',
    data,
    header: {
      'Content-Type': 'application/json',
    },
    enableChunked: true,
    success: () => {
      callbacks.onComplete();
    },
    fail: (err) => {
      callbacks.onError(err);
    }
  });

  // Check if onChunkReceived is available (WeChat Mini Program only)
  if (requestTask && typeof requestTask.onChunkReceived === 'function') {
    requestTask.onChunkReceived((response: { data: ArrayBuffer }) => {
      const text = decodeUtf8(response.data);
      if (text) {
        callbacks.onChunk(text);
      }
    });
  } else {
    // Fallback for H5: use responseType and handle streaming differently
    // For H5, we'll handle the response in success callback
    // The backend should return the full response for non-streaming fallback
  }

  return requestTask;
};

export const request = async (url: string, method: 'GET' | 'POST', data?: unknown): Promise<unknown> => {
  // 获取 token
  const token = await getToken();

  // 构建请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 如果有 token，添加到请求头
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      success: async (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token 过期或无效
          await handleUnauthorized();
          reject(new Error('登录已过期'));
        } else {
          reject(new Error(`Status Code: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        Taro.showToast({ title: `网络错误: ${err.errMsg || '未知'}`, icon: 'none' });
        reject(err);
      }
    });
  });
};
