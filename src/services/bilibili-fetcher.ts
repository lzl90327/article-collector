/**
 * B站视频信息提取和下载服务
 * 
 * 使用 yt-dlp 下载和提取 B站视频信息
 * 支持功能：
 * - 视频元信息提取（标题、作者、时长、发布时间等）
 * - 视频下载
 * - 音频提取
 * - 短链自动展开（b23.tv）
 * - Cookie 认证（高清视频支持）
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';
import { mediaDownloader } from './media-downloader';

/**
 * B站视频信息
 */
export interface BilibiliVideoInfo {
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
  /** 视频 ID (BV号) */
  bvid: string;
  /** 观看数（可选） */
  viewCount?: number;
  /** 点赞数（可选） */
  likeCount?: number;
}

/**
 * 提取结果
 */
export interface BilibiliVideoResult {
  /** 是否成功 */
  success: boolean;
  /** 视频信息 */
  info?: BilibiliVideoInfo;
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
  /** B站 Cookie（用于高清视频） */
  cookie?: string;
}

/**
 * 短链展开
 */
async function expandShortUrl(url: string): Promise<string> {
  // 如果不是短链，直接返回
  if (!url.includes('b23.tv')) {
    return url;
  }

  logger.info(`[B站] 展开短链接: ${url}`);

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
    logger.info(`[B站] 短链接展开为: ${finalUrl}`);
    return finalUrl;
  } catch (error: any) {
    logger.warn(`[B站] 短链接展开失败: ${error.message}`);
    return url;
  }
}

/**
 * 提取 BV 号
 */
function extractBvid(url: string): string | null {
  const bvidMatch = url.match(/BV[a-zA-Z0-9]+/);
  return bvidMatch ? bvidMatch[0] : null;
}

/**
 * 验证 B站 URL
 */
function isValidBilibiliUrl(url: string): boolean {
  return /bilibili\.com|b23\.tv/.test(url);
}

/**
 * 使用 yt-dlp 提取视频信息
 */
async function extractVideoInfo(url: string, cookie?: string): Promise<BilibiliVideoInfo> {
  logger.info(`[B站] 提取视频信息: ${url}`);

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--skip-download',
    ];

    // 添加 Cookie 支持
    if (cookie || videoConfig.bilibiliCookie) {
      const cookieFile = path.join(mediaDownloader.getTempDir(), `bilibili_cookie_${Date.now()}.txt`);
      fs.writeFileSync(cookieFile, cookie || videoConfig.bilibiliCookie);
      args.push('--cookies', cookieFile);
      logger.debug(`[B站] 使用 Cookie 文件: ${cookieFile}`);
    }

    args.push(url);

    logger.debug(`[B站] 执行命令: ${videoConfig.ytDlpPath} ${args.join(' ')}`);

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
        logger.error(`[B站] yt-dlp 执行失败 (code ${code})`);
        logger.debug(`[B站] stderr: ${stderr}`);
        
        // 解析错误信息
        if (stderr.includes('Video unavailable')) {
          reject(new Error('视频不存在或已删除'));
        } else if (stderr.includes('HTTP Error 403')) {
          reject(new Error('访问被拒绝，可能需要 Cookie 认证'));
        } else if (stderr.includes('HTTP Error 404')) {
          reject(new Error('视频不存在'));
        } else {
          reject(new Error(`yt-dlp 执行失败: ${stderr.substring(0, 200)}`));
        }
        return;
      }

      try {
        const jsonData = JSON.parse(stdout);
        logger.debug(`[B站] 成功解析视频信息`);

        const info: BilibiliVideoInfo = {
          title: jsonData.title || '无标题',
          author: jsonData.uploader || jsonData.channel || '未知',
          duration: Math.round(jsonData.duration || 0),
          publishDate: jsonData.upload_date 
            ? `${jsonData.upload_date.substring(0, 4)}-${jsonData.upload_date.substring(4, 6)}-${jsonData.upload_date.substring(6, 8)}`
            : new Date().toISOString().split('T')[0],
          description: jsonData.description || '',
          tags: jsonData.tags || [],
          thumbnail: jsonData.thumbnail || '',
          bvid: extractBvid(url) || jsonData.id || '',
          viewCount: jsonData.view_count,
          likeCount: jsonData.like_count,
        };

        logger.info(`[B站] 视频信息: ${info.title} by ${info.author} (${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')})`);
        resolve(info);
      } catch (error: any) {
        logger.error(`[B站] 解析视频信息失败: ${error.message}`);
        reject(new Error(`解析视频信息失败: ${error.message}`));
      }
    });

    ytdlp.on('error', (error) => {
      logger.error(`[B站] yt-dlp 进程错误: ${error.message}`);
      reject(new Error(`yt-dlp 未找到或执行失败: ${error.message}`));
    });
  });
}

