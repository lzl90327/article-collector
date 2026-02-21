#!/bin/bash
# MindFlow 后端部署脚本
# 部署到云服务器

set -e

echo "🚀 MindFlow 后端部署脚本"
echo "=========================="

# 配置
SERVER_USER="lizuolin_cloud"
SERVER_HOST="100.117.165.59"
SERVER_PORT="22"
REMOTE_DIR="/opt/mindflow"
LOCAL_DIR="/Users/zuolin1/article-collector/mindflow-project"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. 本地构建
log_info "步骤 1: 本地构建后端..."
cd "$LOCAL_DIR/backend"
npm run build
log_info "✅ 构建完成"

# 2. 创建部署包
log_info "步骤 2: 创建部署包..."
cd "$LOCAL_DIR"
tar -czf /tmp/mindflow-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='logs' \
    backend/
log_info "✅ 部署包创建完成"

# 3. 上传到服务器
log_info "步骤 3: 上传到服务器..."
scp -P $SERVER_PORT /tmp/mindflow-deploy.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/
log_info "✅ 上传完成"

# 4. 在服务器上部署
log_info "步骤 4: 在服务器上部署..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'EOF'
    REMOTE_DIR="/opt/mindflow"
    
    # 创建目录
    sudo mkdir -p $REMOTE_DIR
    sudo chown $(whoami):$(whoami) $REMOTE_DIR
    
    # 解压
    cd $REMOTE_DIR
    tar -xzf /tmp/mindflow-deploy.tar.gz
    
    # 安装依赖
    cd backend
    npm install --production
    
    # 复制生产环境配置
    cp .env.production .env
    
    # 安装 PM2（如果没有）
    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2
    fi
    
    # 停止旧服务
    pm2 delete mindflow-backend 2>/dev/null || true
    
    # 启动新服务
    pm2 start dist/index.js --name mindflow-backend --env production
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置开机自启
    sudo pm2 startup systemd -u $(whoami) --hp $HOME
    
    echo "✅ 部署完成"
    echo ""
    echo "服务状态:"
    pm2 status mindflow-backend
    echo ""
    echo "日志查看:"
    echo "pm2 logs mindflow-backend"
EOF

log_info "✅ 部署完成！"
echo ""
echo "=========================="
echo "部署信息:"
echo "  服务器: $SERVER_HOST"
echo "  目录: $REMOTE_DIR"
echo "  端口: 3001"
echo ""
echo "管理命令:"
echo "  查看状态: ssh $SERVER_USER@$SERVER_HOST 'pm2 status mindflow-backend'"
echo "  查看日志: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs mindflow-backend'"
echo "  重启服务: ssh $SERVER_USER@$SERVER_HOST 'pm2 restart mindflow-backend'"
echo "=========================="
