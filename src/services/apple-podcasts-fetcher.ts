/**
 * Apple Podcasts 播客信息提取和下载服务
 * 
 * 支持功能：
 * - 播客元信息提取（标题、播客名称、主播、时长、发布时间等）
 * - 音频下载（可能受 Apple 平台限制）
 * - 短链自动展开
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';
import { mediaDownloader } from './media-downloader';
import { rssPodcastFetcher } from './rss-podcast-fetcher';

/**
 * Apple Podcasts 播客信息
 */
export interface ApplePodcastInfo {
  /** 标题 */
  title: string;
  /** 播客名称 */
  podcastName: string;
  /** 主播/嘉宾 */
  host: string;
  /** 音频时长（秒） */
  duration: number;
  /** 发布时间 */
  publishDate: string;
  /** 简介 */
  description: string;
  /** 封面图 URL */
  thumbnail: string;
  /** Episode ID */
  episodeId: string;
  /** Podcast ID */
  podcastId: string;
}

/**
 * 提取结果
 */
export interface ApplePodcastResult {
  /** 是否成功 */
  success: boolean;
  /** 播客信息 */
  info?: ApplePodcastInfo;
  /** 音频文件路径 */
  audioPath?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 提取 Podcast ID 和 Episode ID
 */
function extractIds(url: string): { podcastId: string; episodeId: string } | null {
  // 格式: https://podcasts.apple.com/cn/podcast/name/id123456?i=1000123456
  const podcastMatch = url.match(/\/id(\d+)/);
  const episodeMatch = url.match(/[?&]i=(\d+)/);
  
  if (podcastMatch && episodeMatch) {
    return {
      podcastId: podcastMatch[1],
      episodeId: episodeMatch[1],
    };
  }
  
  return null;
}

/**
 * HTML 实体解码
 */
function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };
  
  return text.replace(/&[a-z0-9#]+;/gi, match => entities[match] || match);
}

/**
 * 从 meta 标签提取内容
 */
function extractMetaContent(html: string, property: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return '';
}

/**
 * 从 JSON-LD 提取结构化数据
 */
function extractJsonLd(html: string): any {
  const scriptMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    try {
      return JSON.parse(scriptMatch[1]);
    } catch (error) {
      logger.debug('[Apple Podcasts] JSON-LD 解析失败');
    }
  }
  return null;
}

/**
 * 解析时长字符串
 * 支持格式：
 * - "2 小时 35 分钟"
 * - "1:30:15"
 * - "PT2H35M"
 */
