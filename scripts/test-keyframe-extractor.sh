#!/bin/bash

# 关键帧提取功能测试脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 FFmpeg
log_info "检查 FFmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    log_error "FFmpeg 未安装"
    echo "安装方法: brew install ffmpeg"
    exit 1
fi
FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')
log_info "FFmpeg 版本: $FFMPEG_VERSION"

# 检查 Node.js
log_info "检查 Node.js..."
if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装"
    exit 1
fi
NODE_VERSION=$(node --version)
log_info "Node.js 版本: $NODE_VERSION"

# 检查 TypeScript
log_info "检查 TypeScript..."
if ! command -v ts-node &> /dev/null; then
    log_warn "ts-node 未安装，尝试使用 npx..."
    TS_NODE="npx ts-node"
else
    TS_NODE="ts-node"
fi

# 测试视频文件（如果提供）
VIDEO_FILE="${1:-}"
if [ -z "$VIDEO_FILE" ]; then
    log_warn "未提供测试视频文件"
    echo "用法: $0 <video_file>"
    echo ""
    echo "示例:"
    echo "  $0 test-video.mp4"
    echo "  $0 /path/to/video.mp4"
    exit 1
fi

if [ ! -f "$VIDEO_FILE" ]; then
    log_error "视频文件不存在: $VIDEO_FILE"
    exit 1
fi

log_info "测试视频: $VIDEO_FILE"

# 创建测试输出目录
OUTPUT_DIR="./test-keyframes-$(date +%s)"
mkdir -p "$OUTPUT_DIR"
log_info "输出目录: $OUTPUT_DIR"

# 运行演示
log_info "运行关键帧提取演示..."
$TS_NODE examples/keyframe-extractor-demo.ts "$VIDEO_FILE" "$OUTPUT_DIR"

# 检查结果
if [ $? -eq 0 ]; then
    log_info "✅ 测试完成"
    
    # 统计生成的文件
    FRAME_COUNT=$(find "$OUTPUT_DIR" -name "frame*.jpg" -o -name "frame*.png" | wc -l | tr -d ' ')
    if [ "$FRAME_COUNT" -gt 0 ]; then
        log_info "生成了 $FRAME_COUNT 个关键帧文件"
        echo ""
        echo "生成的文件:"
        find "$OUTPUT_DIR" -name "frame*.jpg" -o -name "frame*.png" | head -10 | while read file; do
            echo "  - $file"
        done
        if [ "$FRAME_COUNT" -gt 10 ]; then
            echo "  ... 还有 $((FRAME_COUNT - 10)) 个文件"
        fi
    else
        log_warn "未生成任何关键帧文件"
    fi
    
    echo ""
    log_info "输出目录: $OUTPUT_DIR"
    log_info "可以手动清理: rm -rf $OUTPUT_DIR"
else
    log_error "测试失败"
    exit 1
fi
