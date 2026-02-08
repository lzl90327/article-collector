#!/usr/bin/env ts-node

/**
 * B站视频信息提取快速演示
 * 
 * 这是一个最简单的使用示例，展示核心功能
 */

import { fetchBilibiliVideo, cleanupFiles } from '../src/services/bilibili-fetcher';

async function demo() {
  console.log('\n🎬 B站视频信息提取演示\n');

  // 示例视频链接（请替换为真实链接）
  const testUrl = 'https://www.bilibili.com/video/BV1xx411c7XZ';

  try {
    // 1. 提取视频信息（最基础的用法）
    console.log('📋 正在提取视频信息...');
    const result = await fetchBilibiliVideo(testUrl);

    if (!result.success) {
      console.error('❌ 提取失败:', result.error);
      return;
    }

    // 2. 显示视频信息
    const info = result.info!;
    console.log('\n✅ 提取成功!\n');
    console.log(`标题: ${info.title}`);
    console.log(`作者: ${info.author}`);
    console.log(`时长: ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
    console.log(`发布时间: ${info.publishDate}`);
    console.log(`BV号: ${info.bvid}`);
    console.log(`观看数: ${info.viewCount?.toLocaleString() || 'N/A'}`);
    console.log(`点赞数: ${info.likeCount?.toLocaleString() || 'N/A'}`);

    // 3. 如果需要下载视频（取消注释以下代码）
    /*
    console.log('\n📥 正在下载视频...');
    const downloadResult = await fetchBilibiliVideo(testUrl, {
      downloadVideo: true,
    });

    if (downloadResult.success && downloadResult.videoPath) {
      console.log(`✅ 视频已下载: ${downloadResult.videoPath}`);
      
      // 使用完后清理
      cleanupFiles(downloadResult);
      console.log('🗑️  临时文件已清理');
    }
    */

    // 4. 如果需要提取音频（取消注释以下代码）
    /*
    console.log('\n🎵 正在提取音频...');
    const audioResult = await fetchBilibiliVideo(testUrl, {
      extractAudio: true,
    });

    if (audioResult.success && audioResult.audioPath) {
      console.log(`✅ 音频已提取: ${audioResult.audioPath}`);
      
      // 使用完后清理
      cleanupFiles(audioResult);
      console.log('🗑️  临时文件已清理');
    }
    */

    console.log('\n✨ 演示完成\n');

  } catch (error: any) {
    console.error('\n❌ 错误:', error.message);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  // 从命令行参数获取 URL（如果提供）
  const urlArg = process.argv[2];
  
  if (urlArg) {
    console.log(`\n使用自定义 URL: ${urlArg}\n`);
    
    fetchBilibiliVideo(urlArg)
      .then(result => {
        if (result.success && result.info) {
          console.log('\n✅ 成功!\n');
          console.log('视频信息:');
          console.log(JSON.stringify(result.info, null, 2));
        } else {
          console.error('\n❌ 失败:', result.error);
        }
      })
      .catch(error => {
        console.error('\n❌ 错误:', error.message);
      });
  } else {
    // 运行演示
    demo();
  }
}

export { demo };
