#!/usr/bin/env ts-node

/**
 * B站视频信息提取测试脚本
 * 
 * 用法:
 *   ts-node scripts/test-bilibili.ts <B站视频链接>
 * 
 * 示例:
 *   ts-node scripts/test-bilibili.ts "https://www.bilibili.com/video/BV1xx411c7XZ"
 *   ts-node scripts/test-bilibili.ts "https://b23.tv/abc123"
 */

import { fetchBilibiliVideo, cleanupFiles } from '../src/services/bilibili-fetcher';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('test-bilibili');

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('❌ 缺少参数');
    console.error('用法: ts-node scripts/test-bilibili.ts <B站视频链接>');
    console.error('');
    console.error('示例:');
    console.error('  ts-node scripts/test-bilibili.ts "https://www.bilibili.com/video/BV1xx411c7XZ"');
    console.error('  ts-node scripts/test-bilibili.ts "https://b23.tv/abc123"');
    process.exit(1);
  }
  
  console.log('');
  logger.info('========================================');
  logger.info('  B站视频信息提取测试');
  logger.info('========================================');
  console.log('');
  
  // 步骤 1: 提取视频信息
  logger.info('【步骤 1/3】提取视频信息...');
  console.log('');
  
  const infoResult = await fetchBilibiliVideo(url);
  
  if (!infoResult.success) {
    logger.error(`❌ 提取失败: ${infoResult.error}`);
    process.exit(1);
  }
  
  const info = infoResult.info!;
  
  console.log('✅ 视频信息提取成功:');
  console.log('');
  console.log(`  📌 标题: ${info.title}`);
  console.log(`  👤 作者: ${info.author}`);
  console.log(`  🕒 时长: ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
  console.log(`  📅 发布时间: ${info.publishDate}`);
  console.log(`  🔗 BV号: ${info.bvid}`);
  console.log(`  👁️  观看数: ${info.viewCount?.toLocaleString() || 'N/A'}`);
  console.log(`  👍 点赞数: ${info.likeCount?.toLocaleString() || 'N/A'}`);
  console.log(`  🏷️  标签: ${info.tags.slice(0, 5).join(', ') || '无'}`);
  console.log(`  🖼️  封面: ${info.thumbnail.substring(0, 60)}...`);
  console.log('');
  
  if (info.description) {
    console.log('  📝 简介:');
    const descLines = info.description.split('\n').slice(0, 3);
    descLines.forEach(line => {
      console.log(`      ${line}`);
    });
    if (info.description.split('\n').length > 3) {
      console.log('      ...');
    }
    console.log('');
  }
  
  // 步骤 2: 下载视频（可选）
  const shouldDownload = process.env.DOWNLOAD_VIDEO === 'true';
  
  if (shouldDownload) {
    logger.info('【步骤 2/3】下载视频...');
    console.log('');
    
    const downloadResult = await fetchBilibiliVideo(url, {
      downloadVideo: true,
    });
    
    if (downloadResult.success && downloadResult.videoPath) {
      console.log(`✅ 视频下载成功: ${downloadResult.videoPath}`);
      console.log('');
      
      // 清理视频文件
      setTimeout(() => {
        cleanupFiles(downloadResult);
        logger.info('🗑️  已清理视频文件');
      }, 1000);
    } else {
      logger.error(`❌ 视频下载失败: ${downloadResult.error}`);
    }
  } else {
    logger.info('【步骤 2/3】跳过视频下载（设置 DOWNLOAD_VIDEO=true 启用）');
    console.log('');
  }
  
  // 步骤 3: 提取音频（可选）
  const shouldExtractAudio = process.env.EXTRACT_AUDIO === 'true';
  
  if (shouldExtractAudio) {
    logger.info('【步骤 3/3】提取音频...');
    console.log('');
    
    const audioResult = await fetchBilibiliVideo(url, {
      extractAudio: true,
    });
    
    if (audioResult.success && audioResult.audioPath) {
      console.log(`✅ 音频提取成功: ${audioResult.audioPath}`);
      console.log(`   音频时长: ${info.duration} 秒`);
      console.log('');
      
      // 清理音频文件
      setTimeout(() => {
        cleanupFiles(audioResult);
        logger.info('🗑️  已清理音频文件');
      }, 1000);
    } else {
      logger.error(`❌ 音频提取失败: ${audioResult.error}`);
    }
  } else {
    logger.info('【步骤 3/3】跳过音频提取（设置 EXTRACT_AUDIO=true 启用）');
    console.log('');
  }
  
  // 总结
  console.log('');
  logger.info('========================================');
  logger.info('  测试完成');
  logger.info('========================================');
  console.log('');
  console.log('💡 提示:');
  console.log('  - 设置 DOWNLOAD_VIDEO=true 可测试视频下载');
  console.log('  - 设置 EXTRACT_AUDIO=true 可测试音频提取');
  console.log('  - 示例: DOWNLOAD_VIDEO=true ts-node scripts/test-bilibili.ts <URL>');
  console.log('');
}

main().catch((error) => {
  logger.error('❌ 测试失败:', error.message);
  if (error.stack) {
    logger.debug(error.stack);
  }
  process.exit(1);
});
