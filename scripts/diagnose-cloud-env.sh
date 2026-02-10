#!/bin/bash
# ========================================
# 云服务器文章收集器环境诊断脚本
# ========================================
#
# 使用方法：
#   ssh lizuolin_cloud@<服务器IP> 'bash -s' < scripts/diagnose-cloud-env.sh
#   或先在云服务器上 git pull 后执行：
#   ./scripts/diagnose-cloud-env.sh
#
# 输出：完整的诊断报告，便于排查问题

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 自动检测项目目录：参数 > 当前目录(含 package.json) > 云服务器默认路径
PROJECT_DIR="${1:-}"
if [ -z "$PROJECT_DIR" ]; then
  if [ -f "./package.json" ] && grep -q '"name".*"article-collector"' ./package.json 2>/dev/null; then
    PROJECT_DIR="."
  else
    PROJECT_DIR="/Users/lizuolin_cloud/article-collector"
  fi
fi
cd "$PROJECT_DIR" 2>/dev/null || { echo "项目目录不存在: $PROJECT_DIR"; exit 1; }

echo ""
echo "========================================"
echo "  文章收集器 - 云服务器环境诊断报告"
echo "  执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  工作目录: $(pwd)"
echo "========================================"
echo ""

# ========== 1. PM2 进程状态 ==========
echo -e "${CYAN}========== 1. PM2 进程状态 ==========${NC}"
echo ""
if command -v pm2 &>/dev/null; then
    echo "PM2 版本:"
    pm2 --version 2>/dev/null || echo "  (无法获取)"
    echo ""
    echo "PM2 进程列表:"
    pm2 list 2>/dev/null || echo "  (执行失败)"
    echo ""
    echo "article-collector 详细信息:"
    pm2 show article-collector 2>/dev/null | head -40 || echo "  (未运行或不存在)"
else
    echo -e "${RED}PM2 未安装或不在 PATH 中${NC}"
fi
echo ""

# ========== 2. 服务版本 ==========
echo -e "${CYAN}========== 2. 服务版本 ==========${NC}"
echo ""
echo "Node 版本: $(node -v 2>/dev/null || echo 'N/A')"
echo "npm 版本: $(npm -v 2>/dev/null || echo 'N/A')"
echo "package.json 版本: $(node -p "require('./package.json').version" 2>/dev/null || echo 'N/A')"
echo ""

# ========== 3. 环境配置文件 ==========
echo -e "${CYAN}========== 3. 环境配置文件 ==========${NC}"
echo ""

