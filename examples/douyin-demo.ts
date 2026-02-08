/**
 * 抖音视频处理示例
 * 
 * 展示如何使用 douyin-fetcher 提取和下载抖音视频
 */

import { fetchDouyinVideo, cleanupFiles, DouyinVideoResult } from '../src/services/douyin-fetcher';
import { logger } from '../src/utils/logger';

/**
 * 示例 1: 仅提取视频信息
 */
export async function extractDouyinInfo(url: string): Promise<void> {
  logger.info(`[抖音示例] 提取视频信息: ${url}`);

  const result = await fetchDouyinVideo(url);

  if (!result.success || !result.info) {
    logger.error(`[抖音示例] 提取失败: ${result.error}`);
    return;
  }

  const info = result.info;
  logger.info(`[抖音示例] 视频信息:`);
  logger.info(`  标题: ${info.title}`);
  logger.info(`  作者: ${info.author}`);
  logger.info(`  时长: ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
  logger.info(`  发布时间: ${info.publishDate}`);
  logger.info(`  视频ID: ${info.awemeId}`);
  logger.info(`  观看数: ${info.playCount?.toLocaleString() || 'N/A'}`);
  logger.info(`  点赞数: ${info.diggCount?.toLocaleString() || 'N/A'}`);
  logger.info(`  标签: ${info.tags.join(', ') || '无'}`);
}

/**
 * 示例 2: 下载视频
 */
export async function downloadDouyinVideo(url: string): Promise<void> {
  logger.info(`[抖音示例] 下载视频: ${url}`);

  const result = await fetchDouyinVideo(url, {
    downloadVideo: true,
  });

  if (!result.success) {
    logger.error(`[抖音示例] 下载失败: ${result.error}`);
    return;
  }

  if (result.videoPath) {
    logger.info(`[抖音示例] 视频已下载: ${result.videoPath}`);
  }

  // 清理文件（示例，实际使用时根据需要决定何时清理）
  // cleanupFiles(result);
}

/**
 * 示例 3: 提取音频
 */
export async function extractDouyinAudio(url: string): Promise<void> {
  logger.info(`[抖音示例] 提取音频: ${url}`);

  const result = await fetchDouyinVideo(url, {
    extractAudio: true,
  });

  if (!result.success) {
    logger.error(`[抖音示例] 提取失败: ${result.error}`);
    return;
  }

  if (result.audioPath) {
    logger.info(`[抖音示例] 音频已提取: ${result.audioPath}`);
  }

  // 清理文件
  // cleanupFiles(result);
}

/**
 * 示例 4: 下载视频并提取音频
 */
export async function downloadVideoAndAudio(url: string): Promise<void> {
  logger.info(`[抖音示例] 下载视频并提取音频: ${url}`);

  const result = await fetchDouyinVideo(url, {
    downloadVideo: true,
    extractAudio: true,
  });

  if (!result.success) {
    logger.error(`[抖音示例] 处理失败: ${result.error}`);
    return;
  }

  if (result.videoPath) {
    logger.info(`[抖音示例] 视频路径: ${result.videoPath}`);
  }
  if (result.audioPath) {
    logger.info(`[抖音示例] 音频路径: ${result.audioPath}`);
  }

  // 清理文件
  // cleanupFiles(result);
}

/**
 * 示例 5: 处理短链
 */
export async function processShortUrl(shortUrl: string): Promise<void> {
  logger.info(`[抖音示例] 处理短链: ${shortUrl}`);

  // 短链会自动展开，无需特殊处理
  const result = await fetchDouyinVideo(shortUrl);

  if (!result.success) {
    logger.error(`[抖音示例] 处理失败: ${result.error}`);
    return;
  }

  logger.info(`[抖音示例] 短链已处理，视频信息: ${result.info?.title}`);
}

/**
 * 示例 6: 错误处理
 */
export async function handleErrors(url: string): Promise<void> {
  logger.info(`[抖音示例] 错误处理示例: ${url}`);

  const result = await fetchDouyinVideo(url);

  if (!result.success) {
    // 根据错误类型进行不同处理
    if (result.error?.includes('API 服务不可用')) {
      logger.error(`[抖音示例] API 服务配置错误，请检查 DOUYIN_API_URL`);
    } else if (result.error?.includes('视频不存在')) {
      logger.error(`[抖音示例] 视频不存在或已删除`);
    } else if (result.error?.includes('时长过长')) {
      logger.warn(`[抖音示例] 视频时长超过限制，但已获取信息: ${result.info?.title}`);
      // 可以继续处理，只是不下载
    } else {
      logger.error(`[抖音示例] 未知错误: ${result.error}`);
    }
    return;
  }

  logger.info(`[抖音示例] 处理成功: ${result.info?.title}`);
}

/**
 * 主函数 - 运行示例
 */
async function main() {
  // 示例 URL（请替换为实际的抖音视频链接）
  const testUrls = [
    'https://www.douyin.com/video/1234567890123456789', // 完整链接
    'https://v.douyin.com/xxxxx', // 短链
  ];

  for (const url of testUrls) {
    try {
      // 示例 1: 仅提取信息
      await extractDouyinInfo(url);
      
      // 示例 2: 下载视频
      // await downloadDouyinVideo(url);
      
      // 示例 3: 提取音频
      // await extractDouyinAudio(url);
      
      // 示例 4: 下载视频并提取音频
      // await downloadVideoAndAudio(url);
      
    } catch (error: any) {
      logger.error(`[抖音示例] 示例执行失败: ${error.message}`);
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}
