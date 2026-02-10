#!/bin/bash

##############################################################################
# B站视频信息提取测试脚本
#
# 用法:
#   ./scripts/test-bilibili.sh <B站视频链接>
#
# 示例:
#   ./scripts/test-bilibili.sh "https://www.bilibili.com/video/BV1xx411c7XZ"
#   ./scripts/test-bilibili.sh "https://b23.tv/abc123"
#
# 选项:
#   DOWNLOAD_VIDEO=true    - 下载视频
#   EXTRACT_AUDIO=true     - 提取音频
#   LOG_LEVEL=debug        - 显示详细日志
#
# 示例（下载视频和音频）:
#   DOWNLOAD_VIDEO=true EXTRACT_AUDIO=true ./scripts/test-bilibili.sh <URL>
##############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ 错误: 缺少视频链接参数${NC}"
    echo ""
    echo "用法:"
    echo "  $0 <B站视频链接>"
    echo ""
    echo "示例:"
    echo "  $0 \"https://www.bilibili.com/video/BV1xx411c7XZ\""
    echo "  $0 \"https://b23.tv/abc123\""
    echo ""
    echo "选项:"
    echo "  DOWNLOAD_VIDEO=true    - 下载视频"
    echo "  EXTRACT_AUDIO=true     - 提取音频"
    echo "  LOG_LEVEL=debug        - 显示详细日志"
    echo ""
    echo "完整示例:"
    echo "  DOWNLOAD_VIDEO=true EXTRACT_AUDIO=true $0 <URL>"
    exit 1
fi

VIDEO_URL="$1"

# 检查 URL 格式
if ! echo "$VIDEO_URL" | grep -qE '(bilibili\.com|b23\.tv)'; then
    echo -e "${RED}❌ 错误: 不是有效的 B站链接${NC}"
    echo "URL 必须包含 bilibili.com 或 b23.tv"
    exit 1
fi

# 检查依赖
echo -e "${BLUE}🔍 检查依赖...${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Node.js: $(node --version)${NC}"

# 检查 ts-node
if ! command -v ts-node &> /dev/null && ! [ -f "$PROJECT_ROOT/node_modules/.bin/ts-node" ]; then
    echo -e "${RED}❌ ts-node 未安装${NC}"
    echo "运行: npm install"
    exit 1
fi
echo -e "${GREEN}  ✓ ts-node${NC}"

# 检查 yt-dlp（支持 python3 -m yt_dlp 回退）
YTDLP_CMD="yt-dlp"
if ! command -v yt-dlp &> /dev/null; then
    if python3 -c "import yt_dlp" 2>/dev/null; then
        YTDLP_CMD="python3 -m yt_dlp"
        echo -e "${GREEN}  ✓ 使用回退命令: ${YTDLP_CMD}${NC}"
    else
        echo -e "${YELLOW}⚠️  yt-dlp 未安装${NC}"
        echo ""
        echo "安装方法:"
        echo "  macOS:   brew install yt-dlp"
        echo "  Linux:   pip install yt-dlp"
        echo "  或访问:  https://github.com/yt-dlp/yt-dlp"
        echo ""
        read -p "是否继续测试（仅测试信息提取，不下载视频）? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        # 禁用下载功能
        export DOWNLOAD_VIDEO=false
        export EXTRACT_AUDIO=false
    fi
else
    echo -e "${GREEN}  ✓ yt-dlp: $(yt-dlp --version | head -n1)${NC}"
fi

# 检查 ffmpeg（音频提取需要）
if [ "$EXTRACT_AUDIO" = "true" ]; then
    if ! command -v ffmpeg &> /dev/null; then
        echo -e "${YELLOW}⚠️  ffmpeg 未安装（音频提取需要）${NC}"
        echo "安装方法: brew install ffmpeg"
        export EXTRACT_AUDIO=false
    else
        echo -e "${GREEN}  ✓ ffmpeg: $(ffmpeg -version | head -n1)${NC}"
    fi
fi

echo ""

# 进入项目目录
cd "$PROJECT_ROOT"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env 文件不存在${NC}"
    echo "某些功能可能无法使用（如 Cookie 认证）"
    echo ""
fi

# 显示配置
echo -e "${BLUE}📋 测试配置:${NC}"
echo "  视频链接: $VIDEO_URL"
echo "  下载视频: ${DOWNLOAD_VIDEO:-false}"
echo "  提取音频: ${EXTRACT_AUDIO:-false}"
echo "  日志级别: ${LOG_LEVEL:-info}"
echo ""

# 设置环境变量
export DOWNLOAD_VIDEO="${DOWNLOAD_VIDEO:-false}"
export EXTRACT_AUDIO="${EXTRACT_AUDIO:-false}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export YT_DLP_PATH="${YT_DLP_CMD}"

# 运行测试
echo -e "${BLUE}🚀 开始测试...${NC}"
echo ""

# 使用 ts-node 运行测试脚本
if [ -f "$PROJECT_ROOT/node_modules/.bin/ts-node" ]; then
    "$PROJECT_ROOT/node_modules/.bin/ts-node" "$SCRIPT_DIR/test-bilibili.ts" "$VIDEO_URL"
else
    ts-node "$SCRIPT_DIR/test-bilibili.ts" "$VIDEO_URL"
fi

# 检查执行结果
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 测试成功完成${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ 测试失败${NC}"
    exit 1
fi