for envfile in .env .env.production .env.development; do
    if [ -f "$envfile" ]; then
        echo -e "${GREEN}文件存在: $envfile${NC}"
        echo "--- 内容（敏感信息已脱敏）---"
        # 脱敏显示：保留配置项名，敏感值用 *** 替代
        grep -v '^#' "$envfile" | grep -v '^$' | while IFS= read -r line; do
            key="${line%%=*}"
            case "$key" in
                LARK_APP_SECRET|*SECRET*|*KEY*|*TOKEN*|*COOKIE*|*PASSWORD*)
                    echo "${key}=***"
                    ;;
                LARK_APP_ID|WIKI_*|BITABLE_*|*_PATH|*_URL|*_TOKEN|*_ID)
                    # 部分脱敏，只显示前后几位
                    val="${line#*=}"
                    if [ ${#val} -gt 8 ]; then
                        echo "${key}=${val:0:4}***${val: -4}"
                    else
                        echo "${key}=***"
                    fi
                    ;;
                *)
                    echo "$line"
                    ;;
            esac
        done
        echo ""
    else
        echo -e "${YELLOW}文件不存在: $envfile${NC}"
        echo ""
    fi
done

# 关键配置项专项检查
echo -e "${BLUE}--- 关键配置项专项检查 ---${NC}"
if [ -f .env.production ]; then
    echo "NODE_ENV: $(grep -E '^NODE_ENV=' .env.production 2>/dev/null | cut -d= -f2 || echo '(未在 .env 中，由 PM2 注入)')"
    echo "YT_DLP_PATH: $(grep -E '^YT_DLP_PATH=' .env.production 2>/dev/null | cut -d= -f2 || echo '(未配置，使用默认 yt-dlp)')"
    echo "FFMPEG_PATH: $(grep -E '^FFMPEG_PATH=' .env.production 2>/dev/null | cut -d= -f2 || echo '(未配置，使用默认 ffmpeg)')"
    token_val=$(grep -E '^WIKI_VIDEO_PARENT_NODE_TOKEN=' .env.production 2>/dev/null | cut -d= -f2)
    if [ -n "$token_val" ]; then echo "WIKI_VIDEO_PARENT_NODE_TOKEN: 已配置 (${#token_val} 字符)"; else echo "WIKI_VIDEO_PARENT_NODE_TOKEN: (未配置)"; fi
    echo "MAX_VIDEO_SIZE_MB: $(grep -E '^MAX_VIDEO_SIZE_MB=' .env.production 2>/dev/null | cut -d= -f2 || echo '(未配置)')"
    echo "MAX_AUDIO_DURATION_MINUTES: $(grep -E '^MAX_AUDIO_DURATION_MINUTES=' .env.production 2>/dev/null | cut -d= -f2 || echo '(未配置)')"
    echo "TRANSCRIPTION_THRESHOLD: $(grep -E '^TRANSCRIPTION_THRESHOLD=' .env.production 2>/dev/null | cut -d= -f2 || echo '(未配置)')"
    echo "WHISPER_MODEL: $(grep -E '^WHISPER_MODEL=' .env.production 2>/dev/null | cut -d= -f2 || echo '(未配置)')"
else
    echo -e "${YELLOW}.env.production 不存在，可能使用 .env${NC}"
    if [ -f .env ]; then
        echo "YT_DLP_PATH: $(grep -E '^YT_DLP_PATH=' .env 2>/dev/null | cut -d= -f2 || echo '(未配置)')"
        echo "FFMPEG_PATH: $(grep -E '^FFMPEG_PATH=' .env 2>/dev/null | cut -d= -f2 || echo '(未配置)')"
        echo "WIKI_VIDEO_PARENT_NODE_TOKEN: $(grep -E '^WIKI_VIDEO_PARENT_NODE_TOKEN=' .env 2>/dev/null | cut -d= -f2 | wc -c) 字符"
    fi
fi
echo ""

# ========== 4. 代码分支与版本 ==========
echo -e "${CYAN}========== 4. 代码分支与版本 ==========${NC}"
echo ""
if [ -d .git ]; then
    echo "当前分支: $(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD)"
    echo "最近提交: $(git log -1 --oneline 2>/dev/null)"
    echo "提交哈希: $(git rev-parse HEAD 2>/dev/null)"
    echo "是否有未提交更改: $(git status -s 2>/dev/null | wc -l | tr -d ' ') 个文件"
    echo ""
    echo "feature/video-podcast 分支状态:"
    if git show-ref --verify refs/heads/feature/video-podcast &>/dev/null; then
        echo "  本地存在，最新提交: $(git log -1 --oneline feature/video-podcast 2>/dev/null)"
    else
        echo "  本地不存在"
    fi
    if git show-ref --verify refs/remotes/origin/feature/video-podcast &>/dev/null; then
        echo "  远程存在，最新提交: $(git log -1 --oneline origin/feature/video-podcast 2>/dev/null)"
    else
        echo "  远程不存在"
    fi
else
    echo -e "${YELLOW}非 Git 仓库，无法获取分支信息${NC}"
fi
echo ""

# ========== 5. 关键文件部署检查 ==========
echo -e "${CYAN}========== 5. 关键文件部署检查 ==========${NC}"
echo ""

check_file() {
    local file="$1"
    local marker="$2"
    local desc="$3"
    if [ -f "$file" ]; then
        if grep -q "$marker" "$file" 2>/dev/null; then
            echo -e "${GREEN}✓ $desc${NC}"
            echo "  文件: $file"
            echo "  标记: 包含 '$marker'"
        else
            echo -e "${YELLOW}⚠ $desc (文件存在但可能为旧版本)${NC}"
            echo "  文件: $file"
            echo "  期望包含: $marker"
        fi
    else
        echo -e "${RED}✗ $desc - 文件不存在${NC}"
        echo "  路径: $file"
    fi
    echo ""
}

# bilibili-fetcher.ts: ffmpeg 参数修复 - 使用 path.dirname(ffmpegPath)
check_file "src/services/bilibili-fetcher.ts" "path.dirname(videoConfig.ffmpegPath)" "bilibili-fetcher.ts - ffmpeg 路径修复"

# lark-client.ts: 图片上传功能
check_file "src/services/lark-client.ts" "uploadImageToTemp" "lark-client.ts - 图片上传功能"

# message.ts: 关键帧上传和转录
check_file "src/handlers/message.ts" "uploadImageToTemp(kf.path)" "message.ts - 关键帧上传"
check_file "src/handlers/message.ts" "asrService.transcribe" "message.ts - 音频转录"
check_file "src/handlers/message.ts" "processBilibiliVideo" "message.ts - B站视频处理"

echo ""

# ========== 6. 编译产物检查 ==========
echo -e "${CYAN}========== 6. 编译产物检查 ==========${NC}"
echo ""
if [ -f "dist/index.js" ]; then
    echo -e "${GREEN}✓ dist/index.js 存在${NC}"
    echo "  修改时间: $(ls -l dist/index.js 2>/dev/null | awk '{print $6, $7, $8}')"
else
    echo -e "${RED}✗ dist/index.js 不存在 - 需要执行 npm run build${NC}"
fi
if [ -f "dist/services/bilibili-fetcher.js" ]; then
    echo -e "${GREEN}✓ dist/services/bilibili-fetcher.js 存在${NC}"
    if grep -q "path.dirname(videoConfig.ffmpegPath)" dist/services/bilibili-fetcher.js 2>/dev/null; then
        echo -e "  ${GREEN}包含 ffmpeg 路径修复${NC}"
    else
        echo -e "  ${YELLOW}可能未包含最新 ffmpeg 修复${NC}"
    fi
else
    echo -e "${RED}✗ dist/services/bilibili-fetcher.js 不存在${NC}"
fi
echo ""

# ========== 7. 外部工具检查 ==========
echo -e "${CYAN}========== 7. 外部工具检查 ==========${NC}"
echo ""
echo "yt-dlp: $(which yt-dlp 2>/dev/null || echo '未找到')"
yt-dlp --version 2>/dev/null || echo "  (执行失败)"
echo ""
echo "ffmpeg: $(which ffmpeg 2>/dev/null || echo '未找到')"
ffmpeg -version 2>/dev/null | head -1 || echo "  (执行失败)"
echo ""

# ========== 8. 配置文件加载顺序 ==========
echo -e "${CYAN}========== 8. 配置加载逻辑说明 ==========${NC}"
echo ""
echo "config.ts 加载顺序 (NODE_ENV=production 时):"
echo "  1. .env.production.local"
echo "  2. .env.production"
echo "  3. .env.local"
echo "  4. .env"
echo ""
echo "PM2 ecosystem.config.js 中 NODE_ENV 已设置为 production"
echo ""

# ========== 总结 ==========
echo "========================================"
echo "  诊断完成"
echo "========================================"
echo ""
echo "建议操作："
echo "  1. 若分支不是 feature/video-podcast: git checkout feature/video-podcast && git pull"
echo "  2. 若 .env.production 缺少视频配置: 参考 .env.example 补充"
echo "  3. 若 dist 未更新: npm run build && pm2 reload article-collector"
echo "  4. 查看实时日志: pm2 logs article-collector"
echo ""
