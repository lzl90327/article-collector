/**
 * 喜马拉雅播客信息提取和下载服务
 * 
 * 支持功能：
 * - 播客元信息提取（标题、专辑名称、主播、时长、发布时间等）
 * - 音频下载（通过 yt-dlp 或页面解析）
 * - 短链自动展开
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';
import { mediaDownloader } from './media-downloader';
import { extractXimalayaAudioId } from '../utils/url-parser';

/**
 * 喜马拉雅播客信息
 */
export interface XimalayaPodcastInfo {
  /** 标题 */
  title: string;
  /** 专辑名称 */
  albumName: string;
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
  /** 音频 ID */
  soundId: string;
  /** 播放数（可选） */
  playCount?: number;
}

/**
 * 提取结果
 */
export interface XimalayaPodcastResult {
  /** 是否成功 */
  success: boolean;
  /** 播客信息 */
  info?: XimalayaPodcastInfo;
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
 * 验证喜马拉雅 URL
 */
function isValidXimalayaUrl(url: string): boolean {
  return /ximalaya\.com/.test(url);
}

/**
 * 提取音频 ID
 */
function extractSoundId(url: string): string | null {
  return extractXimalayaAudioId(url);
}

/**
 * 使用 yt-dlp 提取播客信息（优先方案）
 */
async function extractPodcastInfoWithYtDlp(url: string): Promise<XimalayaPodcastInfo | null> {
  logger.info(`[喜马拉雅] 尝试使用 yt-dlp 提取信息: ${url}`);

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--skip-download',
      url,
    ];

    logger.debug(`[喜马拉雅] 执行命令: ${videoConfig.ytDlpPath} ${args.join(' ')}`);

    const ytdlp = spawn(videoConfig.ytDlpPath, args);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        // yt-dlp 不支持或失败，返回 null 让调用方尝试其他方案
        logger.debug(`[喜马拉雅] yt-dlp 不支持或失败 (code ${code})`);
        resolve(null);
        return;
      }

      try {
        const jsonData = JSON.parse(stdout);
        logger.debug(`[喜马拉雅] yt-dlp 成功解析播客信息`);

        const soundId = extractSoundId(url) || jsonData.id || '';
        
        const info: XimalayaPodcastInfo = {
          title: jsonData.title || '无标题',
          albumName: jsonData.album || jsonData.series || jsonData.channel || '未知专辑',
          host: jsonData.uploader || jsonData.artist || jsonData.creator || '未知主播',
          duration: Math.round(jsonData.duration || 0),
          publishDate: jsonData.upload_date 
            ? `${jsonData.upload_date.substring(0, 4)}-${jsonData.upload_date.substring(4, 6)}-${jsonData.upload_date.substring(6, 8)}`
            : new Date().toISOString().split('T')[0],
          description: jsonData.description || jsonData.info || '',
          thumbnail: jsonData.thumbnail || jsonData.cover || '',
          soundId,
          playCount: jsonData.view_count || jsonData.play_count,
        };

        logger.info(`[喜马拉雅] 播客信息: ${info.title} by ${info.host} (${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')})`);
        resolve(info);
      } catch (error: any) {
        logger.debug(`[喜马拉雅] yt-dlp 解析失败: ${error.message}`);
        resolve(null);
      }
    });

    ytdlp.on('error', (error) => {
      logger.debug(`[喜马拉雅] yt-dlp 进程错误: ${error.message}`);
      resolve(null);
    });
  });
}

/**
 * 从页面 HTML 提取播客信息（备用方案）
 */
