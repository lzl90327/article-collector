/**
 * B站视频处理集成示例
 * 
 * 展示如何将 bilibili-fetcher 与项目其他模块集成：
 * - 飞书多维表格存储
 * - 飞书知识库文档
 * - Redis 队列处理
 * - 音频转录
 */

import { fetchBilibiliVideo, cleanupFiles, BilibiliVideoResult } from '../services/bilibili-fetcher';
import { createBitableRecord } from '../services/lark-bitable';
import { createWikiDoc } from '../services/lark-wiki';
import { fieldConfig, extendedFieldConfig, wikiConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * 示例 1: 保存到飞书多维表格
 */
export async function saveBilibiliToFeishu(url: string): Promise<void> {
  logger.info(`[B站集成] 处理视频并保存到飞书: ${url}`);

  // 提取视频信息
  const result = await fetchBilibiliVideo(url);

  if (!result.success || !result.info) {
    throw new Error(`视频信息提取失败: ${result.error}`);
  }

  const info = result.info;

  // 保存到多维表格
  const record = await createBitableRecord({
    [fieldConfig.title]: info.title,
    [fieldConfig.author]: info.author,
    [fieldConfig.source]: 'B站',
    [fieldConfig.originalUrl]: url,
    [fieldConfig.summary]: info.description,
    [fieldConfig.publishTime]: info.publishDate,
    [fieldConfig.collectTime]: new Date().toISOString(),
    [extendedFieldConfig.contentType]: '视频',
    [extendedFieldConfig.videoDuration]: info.duration,
  });

  logger.info(`[B站集成] 已保存到多维表格，记录 ID: ${record.record_id}`);
}

/**
 * 示例 2: 创建飞书知识库文档
 */
export async function createBilibiliWikiDoc(url: string): Promise<string> {
  logger.info(`[B站集成] 创建知识库文档: ${url}`);

  // 提取视频信息
  const result = await fetchBilibiliVideo(url);

  if (!result.success || !result.info) {
    throw new Error(`视频信息提取失败: ${result.error}`);
  }

  const info = result.info;

  // 构建 Markdown 内容
  const content = `
# ${info.title}

## 视频信息

- **作者**: ${info.author}
- **发布时间**: ${info.publishDate}
- **时长**: ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}
- **BV号**: ${info.bvid}
- **观看数**: ${info.viewCount?.toLocaleString() || 'N/A'}
- **点赞数**: ${info.likeCount?.toLocaleString() || 'N/A'}

## 简介

${info.description || '无'}

## 标签

${info.tags.length > 0 ? info.tags.map(tag => `- ${tag}`).join('\n') : '无'}

## 封面

![封面](${info.thumbnail})

## 原始链接

${url}

---

**收藏时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
`;

  // 创建知识库文档
  const docUrl = await createWikiDoc(
    wikiConfig.videoParentNodeToken || wikiConfig.parentNodeToken,
    info.title,
    content
  );

  logger.info(`[B站集成] 知识库文档已创建: ${docUrl}`);
  return docUrl;
}

/**
 * 示例 3: 下载并保存到本地
 */
export async function downloadBilibiliVideo(
  url: string,
  saveToLocal: boolean = false
): Promise<BilibiliVideoResult> {
  logger.info(`[B站集成] 下载视频: ${url}`);

  // 下载视频和音频
  const result = await fetchBilibiliVideo(url, {
    downloadVideo: true,
    extractAudio: true,
  });

  if (!result.success) {
    throw new Error(`视频下载失败: ${result.error}`);
  }

  logger.info(`[B站集成] 视频下载完成`);
  logger.info(`  视频文件: ${result.videoPath || 'N/A'}`);
  logger.info(`  音频文件: ${result.audioPath || 'N/A'}`);

  // 如果不需要保存到本地，使用完后清理
  if (!saveToLocal) {
    cleanupFiles(result);
    logger.info(`[B站集成] 临时文件已清理`);
  }

  return result;
}

/**
 * 示例 4: 完整工作流（提取 → 保存 → 转录）
 */
export async function processBilibiliVideoComplete(url: string): Promise<{
  bitableRecordId?: string;
  wikiDocUrl?: string;
  audioPath?: string;
  transcription?: string;
}> {
  logger.info(`[B站集成] 开始完整处理流程: ${url}`);

  // 1. 提取视频信息
  logger.info(`[B站集成] 步骤 1/4: 提取视频信息`);
  const infoResult = await fetchBilibiliVideo(url);

  if (!infoResult.success || !infoResult.info) {
    throw new Error(`视频信息提取失败: ${infoResult.error}`);
  }

  const info = infoResult.info;
  logger.info(`[B站集成] 视频标题: ${info.title}`);

  // 2. 保存到多维表格
  logger.info(`[B站集成] 步骤 2/4: 保存到多维表格`);
  const bitableRecord = await createBitableRecord({
    [fieldConfig.title]: info.title,
    [fieldConfig.author]: info.author,
    [fieldConfig.source]: 'B站',
    [fieldConfig.originalUrl]: url,
    [fieldConfig.summary]: info.description,
    [fieldConfig.publishTime]: info.publishDate,
    [fieldConfig.collectTime]: new Date().toISOString(),
    [extendedFieldConfig.contentType]: '视频',
    [extendedFieldConfig.videoDuration]: info.duration,
  });

  logger.info(`[B站集成] 多维表格记录 ID: ${bitableRecord.record_id}`);

  // 3. 创建知识库文档
  logger.info(`[B站集成] 步骤 3/4: 创建知识库文档`);
  const wikiDocUrl = await createBilibiliWikiDoc(url);

  // 4. 提取音频（如果时长适合转录）
  let audioPath: string | undefined;
  let transcription: string | undefined;

  const shouldTranscribe = info.duration <= 7200; // 120分钟
  if (shouldTranscribe) {
    logger.info(`[B站集成] 步骤 4/4: 提取音频准备转录`);

    const audioResult = await fetchBilibiliVideo(url, {
      extractAudio: true,
    });

    if (audioResult.success && audioResult.audioPath) {
      audioPath = audioResult.audioPath;
      logger.info(`[B站集成] 音频文件: ${audioPath}`);

      // 这里可以调用转录服务
      // transcription = await transcribeAudio(audioPath);
      logger.info(`[B站集成] 音频转录功能待集成`);
    }
  } else {
    logger.warn(`[B站集成] 步骤 4/4: 视频时长过长 (${Math.floor(info.duration / 60)}分钟)，跳过转录`);
  }

  logger.info(`[B站集成] 完整处理流程完成`);

  return {
    bitableRecordId: bitableRecord.record_id,
    wikiDocUrl,
    audioPath,
    transcription,
  };
}

/**
 * 示例 5: 批量处理
 */
export async function processBatchBilibiliVideos(urls: string[]): Promise<void> {
  logger.info(`[B站集成] 批量处理 ${urls.length} 个视频`);

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    logger.info(`[B站集成] 处理 ${i + 1}/${urls.length}: ${url}`);

    try {
      await saveBilibiliToFeishu(url);
      results.push({ url, success: true });
      logger.info(`[B站集成] ✓ 完成 ${i + 1}/${urls.length}`);
    } catch (error: any) {
      logger.error(`[B站集成] ✗ 失败 ${i + 1}/${urls.length}: ${error.message}`);
      results.push({ url, success: false, error: error.message });
    }

    // 避免请求过快
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  logger.info(`[B站集成] 批量处理完成: 成功 ${successCount}, 失败 ${failCount}`);
}

/**
 * 示例 6: 错误处理和重试
 */
export async function fetchBilibiliWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<BilibiliVideoResult> {
  logger.info(`[B站集成] 开始提取（最多重试 ${maxRetries} 次）: ${url}`);

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info(`[B站集成] 尝试 ${attempt}/${maxRetries}`);

    try {
      const result = await fetchBilibiliVideo(url);

      if (result.success) {
        logger.info(`[B站集成] 成功（第 ${attempt} 次尝试）`);
        return result;
      }

      lastError = result.error;

      // 某些错误不需要重试
      if (
        result.error?.includes('URL 无效') ||
        result.error?.includes('视频不存在')
      ) {
        logger.warn(`[B站集成] 不可重试的错误，停止: ${result.error}`);
        return result;
      }

      logger.warn(`[B站集成] 失败，准备重试: ${result.error}`);

      // 等待后重试
      if (attempt < maxRetries) {
        const delay = attempt * 2000; // 递增延迟：2s, 4s, 6s
        logger.info(`[B站集成] 等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      lastError = error.message;
      logger.error(`[B站集成] 异常: ${error.message}`);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  logger.error(`[B站集成] 所有尝试失败`);
  return {
    success: false,
    error: `所有尝试失败（最后错误: ${lastError}）`,
  };
}

// 导出所有示例函数
export default {
  saveBilibiliToFeishu,
  createBilibiliWikiDoc,
  downloadBilibiliVideo,
  processBilibiliVideoComplete,
  processBatchBilibiliVideos,
  fetchBilibiliWithRetry,
};
