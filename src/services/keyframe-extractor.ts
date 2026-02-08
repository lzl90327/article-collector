/**
 * 视频关键帧提取服务
 * 
 * 使用 FFmpeg 的场景检测功能提取关键帧
 * 适合 PPT/演讲类视频的幻灯片提取
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';

/**
 * 关键帧提取选项
 */
export interface KeyframeExtractionOptions {
  /** 场景检测阈值 (0.0-1.0)，默认 0.2 */
  sceneThreshold?: number;
  /** 最大帧数限制，默认 50 */
  maxFrames?: number;
  /** 输出格式，默认 jpg */
  format?: 'jpg' | 'png';
  /** 输出质量 (1-100)，默认 85 */
  quality?: number;
  /** FFmpeg 可执行文件路径，默认 'ffmpeg' */
  ffmpegPath?: string;
}

/**
 * 关键帧信息
 */
export interface KeyframeInfo {
  /** 图片路径 */
  path: string;
  /** 时间戳（秒） */
  timestamp: number;
  /** 帧索引 */
  index: number;
}

/**
 * 关键帧提取结果
 */
export interface KeyframeResult {
  /** 是否成功 */
  success: boolean;
  /** 提取的关键帧列表 */
  frames?: KeyframeInfo[];
  /** 总帧数 */
  totalFrames?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 默认选项
 */
const DEFAULT_OPTIONS: Required<Omit<KeyframeExtractionOptions, 'ffmpegPath'>> = {
  sceneThreshold: 0.2,
  maxFrames: 50,
  format: 'jpg',
  quality: 85,
};

/**
 * 提取视频关键帧
 * 
 * @param videoPath 视频文件路径
 * @param outputDir 输出目录
 * @param options 提取选项
 * @returns 提取结果
 */
export async function extractKeyframes(
  videoPath: string,
  outputDir: string,
  options?: KeyframeExtractionOptions
): Promise<KeyframeResult> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    ffmpegPath: options?.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg',
  };

  logger.info(`开始提取关键帧: ${videoPath}`);
  logger.debug(`选项: ${JSON.stringify(opts)}`);

  // 验证视频文件
  if (!fs.existsSync(videoPath)) {
    const error = `视频文件不存在: ${videoPath}`;
    logger.error(error);
    return {
      success: false,
      error,
    };
  }

  // 验证并创建输出目录
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      logger.debug(`创建输出目录: ${outputDir}`);
    }
  } catch (error: any) {
    const errorMsg = `无法创建输出目录: ${error.message}`;
    logger.error(errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }

  // 验证选项
  if (opts.sceneThreshold < 0 || opts.sceneThreshold > 1) {
    const error = `场景检测阈值必须在 0.0-1.0 之间，当前值: ${opts.sceneThreshold}`;
    logger.error(error);
    return {
      success: false,
      error,
    };
  }

  if (opts.quality < 1 || opts.quality > 100) {
    const error = `输出质量必须在 1-100 之间，当前值: ${opts.quality}`;
    logger.error(error);
    return {
      success: false,
      error,
    };
  }

  // 生成输出文件名模板
  const outputTemplate = path.join(outputDir, `frame%03d.${opts.format}`);

  return new Promise((resolve) => {
    // 构建 FFmpeg 命令参数
    const args = [
      '-i', videoPath,
      // 场景检测滤镜：select='gt(scene,threshold)' 只选择场景变化超过阈值的帧
      '-vf', `select='gt(scene,${opts.sceneThreshold})',showinfo`,
      // 禁用帧同步，避免重复帧
      '-vsync', '0',
      // 限制最大帧数
      '-frames:v', opts.maxFrames.toString(),
      // 输出质量（仅对 JPEG 有效）
      ...(opts.format === 'jpg' ? ['-q:v', (101 - opts.quality).toString()] : []),
      // PNG 质量设置
      ...(opts.format === 'png' ? ['-compression_level', Math.floor((100 - opts.quality) / 10).toString()] : []),
      // 输出文件
      '-y', // 覆盖已存在的文件
      outputTemplate,
    ];

    logger.debug(`FFmpeg 命令: ${opts.ffmpegPath} ${args.join(' ')}`);

    const ffmpeg = spawn(opts.ffmpegPath, args);

    let stderr = '';
    const timestamps: number[] = [];

    // 解析 stderr 输出获取时间戳信息
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;

      // 解析 showinfo 输出的帧信息
      // 格式示例: [Parsed_showinfo_0 @ 0x...] n:   0 pts:      0 pts_time:0.000000 ...
      const frameMatch = output.match(/pts_time:([\d.]+)/);
      if (frameMatch) {
        const timestamp = parseFloat(frameMatch[1]);
        timestamps.push(timestamp);
        logger.debug(`检测到关键帧时间戳: ${timestamp.toFixed(2)}s`);
      }
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        const error = `FFmpeg 执行失败 (code ${code}): ${stderr.slice(-500)}`;
        logger.error(error);
        // 清理可能已生成的文件
        cleanupOutputDir(outputDir, opts.format);
        resolve({
          success: false,
          error,
        });
        return;
      }

      // 扫描实际生成的文件
      const actualFrames: KeyframeInfo[] = [];
      try {
        const files = fs.readdirSync(outputDir);
        const frameFiles = files
          .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return (ext === `.${opts.format}` || (opts.format === 'jpg' && ext === '.jpeg')) 
              && file.startsWith('frame');
          })
          .sort(); // 按文件名排序

        if (frameFiles.length === 0) {
          const error = '未检测到关键帧，可能是场景变化阈值设置过高或视频没有明显的场景切换';
          logger.warn(error);
          resolve({
            success: false,
            error,
          });
          return;
        }

        // 匹配时间戳和文件
        for (let i = 0; i < frameFiles.length; i++) {
          const fileName = frameFiles[i];
          const framePath = path.join(outputDir, fileName);
          
          // 使用解析到的时间戳，如果没有则使用索引估算
          const timestamp = i < timestamps.length ? timestamps[i] : i * 1.0; // 如果时间戳不足，使用索引作为占位符
          
          actualFrames.push({
            path: framePath,
            timestamp,
            index: i,
          });
        }

        logger.info(`关键帧提取完成: 共 ${actualFrames.length} 帧`);
        resolve({
          success: true,
          frames: actualFrames,
          totalFrames: actualFrames.length,
        });
      } catch (error: any) {
        const errorMsg = `扫描输出文件失败: ${error.message}`;
        logger.error(errorMsg);
        resolve({
          success: false,
          error: errorMsg,
        });
      }
    });

    ffmpeg.on('error', (error) => {
      const errorMsg = `FFmpeg 执行错误: ${error.message}`;
      logger.error(errorMsg);
      // 清理可能已生成的文件
      cleanupOutputDir(outputDir, opts.format);
      resolve({
        success: false,
        error: errorMsg,
      });
    });
  });
}

