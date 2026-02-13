
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from '../utils/logger';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

// 尝试加载 ffmpeg-static，如果失败则回退到系统命令
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  // ffmpeg-static 可能未安装，使用系统默认 'ffmpeg'
  ffmpegPath = 'ffmpeg';
}

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export class MediaHandler {
  /**
   * 获取 B 站视频/音频流 URL
   * @param bvid 视频 BVID
   * @param cid 视频 CID
   */
  async getPlayUrl(bvid: string, cid: number): Promise<string> {
    try {
      // 简单的 API 调用，不带 WBI 签名（可能受限，但对于大多数公共视频通常有效）
      // fnval=16 (DASH)
      const apiUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=16`;
      
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://www.bilibili.com/video/${bvid}`,
        }
      });

      if (response.data.code !== 0) {
        throw new Error(`B站 API 错误: ${response.data.message}`);
      }

      const dash = response.data.data.dash;
      if (dash && dash.audio && dash.audio.length > 0) {
        // 返回第一个音频流（通常是最高质量）
        return dash.audio[0].baseUrl;
      }

      // 如果没有 DASH，尝试 durl (MP4)
      const durl = response.data.data.durl;
      if (durl && durl.length > 0) {
        return durl[0].url;
      }

      throw new Error('未找到可用的音频/视频流');
    } catch (error) {
      logger.error('获取播放地址失败', error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(url: string, outputPath: string, referer: string): Promise<void> {
    const writer = fs.createWriteStream(outputPath);
    
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  /**
   * 转换并压缩音频 (用于 ASR)
   * 目标: mp3, 16k, mono, 64kbps (确保 < 25MB)
   */
  async processAudioForASR(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(/\.\w+$/, '_asr.mp3');
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('64k') // 低码率以减小体积
        .audioChannels(1)    // 单声道
        .audioFrequency(16000) // 16kHz 足够 ASR 使用
        .on('end', () => resolve(outputPath))
        .on('error', (err: any) => reject(err))
        .save(outputPath);
    });
  }
}

export const mediaHandler = new MediaHandler();