function parseDuration(durationStr: string): number {
  // 中文格式：2 小时 35 分钟
  const chineseMatch = durationStr.match(/(?:(\d+)\s*小时)?(?:\s*(\d+)\s*分钟)?/);
  if (chineseMatch && (chineseMatch[1] || chineseMatch[2])) {
    const hours = parseInt(chineseMatch[1] || '0', 10);
    const minutes = parseInt(chineseMatch[2] || '0', 10);
    return hours * 3600 + minutes * 60;
  }
  
  // ISO 8601 格式：PT2H35M15S
  const isoMatch = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] || '0', 10);
    const minutes = parseInt(isoMatch[2] || '0', 10);
    const seconds = parseInt(isoMatch[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // 时间格式：1:30:15 或 30:15
  const timeMatch = durationStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hours = timeMatch[3] ? parseInt(timeMatch[1], 10) : 0;
    const minutes = timeMatch[3] ? parseInt(timeMatch[2], 10) : parseInt(timeMatch[1], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : parseInt(timeMatch[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  return 0;
}

/**
 * 从 HTML 中提取播客信息
 */
function extractPodcastInfo(html: string, url: string): ApplePodcastInfo {
  logger.info(`[Apple Podcasts] 解析播客页面信息`);
  
  const ids = extractIds(url);
  const podcastId = ids?.podcastId || '';
  const episodeId = ids?.episodeId || '';
  
  // 提取标题
  let title = extractMetaContent(html, 'og:title');
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // 移除 "- Apple 播客" 等后缀
      title = title.replace(/\s*[-–—]\s*Apple\s*播客.*$/i, '').trim();
    }
  }
  
  // 提取描述
  let description = extractMetaContent(html, 'og:description');
  if (!description) {
    description = extractMetaContent(html, 'description');
  }
  
  // 提取封面图
  let thumbnail = extractMetaContent(html, 'og:image');
  if (!thumbnail) {
    thumbnail = extractMetaContent(html, 'twitter:image');
  }
  
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
      host = jsonLd.author?.name || jsonLd.creator?.name || jsonLd.actor?.name || host;
      
      // 提取时长
      if (jsonLd.duration) {
        if (typeof jsonLd.duration === 'number') {
          duration = Math.round(jsonLd.duration);
        } else if (typeof jsonLd.duration === 'string') {
          duration = parseDuration(jsonLd.duration);
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
  
  // Fallback: 从 HTML 中提取播客名称
  if (podcastName === '未知播客') {
    // 尝试从 URL 路径提取
    const pathMatch = url.match(/\/podcast\/([^/]+)\//);
    if (pathMatch) {
      podcastName = decodeURIComponent(pathMatch[1]).replace(/[-_]/g, ' ');
    }
    
    // 或从 og:site_name 提取
    const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    if (siteNameMatch) {
      podcastName = siteNameMatch[1];
    }
  }
  
  // Fallback: 从网页文本提取主播
  if (host === '未知主播') {
    const hostPatterns = [
      /(?:主播|主持人|嘉宾)[：:]\s*([^<\n,，]+)/i,
      /(?:导游|主持)[：:]\s*([^<\n,，]+)/i,
      /<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i,
    ];
    
    for (const pattern of hostPatterns) {
      const hostMatch = html.match(pattern);
      if (hostMatch && hostMatch[1]) {
        host = hostMatch[1].trim();
        logger.debug(`[Apple Podcasts] 从网页文本提取主播: ${host}`);
        break;
      }
    }
  }
  
  // Fallback: 从网页文本提取时长
  if (duration === 0) {
    // 方法1: "2 小时 35 分钟" 格式
    const durationPatterns = [
      /(?:时长|长度)[：:]\s*([^<\n]+)/i,
      /(\d+\s*小时\s*\d+\s*分钟)/,
      /(\d+\s*分钟)/,
    ];
    
    for (const pattern of durationPatterns) {
      const durationMatch = html.match(pattern);
      if (durationMatch && durationMatch[1]) {
        duration = parseDuration(durationMatch[1]);
        if (duration > 0) {
          logger.debug(`[Apple Podcasts] 从网页文本提取时长: ${durationMatch[1]}`);
          break;
        }
      }
    }
  }
  
  const info: ApplePodcastInfo = {
    title: decodeHtmlEntities(title || '无标题'),
    podcastName: decodeHtmlEntities(podcastName),
    host: decodeHtmlEntities(host),
    duration,
    publishDate,
    description: decodeHtmlEntities(description || ''),
    thumbnail: thumbnail || '',
    episodeId,
    podcastId,
  };
  
  logger.info(`[Apple Podcasts] 播客信息: ${info.title} | ${info.podcastName} | ${info.host} | ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
  
  return info;
}

/**
 * 从 iTunes API 获取 RSS Feed URL
 */
async function getRSSFeedUrl(podcastId: string): Promise<string | null> {
  try {
    logger.info(`[Apple Podcasts] 查询 iTunes API 获取 RSS Feed: ${podcastId}`);
    
    // 尝试多个地区的 iTunes API
    const regions = ['cn', 'us'];
    
    for (const region of regions) {
      try {
        const itunesApiUrl = `https://itunes.apple.com/${region}/lookup?id=${podcastId}&entity=podcast`;
        const response = await axios.get(itunesApiUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });
        
        if (response.data && response.data.results && response.data.results.length > 0) {
          const feedUrl = response.data.results[0].feedUrl;
          if (feedUrl) {
            logger.info(`[Apple Podcasts] 成功获取 RSS Feed URL (${region}): ${feedUrl}`);
            return feedUrl;
          }
        }
      } catch (error) {
        logger.debug(`[Apple Podcasts] iTunes API ${region} 区域查询失败`);
      }
    }
    
    logger.warn(`[Apple Podcasts] iTunes API 未返回 RSS Feed URL`);
    return null;
  } catch (error: any) {
    logger.error(`[Apple Podcasts] iTunes API 查询失败: ${error.message}`);
    return null;
  }
}

/**
 * 从播客主页查找 RSS Feed URL
 */
async function discoverRSSFromPodcastPage(podcastId: string): Promise<string | null> {
  try {
    logger.info(`[Apple Podcasts] 尝试从播客主页发现 RSS Feed`);
    
    const podcastUrl = `https://podcasts.apple.com/cn/podcast/id${podcastId}`;
    const response = await axios.get(podcastUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    
    const html = response.data;
    
    // 查找 RSS Feed 链接
    const rssFeedPatterns = [
      /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i,
      /"feedUrl"\s*:\s*"([^"]+)"/,
      /href=["']([^"']*feed[^"']*\.xml)["']/i,
    ];
    
    for (const pattern of rssFeedPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const rssUrl = match[1];
        logger.info(`[Apple Podcasts] 发现 RSS Feed: ${rssUrl}`);
        return rssUrl;
      }
    }
    
    logger.warn(`[Apple Podcasts] 未在播客主页中发现 RSS Feed`);
    return null;
  } catch (error: any) {
    logger.error(`[Apple Podcasts] 从播客主页发现 RSS Feed 失败: ${error.message}`);
    return null;
  }
}

