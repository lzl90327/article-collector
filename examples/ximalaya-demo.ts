/**
 * 喜马拉雅播客提取示例
 * 
 * 演示如何使用 ximalaya-fetcher 提取和下载喜马拉雅播客
 */

import { fetchXimalayaPodcast, cleanupFiles } from '../src/services/ximalaya-fetcher';

async function main() {
  // 示例 URL（请替换为实际的喜马拉雅播客链接）
  const urls = [
    'https://www.ximalaya.com/sound/12345678',
    'https://www.ximalaya.com/album/xxx/12345678',
  ];

  for (const url of urls) {
    console.log(`\n处理 URL: ${url}`);
    console.log('='.repeat(50));

    try {
      // 1. 仅提取信息
      console.log('\n1. 提取播客信息...');
      const infoResult = await fetchXimalayaPodcast(url, {
        downloadAudio: false,
      });

      if (!infoResult.success) {
        console.error(`❌ 提取失败: ${infoResult.error}`);
        continue;
      }

      const info = infoResult.info!;
      console.log('✅ 提取成功！');
      console.log(`   标题: ${info.title}`);
      console.log(`   专辑: ${info.albumName}`);
      console.log(`   主播: ${info.host}`);
      console.log(`   时长: ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
      console.log(`   发布时间: ${info.publishDate}`);
      console.log(`   音频ID: ${info.soundId}`);
      if (info.playCount) {
        console.log(`   播放数: ${info.playCount}`);
      }
      console.log(`   简介: ${info.description.substring(0, 100)}...`);
      console.log(`   封面: ${info.thumbnail}`);

      // 2. 下载音频（可选）
      console.log('\n2. 下载音频...');
      const downloadResult = await fetchXimalayaPodcast(url, {
        downloadAudio: true,
      });

      if (!downloadResult.success) {
        console.error(`❌ 下载失败: ${downloadResult.error}`);
        continue;
      }

      if (downloadResult.audioPath) {
        console.log(`✅ 下载成功: ${downloadResult.audioPath}`);
        
        // 使用完后清理文件
        // cleanupFiles(downloadResult);
      }

    } catch (error: any) {
      console.error(`❌ 处理失败: ${error.message}`);
      console.error(error.stack);
    }
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}
