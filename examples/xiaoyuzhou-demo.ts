/**
 * 小宇宙播客提取示例
 * 
 * 使用示例：
 * ```bash
 * npx ts-node examples/xiaoyuzhou-demo.ts
 * ```
 */

import { fetchXiaoyuzhouPodcast, cleanupFiles } from '../src/services/xiaoyuzhou-fetcher';

async function main() {
  // 示例：小宇宙播客链接
  const url = process.argv[2] || 'https://www.xiaoyuzhoufm.com/episode/xxx';

  console.log(`\n📻 开始处理小宇宙播客: ${url}\n`);

  try {
    // 提取播客信息（不下载音频）
    console.log('1️⃣ 提取播客信息...');
    const result1 = await fetchXiaoyuzhouPodcast(url, {
      downloadAudio: false,
    });

    if (!result1.success) {
      console.error(`❌ 提取失败: ${result1.error}`);
      return;
    }

    console.log('\n✅ 播客信息提取成功:');
    console.log(`   标题: ${result1.info?.title}`);
    console.log(`   播客名称: ${result1.info?.podcastName}`);
    console.log(`   主播: ${result1.info?.host}`);
    console.log(`   时长: ${Math.floor((result1.info?.duration || 0) / 60)}:${((result1.info?.duration || 0) % 60).toString().padStart(2, '0')}`);
    console.log(`   发布时间: ${result1.info?.publishDate}`);
    console.log(`   简介: ${result1.info?.description.substring(0, 100)}...`);
    console.log(`   封面图: ${result1.info?.thumbnail}`);
    console.log(`   单集 ID: ${result1.info?.episodeId}`);

    // 下载音频
    console.log('\n2️⃣ 下载音频...');
    const result2 = await fetchXiaoyuzhouPodcast(url, {
      downloadAudio: true,
    });

    if (!result2.success) {
      console.error(`❌ 下载失败: ${result2.error}`);
      return;
    }

    console.log(`\n✅ 音频下载成功: ${result2.audioPath}`);

    // 清理文件（可选）
    // cleanupFiles(result2);

  } catch (error: any) {
    console.error(`\n❌ 处理失败: ${error.message}`);
    process.exit(1);
  }
}

main();
