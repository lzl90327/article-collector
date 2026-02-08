/**
 * 小宇宙播客信息提取和下载服务
 * 
 * 支持功能：
 * - 播客元信息提取（标题、播客名称、主播、时长、发布时间等）
 * - 音频下载（通过域名替换方法）
 * - 短链自动展开
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';
import { mediaDownloader } from './media-downloader';

/**
 * 小宇宙播客信息
 */
export interface XiaoyuzhouPodcastInfo {
  /** 标题 */
  title: string;
  /** 播客名称 */
  podcastName: string;
  /** 主播 */
  host: string;
  /** 音频时长（秒） */
  duration: number;
  /** 发布时间 */
  publishDate: string;
  /** 简介 */
  description: string;
  /** 封面图 URL */
  thumbnail: string;
  /** 单集 ID */
  episodeId: string;
}

/**
 * 提取结果
 */
export interface XiaoyuzhouPodcastResult {
  /** 是否成功 */
  success: boolean;
  /** 播客信息 */
  info?: XiaoyuzhouPodcastInfo;
  /** 音频文件路径 */
  audioPath?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 提取选项
 */
export interface FetchOptions {
  /** 是否下载音频 */
  downloadAudio?: boolean;
}

/**
 * 验证小宇宙 URL
 */
function isValidXiaoyuzhouUrl(url: string): boolean {
  return /xiaoyuzhoufm\.com/.test(url);
}

/**
 * 提取单集 ID
 */
function extractEpisodeId(url: string): string | null {
  // 匹配 /episode/ 后面的 ID
  const match = url.match(/\/episode\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * 从 HTML 中提取 JSON-LD 结构化数据
 */
function extractJsonLd(html: string): any {
  try {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/s);
    if (jsonLdMatch) {
      return JSON.parse(jsonLdMatch[1]);
    }
  } catch (error) {
    logger.debug(`[小宇宙] JSON-LD 解析失败: ${error}`);
  }
  return null;
}

/**
 * 从 HTML 中提取 meta 标签内容
 */
function extractMetaContent(html: string, property: string): string {
  const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const match = html.match(regex);
  return match ? match[1] : '';
}

/**
 * 从 HTML 中提取标题
 */
function extractTitle(html: string): string {
  // 优先从 og:title 提取
  let title = extractMetaContent(html, 'og:title');
  if (title) return title;

  // 从 title 标签提取
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
    // 移除 " - 小宇宙" 等后缀
    title = title.replace(/\s*[-–—]\s*小宇宙.*$/, '').trim();
    return title;
  }

  return '无标题';
}

/**
 * 从 HTML 中提取描述
 */
function extractDescription(html: string): string {
  // 优先从 og:description 提取
  let description = extractMetaContent(html, 'og:description');
  if (description) return description;

  // 从 description meta 标签提取
  description = extractMetaContent(html, 'description');
  if (description) return description;

  return '';
}

/**
 * 从 HTML 中提取封面图
 */
function extractThumbnail(html: string): string {
  // 优先从 og:image 提取
  let thumbnail = extractMetaContent(html, 'og:image');
  if (thumbnail) return thumbnail;

  // 从 twitter:image 提取
  thumbnail = extractMetaContent(html, 'twitter:image');
  if (thumbnail) return thumbnail;

  return '';
}

/**
 * 从 HTML 中提取播客信息
 */
function extractPodcastInfo(html: string, url: string): XiaoyuzhouPodcastInfo {
  logger.info(`[小宇宙] 解析播客页面信息`);

  // 提取单集 ID
  const episodeId = extractEpisodeId(url) || '';

  // 提取标题
  const title = extractTitle(html);

  // 提取描述
  const description = extractDescription(html);

  // 提取封面图
  const thumbnail = extractThumbnail(html);

  // 尝试从 JSON-LD 提取结构化数据
  const jsonLd = extractJsonLd(html);
  
  let podcastName = '未知播客';
  let host = '未知主播';
  let duration = 0;
  let publishDate = new Date().toISOString().split('T')[0];

  if (jsonLd) {
    // 处理 PodcastEpisode 类型
    if (jsonLd['@type'] === 'PodcastEpisode' || jsonLd['@type'] === 'https://schema.org/PodcastEpisode') {
      podcastName = jsonLd.partOfSeries?.name || jsonLd.partOfSeries?.title || podcastName;
      host = jsonLd.author?.name || jsonLd.creator?.name || host;
      
      // 提取时长（可能是秒数或 ISO 8601 格式）
      if (jsonLd.duration) {
        if (typeof jsonLd.duration === 'number') {
          duration = Math.round(jsonLd.duration);
        } else if (typeof jsonLd.duration === 'string') {
          // 解析 ISO 8601 格式 (PT1H30M15S)
          const durationMatch = jsonLd.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (durationMatch) {
            const hours = parseInt(durationMatch[1] || '0', 10);
            const minutes = parseInt(durationMatch[2] || '0', 10);
            const seconds = parseInt(durationMatch[3] || '0', 10);
            duration = hours * 3600 + minutes * 60 + seconds;
          }
        }
      }

      // 提取发布时间
      if (jsonLd.datePublished) {
        const date = new Date(jsonLd.datePublished);
        if (!isNaN(date.getTime())) {
          publishDate = date.toISOString().split('T')[0];
        }
      }
    }
  }

  // 如果 JSON-LD 中没有找到，尝试从 HTML 中提取
  if (podcastName === '未知播客') {
    // 尝试从页面中提取播客名称
    const podcastNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    if (podcastNameMatch) {
      podcastName = podcastNameMatch[1];
    }
  }

  // 尝试从页面中提取主播信息
  if (host === '未知主播') {
    // 查找包含"主播"、"主持人"等关键词的文本
    const hostMatch = html.match(/(?:主播|主持人)[：:]\s*([^<\n]+)/i);
    if (hostMatch) {
      host = hostMatch[1].trim();
    }
  }

  // 尝试从页面中提取时长
  if (duration === 0) {
    // 查找时长格式：如 "1:30:15" 或 "90分钟"
    const durationMatch = html.match(/(?:时长|时长)[：:]\s*(\d+)[：:](\d+)[：:](\d+)/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1], 10);
      const minutes = parseInt(durationMatch[2], 10);
      const seconds = parseInt(durationMatch[3], 10);
      duration = hours * 3600 + minutes * 60 + seconds;
    } else {
      const durationMatch2 = html.match(/(?:时长|时长)[：:]\s*(\d+)\s*分钟/);
      if (durationMatch2) {
        duration = parseInt(durationMatch2[1], 10) * 60;
      } else {
        // 尝试匹配时间格式 "HH:MM:SS" 或 "MM:SS"
        const timeMatch = html.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (timeMatch) {
          const hours = timeMatch[3] ? parseInt(timeMatch[1], 10) : 0;
          const minutes = timeMatch[3] ? parseInt(timeMatch[2], 10) : parseInt(timeMatch[1], 10);
          const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : parseInt(timeMatch[2], 10);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }
    }
  }

