/**
 * 小宇宙播客浏览器自动化抓取服务
 * 使用 Playwright 模拟真实用户访问，抓取音频真实 URL
 */

import { chromium, Browser, Page } from 'playwright';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';

/**
 * 音频抓取结果
 */
export interface AudioFetchResult {
  success: boolean;
  audioUrl?: string;
  audioPath?: string;
  error?: string;
}

/**
 * 使用浏览器自动化抓取小宇宙音频
 * 
 * 策略：
  * 1. 使用 Playwright 打开播客页面
  * 2. 监听网络请求，捕获音频文件 URL
  * 3. 使用获取到的真实 URL 下载音频
 */
export async function fetchXiaoyuzhouAudioWithBrowser(
  episodeUrl: string,
  timeout: number = 60000
): Promise<AudioFetchResult> {
  logger.info(`[小宇宙浏览器] 开始抓取音频: ${episodeUrl}`);

  let browser: Browser | null = null;
  let audioUrl: string | null = null;

  try {
    // 启动浏览器
    // 优先使用系统 Chrome，如果没有则使用 Playwright 自带的 Chromium
    const executablePath = process.env.PLAYWRIGHT_CHROME_PATH || 
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    browser = await chromium.launch({
      headless: true, // 无头模式
      executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // 监听网络请求，寻找音频文件
    page.on('request', (request) => {
      const url = request.url();
      // 匹配音频文件请求
      if (url.includes('.mp3') || url.includes('.m4a') || url.includes('audio')) {
        logger.debug(`[小宇宙浏览器] 捕获请求: ${url.substring(0, 100)}...`);
        // 匹配小宇宙相关的 CDN 域名
        if (url.includes('xiaoyuzhou') || url.includes('ximalaya') || url.includes('qn') || 
            url.includes('xyzcdn') || url.includes('cdn')) {
          audioUrl = url;
          logger.info(`[小宇宙浏览器] 找到音频 URL: ${url.substring(0, 100)}...`);
        }
      }
    });

    // 监听响应，进一步确认音频 URL
    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      if (contentType.includes('audio') || url.includes('.mp3') || url.includes('.m4a')) {
        logger.debug(`[小宇宙浏览器] 捕获音频响应: ${url.substring(0, 100)}...`);
        if (!audioUrl && (url.includes('xiaoyuzhou') || url.includes('qn') || url.includes('xyzcdn'))) {
          audioUrl = url;
          logger.info(`[小宇宙浏览器] 从响应确认音频 URL: ${url.substring(0, 100)}...`);
        }
      }
    });

    // 访问播客页面
    logger.info('[小宇宙浏览器] 访问播客页面...');
    await page.goto(episodeUrl, {
      waitUntil: 'networkidle',
      timeout: timeout,
    });

    // 等待页面加载完成
    await page.waitForTimeout(3000);

    // 尝试点击播放按钮（触发音频加载）
    try {
      // 查找播放按钮
      const playButton = await page.$('button[class*="play"], .play-btn, [data-testid*="play"]');
      if (playButton) {
        logger.info('[小宇宙浏览器] 点击播放按钮...');
        await playButton.click();
        // 等待音频加载
        await page.waitForTimeout(5000);
      }
    } catch (e) {
      logger.debug('[小宇宙浏览器] 未找到播放按钮或点击失败');
    }

    // 等待一段时间，让音频 URL 被捕获
    logger.info('[小宇宙浏览器] 等待音频加载...');
    await page.waitForTimeout(5000);

    // 如果还没找到音频 URL，尝试从页面源码中提取
    if (!audioUrl) {
      logger.info('[小宇宙浏览器] 尝试从页面源码提取音频 URL...');
      const pageContent = await page.content();
      
      // 尝试多种正则匹配模式
      const patterns = [
        /"audioUrl"[:\s]*"([^"]+)"/,
        /"audio_url"[:\s]*"([^"]+)"/,
        /"mediaUrl"[:\s]*"([^"]+)"/,
        /(https?:\/\/[^"\s]+\.mp3)/,
        /(https?:\/\/[^"\s]+audio[^"\s]*)/,
      ];

      for (const pattern of patterns) {
        const match = pageContent.match(pattern);
        if (match) {
          audioUrl = match[1];
          logger.info(`[小宇宙浏览器] 从源码提取音频 URL: ${audioUrl.substring(0, 100)}...`);
          break;
        }
      }
    }

    // 关闭浏览器
    await browser.close();
    browser = null;

    // 检查是否获取到音频 URL
    if (!audioUrl) {
      return {
        success: false,
        error: '无法获取音频 URL，可能需要登录或该内容受限',
      };
    }

    // 下载音频文件
    logger.info('[小宇宙浏览器] 开始下载音频...');
    const audioPath = await downloadAudioFile(audioUrl);

    if (!audioPath) {
      return {
        success: false,
        error: '音频下载失败',
      };
    }

    logger.info(`[小宇宙浏览器] 音频下载完成: ${audioPath}`);
    return {
      success: true,
      audioUrl,
      audioPath,
    };

  } catch (error: any) {
    logger.error('[小宇宙浏览器] 抓取失败', error);
    
    // 确保浏览器关闭
    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      success: false,
      error: `浏览器抓取失败: ${error.message}`,
    };
  }
}

/**
 * 下载音频文件
 */
async function downloadAudioFile(audioUrl: string): Promise<string | null> {
  try {
    const tempDir = path.join(os.tmpdir(), 'article-collector-media');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filePath = path.join(tempDir, `xiaoyuzhou_audio_${timestamp}.mp3`);

    const response = await axios.get(audioUrl, {
      responseType: 'stream',
      timeout: 300000, // 5分钟超时
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.xiaoyuzhoufm.com/',
      },
    });

    // 检查文件大小
    const contentLength = parseInt(response.headers['content-length'] || '0', 10);
    const sizeMB = contentLength / (1024 * 1024);
    
    if (sizeMB > videoConfig.maxVideoSizeMB) {
      throw new Error(`文件过大: ${sizeMB.toFixed(2)}MB (限制: ${videoConfig.maxVideoSizeMB}MB)`);
    }

    logger.info(`[小宇宙浏览器] 音频大小: ${sizeMB.toFixed(2)}MB`);

    // 写入文件
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 验证文件
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      fs.unlinkSync(filePath);
      throw new Error('下载的文件为空');
    }

    logger.info(`[小宇宙浏览器] 音频保存成功: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    return filePath;

  } catch (error: any) {
    logger.error('[小宇宙浏览器] 音频下载失败', error);
    return null;
  }
}

/**
 * 清理音频文件
 */
export function cleanupAudioFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug(`[小宇宙浏览器] 清理音频文件: ${filePath}`);
    }
  } catch (error) {
    logger.warn(`[小宇宙浏览器] 清理文件失败: ${filePath}`, error);
  }
}
