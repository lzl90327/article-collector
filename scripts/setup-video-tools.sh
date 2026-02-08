#!/bin/bash

##############################################################################
# 视频/播客功能依赖安装脚本
# 
# 功能:
# - 检查 Python 3.11+ 环境
# - 安装 yt-dlp (B站视频下载)
# - 安装 faster-whisper (音频转录)
# - 安装 FFmpeg (关键帧提取)
# - 下载 Whisper 模型
# - 测试工具可用性
##############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" &> /dev/null
}

##############################################################################
# 1. 检查 Python 环境
##############################################################################
log_info "检查 Python 环境..."

if ! command_exists python3; then
    log_error "未找到 python3，请先安装 Python 3.11+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
log_success "Python 版本: $PYTHON_VERSION"

# 检查 Python 版本是否 >= 3.11
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
    log_error "Python 版本过低（需要 3.11+），当前版本: $PYTHON_VERSION"
    log_info "请升级 Python: brew install python@3.11"
    exit 1
fi

log_success "Python 版本符合要求 (>= 3.11)"

##############################################################################
# 2. 安装 yt-dlp
##############################################################################
log_info "检查 yt-dlp..."

if command_exists yt-dlp; then
    YT_DLP_VERSION=$(yt-dlp --version)
    log_success "yt-dlp 已安装，版本: $YT_DLP_VERSION"
else
    log_warn "yt-dlp 未安装，开始安装..."
    
    if command_exists brew; then
        brew install yt-dlp
    elif command_exists pip3; then
        pip3 install -U yt-dlp
    else
        log_error "无法安装 yt-dlp，请手动安装"
        log_info "macOS: brew install yt-dlp"
        log_info "Linux: pip3 install -U yt-dlp"
        exit 1
    fi
    
    log_success "yt-dlp 安装完成"
fi

##############################################################################
# 3. 安装 FFmpeg
##############################################################################
log_info "检查 FFmpeg..."

if command_exists ffmpeg; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n1 | awk '{print $3}')
    log_success "FFmpeg 已安装，版本: $FFMPEG_VERSION"
else
    log_warn "FFmpeg 未安装，开始安装..."
    
    if command_exists brew; then
        brew install ffmpeg
    elif command_exists apt-get; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    elif command_exists yum; then
        sudo yum install -y ffmpeg
    else
        log_error "无法自动安装 FFmpeg，请手动安装"
        log_info "macOS: brew install ffmpeg"
        log_info "Ubuntu/Debian: sudo apt-get install ffmpeg"
        log_info "CentOS/RHEL: sudo yum install ffmpeg"
        exit 1
    fi
    
    log_success "FFmpeg 安装完成"
fi

##############################################################################
# 4. 安装 faster-whisper
##############################################################################
log_info "检查 faster-whisper..."

if python3 -c "import faster_whisper" 2>/dev/null; then
    log_success "faster-whisper 已安装"
else
    log_warn "faster-whisper 未安装，开始安装..."
    pip3 install faster-whisper
    log_success "faster-whisper 安装完成"
fi

##############################################################################
# 5. 安装 fluent-ffmpeg (Node.js)
##############################################################################
log_info "检查 fluent-ffmpeg..."

cd "$(dirname "$0")/.." || exit 1

if npm list fluent-ffmpeg >/dev/null 2>&1; then
    log_success "fluent-ffmpeg 已安装"
else
    log_warn "fluent-ffmpeg 未安装，开始安装..."
    npm install --save fluent-ffmpeg
    log_success "fluent-ffmpeg 安装完成"
fi

##############################################################################
# 6. 测试 Whisper 模型下载
##############################################################################
log_info "测试 Whisper 模型..."

TEMP_TEST_SCRIPT=$(mktemp)
cat > "$TEMP_TEST_SCRIPT" << 'EOF'
import sys
from faster_whisper import WhisperModel

try:
    print("正在加载 Whisper base 模型（首次会自动下载）...")
    model = WhisperModel("base", device="cpu", compute_type="int8")
    print("✓ Whisper 模型加载成功")
    sys.exit(0)
except Exception as e:
    print(f"✗ Whisper 模型加载失败: {e}")
    sys.exit(1)
EOF

if python3 "$TEMP_TEST_SCRIPT"; then
    log_success "Whisper 模型测试通过"
else
    log_error "Whisper 模型测试失败"
    log_info "请检查网络连接和磁盘空间"
    rm -f "$TEMP_TEST_SCRIPT"
    exit 1
fi

rm -f "$TEMP_TEST_SCRIPT"

##############################################################################
# 7. 可选：安装 Douyin API（需要用户手动操作）
##############################################################################
log_info "抖音 API 服务（可选）"
log_info "如需支持抖音视频，请手动安装 Douyin_TikTok_Download_API:"
log_info "  1. git clone https://github.com/Evil0ctal/Douyin_TikTok_Download_API.git"
log_info "  2. cd Douyin_TikTok_Download_API"
log_info "  3. pip install -r requirements.txt"
log_info "  4. python app.py（或使用 Docker）"
log_info "  5. 配置 .env: DOUYIN_API_URL=http://localhost:5557"

##############################################################################
# 总结
##############################################################################
echo ""
log_success "========================================="
log_success "视频/播客功能依赖安装完成！"
log_success "========================================="
echo ""
log_info "已安装的工具:"
echo "  ✓ Python $PYTHON_VERSION"
echo "  ✓ yt-dlp (B站视频下载)"
echo "  ✓ FFmpeg (关键帧提取)"
echo "  ✓ faster-whisper (音频转录)"
echo "  ✓ fluent-ffmpeg (Node.js)"
echo ""
log_info "下一步:"
echo "  1. 配置 .env 文件（参考 .env.example）"
echo "  2. （可选）启动 Douyin API 服务"
echo "  3. 运行 npm run dev 启动服务"
echo ""
log_info "快速测试:"
echo "  npm run typecheck    # 检查 TypeScript 编译"
echo "  yt-dlp --version     # 检查 yt-dlp 版本"
echo "  ffmpeg -version      # 检查 FFmpeg 版本"
echo ""
