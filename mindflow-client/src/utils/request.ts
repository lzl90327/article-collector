import Taro from '@tarojs/taro';

// Using 127.0.0.1 which is safer for simulator
const BASE_URL = 'http://127.0.0.1:3000/api/mindflow';

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

export const request = (url: string, method: 'GET' | 'POST', data?: unknown): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
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
