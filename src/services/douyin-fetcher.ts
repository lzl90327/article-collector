/**
 * 抖音视频信息提取和下载服务
 * 
 * 使用 Douyin_TikTok_Download_API 服务提取和下载抖音视频
 * 支持功能：
 * - 视频元信息提取（标题、作者、时长、发布时间等）
 * - 视频下载
 * - 音频提取
 * - 短链自动展开（v.douyin.com）
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';
import { mediaDownloader } from './media-downloader';
import { extractDouyinVideoId } from '../utils/url-parser';

/**
 * 抖音视频信息
 */
export interface DouyinVideoInfo {
  /** 标题 */
  title: string;
  /** 作者 */
  author: string;
  /** 视频时长（秒） */
  duration: number;
  /** 发布时间 */
  publishDate: string;
  /** 简介 */
  description: string;
  /** 标签 */
  tags: string[];
  /** 封面图 URL */
  thumbnail: string;
  /** 视频 ID (aweme_id) */
  awemeId: string;
  /** 观看数（可选） */
  playCount?: number;
  /** 点赞数（可选） */
  diggCount?: number;
}

/**
 * 提取结果
 */
export interface DouyinVideoResult {
  /** 是否成功 */
  success: boolean;
  /** 视频信息 */
  info?: DouyinVideoInfo;
  /** 视频文件路径 */
  videoPath?: string;
  /** 音频文件路径 */
  audioPath?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 提取选项
 */
export interface FetchOptions {
  /** 是否下载视频 */
  downloadVideo?: boolean;
  /** 是否提取音频 */
  extractAudio?: boolean;
}

/**
 * Douyin API 响应数据结构（根据实际 API 调整）
 */
interface DouyinApiResponse {
  status?: string;
  code?: number;
  message?: string;
  data?: {
    aweme_id?: string;
    desc?: string;
    author?: {
      nickname?: string;
      unique_id?: string;
    };
    video?: {
      duration?: number;
      play_addr?: {
        url_list?: string[];
      };
      cover?: {
        url_list?: string[];
      };
    };
    statistics?: {
      play_count?: number;
      digg_count?: number;
      comment_count?: number;
      share_count?: number;
    };
    create_time?: number;
    tags?: Array<{
      tag_name?: string;
    }>;
  };
  video_url?: string;
  audio_url?: string;
  cover_url?: string;
}

/**
 * 短链展开
 */
async function expandShortUrl(url: string): Promise<string> {
  // 如果不是短链，直接返回
  if (!url.includes('v.douyin.com')) {
    return url;
  }

  logger.info(`[抖音] 展开短链接: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      },
      maxRedirects: 5,
      timeout: 10000,
      validateStatus: () => true,
    });

    const finalUrl = response.request?.res?.responseUrl || response.config?.url || url;
    logger.info(`[抖音] 短链接展开为: ${finalUrl}`);
    return finalUrl;
  } catch (error: any) {
    logger.warn(`[抖音] 短链接展开失败: ${error.message}`);
    return url;
  }
}

/**
 * 验证抖音 URL
 */
function isValidDouyinUrl(url: string): boolean {
  return /douyin\.com\/video\/\d+|v\.douyin\.com|iesdouyin\.com/.test(url);
}

/**
 * 调用 Douyin API 获取视频信息
 */
async function fetchVideoDataFromApi(url: string): Promise<DouyinApiResponse> {
  const apiUrl = `${videoConfig.douyinApiUrl}/api/hybrid/video_data`;
  
  logger.info(`[抖音] 调用 API: ${apiUrl}`);
  logger.debug(`[抖音] 请求 URL: ${url}`);

  try {
    const response = await axios.post(
      apiUrl,
      { url },
      {
        timeout: 30000, // 30秒超时
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    logger.debug(`[抖音] API 响应状态: ${response.status}`);
    logger.debug(`[抖音] API 响应数据: ${JSON.stringify(response.data).substring(0, 500)}`);

    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new Error('API 服务不可用，请检查 DOUYIN_API_URL 配置');
    }
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data?.error || 'API 请求失败';
      throw new Error(`API 请求失败 (${status}): ${message}`);
    }
    throw new Error(`API 请求失败: ${error.message}`);
  }
}

/**
 * 解析 API 响应，提取视频信息
 */
function parseVideoInfo(apiResponse: DouyinApiResponse, url: string): DouyinVideoInfo {
  // 检查响应状态
  if (apiResponse.status === 'error' || apiResponse.code !== undefined && apiResponse.code !== 0) {
    throw new Error(apiResponse.message || 'API 返回错误状态');
  }

  const data = apiResponse.data || apiResponse as any;
  
  // 提取基本信息
  const awemeId = data.aweme_id || extractDouyinVideoId(url) || '';
  const title = data.desc || '无标题';
  const author = data.author?.nickname || data.author?.unique_id || '未知';
  
  // 提取时长（毫秒转秒）
  const duration = data.video?.duration 
    ? Math.round(data.video.duration / 1000)
    : 0;

  // 提取发布时间
  let publishDate = new Date().toISOString().split('T')[0];
  if (data.create_time) {
    const date = new Date(data.create_time * 1000);
    publishDate = date.toISOString().split('T')[0];
  }

  // 提取简介
  const description = data.desc || '';

  // 提取标签
  const tags: string[] = [];
  if (data.tags && Array.isArray(data.tags)) {
    tags.push(...data.tags.map((tag: any) => tag.tag_name || '').filter(Boolean));
  }

  // 提取封面图
  const thumbnail = data.video?.cover?.url_list?.[0] 
    || apiResponse.cover_url 
    || '';

  // 提取统计数据
  const playCount = data.statistics?.play_count;
  const diggCount = data.statistics?.digg_count;

  const info: DouyinVideoInfo = {
    title,
    author,
    duration,
    publishDate,
    description,
    tags,
    thumbnail,
    awemeId,
    playCount,
    diggCount,
  };

  logger.info(`[抖音] 视频信息: ${info.title} by ${info.author} (${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')})`);
  
  return info;
}

/**
 * 下载视频
 */
async function downloadVideo(
  apiResponse: DouyinApiResponse,
  info: DouyinVideoInfo
): Promise<string> {
  logger.info(`[抖音] 开始下载视频: ${info.title}`);

  // 获取视频下载链接
  const videoUrl = apiResponse.data?.video?.play_addr?.url_list?.[0] 
    || apiResponse.video_url;

  if (!videoUrl) {
    throw new Error('未找到视频下载链接');
  }

  logger.debug(`[抖音] 视频下载链接: ${videoUrl}`);

  // 使用 media-downloader 下载
  const safeTitle = info.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  const result = await mediaDownloader.downloadFile(videoUrl, {
    type: 'video',
    filename: safeTitle,
    maxSizeMB: videoConfig.maxVideoSizeMB,
  });

  if (!result.success || !result.filePath) {
    throw new Error(result.error || '视频下载失败');
  }

  logger.info(`[抖音] 视频下载完成: ${result.filePath}`);
  return result.filePath;
}

/**
 * 下载音频
 */
async function downloadAudio(
  apiResponse: DouyinApiResponse,
  info: DouyinVideoInfo
): Promise<string> {
  logger.info(`[抖音] 开始下载音频: ${info.title}`);

  // 优先使用音频链接，否则从视频中提取
  const audioUrl = apiResponse.audio_url;

  if (audioUrl) {
    // 直接下载音频
    logger.debug(`[抖音] 音频下载链接: ${audioUrl}`);
    
    const safeTitle = info.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const result = await mediaDownloader.downloadFile(audioUrl, {
      type: 'audio',
      filename: safeTitle,
      maxSizeMB: videoConfig.maxVideoSizeMB,
      maxDurationMinutes: videoConfig.maxAudioDurationMinutes,
    });

    if (!result.success || !result.filePath) {
      throw new Error(result.error || '音频下载失败');
    }

    logger.info(`[抖音] 音频下载完成: ${result.filePath}`);
    return result.filePath;
  } else {
    // 如果没有音频链接，需要先下载视频再提取音频
    throw new Error('未找到音频下载链接，请先下载视频');
  }
}

/**
 * 从视频提取音频
 */
async function extractAudioFromVideo(videoPath: string): Promise<string> {
  logger.info(`[抖音] 从视频提取音频: ${videoPath}`);

  const result = await mediaDownloader.extractAudio(videoPath);
  
  if (!result.success || !result.filePath) {
    throw new Error(result.error || '音频提取失败');
  }

  logger.info(`[抖音] 音频提取完成: ${result.filePath}`);
  return result.filePath;
}

/**
 * 从抖音链接获取视频信息和下载（主入口）
 * 
 * @param url 抖音视频链接（支持短链）
 * @param options 提取选项
 * @returns 提取结果
 */
export async function fetchDouyinVideo(
  url: string,
  options: FetchOptions = {}
): Promise<DouyinVideoResult> {
  logger.info(`[抖音] 开始处理视频: ${url}`);

  try {
    // 1. 验证 URL
    if (!isValidDouyinUrl(url)) {
      return {
        success: false,
        error: 'URL 无效：不是有效的抖音链接',
      };
    }

    // 2. 展开短链
    const expandedUrl = await expandShortUrl(url);

    // 3. 调用 API 获取视频数据
    const apiResponse = await fetchVideoDataFromApi(expandedUrl);

    // 4. 解析视频信息
    const info = parseVideoInfo(apiResponse, expandedUrl);

    // 5. 检查时长限制
    const maxDurationMinutes = videoConfig.maxAudioDurationMinutes;
    if (info.duration / 60 > maxDurationMinutes) {
      logger.warn(`[抖音] 视频时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`);
      return {
        success: false,
        info,
        error: `视频时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`,
      };
    }

    const result: DouyinVideoResult = {
      success: true,
      info,
    };

    // 6. 下载视频（如果需要）
    if (options.downloadVideo) {
      try {
        const videoPath = await downloadVideo(apiResponse, info);
        result.videoPath = videoPath;
      } catch (error: any) {
        logger.error(`[抖音] 视频下载失败: ${error.message}`);
        return {
          success: false,
          info,
          error: `视频下载失败: ${error.message}`,
        };
      }
    }

    // 7. 提取音频（如果需要）
    if (options.extractAudio) {
      if (result.videoPath) {
        // 如果已下载视频，从视频中提取音频
        try {
          const audioPath = await extractAudioFromVideo(result.videoPath);
          result.audioPath = audioPath;
        } catch (error: any) {
          logger.error(`[抖音] 音频提取失败: ${error.message}`);
          // 音频提取失败不影响整体成功（视频已下载）
          logger.warn(`[抖音] 继续处理，但音频提取失败`);
        }
      } else {
        // 如果没下载视频，尝试直接下载音频
        logger.info(`[抖音] 直接下载音频`);
        try {
          const audioPath = await downloadAudio(apiResponse, info);
          result.audioPath = audioPath;
        } catch (error: any) {
          // 如果直接下载音频失败，尝试先下载视频再提取
          if (error.message.includes('未找到音频下载链接')) {
            logger.info(`[抖音] 音频链接不可用，尝试下载视频后提取音频`);
            try {
              const videoPath = await downloadVideo(apiResponse, info);
              result.videoPath = videoPath;
              const audioPath = await extractAudioFromVideo(videoPath);
              result.audioPath = audioPath;
            } catch (innerError: any) {
              logger.error(`[抖音] 音频下载失败: ${innerError.message}`);
              return {
                success: false,
                info,
                error: `音频下载失败: ${innerError.message}`,
              };
            }
          } else {
            logger.error(`[抖音] 音频下载失败: ${error.message}`);
            return {
              success: false,
              info,
              error: `音频下载失败: ${error.message}`,
            };
          }
        }
      }
    }

    logger.info(`[抖音] 处理完成: ${info.title}`);
    return result;

  } catch (error: any) {
    logger.error(`[抖音] 处理失败: ${error.message}`);
    
    // 解析常见错误
    let errorMessage = error.message;
    if (errorMessage.includes('API 服务不可用')) {
      errorMessage = 'API 服务不可用，请检查 DOUYIN_API_URL 配置和服务状态';
    } else if (errorMessage.includes('视频不存在') || errorMessage.includes('已删除')) {
      errorMessage = '视频不存在或已删除';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      errorMessage = '无法连接到 API 服务，请检查服务是否运行';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 清理下载的文件
 */
export function cleanupFiles(result: DouyinVideoResult): void {
  const filesToClean = [result.videoPath, result.audioPath].filter(Boolean) as string[];
  
  if (filesToClean.length > 0) {
    logger.info(`[抖音] 清理 ${filesToClean.length} 个文件`);
    mediaDownloader.cleanupFiles(filesToClean);
  }
}
