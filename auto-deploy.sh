#!/bin/bash
# 自动部署 B站视频功能修复到云服务器
# 使用现有的云服务器配置

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENV="${1:-production}"
REMOTE_HOST="lizuolin_cloud@100.117.165.59"
REMOTE_DIR="/Users/lizuolin_cloud/article-collector"
ENV_FILE=".env.${ENV}"
APP_NAME="article-collector"
if [ "$ENV" = "test" ]; then
  APP_NAME="article-collector-test"
fi
REMOTE_NODE_BIN="\$HOME/node-v20.11.1-darwin-x64/bin"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}B站视频功能修复 - 自动部署${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 步骤 1: 同步代码到云服务器
echo -e "${BLUE}步骤 1/5: 同步代码到云服务器...${NC}"
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  --exclude '*.log' --exclude '.DS_Store' \
  /Users/zuolin1/article-collector/ ${REMOTE_HOST}:${REMOTE_DIR}/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 代码同步成功${NC}"
else
    echo -e "${RED}✗ 代码同步失败${NC}"
    exit 1
fi
echo ""

# 步骤 2: 更新 .env.production 配置
echo -e "${BLUE}步骤 2/5: 更新 ${ENV_FILE} 配置...${NC}"
ssh ${REMOTE_HOST} "cd ${REMOTE_DIR} && touch ${ENV_FILE} && if ! grep -q 'WIKI_VIDEO_PARENT_NODE_TOKEN' ${ENV_FILE} 2>/dev/null; then cat >> ${ENV_FILE} <<'EOFENV'

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
echo '配置已更新'; else echo '配置已存在，跳过'; fi"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 配置更新成功${NC}"
else
    echo -e "${YELLOW}⚠ 配置更新可能失败，继续部署${NC}"
fi
echo ""

# 步骤 3: 安装依赖（如果需要）
echo -e "${BLUE}步骤 3/5: 检查并安装依赖...${NC}"
ssh ${REMOTE_HOST} "cd ${REMOTE_DIR} && if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then echo '安装依赖中...'; npm install; else echo '依赖已是最新'; fi"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 依赖检查完成${NC}"
else
    echo -e "${RED}✗ 依赖安装失败${NC}"
    exit 1
fi
echo ""

# 步骤 4: 编译代码
echo -e "${BLUE}步骤 4/5: 编译 TypeScript 代码...${NC}"
if [ "$ENV" = "test" ]; then
  ssh ${REMOTE_HOST} "export PATH=${REMOTE_NODE_BIN}:\$PATH; cd ${REMOTE_DIR} && NODE_ENV=development npm run build"
else
  ssh ${REMOTE_HOST} "export PATH=${REMOTE_NODE_BIN}:\$PATH; cd ${REMOTE_DIR} && NODE_ENV=production npm run build"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 编译成功${NC}"
else
    echo -e "${RED}✗ 编译失败${NC}"
    exit 1
fi
echo ""

# 步骤 5: 重启 PM2 服务
echo -e "${BLUE}步骤 5/5: 重启 PM2 服务...${NC}"
ssh ${REMOTE_HOST} "export PATH=${REMOTE_NODE_BIN}:\$PATH; cd ${REMOTE_DIR} && pm2 reload ${APP_NAME} || NODE_ENV=$([ \"$ENV\" = \"test\" ] && echo development || echo production) pm2 start dist/index.js --name ${APP_NAME}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 服务重启成功${NC}"
else
    echo -e "${YELLOW}⚠ 服务重启可能失败${NC}"
fi
echo ""

# 查看服务状态
echo -e "${BLUE}查看服务状态...${NC}"
ssh ${REMOTE_HOST} "export PATH=${REMOTE_NODE_BIN}:\$PATH; pm2 status ${APP_NAME}"
echo ""

# 查看最近日志
echo -e "${BLUE}最近 20 条日志：${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
ssh ${REMOTE_HOST} "export PATH=${REMOTE_NODE_BIN}:\$PATH; pm2 logs ${APP_NAME} --lines 20 --nostream"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步测试：${NC}"
echo "1. 发送 B站视频链接到飞书机器人"
echo "   例如：https://www.bilibili.com/video/BV1xx411c7mu/"
echo ""
echo "2. 检查文档是否在正确位置："
echo "   https://my.feishu.cn/wiki/NHnMwAwdEiQs3CkQtrEcc7aVnNd"
echo ""
echo "3. 验证："
echo "   - 关键帧图片是否显示"
echo "   - 是否包含音频转录文字"
echo "   - 文档是否在知识库指定位置"
echo ""
echo -e "${YELLOW}查看实时日志：${NC}"
echo "  ssh ${REMOTE_HOST} \"pm2 logs ${APP_NAME}\""
echo ""
echo -e "${YELLOW}故障排查：${NC}"
echo "  cat DEPLOYMENT-GUIDE.md"
echo ""