  // 尝试从页面中提取发布时间
  if (publishDate === new Date().toISOString().split('T')[0]) {
    const dateMatch = html.match(/(?:发布时间|发布日期)[：:]\s*(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      const day = dateMatch[3].padStart(2, '0');
      publishDate = `${year}-${month}-${day}`;
    }
  }

  const info: XiaoyuzhouPodcastInfo = {
    title,
    podcastName,
    host,
    duration,
    publishDate,
    description,
    thumbnail,
    episodeId,
  };

  logger.info(`[小宇宙] 播客信息: ${info.title} | ${info.podcastName} | ${info.host} | ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
  
  return info;
}

/**
 * 构建音频下载 URL（域名替换法）
 */
function buildAudioDownloadUrl(url: string): string {
  // 提取单集 ID
  const episodeId = extractEpisodeId(url);
  if (!episodeId) {
    throw new Error('无法从 URL 中提取单集 ID');
  }

  // 域名替换：xiaoyuzhoufm.com → xiaoyuzhoufm.xlab.app
  const downloadUrl = url
    .replace(/xiaoyuzhoufm\.com/g, 'xiaoyuzhoufm.xlab.app')
    .replace(/\/episode\/[^\/]+$/, `/episode/${episodeId}.mp3`);

  logger.debug(`[小宇宙] 音频下载 URL: ${downloadUrl}`);
  return downloadUrl;
}

/**
 * 下载音频
 */
async function downloadAudio(
  url: string,
  info: XiaoyuzhouPodcastInfo
): Promise<string> {
  logger.info(`[小宇宙] 开始下载音频: ${info.title}`);

  try {
    // 构建下载 URL
    const audioUrl = buildAudioDownloadUrl(url);

    // 使用 media-downloader 下载
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

    logger.info(`[小宇宙] 音频下载完成: ${result.filePath}`);
    return result.filePath;
  } catch (error: any) {
    // 如果域名替换方法失败，记录错误
    logger.error(`[小宇宙] 音频下载失败: ${error.message}`);
    throw error;
  }
}

/**
 * 从小宇宙链接获取播客信息和下载（主入口）
 * 
 * @param url 小宇宙播客链接
 * @param options 提取选项
 * @returns 提取结果
 */
export async function fetchXiaoyuzhouPodcast(
  url: string,
  options: FetchOptions = {}
): Promise<XiaoyuzhouPodcastResult> {
  logger.info(`[小宇宙] 开始处理播客: ${url}`);

  try {
    // 1. 验证 URL
    if (!isValidXiaoyuzhouUrl(url)) {
      return {
        success: false,
        error: 'URL 无效：不是有效的小宇宙播客链接',
      };
    }

    // 2. 获取页面 HTML
    logger.info(`[小宇宙] 获取播客页面: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 30000, // 30秒超时
      validateStatus: (status) => status < 500, // 允许 4xx 状态码
    });

