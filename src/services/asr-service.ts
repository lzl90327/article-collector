/**
 * 音频转文字服务 (ASR - Automatic Speech Recognition)
 * 
 * 统一接口设计，支持多种转录后端：
 * - faster-whisper（本地部署，推荐）
 * - OpenAI Whisper API（云端备选）
 * - 百度 ASR（已有，短语音兜底）
 * 
 * 策略：
 * - 短音频（< TRANSCRIPTION_THRESHOLD）: 优先使用 OpenAI API
 * - 长音频（>= TRANSCRIPTION_THRESHOLD）: 使用本地 faster-whisper
 * - 失败降级：云端 → 本地 → 百度 ASR
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';
import { splitAudio, cleanupSegments, mergeTranscriptions, AudioSegment } from './audio-splitter';

/**
 * 转录结果中的单个片段
 */
export interface TranscriptSegment {
  /** 开始时间（秒） */
  start: number;
  /** 结束时间（秒） */
  end: number;
  /** 文本内容 */
  text: string;
}

/**
 * 转录结果
 */
export interface TranscriptionResult {
  /** 是否成功 */
  success: boolean;
  /** 完整文本 */
  text: string;
  /** 分段文本（带时间戳） */
  segments: TranscriptSegment[];
  /** 语言 */
  language?: string;
  /** 使用的后端 */
  backend: 'faster-whisper' | 'openai' | 'baidu' | 'baidu-segmented' | 'unknown';
  /** 耗时（毫秒） */
  duration?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 转录配置
 */
export interface TranscriptionOptions {
  /** 强制使用的后端 */
  backend?: 'faster-whisper' | 'openai' | 'baidu';
  /** 语言（auto 自动检测） */
  language?: string;
  /** 是否需要时间戳 */
  timestamps?: boolean;
}

/**
 * ASR 服务类
 */
export class ASRService {
  /**
   * 转录音频文件
   * @param audioPath 音频文件路径
   * @param options 转录配置
   * @returns 转录结果
   */
  async transcribe(
    audioPath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    // 检查文件是否存在
    if (!fs.existsSync(audioPath)) {
      return {
        success: false,
        text: '',
        segments: [],
        backend: 'unknown',
        error: `音频文件不存在: ${audioPath}`,
      };
    }

    // 获取音频时长（秒）
    const audioDuration = await this.getAudioDuration(audioPath);
    logger.info(`音频时长: ${audioDuration}秒`);

    // 根据配置和音频时长选择后端
    const backend = this.selectBackend(audioDuration, options.backend);
    logger.info(`选择转录后端: ${backend}`);

    // 调用对应的转录方法
    let result: TranscriptionResult;
    
    try {
      switch (backend) {
        case 'openai':
          result = await this.transcribeWithOpenAI(audioPath, options);
          break;
        case 'faster-whisper':
          result = await this.transcribeWithFasterWhisper(audioPath, options);
          break;
        case 'baidu':
          result = await this.transcribeWithBaidu(audioPath, options);
          break;
        default:
          throw new Error(`未知的转录后端: ${backend}`);
      }
      
      result.duration = Date.now() - startTime;
      logger.info(`转录完成，耗时: ${result.duration}ms`);
      
      return result;
    } catch (error: any) {
      logger.error(`转录失败 (${backend}): ${error.message}`);
      
      if (backend === 'openai' && videoConfig.whisperModel) {
        logger.info('尝试降级到本地 faster-whisper...');
        return this.transcribe(audioPath, { ...options, backend: 'faster-whisper' });
      }
      if (backend === 'faster-whisper') {
        if (videoConfig.hasOpenAI) {
          logger.info('尝试降级到 OpenAI Whisper...');
          return this.transcribe(audioPath, { ...options, backend: 'openai' });
        }
        const { baiduASRConfig } = await import('../config');
        if (baiduASRConfig.enabled) {
          logger.info('尝试降级到百度 ASR...');
          return this.transcribe(audioPath, { ...options, backend: 'baidu' });
        }
      }
      
      return {
        success: false,
        text: '',
        segments: [],
        backend,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * 选择转录后端
   */
  private selectBackend(
    audioDuration: number,
    forcedBackend?: string
  ): 'faster-whisper' | 'openai' | 'baidu' {
    // 强制指定后端
    if (forcedBackend) {
      return forcedBackend as any;
    }

    // 短音频且有 OpenAI API Key
    if (audioDuration <= videoConfig.transcriptionThreshold && videoConfig.hasOpenAI) {
      return 'openai';
    }

    // 长音频或无 OpenAI Key，使用本地
    if (videoConfig.whisperModel) {
      return 'faster-whisper';
    }

    // 兜底：百度 ASR（仅支持短音频）
    return 'baidu';
  }

  /**
   * 获取音频时长（秒）
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
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
          resolve(duration);
        } else {
          // 无法获取时长，返回一个安全的默认值
          logger.warn(`无法获取音频时长，使用默认值 300秒`);
          resolve(300);
        }
      });

      ffprobe.on('error', (err) => {
        logger.warn(`ffprobe 执行失败: ${err.message}，使用默认时长`);
        resolve(300);
      });
    });
  }

  /**
   * 使用 faster-whisper 转录（本地）
   */
  private async transcribeWithFasterWhisper(
    audioPath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    logger.info('[faster-whisper] 开始本地转录...');

    const scriptPath = path.join(__dirname, '../../scripts/transcribe_audio.py');
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`转录脚本不存在: ${scriptPath}`);
    }

    const runOnce = () =>
      new Promise<TranscriptionResult>((resolve, reject) => {
      let pythonCmd = 'python3';
      try {
        // 优先使用 browser-fetcher 中的 Python 环境检测结果（包含虚拟环境）
        // 以提高在云服务器上的兼容性
        // 若检测失败，则回退到系统 python3
        // 动态导入避免循环依赖
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bf = require('./browser-fetcher');
        const env = bf.checkPythonEnv?.();
        if (env?.available && env?.pythonPath) {
          pythonCmd = env.pythonPath;
        }
      } catch {
        // 忽略检测失败，使用默认 python3
      }

      const args = [
        scriptPath,
        '--audio', audioPath,
        '--model', videoConfig.whisperModel,
        '--language', options.language || 'auto',
      ];

      if (options.timestamps !== false) {
        args.push('--timestamps');
      }

      logger.debug(`执行命令: ${pythonCmd} ${args.join(' ')}`);

      const process = spawn(pythonCmd, args);
      
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // 实时输出进度日志
        const lines = chunk.split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) => {
          if (line.includes('进度') || line.includes('Progress')) {
            logger.debug(`[faster-whisper] ${line}`);
          }
        });
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          logger.error(`[faster-whisper] 转录失败，退出码: ${code}`);
          logger.error(`stderr: ${stderr}`);
            reject(new Error(`转录进程退出异常 (code ${code})`));
          return;
        }

        try {
          // 解析 JSON 输出
          const result = JSON.parse(stdout);
          
          logger.info(`[faster-whisper] 转录成功，文本长度: ${result.text?.length || 0}`);
          
          resolve({
            success: true,
            text: result.text || '',
            segments: result.segments || [],
            language: result.language,
            backend: 'faster-whisper',
          });
        } catch (error: any) {
          logger.error(`[faster-whisper] 解析输出失败: ${error.message}`);
          logger.error(`stdout: ${stdout.substring(0, 500)}`);
          reject(new Error(`解析转录结果失败: ${error.message}`));
        }
      });