/**
 * 清理关键帧文件
 * 
 * @param framePaths 关键帧文件路径数组
 */
export function cleanupFrames(framePaths: string[]): void {
  let cleaned = 0;
  for (const framePath of framePaths) {
    try {
      if (fs.existsSync(framePath)) {
        fs.unlinkSync(framePath);
        cleaned++;
        logger.debug(`清理关键帧文件: ${framePath}`);
      }
    } catch (error: any) {
      logger.warn(`清理关键帧文件失败: ${framePath}, 错误: ${error.message}`);
    }
  }
  if (cleaned > 0) {
    logger.info(`清理了 ${cleaned} 个关键帧文件`);
  }
}

/**
 * 清理输出目录中的所有关键帧文件
 * 
 * @param outputDir 输出目录
 * @param format 文件格式（可选，用于过滤）
 */
export function cleanupOutputDir(outputDir: string, format?: 'jpg' | 'png'): void {
  try {
    if (!fs.existsSync(outputDir)) {
      return;
    }

    const files = fs.readdirSync(outputDir);
    const pattern = format ? new RegExp(`\\.${format}$`, 'i') : /\.(jpg|jpeg|png)$/i;
    let cleaned = 0;

    for (const file of files) {
      if (pattern.test(file) && file.startsWith('frame')) {
        const filePath = path.join(outputDir, file);
        try {
          fs.unlinkSync(filePath);
          cleaned++;
        } catch (error: any) {
          logger.warn(`清理文件失败: ${filePath}, 错误: ${error.message}`);
        }
      }
    }

    if (cleaned > 0) {
      logger.info(`清理输出目录: ${cleaned} 个关键帧文件`);
    }
  } catch (error: any) {
    logger.warn(`清理输出目录失败: ${error.message}`);
  }
}