    if (response.status === 404) {
      return {
        success: false,
        error: '播客不存在或已删除',
      };
    }

    if (response.status !== 200) {
      return {
        success: false,
        error: `获取播客页面失败 (HTTP ${response.status})`,
      };
    }

    const html = response.data;
    if (!html || typeof html !== 'string') {
      return {
        success: false,
        error: '获取的页面内容无效',
      };
    }

    // 3. 提取播客信息
    const info = extractPodcastInfo(html, url);

    // 4. 检查时长限制
    const maxDurationMinutes = videoConfig.maxAudioDurationMinutes;
    if (info.duration > 0 && info.duration / 60 > maxDurationMinutes) {
      logger.warn(`[小宇宙] 播客时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`);
      return {
        success: false,
        info,
        error: `播客时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`,
      };
    }

    const result: XiaoyuzhouPodcastResult = {
      success: true,
      info,
    };

    // 5. 下载音频（如果需要）
    if (options.downloadAudio) {
      try {
        const audioPath = await downloadAudio(url, info);
        result.audioPath = audioPath;
      } catch (error: any) {
        logger.error(`[小宇宙] 音频下载失败: ${error.message}`);
        return {
          success: false,
          info,
          error: `音频下载失败: ${error.message}`,
        };
      }
    }

    logger.info(`[小宇宙] 处理完成: ${info.title}`);
    return result;

  } catch (error: any) {
    logger.error(`[小宇宙] 处理失败: ${error.message}`);
    
    // 解析常见错误
    let errorMessage = error.message;
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = '网络连接失败，请检查网络连接';
    } else if (error.response?.status === 404) {
      errorMessage = '播客不存在或已删除';
    } else if (error.response?.status === 403) {
      errorMessage = '访问被拒绝，可能需要登录或验证';
    } else if (error.message.includes('timeout')) {
      errorMessage = '请求超时，请稍后重试';
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
export function cleanupFiles(result: XiaoyuzhouPodcastResult): void {
  const filesToClean = [result.audioPath].filter(Boolean) as string[];
  
  if (filesToClean.length > 0) {
    logger.info(`[小宇宙] 清理 ${filesToClean.length} 个文件`);
    mediaDownloader.cleanupFiles(filesToClean);
  }
}
