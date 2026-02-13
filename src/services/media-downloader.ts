/**
 * 媒体下载管理器
 * 
 * 统一管理视频和音频文件的下载、转换和清理
 * 支持：
 * - 临时文件管理
 * - 下载进度监控
 * - 格式转换
 * - 自动清理
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import axios from 'axios';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';

// 尝试加载 ffmpeg-static
let staticFfmpegPath: string | null = null;
try {
  staticFfmpegPath = require('ffmpeg-static');
} catch (e) {
  // 忽略错误，可能未安装或环境不支持
}

// 尝试加载 ffprobe-static
let staticFfprobePath: string | null = null;
try {
  const ffprobeStatic = require('ffprobe-static');
  staticFfprobePath = ffprobeStatic.path;
} catch (e) {
  // 忽略错误
}

/**
 * 获取 ffmpeg 可执行文件路径
 * 优先级: config > ffmpeg-static > 系统路径
 */
function getFfmpegPath(): string {
  if (videoConfig.ffmpegPath && videoConfig.ffmpegPath !== 'ffmpeg') {
    return videoConfig.ffmpegPath;
  }
  if (staticFfmpegPath) {
    return staticFfmpegPath;
  }
  return 'ffmpeg';
}

/**
 * 获取 ffprobe 可执行文件路径
 */
function getFfprobePath(): string {
  if (staticFfprobePath) {
    return staticFfprobePath;
  }
  
  const ffmpeg = getFfmpegPath();
  if (ffmpeg === 'ffmpeg') return 'ffprobe';
  
  // 尝试在同目录下找 ffprobe
  const dir = path.dirname(ffmpeg);
  const ffprobe = path.join(dir, 'ffprobe');
  if (fs.existsSync(ffprobe)) {
    return ffprobe;
  }
  return 'ffprobe';
}

/**
 * 媒体类型
 */
export type MediaType = 'video' | 'audio';

/**
 * 下载结果
 */
export interface DownloadResult {
  /** 是否成功 */
  success: boolean;
  /** 本地文件路径 */
  filePath?: string;
  /** 文件大小（字节） */
  fileSize?: number;
  /** 时长（秒） */
  duration?: number;
  /** 格式 */
  format?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 下载选项
 */
export interface DownloadOptions {
  /** 媒体类型 */
  type: MediaType;
  /** 保存的文件名（不含扩展名） */
  filename?: string;
  /** 最大大小（MB） */
  maxSizeMB?: number;
  /** 最大时长（分钟） */
  maxDurationMinutes?: number;
  /** 格式转换目标 */
  convertTo?: string;
}

/**
 * 媒体下载管理器类
 */
export class MediaDownloader {
  private tempDir: string;

  constructor() {
    // 使用项目特定的临时目录
    this.tempDir = path.join(os.tmpdir(), 'article-collector-media');
    this.ensureTempDir();
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      logger.info(`创建临时目录: ${this.tempDir}`);
    }
  }

  /**
   * 生成临时文件路径
   */
  private getTempFilePath(filename: string, extension: string): string {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    return path.join(this.tempDir, `${safeFilename}_${timestamp}.${extension}`);
  }

