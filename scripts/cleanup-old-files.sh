#!/bin/bash

##############################################################################
# 文件清理定时任务脚本
# 
# 功能：
# - 清理 30 天以上的视频/音频/图片临时文件
# - 支持 crontab 调度
# - 记录清理日志
#
# 使用方法：
#   1. 手动执行: ./scripts/cleanup-old-files.sh
#   2. 定时任务: crontab -e
#      0 2 * * * /path/to/scripts/cleanup-old-files.sh >> /path/to/logs/cleanup.log 2>&1
##############################################################################

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 配置
MAX_AGE_DAYS=${MAX_AGE_DAYS:-30}  # 默认 30 天
TEMP_BASE_DIR="$PROJECT_ROOT/temp"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 统计变量
TOTAL_SCANNED=0
TOTAL_DELETED=0
TOTAL_FREED=0

echo "=========================================="
echo "  文件自动清理任务"
echo "=========================================="
echo ""
log_info "开始执行文件清理任务"
log_info "配置: 清理 ${MAX_AGE_DAYS} 天以上的临时文件"
echo ""

# 清理函数
cleanup_directory() {
    local dir=$1
    local description=$2
    local extensions=$3
    
    if [ ! -d "$dir" ]; then
        log_warn "目录不存在，跳过: $dir"
        return
    fi
    
    log_info "清理目录: $description ($dir)"
    
    local scanned=0
    local deleted=0
    local freed=0
    
    # 查找并删除旧文件
    while IFS= read -r -d '' file; do
        ((scanned++))
        
        # 获取文件大小
        local size=$(stat -f%z "$file" 2>/dev/null || echo 0)
        
        # 删除文件
        if rm -f "$file" 2>/dev/null; then
            ((deleted++))
            freed=$((freed + size))
            log_info "  删除: $(basename "$file") ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo "${size}B"))"
        else
            log_error "  删除失败: $(basename "$file")"
        fi
    done < <(find "$dir" -type f \( $extensions \) -mtime +${MAX_AGE_DAYS} -print0 2>/dev/null)
    
    TOTAL_SCANNED=$((TOTAL_SCANNED + scanned))
    TOTAL_DELETED=$((TOTAL_DELETED + deleted))
    TOTAL_FREED=$((TOTAL_FREED + freed))
    
    if [ $deleted -gt 0 ]; then
        local freed_mb=$((freed / 1024 / 1024))
        log_success "完成: 扫描 $scanned 个文件，删除 $deleted 个，释放 ${freed_mb}MB"
    else
        log_info "完成: 扫描 $scanned 个文件，无需删除"
    fi
    echo ""
}

# 1. 清理视频下载目录
cleanup_directory \
    "$TEMP_BASE_DIR/downloads" \
    "视频下载临时文件" \
    "-name '*.mp4' -o -name '*.webm' -o -name '*.flv' -o -name '*.m4a'"

# 2. 清理音频转换目录
cleanup_directory \
    "$TEMP_BASE_DIR/audio" \
    "音频转换临时文件" \
    "-name '*.wav' -o -name '*.mp3' -o -name '*.m4a'"

# 3. 清理关键帧目录
cleanup_directory \
    "$TEMP_BASE_DIR/keyframes" \
    "视频关键帧图片" \
    "-name '*.jpg' -o -name '*.png'"

# 4. 清理视频处理目录
cleanup_directory \
    "$TEMP_BASE_DIR/videos" \
    "视频处理临时文件" \
    "-name '*.mp4' -o -name '*.webm'"

# 输出总结
echo "=========================================="
echo "  清理任务完成"
echo "=========================================="
echo ""
log_success "总计扫描: $TOTAL_SCANNED 个文件"
log_success "总计删除: $TOTAL_DELETED 个文件"

if [ $TOTAL_FREED -gt 0 ]; then
    TOTAL_FREED_MB=$((TOTAL_FREED / 1024 / 1024))
    log_success "释放空间: ${TOTAL_FREED_MB}MB"
fi

echo ""
log_info "下次清理: $(date -v+${MAX_AGE_DAYS}d '+%Y-%m-%d')"
echo ""

# 退出码
if [ $TOTAL_DELETED -gt 0 ]; then
    exit 0  # 有文件被删除
else
    exit 0  # 无文件需要删除（正常）
fi