/**
 * 通过 RSS Feed 下载音频
 */
async function downloadAudioViaRSS(
  podcastId: string,
  episodeId: string,
  info: ApplePodcastInfo
): Promise<string> {
  logger.info(`[Apple Podcasts] 尝试通过 RSS Feed 下载音频`);
  
  try {
    // 1. 获取 RSS Feed URL (尝试 iTunes API)
    let feedUrl = await getRSSFeedUrl(podcastId);
    
    // 2. 如果 iTunes API 失败，尝试从播客主页发现
    if (!feedUrl) {
      logger.info(`[Apple Podcasts] iTunes API 失败，尝试从播客主页发现 RSS Feed`);
      feedUrl = await discoverRSSFromPodcastPage(podcastId);
    }
    
    if (!feedUrl) {
      throw new Error('无法获取 RSS Feed URL');
    }
    
    // 3. 从 RSS Feed 中查找对应的单集（传递标题用于匹配）
    const episode = await rssPodcastFetcher.findEpisodeById(
      feedUrl, 
      episodeId, 
      info.title // 传递标题用于标题匹配
    );
    
    if (!episode || !episode.audioUrl) {
      throw new Error(`未在 RSS Feed 中找到 Episode ID ${episodeId} 的音频链接`);
    }
    
    logger.info(`[Apple Podcasts] 从 RSS 找到音频链接: ${episode.audioUrl}`);
    logger.info(`[Apple Podcasts] 匹配的单集标题: ${episode.title}`);
    
    // 4. 下载音频
    const result = await mediaDownloader.downloadFile(episode.audioUrl, {
      type: 'audio',
      filename: `apple_podcast_${episodeId}`,
    });
    
    if (!result.success || !result.filePath) {
      throw new Error(result.error || 'RSS 音频下载失败');
    }
    
    logger.info(`[Apple Podcasts] RSS 音频下载完成: ${result.filePath}`);
    return result.filePath;
    
  } catch (error: any) {
    logger.error(`[Apple Podcasts] RSS 音频下载失败: ${error.message}`);
    throw error;
  }
}

/**
 * 下载播客音频
 * 注意：Apple Podcasts 的音频可能需要特殊的访问权限
 */
