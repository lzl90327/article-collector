/**
 * 百度千帆语音识别服务
 * 短语音识别标准版 API
 * 文档：https://cloud.baidu.com/doc/SPEECH/s/Jlbxdezuf
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// 百度 ASR 配置
interface BaiduASRConfig {
  apiKey: string;
  secretKey: string;
  devPid?: number; // 识别模型，默认 1537（普通话输入法模型）
  format?: string; // 强制指定格式
}

// 缓存 access_token
let cachedToken: { token: string; expireAt: number } | null = null;

/**
 * 获取百度 access_token
 */
async function getBaiduAccessToken(
  apiKey: string,
  secretKey: string
): Promise<string> {
  // 检查缓存（提前 1 小时过期）
  if (cachedToken && cachedToken.expireAt > Date.now()) {
    logger.debug('使用缓存的百度 access_token');
    return cachedToken.token;
  }

  logger.info('获取新的百度 access_token');

  const url = 'https://aip.baidubce.com/oauth/2.0/token';
  const params = {
    grant_type: 'client_credentials',
    client_id: apiKey,
    client_secret: secretKey,
  };

  try {
    const response = await axios.post(url, null, { params, timeout: 10000 });

    if (response.data.error) {
      throw new Error(
        `获取 token 失败: ${response.data.error_description || response.data.error}`
      );
    }

    // 缓存 token
    cachedToken = {
      token: response.data.access_token,
      expireAt: Date.now() + (response.data.expires_in - 3600) * 1000,
    };

    logger.info('百度 access_token 获取成功');
    return cachedToken.token;

  } catch (error) {
    logger.error('获取百度 access_token 失败', error);
    throw error;
  }
}

/**
 * 检测音频格式
 */
function detectAudioFormat(buffer: Buffer): string {
  // AMR 文件头: #!AMR
  if (buffer.length >= 5 && buffer.slice(0, 5).toString() === '#!AMR') {
    return 'amr';
  }
  // AMR-WB 文件头: #!AMR-WB
  if (buffer.length >= 9 && buffer.slice(0, 9).toString() === '#!AMR-WB') {
    return 'amr';
  }
  // WAV 文件头: RIFF
  if (buffer.length >= 4 && buffer.slice(0, 4).toString() === 'RIFF') {
    return 'wav';
  }
  // OGG 文件头: OggS
  if (buffer.length >= 4 && buffer.slice(0, 4).toString() === 'OggS') {
    // 百度不直接支持 OGG，需要转码
    // 但可以尝试发送，某些情况下可能兼容
    return 'pcm';
  }
  // M4A 文件头检测（ftyp）
  if (buffer.length >= 8) {
    const ftypMarker = buffer.slice(4, 8).toString();
    if (ftypMarker === 'ftyp') {
      return 'm4a';
    }
  }
  // 默认尝试 PCM
  return 'pcm';
}

/**
 * 百度语音识别
 * @param audioBuffer 音频二进制数据
 * @param config 配置
 * @param format 音频格式（可选，自动检测）
 * @param rate 采样率（默认 16000）
 */
export async function transcribeWithBaidu(
  audioBuffer: Buffer,
  config: BaiduASRConfig,
  format?: string,
  rate: number = 16000
): Promise<string> {
  // 优先使用参数传入的 format，其次是 config 中的 format，最后自动检测
  const detectedFormat = format || config.format || detectAudioFormat(audioBuffer);
  
  logger.info(
    `百度 ASR: 开始识别, 格式=${detectedFormat}, 大小=${audioBuffer.length}字节, 采样率=${rate}`
  );

  try {
    // 1. 获取 access_token
    const token = await getBaiduAccessToken(config.apiKey, config.secretKey);

    // 2. 构建请求体（JSON 方式上传）
    const requestBody = {
      format: detectedFormat,
      rate,
      channel: 1,
      cuid: 'article-collector-bot-' + Date.now(),
      token,
      dev_pid: config.devPid || 1537, // 普通话输入法模型，有标点
      speech: audioBuffer.toString('base64'),
      len: audioBuffer.length,
    };

    // 3. 调用识别 API
    const response = await axios.post(
      'http://vop.baidu.com/server_api',
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000, // 60 秒超时
      }
    );

    // 4. 处理结果
    if (response.data.err_no !== 0) {
      const errorMsg = getBaiduErrorMessage(response.data.err_no);
      logger.error(`百度 ASR 错误 [${response.data.err_no}]: ${errorMsg}`);
      throw new Error(`语音识别失败: ${errorMsg} (错误码: ${response.data.err_no})`);
    }

    const result = response.data.result?.[0] || '';
    logger.info(`百度 ASR 成功: ${result.substring(0, 100)}${result.length > 100 ? '...' : ''}`);

    return result;

  } catch (error: any) {
    if (error.response) {
      logger.error('百度 ASR 响应错误', {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      logger.error('百度 ASR 调用失败', error.message);
    }
    throw error;
  }
}

/**
 * 获取百度 ASR 错误信息
 */
function getBaiduErrorMessage(errNo: number): string {
  const errorMessages: Record<number, string> = {
    3300: '输入参数不正确',
    3301: '音频质量过差',
    3302: '鉴权失败',
    3303: '语音服务器后端问题',
    3304: '用户的请求 QPS 超限',
    3305: '用户的日 PV 超限',
    3307: '语音服务器后端识别出错问题',
    3308: '音频过长',
    3309: '音频数据问题',
    3310: '输入的音频文件过大',
    3311: '采样率 rate 参数不在选项里',
    3312: '音频格式 format 参数不在选项里',
  };
  return errorMessages[errNo] || '未知错误';
}

/**
 * 检查百度 ASR 服务状态
 */
export async function checkBaiduASRStatus(config: BaiduASRConfig): Promise<boolean> {
  try {
    await getBaiduAccessToken(config.apiKey, config.secretKey);
    return true;
  } catch {
    return false;
  }
}
