/**
 * 音频分割服务
 * 将长音频分割成多个小段，以便进行转录
 * 支持按时长或文件大小分割
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execSync } from 'child_process';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';

// 尝试加载 ffmpeg-static
let staticFfmpegPath: string | null = null;
try {
  staticFfmpegPath = require('ffmpeg-static');
} catch (e) {
  // 忽略错误
}

/**
 * 检查命令是否存在
 */
function isCommandAvailable(command: string): boolean {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取 ffmpeg 可执行文件路径
 */
function getFfmpegPath(): string {
  // 1. 优先使用配置的路径
  if (videoConfig.ffmpegPath && videoConfig.ffmpegPath !== 'ffmpeg') {
    return videoConfig.ffmpegPath;
  }
  
  // 2. 其次尝试系统安装的 ffmpeg (通常更稳定)
  if (isCommandAvailable('ffmpeg')) {
    return 'ffmpeg';
  }

  // 3. 最后尝试 ffmpeg-static
  if (staticFfmpegPath) {
    return staticFfmpegPath;
  }
  
  return 'ffmpeg';
}

/**
 * 分割选项
 */
export interface SplitOptions {
  /** 每段最大时长（秒），默认 300秒（5分钟） */
  segmentDuration?: number;
  /** 每段最大文件大小（MB），默认 50MB */
  maxSegmentSizeMB?: number;
  /** 输出格式 */
  outputFormat?: string;
  /** 音频总时长（秒），如果提供则优先使用，不通过 ffprobe 获取 */
  totalDuration?: number;
}

/**
 * 分割结果
 */
export interface SplitResult {
  success: boolean;
  segments?: AudioSegment[];
  error?: string;
}

/**
 * 音频分段信息
 */
export interface AudioSegment {
  /** 分段文件路径 */
  filePath: string;
  /** 分段序号 */
  index: number;
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 时长（秒） */
  duration: number;
  /** 文件大小（字节） */
  fileSize: number;
}

/**
 * 获取音频时长（秒）
 * 优先使用 ffprobe，如果不存在则使用 ffmpeg
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  // 首先尝试使用 ffprobe
  try {
    const duration = await getDurationWithFfprobe(audioPath);
    return duration;
  } catch (error) {
    logger.warn('[音频分割] ffprobe 不可用，尝试使用 ffmpeg');
  }

  // 备用方案：使用 ffmpeg
  try {
    const duration = await getDurationWithFfmpeg(audioPath);
    return duration;
  } catch (error) {
    logger.warn('[音频分割] ffmpeg 获取时长失败，使用播客页面时长');
  }

  // 最终备用：返回默认值（从播客页面获取的时长）
  // 这里返回 0，让调用方使用播客页面提供的时长
  return 0;
}

/**
 * 使用 ffprobe 获取时长
 */
async function getDurationWithFfprobe(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration) && duration > 0) {
          resolve(duration);
        } else {
          reject(new Error('无效的音频时长'));
        }
      } else {
        reject(new Error('ffprobe 执行失败'));
      }
    });

    ffprobe.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 使用 ffmpeg 获取时长（备用方案）
 */
async function getDurationWithFfmpeg(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(getFfmpegPath(), [
      '-i', audioPath,
      '-f', 'null',
      '-',
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', () => {
      // 从 stderr 中解析时长
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10);
        const minutes = parseInt(durationMatch[2], 10);
        const seconds = parseFloat(durationMatch[3]);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        resolve(totalSeconds);
      } else {
        reject(new Error('无法从 ffmpeg 输出解析时长'));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 分割音频文件
 * 
 * @param audioPath 音频文件路径
 * @param options 分割选项
 * @returns 分割结果
 */
export async function splitAudio(
  audioPath: string,
  options: SplitOptions = {}
): Promise<SplitResult> {
  const {
    segmentDuration = 300, // 默认5分钟一段
    maxSegmentSizeMB = 50, // 默认50MB
    outputFormat = 'mp3',
    totalDuration: providedDuration,
  } = options;

  logger.info(`[音频分割] 开始分割: ${audioPath}`);

  try {
    // 1. 获取音频总时长
    let totalDuration = providedDuration || 0;
    
    if (totalDuration === 0) {
      // 如果没有提供时长，尝试通过 ffprobe/ffmpeg 获取
      totalDuration = await getAudioDuration(audioPath);
    }
    
    if (totalDuration === 0) {
      return {
        success: false,
        error: '无法获取音频时长，请提供 totalDuration 参数',
      };
    }
    
    logger.info(`[音频分割] 音频总时长: ${totalDuration}秒 (${(totalDuration / 60).toFixed(1)}分钟)`);

    // 2. 计算需要分割成多少段
    const numSegments = Math.ceil(totalDuration / segmentDuration);
    logger.info(`[音频分割] 将分割成 ${numSegments} 段，每段约 ${segmentDuration} 秒`);

    // 3. 创建临时目录
    const tempDir = path.join(os.tmpdir(), 'article-collector-audio-segments');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 4. 分割音频
    const segments: AudioSegment[] = [];
    const baseName = path.basename(audioPath, path.extname(audioPath));

    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, totalDuration);
      const duration = endTime - startTime;

      // 扩展名使用 .m4a
      const segmentFileName = `${baseName}_segment_${String(i + 1).padStart(3, '0')}.m4a`;
      const segmentPath = path.join(tempDir, segmentFileName);

      logger.info(`[音频分割] 分割第 ${i + 1}/${numSegments} 段: ${startTime}s - ${endTime}s`);

      // 使用 ffmpeg 分割
      await splitSegment(audioPath, segmentPath, startTime, duration);

      // 验证文件
      const stats = fs.statSync(segmentPath);
      const sizeMB = stats.size / (1024 * 1024);

      logger.info(`[音频分割] 第 ${i + 1} 段完成: ${sizeMB.toFixed(2)}MB`);

      segments.push({
        filePath: segmentPath,
        index: i,
        startTime,
        endTime,
        duration,
        fileSize: stats.size,
      });
    }

    logger.info(`[音频分割] 分割完成，共 ${segments.length} 段`);

    return {
      success: true,
      segments,
    };

  } catch (error: any) {
    logger.error('[音频分割] 分割失败', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 使用 ffmpeg 分割单个片段
 */
async function splitSegment(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 输出为 M4A 格式 (AAC编码)
    // -ar 16000: 设置采样率为 16kHz
    // -ac 1: 单声道
    // -c:a aac: AAC 编码器
    // -b:a 24k: 低比特率 (足够语音识别)
    const ffmpeg = spawn(getFfmpegPath(), [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'aac',
      '-b:a', '24k',
      '-y', // 覆盖输出文件
      outputPath,
    ]);

    let errorOutput = '';
    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg 分割失败: ${errorOutput}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 清理分割的音频文件
 */
export function cleanupSegments(segments: AudioSegment[]): void {
  for (const segment of segments) {
    try {
      if (fs.existsSync(segment.filePath)) {
        fs.unlinkSync(segment.filePath);
        logger.debug(`[音频分割] 清理分段文件: ${segment.filePath}`);
      }
    } catch (error) {
      logger.warn(`[音频分割] 清理文件失败: ${segment.filePath}`, error);
    }
  }
}

/**
 * 合并转录结果
 */
export function mergeTranscriptions(transcriptions: string[]): string {
  return transcriptions
    .map((text, index) => {
      // 添加段落标记
      const segmentText = text.trim();
      if (!segmentText) return '';
      return `[第 ${index + 1} 部分]\n${segmentText}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
