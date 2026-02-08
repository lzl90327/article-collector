/**
 * 音频转文字服务集成示例
 * 
 * 展示如何在 Node.js/TypeScript 项目中集成 transcribe_audio.py
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * 转录结果接口
 */
interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    duration?: number;
  }>;
  language: string;
  language_probability: number;
  duration: number;
  metadata: {
    model: string;
    device: string;
    compute_type: string;
    transcribe_time: number;
    realtime_factor: number;
    segments_count: number;
  };
}

/**
 * 转录错误接口
 */
interface TranscriptionError {
  error: string;
  message: string;
  traceback?: string;
}

/**
 * 转录选项
 */
interface TranscriptionOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3';
  language?: string;
  device?: 'cpu' | 'cuda';
  computeType?: 'int8' | 'float16' | 'float32';
  timestamps?: boolean;
  outputPath?: string;
}

/**
 * 音频转文字服务
 */
export class AudioTranscriptionService {
  private scriptPath: string;

  constructor(scriptPath: string = 'scripts/transcribe_audio.py') {
    this.scriptPath = scriptPath;
  }

  /**
   * 转录音频文件（简单方式）
   */
  async transcribe(
    audioPath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const args = ['--audio', audioPath];

    if (options.model) args.push('--model', options.model);
    if (options.language) args.push('--language', options.language);
    if (options.device) args.push('--device', options.device);
    if (options.computeType) args.push('--compute-type', options.computeType);
    if (options.timestamps) args.push('--timestamps');
    if (options.outputPath) args.push('--output', options.outputPath);

    const command = `python ${this.scriptPath} ${args.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // stderr 包含进度信息（可选打印）
      if (stderr) {
        console.log('[Transcription Progress]', stderr);
      }

      const result = JSON.parse(stdout) as TranscriptionResult | TranscriptionError;

      if ('error' in result) {
        throw new Error(`转录失败: ${result.message}`);
      }

      return result;
    } catch (error: any) {
      if (error.stdout) {
        try {
          const errorResult = JSON.parse(error.stdout) as TranscriptionError;
          throw new Error(`转录失败: ${errorResult.message}`);
        } catch {
          // 继续抛出原始错误
        }
      }
      throw error;
    }
  }

  /**
   * 转录音频文件（支持进度回调）
   */
  async transcribeWithProgress(
    audioPath: string,
    options: TranscriptionOptions = {},
    onProgress?: (progress: string) => void
  ): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      const args = ['--audio', audioPath];

      if (options.model) args.push('--model', options.model);
      if (options.language) args.push('--language', options.language);
      if (options.device) args.push('--device', options.device);
      if (options.computeType) args.push('--compute-type', options.computeType);
      if (options.timestamps) args.push('--timestamps');
      if (options.outputPath) args.push('--output', options.outputPath);

      const python = spawn('python', [this.scriptPath, ...args]);

      let stdout = '';
      let stderr = '';

      // 监听进度输出
      python.stderr.on('data', (data) => {
        const progress = data.toString();
        stderr += progress;
        
        if (onProgress) {
          onProgress(progress.trim());
        }
      });

      // 收集结果
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout) as TranscriptionResult | TranscriptionError;

            if ('error' in result) {
              reject(new Error(`转录失败: ${result.message}`));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(new Error(`JSON 解析失败: ${e}`));
          }
        } else {
          reject(new Error(`进程退出码: ${code}\n${stderr}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`进程错误: ${error.message}`));
      });
    });
  }

  /**
   * 批量转录音频文件
   */
  async transcribeBatch(
    audioPaths: string[],
    options: TranscriptionOptions = {},
    concurrency: number = 2
  ): Promise<Array<{ path: string; result: TranscriptionResult | Error }>> {
    const results: Array<{ path: string; result: TranscriptionResult | Error }> = [];

    // 分批处理
    for (let i = 0; i < audioPaths.length; i += concurrency) {
      const batch = audioPaths.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (audioPath) => {
        try {
          const result = await this.transcribe(audioPath, options);
          return { path: audioPath, result };
        } catch (error) {
          return { path: audioPath, result: error as Error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }
}

/**
 * 使用示例 1: 基础用法
 */
async function example1() {
  const service = new AudioTranscriptionService();

  try {
    console.log('开始转录...');
    const result = await service.transcribe('input.mp3', {
      model: 'medium',
      language: 'zh',
    });

    console.log('转录完成！');
    console.log('检测语言:', result.language);
    console.log('音频时长:', result.duration, '秒');
    console.log('转录文本:', result.text.substring(0, 100) + '...');
    console.log('片段数量:', result.segments.length);
  } catch (error) {
    console.error('转录失败:', error);
  }
}

/**
 * 使用示例 2: 带进度反馈
 */
async function example2() {
  const service = new AudioTranscriptionService();

  try {
    console.log('开始转录（带进度）...\n');
    
    const result = await service.transcribeWithProgress(
      'podcast.mp3',
      {
        model: 'large-v3',
        timestamps: true,
      },
      (progress) => {
        // 实时打印进度
        console.log('Progress:', progress);
      }
    );

    console.log('\n转录完成！');
    console.log('实时率:', result.metadata.realtime_factor, 'x');
    
    // 保存结果
    await fs.writeFile(
      'transcription.json',
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error('转录失败:', error);
  }
}

/**
 * 使用示例 3: 批量处理
 */
async function example3() {
  const service = new AudioTranscriptionService();

  const audioFiles = [
    'episode1.mp3',
    'episode2.mp3',
    'episode3.mp3',
  ];

  console.log(`批量转录 ${audioFiles.length} 个文件...`);

  const results = await service.transcribeBatch(audioFiles, {
    model: 'small',
    language: 'zh',
  }, 2); // 同时处理 2 个

  // 统计结果
  const successful = results.filter(r => !(r.result instanceof Error));
  const failed = results.filter(r => r.result instanceof Error);

  console.log(`成功: ${successful.length}, 失败: ${failed.length}`);

  // 保存成功的结果
  for (const { path: audioPath, result } of successful) {
    if (!(result instanceof Error)) {
      const outputPath = audioPath.replace('.mp3', '_transcript.json');
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
      console.log(`已保存: ${outputPath}`);
    }
  }

  // 打印失败的文件
  if (failed.length > 0) {
    console.error('\n失败的文件:');
    for (const { path: audioPath, result } of failed) {
      console.error(`- ${audioPath}: ${(result as Error).message}`);
    }
  }
}

/**
 * 使用示例 4: 与 ASR 服务集成
 */
export async function transcribeForASR(
  audioPath: string,
  options?: {
    preferGPU?: boolean;
    quality?: 'fast' | 'balanced' | 'best';
  }
): Promise<{ text: string; segments: any[]; language: string }> {
  const service = new AudioTranscriptionService();

  // 根据质量要求选择模型
  let model: TranscriptionOptions['model'] = 'medium';
  if (options?.quality === 'fast') model = 'small';
  if (options?.quality === 'best') model = 'large-v3';

  const result = await service.transcribe(audioPath, {
    model,
    device: options?.preferGPU ? 'cuda' : 'cpu',
    timestamps: true,
  });

  return {
    text: result.text,
    segments: result.segments,
    language: result.language,
  };
}

// 如果直接运行此文件
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: ts-node transcribe-example.ts <audio-file>');
    console.log('示例: ts-node transcribe-example.ts input.mp3');
    process.exit(1);
  }

  const audioPath = args[0];
  const service = new AudioTranscriptionService();

  service
    .transcribeWithProgress(
      audioPath,
      { model: 'medium', timestamps: true },
      (progress) => console.log(progress)
    )
    .then((result) => {
      console.log('\n转录结果:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error('错误:', error.message);
      process.exit(1);
    });
}

export default AudioTranscriptionService;