      process.on('error', (error) => {
        logger.error(`[faster-whisper] 进程启动失败: ${error.message}`);
        reject(error);
      });
      });

    try {
      return await runOnce();
    } catch (e) {
      logger.warn('[faster-whisper] 第一次转录失败，重试中...');
      await new Promise((r) => setTimeout(r, 1000));
      return await runOnce();
    }
  }

  /**
   * 使用 OpenAI Whisper API 转录（云端）
   */
  private async transcribeWithOpenAI(
    audioPath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    logger.info('[OpenAI] 开始云端转录...');

    if (!videoConfig.openaiApiKey) {
      throw new Error('未配置 OPENAI_WHISPER_API_KEY');
    }

    try {
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('file', fs.createReadStream(audioPath));
      formData.append('model', 'whisper-1');
      
      if (options.language && options.language !== 'auto') {
        formData.append('language', options.language);
      }

      // OpenAI API 支持时间戳
      if (options.timestamps !== false) {
        formData.append('timestamp_granularities[]', 'segment');
        formData.append('response_format', 'verbose_json');
      }

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${videoConfig.openaiApiKey}`,
            ...formData.getHeaders(),
          },
          timeout: 300000, // 5分钟超时
        }
      );

      const data = response.data;
      
      // 解析分段（如果有）
      const segments: TranscriptSegment[] = [];
      if (data.segments) {
        for (const seg of data.segments) {
          segments.push({
            start: seg.start,
            end: seg.end,
            text: seg.text,
          });
        }
      }

      logger.info(`[OpenAI] 转录成功，文本长度: ${data.text?.length || 0}`);

      return {
        success: true,
        text: data.text || '',
        segments,
        language: data.language,
        backend: 'openai',
      };
    } catch (error: any) {
      logger.error(`[OpenAI] 转录失败: ${error.message}`);
      
      if (error.response) {
        logger.error(`API 响应: ${JSON.stringify(error.response.data)}`);
      }
      
      throw error;
    }
  }

  /**
   * 使用百度 ASR 转录（兜底方案，仅短音频）
   */
  private async transcribeWithBaidu(
    audioPath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    logger.info('[百度ASR] 开始转录（兜底方案）...');
    
    // 导入百度 ASR 服务
    const { transcribeWithBaidu } = await import('./baidu-asr');
    const { baiduASRConfig } = await import('../config');

    if (!baiduASRConfig.enabled) {
      throw new Error('百度 ASR 未配置');
    }

    try {
      // 读取音频文件
      const audioBuffer = fs.readFileSync(audioPath);
      
      // 调用百度 ASR
      const text = await transcribeWithBaidu(
        audioBuffer,
        {
          apiKey: baiduASRConfig.apiKey,
          secretKey: baiduASRConfig.secretKey,
        }
      );

      logger.info(`[百度ASR] 转录成功，文本长度: ${text?.length || 0}`);

      return {
        success: true,
        text: text || '',
        segments: [], // 百度 ASR 不支持时间戳
        backend: 'baidu',
      };
    } catch (error: any) {
      logger.error(`[百度ASR] 转录失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 分段转录长音频
   * 将长音频分割成小段，分别转录后合并结果
   * 
   * @param audioPath 音频文件路径
   * @param options 转录选项
   * @param totalDuration 音频总时长（秒），如果提供则优先使用
   */
  async transcribeLongAudio(
    audioPath: string,
    options: TranscriptionOptions = {},
    totalDuration?: number
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    logger.info(`[分段转录] 开始处理长音频: ${audioPath}`);

    try {
      // 1. 分割音频
      logger.info('[分段转录] 分割音频...');
      const splitResult = await splitAudio(audioPath, {
        segmentDuration: 300, // 5分钟一段
        maxSegmentSizeMB: 50, // 最大50MB
        totalDuration, // 传入播客页面提供的时长
      });

      // 如果分割失败且是因为 ffmpeg 不存在，尝试直接使用百度 ASR（如果文件大小允许）
      if (!splitResult.success && splitResult.error?.includes('ENOENT')) {
        logger.warn('[分段转录] ffmpeg 不可用，尝试直接使用百度 ASR');
        
        // 检查文件大小
        const stats = fs.statSync(audioPath);
        const sizeMB = stats.size / (1024 * 1024);
        
        if (sizeMB <= 60) {
          // 文件小于 60MB，直接使用百度 ASR
          logger.info(`[分段转录] 文件大小 ${sizeMB.toFixed(2)}MB，直接使用百度 ASR`);
          return await this.transcribe(audioPath, { ...options, backend: 'baidu' });
        } else {
          throw new Error(`音频文件过大 (${sizeMB.toFixed(2)}MB)，需要 ffmpeg 进行分割转录`);
        }
      }

      if (!splitResult.success || !splitResult.segments) {
        throw new Error(`音频分割失败: ${splitResult.error}`);
      }

      const segments = splitResult.segments;
      logger.info(`[分段转录] 音频已分割成 ${segments.length} 段`);

      // 2. 逐段转录
      const transcriptions: string[] = [];
      const allSegments: TranscriptSegment[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        logger.info(`[分段转录] 转录第 ${i + 1}/${segments.length} 段...`);

        // 使用百度 ASR 转录（分段后文件较小）
        try {
          const result = await this.transcribeWithBaidu(segment.filePath, options);
          
          if (result.success && result.text) {
            transcriptions.push(result.text);
            
            // 调整时间戳
            if (result.segments) {
              const adjustedSegments = result.segments.map(s => ({
                ...s,
                start: s.start + segment.startTime,
                end: s.end + segment.startTime,
              }));
              allSegments.push(...adjustedSegments);
            }
            
            logger.info(`[分段转录] 第 ${i + 1} 段转录完成，文本长度: ${result.text.length}`);
          } else {
            logger.warn(`[分段转录] 第 ${i + 1} 段转录失败: ${result.error}`);
            transcriptions.push(`[第 ${i + 1} 部分转录失败]`);
          }
        } catch (error: any) {
          logger.error(`[分段转录] 第 ${i + 1} 段转录异常: ${error.message}`);
          transcriptions.push(`[第 ${i + 1} 部分转录失败]`);
        }
      }

      // 3. 清理分段文件
      cleanupSegments(segments);

      // 4. 合并结果
      const mergedText = mergeTranscriptions(transcriptions);
      
      logger.info(`[分段转录] 全部完成，总文本长度: ${mergedText.length}`);

      return {
        success: true,
        text: mergedText,
        segments: allSegments,
        backend: 'baidu-segmented',
        duration: Date.now() - startTime,
      };

    } catch (error: any) {
      logger.error('[分段转录] 处理失败', error);
      return {
        success: false,
        text: '',
        segments: [],
        backend: 'baidu-segmented',
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * 格式化转录结果为 Markdown（带时间戳）
   */
  formatTranscriptToMarkdown(result: TranscriptionResult): string {
    if (!result.success || !result.text) {
      return '';
    }

    const lines: string[] = [];

    // 如果有分段，生成带时间戳的文本
    if (result.segments && result.segments.length > 0) {
      lines.push('## 文字稿（带时间戳）\n');
      
      for (const segment of result.segments) {
        const timestamp = this.formatTimestamp(segment.start);
        lines.push(`**[${timestamp}]** ${segment.text.trim()}\n`);
      }
    } else {
      // 无分段，直接输出全文
      lines.push('## 文字稿\n');
      lines.push(result.text);
    }

    return lines.join('\n');
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * 检查转录服务是否可用
   */
  async checkAvailability(): Promise<{
    fasterWhisper: boolean;
    openai: boolean;
    baidu: boolean;
  }> {
    const result = {
      fasterWhisper: false,
      openai: false,
      baidu: false,
    };

    // 检查 faster-whisper（检查 Python 脚本和依赖）
    try {
      const scriptPath = path.join(__dirname, '../../scripts/transcribe_audio.py');
      result.fasterWhisper = fs.existsSync(scriptPath);
    } catch {
      result.fasterWhisper = false;
    }

    // 检查 OpenAI
    result.openai = !!videoConfig.openaiApiKey;

    // 检查百度 ASR
    const { baiduASRConfig } = await import('../config');
    result.baidu = baiduASRConfig.enabled;

    return result;
  }
}

// 导出单例
export const asrService = new ASRService();