async function downloadAudio(
  url: string,
  info: ApplePodcastInfo
): Promise<string> {
  logger.info(`[Apple Podcasts] 开始下载音频: ${info.title}`);
  
  // 策略1：尝试通过 RSS Feed 下载（推荐）
  if (info.podcastId && info.episodeId) {
    try {
      logger.info(`[Apple Podcasts] 策略1: 尝试通过 RSS Feed 下载`);
      const audioPath = await downloadAudioViaRSS(info.podcastId, info.episodeId, info);
      return audioPath;
    } catch (error: any) {
      logger.warn(`[Apple Podcasts] RSS Feed 下载失败，尝试其他方式: ${error.message}`);
    }
  }
  
  // 策略2：尝试从网页中提取音频链接（备选）
  try {
    logger.info(`[Apple Podcasts] 策略2: 尝试从网页提取音频链接`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 30000,
    });
    
    const html = response.data;
    
    // 尝试提取音频 URL
    const audioPatterns = [
      /"assetUrl"\s*:\s*"([^"]+\.m4a[^"]*)"/,
      /"url"\s*:\s*"([^"]+\.mp3[^"]*)"/,
      /<audio[^>]*src=["']([^"']+)["']/i,
    ];
    
    let audioUrl = '';
    for (const pattern of audioPatterns) {
      const audioMatch = html.match(pattern);
      if (audioMatch) {
        audioUrl = audioMatch[1];
        logger.debug(`[Apple Podcasts] 找到音频链接: ${audioUrl}`);
        break;
      }
    }
    
    if (!audioUrl) {
      throw new Error('无法从网页中提取音频链接');
    }
    
    // 下载音频
    const result = await mediaDownloader.downloadFile(audioUrl, {
      type: 'audio',
      filename: `apple_podcast_${info.episodeId}`,
    });
    
    if (!result.success || !result.filePath) {
      throw new Error(result.error || '下载失败');
    }
    
    const audioPath = result.filePath;
    
    logger.info(`[Apple Podcasts] 音频下载完成: ${audioPath}`);
    return audioPath;
    
  } catch (error: any) {
    logger.error(`[Apple Podcasts] 所有下载策略均失败`);
    throw new Error(`音频下载失败: ${error.message}。建议：大多数 Apple Podcasts 内容需要通过 RSS Feed 下载，但部分付费内容可能需要 Apple Music 订阅。`);
  }
}

/**
 * 提取并下载 Apple Podcasts 播客
 * 
 * @param url Apple Podcasts URL
 * @param options 选项
 * @returns 提取结果
 */
export async function fetchApplePodcast(
  url: string,
  options: { downloadAudio?: boolean } = {}
): Promise<ApplePodcastResult> {
  const { downloadAudio: shouldDownload = false } = options;
  
  try {
    logger.info(`[Apple Podcasts] 开始处理播客: ${url}`);
    
    // 展开短链
    let finalUrl = url;
    if (url.includes('apple.co') || url.includes('itunes.apple.com')) {
      try {
        const response = await axios.head(url, {
          maxRedirects: 5,
          timeout: 10000,
        });
        finalUrl = response.request.res.responseUrl || url;
        logger.info(`[Apple Podcasts] 短链展开: ${finalUrl}`);
      } catch (error) {
        logger.warn(`[Apple Podcasts] 短链展开失败，使用原始链接`);
      }
    }
    
    // 获取播客页面
    logger.info(`[Apple Podcasts] 获取播客页面: ${finalUrl}`);
    const response = await axios.get(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 30000,
    });
    
    const html = response.data;
    
    // 提取播客信息
    const info = extractPodcastInfo(html, finalUrl);
    
    // 检查时长限制
    const maxDuration = videoConfig.maxAudioDurationMinutes * 60;
    if (info.duration > maxDuration) {
      logger.warn(`[Apple Podcasts] 播客时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${videoConfig.maxAudioDurationMinutes}分钟)`);
      return {
        success: false,
        info,
        error: `播客时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${videoConfig.maxAudioDurationMinutes}分钟)`,
      };
    }
    
    const result: ApplePodcastResult = {
      success: true,
      info,
    };
    
    // 下载音频（如果需要）
    if (shouldDownload) {
      try {
        const audioPath = await downloadAudio(finalUrl, info);
        result.audioPath = audioPath;
      } catch (error: any) {
        logger.error(`[Apple Podcasts] 音频下载失败: ${error.message}`);
        return {
          success: false,
          info,
          error: `音频下载失败: ${error.message}`,
        };
      }
    }
    
    logger.info(`[Apple Podcasts] 处理完成: ${info.title}`);
    return result;
    
  } catch (error: any) {
    logger.error(`[Apple Podcasts] 处理失败: ${error.message}`);
    
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
export function cleanupFiles(result: ApplePodcastResult): void {
  const filesToClean = [result.audioPath].filter(Boolean) as string[];
  
  if (filesToClean.length > 0) {
    logger.info(`[Apple Podcasts] 清理 ${filesToClean.length} 个文件`);
    mediaDownloader.cleanupFiles(filesToClean);
  }
}
