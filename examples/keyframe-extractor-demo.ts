/**
 * 关键帧提取功能演示
 * 
 * 使用示例：
 *   ts-node examples/keyframe-extractor-demo.ts <video_path> [output_dir]
 */

import path from 'path';
import { extractKeyframes, cleanupOutputDir, cleanupFrames } from '../src/services/keyframe-extractor';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: ts-node examples/keyframe-extractor-demo.ts <video_path> [output_dir]');
    console.log('');
    console.log('示例:');
    console.log('  ts-node examples/keyframe-extractor-demo.ts video.mp4');
    console.log('  ts-node examples/keyframe-extractor-demo.ts video.mp4 ./frames');
    process.exit(1);
  }

  const videoPath = args[0];
  const outputDir = args[1] || path.join(process.cwd(), 'keyframes');

  console.log('='.repeat(60));
  console.log('关键帧提取演示');
  console.log('='.repeat(60));
  console.log(`视频文件: ${videoPath}`);
  console.log(`输出目录: ${outputDir}`);
  console.log('');

  // 示例 1: 默认配置提取
  console.log('[示例 1] 使用默认配置提取关键帧...');
  const result1 = await extractKeyframes(videoPath, outputDir);
  
  if (result1.success) {
    console.log(`✅ 成功提取 ${result1.totalFrames} 个关键帧`);
    if (result1.frames) {
      console.log('\n前 5 个关键帧:');
      result1.frames.slice(0, 5).forEach((frame, i) => {
        console.log(`  ${i + 1}. ${path.basename(frame.path)} - ${frame.timestamp.toFixed(2)}s`);
      });
    }
  } else {
    console.log(`❌ 提取失败: ${result1.error}`);
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // 示例 2: 自定义配置提取
  console.log('[示例 2] 使用自定义配置提取关键帧...');
  const customOutputDir = path.join(outputDir, 'custom');
  const result2 = await extractKeyframes(videoPath, customOutputDir, {
    sceneThreshold: 0.3,  // 更高的阈值，更少的帧
    maxFrames: 20,
    format: 'png',
    quality: 90,
  });

  if (result2.success) {
    console.log(`✅ 成功提取 ${result2.totalFrames} 个关键帧`);
    if (result2.frames) {
      console.log('\n所有关键帧:');
      result2.frames.forEach((frame, i) => {
        console.log(`  ${i + 1}. ${path.basename(frame.path)} - ${frame.timestamp.toFixed(2)}s`);
      });
    }
  } else {
    console.log(`❌ 提取失败: ${result2.error}`);
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // 示例 3: 清理文件
  console.log('[示例 3] 清理提取的关键帧文件...');
  if (result2.success && result2.frames) {
    cleanupFrames(result2.frames.map(f => f.path));
    console.log('✅ 已清理自定义配置提取的文件');
  }
  
  // 清理整个输出目录
  cleanupOutputDir(outputDir, 'jpg');
  console.log('✅ 已清理输出目录中的 JPG 文件');

  console.log('\n' + '='.repeat(60));
  console.log('演示完成');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('❌ 发生错误:', error);
  process.exit(1);
});