async function extractPodcastInfoFromPage(url: string): Promise<XimalayaPodcastInfo> {
  logger.info(`[喜马拉雅] 从页面提取信息: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = response.data;
    const soundId = extractSoundId(url) || '';

    // 提取标题（从 <title> 标签或 JSON-LD）
    let title = '无标题';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/-.*$/, '').trim();
    }

    // 尝试从 JSON-LD 提取信息
    let albumName = '未知专辑';
    let host = '未知主播';
    let description = '';
    let thumbnail = '';
    let duration = 0;
    let publishDate = new Date().toISOString().split('T')[0];
    let playCount: number | undefined;

    // 查找 JSON-LD 数据
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd['@type'] === 'AudioObject' || jsonLd['@type'] === 'PodcastEpisode') {
          title = jsonLd.name || title;
          description = jsonLd.description || '';
          thumbnail = jsonLd.image || '';
          if (jsonLd.duration) {
            // ISO 8601 格式 (PT1H30M) 转秒数
            const durationMatch = jsonLd.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (durationMatch) {
              const hours = parseInt(durationMatch[1] || '0', 10);
              const minutes = parseInt(durationMatch[2] || '0', 10);
              const seconds = parseInt(durationMatch[3] || '0', 10);
              duration = hours * 3600 + minutes * 60 + seconds;
            }
          }
        }
      } catch (e) {
        logger.debug(`[喜马拉雅] JSON-LD 解析失败: ${e}`);
      }
    }

    // 从页面中的 JavaScript 变量提取信息
    // 喜马拉雅通常在页面中嵌入 JSON 数据
    const pageDataMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (pageDataMatch) {
      try {
        const pageData = JSON.parse(pageDataMatch[1]);
        // 根据实际页面结构调整路径
        const soundInfo = pageData?.sound || pageData?.trackInfo || pageData?.currentTrack;
        if (soundInfo) {
          title = soundInfo.title || soundInfo.trackTitle || title;
          albumName = soundInfo.albumTitle || soundInfo.albumName || soundInfo.categoryName || albumName;
          host = soundInfo.nickname || soundInfo.anchorName || soundInfo.anchor || host;
          description = soundInfo.intro || soundInfo.description || description;
          thumbnail = soundInfo.cover || soundInfo.coverUrl || soundInfo.coverPath || thumbnail;
          duration = soundInfo.duration || soundInfo.playTime || duration;
          playCount = soundInfo.playCount || soundInfo.playTimes;
          
          if (soundInfo.createDateFormat || soundInfo.publishTime) {
            const dateStr = soundInfo.createDateFormat || soundInfo.publishTime;
            if (dateStr) {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                publishDate = date.toISOString().split('T')[0];
              }
            }
          }
        }
      } catch (e) {
        logger.debug(`[喜马拉雅] 页面数据解析失败: ${e}`);
      }
    }

    // 如果时长仍为 0，尝试从其他位置提取
    if (duration === 0) {
      const durationMatch = html.match(/"duration["']?\s*:\s*(\d+)/i);
      if (durationMatch) {
        duration = parseInt(durationMatch[1], 10);
      }
    }

    // 如果封面仍为空，尝试从 meta 标签提取
    if (!thumbnail) {
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      if (ogImageMatch) {
        thumbnail = ogImageMatch[1];
      }
    }

    const info: XimalayaPodcastInfo = {
      title,
      albumName,
      host,
      duration,
      publishDate,
      description,
      thumbnail,
      soundId,
      playCount,
    };

    logger.info(`[喜马拉雅] 播客信息: ${info.title} by ${info.host} (${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')})`);
    return info;

  } catch (error: any) {
    logger.error(`[喜马拉雅] 页面提取失败: ${error.message}`);
    throw new Error(`页面提取失败: ${error.message}`);
  }
}

/**
 * 提取播客信息（主函数）
 */
async function extractPodcastInfo(url: string): Promise<XimalayaPodcastInfo> {
  // 优先尝试 yt-dlp
  const ytDlpInfo = await extractPodcastInfoWithYtDlp(url);
  if (ytDlpInfo) {
    return ytDlpInfo;
  }

  // 如果 yt-dlp 不支持，使用页面解析
  logger.info(`[喜马拉雅] yt-dlp 不支持，使用页面解析`);
  return extractPodcastInfoFromPage(url);
}

/**
 * 使用 yt-dlp 下载音频
 */
async function downloadAudioWithYtDlp(
  url: string,
  info: XimalayaPodcastInfo
): Promise<string> {
  logger.info(`[喜马拉雅] 使用 yt-dlp 下载音频: ${info.title}`);

  const tempDir = mediaDownloader.getTempDir();
  const safeTitle = info.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  const outputTemplate = path.join(tempDir, `${safeTitle}_${Date.now()}.%(ext)s`);

  return new Promise((resolve, reject) => {
    const args = [
      '--format', 'bestaudio',
      '--extract-audio',
      '--audio-format', 'wav',
      '--output', outputTemplate,
      '--no-playlist',
    ];

    // 文件大小限制
    if (videoConfig.maxVideoSizeMB) {
      args.push('--max-filesize', `${videoConfig.maxVideoSizeMB}M`);
    }

    args.push(url);

    logger.debug(`[喜马拉雅] 下载命令: ${videoConfig.ytDlpPath} ${args.join(' ')}`);

    const ytdlp = spawn(videoConfig.ytDlpPath, args);

    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('%') || output.includes('Downloading')) {
        logger.debug(`[喜马拉雅] ${output.trim()}`);
      }
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[喜马拉雅] 音频下载失败 (code ${code})`);
        logger.debug(`[喜马拉雅] stderr: ${stderr}`);
        reject(new Error(`音频下载失败: ${stderr.substring(0, 200)}`));
        return;
      }

      // 查找下载的文件
      const audioFile = outputTemplate.replace('.%(ext)s', '.wav');
      if (fs.existsSync(audioFile)) {
        const stats = fs.statSync(audioFile);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        logger.info(`[喜马拉雅] 音频下载完成: ${audioFile} (${sizeMB}MB)`);
        resolve(audioFile);
      } else {
        // 尝试查找其他可能的文件名
        const dir = path.dirname(outputTemplate);
        const basename = path.basename(outputTemplate).replace('.%(ext)s', '');
        const files = fs.readdirSync(dir).filter(f => f.startsWith(basename) && f.endsWith('.wav'));
        
        if (files.length > 0) {
          const foundFile = path.join(dir, files[0]);
          logger.info(`[喜马拉雅] 音频下载完成: ${foundFile}`);
          resolve(foundFile);
        } else {
          reject(new Error('音频下载完成但未找到文件'));
        }
      }
    });

    ytdlp.on('error', (error) => {
      logger.error(`[喜马拉雅] 下载进程错误: ${error.message}`);
      reject(new Error(`yt-dlp 执行失败: ${error.message}`));
    });
  });
}

/**
 * 从页面提取音频链接并下载（备用方案）
 * TODO: 需要进一步研究喜马拉雅的音频链接获取方式
 */
async function downloadAudioFromPage(
  url: string,
  info: XimalayaPodcastInfo
): Promise<string> {
  logger.info(`[喜马拉雅] 尝试从页面提取音频链接: ${info.title}`);
  
  // 喜马拉雅的音频链接通常需要 API 调用或特殊处理
  // 这里先尝试使用 yt-dlp，如果失败则抛出错误
  throw new Error('页面音频下载暂未实现，请使用 yt-dlp 或配置 API');
}

/**
 * 下载音频
 */
async function downloadAudio(
  url: string,
  info: XimalayaPodcastInfo
): Promise<string> {
  try {
    // 优先使用 yt-dlp
    return await downloadAudioWithYtDlp(url, info);
  } catch (error: any) {
    logger.warn(`[喜马拉雅] yt-dlp 下载失败: ${error.message}`);
    logger.info(`[喜马拉雅] 尝试备用方案`);
    
    // 尝试备用方案
    try {
      return await downloadAudioFromPage(url, info);
    } catch (fallbackError: any) {
      logger.error(`[喜马拉雅] 备用方案也失败: ${fallbackError.message}`);
      throw new Error(`音频下载失败: ${error.message}`);
    }
  }
}

/**
 * 从喜马拉雅链接获取播客信息和下载（主入口）
 * 
 * @param url 喜马拉雅播客链接
 * @param options 提取选项
 * @returns 提取结果
 */
export async function fetchXimalayaPodcast(
  url: string,
  options: FetchOptions = {}
): Promise<XimalayaPodcastResult> {
  logger.info(`[喜马拉雅] 开始处理播客: ${url}`);

  try {
    // 1. 验证 URL
    if (!isValidXimalayaUrl(url)) {
      return {
        success: false,
        error: 'URL 无效：不是有效的喜马拉雅链接',
      };
    }

    // 2. 提取音频 ID
    const soundId = extractSoundId(url);
    if (!soundId) {
      return {
        success: false,
        error: '无法从 URL 中提取音频 ID',
      };
    }

    // 3. 提取播客信息
    const info = await extractPodcastInfo(url);

    // 4. 检查时长限制
    const maxDurationMinutes = videoConfig.maxAudioDurationMinutes;
    if (info.duration / 60 > maxDurationMinutes) {
      logger.warn(`[喜马拉雅] 播客时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`);
      return {
        success: false,
        info,
        error: `播客时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`,
      };
    }

    const result: XimalayaPodcastResult = {
      success: true,
      info,
    };

    // 5. 下载音频（如果需要）
    if (options.downloadAudio) {
      try {
        const audioPath = await downloadAudio(url, info);
        result.audioPath = audioPath;
      } catch (error: any) {
        logger.error(`[喜马拉雅] 音频下载失败: ${error.message}`);
        return {
          success: false,
          info,
          error: `音频下载失败: ${error.message}`,
        };
      }
    }

    logger.info(`[喜马拉雅] 处理完成: ${info.title}`);
    return result;

  } catch (error: any) {
    logger.error(`[喜马拉雅] 处理失败: ${error.message}`);
    
    // 解析常见错误
    let errorMessage = error.message;
    if (errorMessage.includes('不存在') || errorMessage.includes('已删除')) {
      errorMessage = '播客不存在或已删除';
    } else if (errorMessage.includes('HTTP Error 404')) {
      errorMessage = '播客不存在';
    } else if (errorMessage.includes('HTTP Error 403')) {
      errorMessage = '访问被拒绝，可能需要登录或 Cookie';
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
export function cleanupFiles(result: XimalayaPodcastResult): void {
  const filesToClean = [result.audioPath].filter(Boolean) as string[];
  
  if (filesToClean.length > 0) {
    logger.info(`[喜马拉雅] 清理 ${filesToClean.length} 个文件`);
    mediaDownloader.cleanupFiles(filesToClean);
  }
}
