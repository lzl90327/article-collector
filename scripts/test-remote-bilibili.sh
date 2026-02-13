#!/bin/bash
# ========================================
# 远程测试 B 站视频下载和分析功能
# ========================================

set -e

REMOTE_HOST="lizuolin_cloud@100.117.165.59"
REMOTE_DIR="/Users/lizuolin_cloud/article-collector"

# 测试用的 B 站视频链接（这个是之前测试过的，有效期短）
TEST_URL="https://www.bilibili.com/video/BV1kXcczfECq"

echo "========================================"
echo "远程测试 B 站视频功能"
echo "========================================"
echo ""
echo "测试链接: $TEST_URL"
echo ""

# 1. 测试元数据提取
echo "步骤 1/3: 测试元数据提取..."
ssh "$REMOTE_HOST" "zsh -l -c 'cd $REMOTE_DIR && node -e \"
const { fetchBilibiliVideo } = require(\\\"./dist/services/bilibili-fetcher\\\");

(async () => {
  try {
    const result = await fetchBilibiliVideo(\\\"$TEST_URL\\\", {
      downloadAudio: false,
      extractKeyframes: false
    });
    
    if (result.success) {
      console.log(\\\"✅ 元数据提取成功\\\");
      console.log(\\\"标题:\\\", result.info.title);
      console.log(\\\"作者:\\\", result.info.author);
      console.log(\\\"时长:\\\", Math.floor(result.info.duration / 60), \\\"分钟\\\");
      process.exit(0);
    } else {
      console.error(\\\"❌ 元数据提取失败:\\\", result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error(\\\"❌ 测试异常:\\\", error.message);
    process.exit(1);
  }
})();
\"'" || echo "❌ 步骤 1 失败"

echo ""

# 2. 测试音频下载
echo "步骤 2/3: 测试音频下载..."
ssh "$REMOTE_HOST" "zsh -l -c 'cd $REMOTE_DIR && node -e \"
const { fetchBilibiliVideo } = require(\\\"./dist/services/bilibili-fetcher\\\");

(async () => {
  try {
    const result = await fetchBilibiliVideo(\\\"$TEST_URL\\\", {
      downloadAudio: true,
      extractKeyframes: false
    });
    
    if (result.success && result.audioPath) {
      console.log(\\\"✅ 音频下载成功\\\");
      console.log(\\\"音频路径:\\\", result.audioPath);
      process.exit(0);
    } else {
      console.error(\\\"❌ 音频下载失败:\\\", result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error(\\\"❌ 测试异常:\\\", error.message);
    process.exit(1);
  }
})();
\"'" || echo "❌ 步骤 2 失败"

echo ""

# 3. 测试关键帧提取
echo "步骤 3/3: 测试关键帧提取..."
ssh "$REMOTE_HOST" "zsh -l -c 'cd $REMOTE_DIR && node -e \"
const { fetchBilibiliVideo } = require(\\\"./dist/services/bilibili-fetcher\\\");

(async () => {
  try {
    const result = await fetchBilibiliVideo(\\\"$TEST_URL\\\", {
      downloadAudio: false,
      extractKeyframes: true,
      keyframeCount: 3
    });
    
    if (result.success && result.keyframes && result.keyframes.length > 0) {
      console.log(\\\"✅ 关键帧提取成功\\\");
      console.log(\\\"关键帧数量:\\\", result.keyframes.length);
      result.keyframes.forEach((kf, idx) => {
        console.log(\\\`  关键帧 \\\${idx + 1}: \\\${kf.timestamp}s - \\\${kf.path}\\\`);
      });
      process.exit(0);
    } else {
      console.error(\\\"❌ 关键帧提取失败:\\\", result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error(\\\"❌ 测试异常:\\\", error.message);
    process.exit(1);
  }
})();
\"'" || echo "❌ 步骤 3 失败"

echo ""
echo "========================================"
echo "测试完成"
echo "========================================"
