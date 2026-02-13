#!/bin/bash

# B站视频功能修复 - 自动部署脚本
# 用途：将修改部署到云服务器 lizuolin_cloud

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}B站视频功能修复 - 部署到云服务器${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 云服务器配置
CLOUD_USER="lizuolin_cloud"
CLOUD_HOST="localhost"  # 如果是远程服务器，修改为实际 IP 或域名
CLOUD_PATH="/Users/lizuolin_cloud/article-collector"
CLOUD_SSH="${CLOUD_USER}@${CLOUD_HOST}"

# 检查是否需要 SSH（如果是远程服务器）
if [ "$CLOUD_HOST" != "localhost" ]; then
    echo -e "${YELLOW}检查 SSH 连接...${NC}"
    if ! ssh -o ConnectTimeout=5 "$CLOUD_SSH" "echo '连接成功'" 2>/dev/null; then
        echo -e "${RED}错误: 无法连接到云服务器 $CLOUD_SSH${NC}"
        echo "请检查："
        echo "  1. SSH 配置是否正确"
        echo "  2. 服务器是否在线"
        echo "  3. 是否需要 VPN"
        exit 1
    fi
    echo -e "${GREEN}✓ SSH 连接正常${NC}"
    echo ""
    DEPLOY_CMD="ssh $CLOUD_SSH"
else
    echo -e "${YELLOW}本地部署模式（同一台机器）${NC}"
    DEPLOY_CMD=""
fi

# 步骤 1: 更新 .env.production 配置
echo -e "${YELLOW}步骤 1/6: 更新 .env.production 配置...${NC}"

# 创建临时配置文件
cat > /tmp/env_production_update.txt <<'EOF'

# ========== 视频/播客处理配置 ==========
# 视频处理工具路径（生产环境）
YT_DLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg

# 视频内容保存位置
WIKI_VIDEO_PARENT_NODE_TOKEN=NHnMwAwdEiQs3CkQtrEcc7aVnNd
# 播客内容保存位置
WIKI_PODCAST_PARENT_NODE_TOKEN=NHnMwAwdEiQs3CkQtrEcc7aVnNd

# 性能配置
MAX_VIDEO_SIZE_MB=500
MAX_AUDIO_DURATION_MINUTES=120

# Whisper 转录配置
WHISPER_MODEL=large-v3
TRANSCRIPTION_THRESHOLD=600

# B站 Cookie（高清视频需要，可选）
BILIBILI_COOKIE=

# 抖音 API
DOUYIN_API_URL=http://127.0.0.1:5557
EOF

if [ -z "$DEPLOY_CMD" ]; then
    # 本地部署
    if ! grep -q "WIKI_VIDEO_PARENT_NODE_TOKEN" "$CLOUD_PATH/.env.production" 2>/dev/null; then
        cat /tmp/env_production_update.txt >> "$CLOUD_PATH/.env.production"
        echo -e "${GREEN}✓ 配置已更新${NC}"
    else
        echo -e "${GREEN}✓ 配置已存在，跳过${NC}"
    fi
else
    # 远程部署
    $DEPLOY_CMD "cd $CLOUD_PATH && if ! grep -q 'WIKI_VIDEO_PARENT_NODE_TOKEN' .env.production 2>/dev/null; then cat >> .env.production <<'EOFENV'

# ========== 视频/播客处理配置 ==========
YT_DLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
WIKI_VIDEO_PARENT_NODE_TOKEN=NHnMwAwdEiQs3CkQtrEcc7aVnNd
WIKI_PODCAST_PARENT_NODE_TOKEN=NHnMwAwdEiQs3CkQtrEcc7aVnNd
MAX_VIDEO_SIZE_MB=500
MAX_AUDIO_DURATION_MINUTES=120
WHISPER_MODEL=large-v3
TRANSCRIPTION_THRESHOLD=600
BILIBILI_COOKIE=
DOUYIN_API_URL=http://127.0.0.1:5557
EOFENV
    echo '配置已更新'; else echo '配置已存在'; fi"
fi

echo ""

# 步骤 2: 拉取最新代码
echo -e "${YELLOW}步骤 2/6: 拉取最新代码...${NC}"
if [ -z "$DEPLOY_CMD" ]; then
    cd "$CLOUD_PATH"
    git fetch origin
    git checkout feature/video-podcast
    git pull origin feature/video-podcast
else
    $DEPLOY_CMD "cd $CLOUD_PATH && git fetch origin && git checkout feature/video-podcast && git pull origin feature/video-podcast"
fi
echo -e "${GREEN}✓ 代码已更新${NC}"
echo ""

# 步骤 3: 安装依赖（如果需要）
echo -e "${YELLOW}步骤 3/6: 检查依赖...${NC}"
if [ -z "$DEPLOY_CMD" ]; then
    cd "$CLOUD_PATH"
    if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
        npm install
        echo -e "${GREEN}✓ 依赖已安装${NC}"
    else
        echo -e "${GREEN}✓ 依赖已是最新${NC}"
    fi
else
    $DEPLOY_CMD "cd $CLOUD_PATH && if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then npm install; echo '依赖已安装'; else echo '依赖已是最新'; fi"
fi
echo ""

# 步骤 4: 编译代码
echo -e "${YELLOW}步骤 4/6: 编译代码...${NC}"
if [ -z "$DEPLOY_CMD" ]; then
    cd "$CLOUD_PATH"
    npm run build
else
    $DEPLOY_CMD "cd $CLOUD_PATH && npm run build"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 编译成功${NC}"
else
    echo -e "${RED}✗ 编译失败${NC}"
    exit 1
fi
echo ""

# 步骤 5: 重启 PM2 服务
echo -e "${YELLOW}步骤 5/6: 重启 PM2 服务...${NC}"
if [ -z "$DEPLOY_CMD" ]; then
    cd "$CLOUD_PATH"
    pm2 reload article-collector
else
    $DEPLOY_CMD "cd $CLOUD_PATH && pm2 reload article-collector"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 服务已重启${NC}"
else
    echo -e "${YELLOW}⚠ 服务重启可能失败，请手动检查${NC}"
fi
echo ""

# 步骤 6: 查看服务状态
echo -e "${YELLOW}步骤 6/6: 查看服务状态...${NC}"
if [ -z "$DEPLOY_CMD" ]; then
    pm2 status article-collector
    echo ""
    echo -e "${YELLOW}查看最近日志：${NC}"
    pm2 logs article-collector --lines 20 --nostream
else
    $DEPLOY_CMD "pm2 status article-collector"
    echo ""
    echo -e "${YELLOW}查看最近日志：${NC}"
    $DEPLOY_CMD "pm2 logs article-collector --lines 20 --nostream"
fi
echo ""

# 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步：${NC}"
echo "1. 发送一个 B站视频链接到飞书机器人进行测试"
echo "2. 检查文档是否在知识库正确位置"
echo "3. 检查关键帧图片是否显示"
echo "4. 检查是否包含音频转录文字"
echo ""
echo -e "${YELLOW}查看实时日志：${NC}"
if [ -z "$DEPLOY_CMD" ]; then
    echo "  pm2 logs article-collector"
else
    echo "  ssh $CLOUD_SSH \"pm2 logs article-collector\""
fi
echo ""
echo -e "${YELLOW}故障排查：${NC}"
echo "  查看详细部署指南: cat DEPLOYMENT-GUIDE.md"
echo ""