  /**
   * 延迟函数（用于重试）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 直接下载文件（HTTP/HTTPS）
   * @param url 文件 URL
   * @param options 下载选项
   */
  async downloadFile(url: string, options: DownloadOptions): Promise<DownloadResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`开始下载 (尝试 ${attempt}/${maxRetries}): ${url}`);

        const filename = options.filename || 'media';
        const extension = options.type === 'video' ? 'mp4' : 'mp3';
        const filePath = this.getTempFilePath(filename, extension);

        const response = await axios.get(url, {
          responseType: 'stream',
          timeout: 300000, // 5分钟超时
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });

        // 检查特定错误码
        if (response.status === 402) {
          throw new Error('付费内容，需要会员权限');
        }
        if (response.status === 403) {
          throw new Error('访问被拒绝，可能需要认证');
        }
        if (response.status === 429) {
          throw new Error('请求过于频繁，已被限流');
        }

        // 检查文件大小
        const contentLength = parseInt(response.headers['content-length'] || '0', 10);
        const sizeMB = contentLength / (1024 * 1024);
        
        const maxSize = options.maxSizeMB || videoConfig.maxVideoSizeMB;
        if (sizeMB > maxSize) {
          throw new Error(`文件过大: ${sizeMB.toFixed(2)}MB (限制: ${maxSize}MB)`);
        }

        logger.info(`文件大小: ${sizeMB.toFixed(2)}MB`);

        // 写入文件
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        logger.info(`下载完成: ${filePath}`);

        // 获取媒体信息
        const duration = await this.getMediaDuration(filePath);
        const fileSize = fs.statSync(filePath).size;

        // 检查时长限制
        const maxDurationMinutes = options.maxDurationMinutes || videoConfig.maxAudioDurationMinutes;
        if (duration && duration / 60 > maxDurationMinutes) {
          // 清理过大文件
          this.cleanupFile(filePath);
          throw new Error(
            `音频时长过长: ${(duration / 60).toFixed(1)}分钟 (限制: ${maxDurationMinutes}分钟)`
          );
        }

        return {
          success: true,
          filePath,
          fileSize,
          duration,
          format: extension,
        };
      } catch (error: any) {
        lastError = error;

        // 特定错误立即抛出，不重试
        if (
          error.message.includes('付费内容') ||
          error.message.includes('访问被拒绝') ||
          error.message.includes('文件过大') ||
          error.message.includes('时长过长')
        ) {
          logger.error(`下载失败（不重试）: ${error.message}`);
          return {
            success: false,
            error: error.message,
          };
        }

        // 重试逻辑
        if (attempt < maxRetries) {
          // 指数退避：1秒、2秒、4秒
          const delay = Math.pow(2, attempt - 1) * 1000;
          logger.warn(`下载失败，${delay / 1000}秒后重试... (${error.message})`);
          await this.sleep(delay);
        } else {
          // 最后一次尝试失败
          logger.error(`下载失败，已达到最大重试次数: ${error.message}`);
        }
      }
    }

    // 所有重试均失败
    return {
      success: false,
      error: lastError?.message || '下载失败',
    };
  }

  /**
   * 从视频提取音频
   * @param videoPath 视频文件路径
   */
  async extractAudio(videoPath: string): Promise<DownloadResult> {
    logger.info(`从视频提取音频: ${videoPath}`);

    if (!fs.existsSync(videoPath)) {
      return {
        success: false,
        error: `视频文件不存在: ${videoPath}`,
      };
    }

    try {
      const audioPath = videoPath.replace(/\.[^.]+$/, '.wav');

      await this.convertMedia(videoPath, audioPath, {
        format: 'wav',
        audioOnly: true,
      });

      const fileSize = fs.statSync(audioPath).size;
      const duration = await this.getMediaDuration(audioPath);

      logger.info(`音频提取完成: ${audioPath}`);

      return {
        success: true,
        filePath: audioPath,
        fileSize,
        duration,
        format: 'wav',
      };
    } catch (error: any) {
      logger.error(`音频提取失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 提取关键帧
   * @param videoPath 视频文件路径
   * @param count 提取数量
   */
  async extractKeyframes(videoPath: string, count: number = 5): Promise<{ path: string; timestamp: number }[]> {
    const duration = await this.getMediaDuration(videoPath) || 60;
    const interval = Math.floor(duration / (count + 1));
    const results: { path: string; timestamp: number }[] = [];

    logger.info(`开始提取关键帧: ${videoPath}, 数量: ${count}, 时长: ${duration}s`);

    for (let i = 1; i <= count; i++) {
      const timestamp = i * interval;
      // 使用更安全的文件名
      const dir = path.dirname(videoPath);
      const name = path.basename(videoPath, path.extname(videoPath));
      const outputPath = path.join(dir, `${name}_kf${i}.jpg`);
      
      try {
        await new Promise<void>((resolve, reject) => {
          const ffmpegCmd = getFfmpegPath();
          const args = [
            '-ss', timestamp.toString(),
            '-i', videoPath,
            '-vframes', '1',
            '-q:v', '2', // 高质量 JPEG
            '-y',
            outputPath
          ];
          
          const ffmpeg = spawn(ffmpegCmd, args);
          ffmpeg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
          });
          ffmpeg.on('error', reject);
        });
        
        if (fs.existsSync(outputPath)) {
          results.push({ path: outputPath, timestamp });
        }
      } catch (e: any) {
        logger.warn(`提取关键帧失败 (${timestamp}s): ${e.message}`);
      }
    }
    
    logger.info(`关键帧提取完成: ${results.length} 张`);
    return results;
  }

  /**
   * 转换媒体格式
   */
  async convertMedia(
    inputPath: string,
    outputPath: string,
    options: {
      format?: string;
      audioOnly?: boolean;
      sampleRate?: number;
      channels?: number;
    } = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['-i', inputPath];

      if (options.audioOnly) {
        args.push('-vn'); // 仅音频
      }

      if (options.sampleRate) {
        args.push('-ar', options.sampleRate.toString());
      }

      if (options.channels) {
        args.push('-ac', options.channels.toString());
      }

      // 覆盖已存在的文件
      args.push('-y', outputPath);

      const ffmpegCmd = getFfmpegPath();
      logger.debug(`ffmpeg 命令: ${ffmpegCmd} ${args.join(' ')}`);

      const ffmpeg = spawn(ffmpegCmd, args);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg 转换失败 (code ${code}): ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 获取媒体时长（秒）
   */
  private async getMediaDuration(filePath: string): Promise<number | undefined> {
    return new Promise((resolve) => {
      const ffprobeCmd = getFfprobePath();
      const ffprobe = spawn(ffprobeCmd, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const duration = parseFloat(output.trim());
          resolve(duration);
        } else {
          logger.warn(`无法获取媒体时长: ${filePath}`);
          resolve(undefined);
        }
      });

      ffprobe.on('error', () => {
        resolve(undefined);
      });
    });
  }

  /**
   * 获取媒体元信息
   */
  async getMediaInfo(filePath: string): Promise<{
    duration?: number;
    format?: string;
    size?: number;
    bitrate?: number;
  }> {
    const duration = await this.getMediaDuration(filePath);
    const stats = fs.statSync(filePath);
    const format = path.extname(filePath).substring(1);

    return {
      duration,
      format,
      size: stats.size,
      bitrate: duration ? Math.floor((stats.size * 8) / duration) : undefined,
    };
  }

  /**
   * 清理单个文件
   */
  cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`清理文件: ${filePath}`);
      }
    } catch (error: any) {
      logger.warn(`清理文件失败: ${error.message}`);
    }
  }

  /**
   * 清理多个文件
   */
  cleanupFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      this.cleanupFile(filePath);
    }
  }

  /**
   * 清理临时目录中的所有文件
   */
  cleanupTempDir(): void {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          fs.unlinkSync(filePath);
        }
        logger.info(`清理临时目录: ${files.length} 个文件`);
      }
    } catch (error: any) {
      logger.warn(`清理临时目录失败: ${error.message}`);
    }
  }

  /**
   * 清理过期文件（超过指定时间）
   */
  cleanupOldFiles(maxAgeHours: number = 24): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return;
      }

      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;
      const files = fs.readdirSync(this.tempDir);
      
      let cleaned = 0;
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`清理过期文件: ${cleaned} 个`);
      }
    } catch (error: any) {
      logger.warn(`清理过期文件失败: ${error.message}`);
    }
  }

  /**
   * 获取临时目录路径
   */
  getTempDir(): string {
    return this.tempDir;
  }

  /**
   * 获取临时目录使用情况
   */
  async getTempDirStats(): Promise<{
    fileCount: number;
    totalSize: number;
    files: Array<{ name: string; size: number; age: number }>;
  }> {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return { fileCount: 0, totalSize: 0, files: [] };
      }

      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      
      let totalSize = 0;
      const fileInfos: Array<{ name: string; size: number; age: number }> = [];

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        totalSize += stats.size;
        fileInfos.push({
          name: file,
          size: stats.size,
          age: Math.floor((now - stats.mtimeMs) / 1000 / 60), // 分钟
        });
      }

      return {
        fileCount: files.length,
        totalSize,
        files: fileInfos,
      };
    } catch (error: any) {
      logger.warn(`获取临时目录统计失败: ${error.message}`);
      return { fileCount: 0, totalSize: 0, files: [] };
    }
  }
}

// 导出单例
export const mediaDownloader = new MediaDownloader();

// 定期清理过期文件（每小时执行一次）
setInterval(() => {
  mediaDownloader.cleanupOldFiles(24);
}, 60 * 60 * 1000);
