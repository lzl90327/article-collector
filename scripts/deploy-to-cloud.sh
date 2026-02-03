#!/bin/bash
# 部署 article-collector 和 XHS-Downloader 到云服务器
# 使用方法: ./scripts/deploy-to-cloud.sh

set -e

REMOTE_HOST="lizuolin_cloud@100.117.165.59"
REMOTE_DIR="/Users/lizuolin_cloud/article-collector"
XHS_DIR="/Users/lizuolin_cloud/XHS-Downloader"

echo "========================================"
echo "  Article-Collector 云服务器部署脚本"
echo "========================================"
echo ""

# 步骤 1: 同步 article-collector 代码
echo "📦 步骤 1: 同步 article-collector 代码..."
echo ""
echo "请在本地执行以下命令（需要输入密码）："
echo ""
echo "  rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \\"
echo "    /Users/zuolin1/article-collector/ ${REMOTE_HOST}:${REMOTE_DIR}/"
echo ""

# 步骤 2: 在云服务器上安装依赖和编译
echo "📦 步骤 2: 在云服务器上安装依赖..."
echo ""
echo "SSH 连接到云服务器后执行："
echo ""
echo "  cd ${REMOTE_DIR}"
echo "  npm install"
echo "  npm run build"
echo ""

# 步骤 3: 安装 XHS-Downloader
echo "📦 步骤 3: 安装 XHS-Downloader..."
echo ""
echo "在云服务器上执行："
echo ""
echo "  # 安装 uv (如果没有)"
echo "  pip3 install uv"
echo ""
echo "  # 克隆 XHS-Downloader"
echo "  cd ~"
echo "  git clone https://github.com/JoeanAmier/XHS-Downloader.git"
echo "  cd XHS-Downloader"
echo "  uv sync"
echo ""

# 步骤 4: 配置 XHS-Downloader 自启动
echo "📦 步骤 4: 配置 XHS-Downloader 作为后台服务..."
echo ""
echo "创建 XHS-Downloader 启动脚本："
echo ""
echo "  cat > ~/start-xhs-api.sh << 'EOF'"
echo "#!/bin/bash"
echo "cd ~/XHS-Downloader"
echo "uv run main.py api"
echo "EOF"
echo "  chmod +x ~/start-xhs-api.sh"
echo ""
echo "使用 pm2 管理 XHS-Downloader："
echo ""
echo "  pm2 start ~/start-xhs-api.sh --name xhs-downloader --interpreter bash"
echo "  pm2 save"
echo ""

# 步骤 5: 重启 article-collector
echo "📦 步骤 5: 重启 article-collector..."
echo ""
echo "  pm2 restart article-collector"
echo "  pm2 status"
echo ""

echo "========================================"
echo "  部署完成后，验证服务状态"
echo "========================================"
echo ""
echo "  # 检查 XHS-Downloader API"
echo "  curl http://127.0.0.1:5556/docs"
echo ""
echo "  # 检查 pm2 状态"
echo "  pm2 status"
echo ""
echo "  # 查看日志"
echo "  pm2 logs article-collector"
echo ""