/**
 * 使用 yt-dlp 下载视频
 */
async function downloadVideo(
  url: string,
  info: BilibiliVideoInfo,
  cookie?: string
): Promise<string> {
  logger.info(`[B站] 开始下载视频: ${info.title}`);

  const tempDir = mediaDownloader.getTempDir();
  const safeTitle = info.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  const outputTemplate = path.join(tempDir, `${safeTitle}_${Date.now()}.%(ext)s`);

  return new Promise((resolve, reject) => {
    const args = [
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--output', outputTemplate,
      '--no-playlist',
    ];

    // 添加 Cookie 支持
    if (cookie || videoConfig.bilibiliCookie) {
      const cookieFile = path.join(tempDir, `bilibili_cookie_${Date.now()}.txt`);
      fs.writeFileSync(cookieFile, cookie || videoConfig.bilibiliCookie);
      args.push('--cookies', cookieFile);
    }

    // 文件大小限制
    if (videoConfig.maxVideoSizeMB) {
      args.push('--max-filesize', `${videoConfig.maxVideoSizeMB}M`);
    }

    args.push(url);

    logger.debug(`[B站] 下载命令: ${videoConfig.ytDlpPath} ${args.join(' ')}`);

    const ytdlp = spawn(videoConfig.ytDlpPath, args);

    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      // 只输出进度相关日志（避免刷屏）
      if (output.includes('%') || output.includes('Downloading')) {
        logger.debug(`[B站] ${output.trim()}`);
      }
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[B站] 视频下载失败 (code ${code})`);
        logger.debug(`[B站] stderr: ${stderr}`);
        
        if (stderr.includes('File is larger than max-filesize')) {
          reject(new Error(`视频文件过大 (限制: ${videoConfig.maxVideoSizeMB}MB)`));
        } else if (stderr.includes('HTTP Error 403')) {
          reject(new Error('下载被拒绝，Cookie 可能已过期'));
        } else {
          reject(new Error(`视频下载失败: ${stderr.substring(0, 200)}`));
        }
        return;
      }

      // 查找下载的文件
      const videoFile = outputTemplate.replace('.%(ext)s', '.mp4');
      if (fs.existsSync(videoFile)) {
        const stats = fs.statSync(videoFile);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        logger.info(`[B站] 视频下载完成: ${videoFile} (${sizeMB}MB)`);
        resolve(videoFile);
      } else {
        // 尝试查找其他可能的文件名
        const dir = path.dirname(outputTemplate);
        const basename = path.basename(outputTemplate).replace('.%(ext)s', '');
        const files = fs.readdirSync(dir).filter(f => f.startsWith(basename));
        
        if (files.length > 0) {
          const foundFile = path.join(dir, files[0]);
          logger.info(`[B站] 视频下载完成: ${foundFile}`);
          resolve(foundFile);
        } else {
          reject(new Error('视频下载完成但未找到文件'));
        }
      }
    });

    ytdlp.on('error', (error) => {
      logger.error(`[B站] 下载进程错误: ${error.message}`);
      reject(new Error(`yt-dlp 执行失败: ${error.message}`));
    });
  });
}

/**
 * 提取视频音频
 */
async function extractAudioFromVideo(videoPath: string): Promise<string> {
  logger.info(`[B站] 从视频提取音频: ${videoPath}`);

  const result = await mediaDownloader.extractAudio(videoPath);
  
  if (!result.success || !result.filePath) {
    throw new Error(result.error || '音频提取失败');
  }

  logger.info(`[B站] 音频提取完成: ${result.filePath}`);
  return result.filePath;
}

/**
 * 从 B站链接获取视频信息和下载（主入口）
 * 
 * @param url B站视频链接（支持短链）
 * @param options 提取选项
 * @returns 提取结果
 */
export async function fetchBilibiliVideo(
  url: string,
  options: FetchOptions = {}
): Promise<BilibiliVideoResult> {
  logger.info(`[B站] 开始处理视频: ${url}`);

  try {
    // 1. 验证 URL
    if (!isValidBilibiliUrl(url)) {
      return {
        success: false,
        error: 'URL 无效：不是有效的 B站链接',
      };
    }

    // 2. 展开短链
    const expandedUrl = await expandShortUrl(url);

    // 3. 提取视频信息
    const info = await extractVideoInfo(expandedUrl, options.cookie);

    // 4. 检查时长限制
    const maxDurationMinutes = videoConfig.maxAudioDurationMinutes;
    if (info.duration / 60 > maxDurationMinutes) {
      logger.warn(`[B站] 视频时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`);
      return {
        success: false,
        info,
        error: `视频时长过长: ${(info.duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`,
      };
    }

    const result: BilibiliVideoResult = {
      success: true,
      info,
    };

    // 5. 下载视频（如果需要）
    if (options.downloadVideo) {
      try {
        const videoPath = await downloadVideo(expandedUrl, info, options.cookie);
        result.videoPath = videoPath;
      } catch (error: any) {
        logger.error(`[B站] 视频下载失败: ${error.message}`);
        return {
          success: false,
          info,
          error: `视频下载失败: ${error.message}`,
        };
      }
    }

    // 6. 提取音频（如果需要）
    if (options.extractAudio) {
      if (result.videoPath) {
        // 如果已下载视频，从视频中提取音频
        try {
          const audioPath = await extractAudioFromVideo(result.videoPath);
          result.audioPath = audioPath;
        } catch (error: any) {
          logger.error(`[B站] 音频提取失败: ${error.message}`);
          // 音频提取失败不影响整体成功（视频已下载）
          logger.warn(`[B站] 继续处理，但音频提取失败`);
        }
      } else {
        // 如果没下载视频，直接下载音频
        logger.info(`[B站] 直接下载音频`);
        try {
          const audioPath = await downloadAudio(expandedUrl, info, options.cookie);
          result.audioPath = audioPath;
        } catch (error: any) {
          logger.error(`[B站] 音频下载失败: ${error.message}`);
          return {
            success: false,
            info,
            error: `音频下载失败: ${error.message}`,
          };
        }
      }
    }

    logger.info(`[B站] 处理完成: ${info.title}`);
    return result;

  } catch (error: any) {
    logger.error(`[B站] 处理失败: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 直接下载音频（仅音频）
 */
async function downloadAudio(
  url: string,
  info: BilibiliVideoInfo,
  cookie?: string
): Promise<string> {
  logger.info(`[B站] 开始下载音频: ${info.title}`);

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

    // 添加 Cookie 支持
    if (cookie || videoConfig.bilibiliCookie) {
      const cookieFile = path.join(tempDir, `bilibili_cookie_${Date.now()}.txt`);
      fs.writeFileSync(cookieFile, cookie || videoConfig.bilibiliCookie);
      args.push('--cookies', cookieFile);
    }

    args.push(url);

    logger.debug(`[B站] 下载命令: ${videoConfig.ytDlpPath} ${args.join(' ')}`);

    const ytdlp = spawn(videoConfig.ytDlpPath, args);

    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('%') || output.includes('Downloading')) {
        logger.debug(`[B站] ${output.trim()}`);
      }
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[B站] 音频下载失败 (code ${code})`);
        logger.debug(`[B站] stderr: ${stderr}`);
        reject(new Error(`音频下载失败: ${stderr.substring(0, 200)}`));
        return;
      }

      // 查找下载的文件
      const audioFile = outputTemplate.replace('.%(ext)s', '.wav');
      if (fs.existsSync(audioFile)) {
        const stats = fs.statSync(audioFile);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        logger.info(`[B站] 音频下载完成: ${audioFile} (${sizeMB}MB)`);
        resolve(audioFile);
      } else {
        // 尝试查找其他可能的文件名
        const dir = path.dirname(outputTemplate);
        const basename = path.basename(outputTemplate).replace('.%(ext)s', '');
        const files = fs.readdirSync(dir).filter(f => f.startsWith(basename) && f.endsWith('.wav'));
        
        if (files.length > 0) {
          const foundFile = path.join(dir, files[0]);
          logger.info(`[B站] 音频下载完成: ${foundFile}`);
          resolve(foundFile);
        } else {
          reject(new Error('音频下载完成但未找到文件'));
        }
      }
    });

    ytdlp.on('error', (error) => {
      logger.error(`[B站] 下载进程错误: ${error.message}`);
      reject(new Error(`yt-dlp 执行失败: ${error.message}`));
    });
  });
}

/**
 * 清理下载的文件
 */
export function cleanupFiles(result: BilibiliVideoResult): void {
  const filesToClean = [result.videoPath, result.audioPath].filter(Boolean) as string[];
  
  if (filesToClean.length > 0) {
    logger.info(`[B站] 清理 ${filesToClean.length} 个文件`);
    mediaDownloader.cleanupFiles(filesToClean);
  }
}
