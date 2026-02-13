#!/bin/bash
# ========================================
# Article-Collector 自动化部署脚本
# ========================================
#
# 使用方法：
#   ./scripts/deploy.sh              # 部署生产环境
#   ./scripts/deploy.sh production   # 部署生产环境
#   ./scripts/deploy.sh development  # 部署测试环境
#   ./scripts/deploy.sh all          # 部署两个环境
#
# 环境变量：
#   SKIP_BUILD=1    跳过本地构建
#   SKIP_TEST=1     跳过测试
#   DRY_RUN=1       只显示命令不执行
#
# ⚠️  重要提示：
#   生产环境和测试环境使用同一个飞书机器人应用！
#   同时运行会导致消息重复处理，请避免同时启动两个环境。
#   建议只运行生产环境，或临时停止生产环境后再启动测试环境。

set -e

# ========== 配置 ==========
REMOTE_HOST="lizuolin_cloud@100.117.165.59"
REMOTE_DIR="/Users/lizuolin_cloud/article-collector"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV="${1:-production}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========== 辅助函数 ==========
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

run_cmd() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "[DRY RUN] $1"
    else
        eval "$1"
    fi
}

run_remote() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "[DRY RUN] ssh $REMOTE_HOST \"$1\""
    else
        # 使用登录 shell 确保 PATH 正确加载（解决非交互式 SSH 找不到 npm 的问题）
        ssh "$REMOTE_HOST" "zsh -l -c '$1'"
    fi
}

# ========== 主流程 ==========
echo ""
echo "========================================"
echo "  Article-Collector 部署脚本"
echo "  环境: $ENV"
echo "========================================"
echo ""

# 检查是否部署测试环境
if [ "$ENV" = "development" ]; then
    log_warn "⚠️  警告: 生产环境和测试环境使用同一个飞书机器人！"
    log_warn "   同时运行会导致消息重复处理。"
    echo ""
    read -p "是否继续部署测试环境? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "部署已取消"
        exit 0
    fi
fi

# 1. 本地构建检查
if [ "$SKIP_BUILD" != "1" ]; then
    log_info "步骤 1/6: 本地构建检查..."
    
    cd "$LOCAL_DIR"
    
    # TypeScript 编译
    log_info "  编译 TypeScript..."
    run_cmd "npm run build"
    log_success "  构建成功"
else
    log_warn "步骤 1/6: 跳过本地构建 (SKIP_BUILD=1)"
fi

# 2. 同步代码到云服务器
log_info "步骤 2/6: 同步代码到云服务器..."

# rsync 排除列表
EXCLUDES="--exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '*.log' --exclude '.env.*.local'"

run_cmd "rsync -avz $EXCLUDES '$LOCAL_DIR/' '$REMOTE_HOST:$REMOTE_DIR/'"
log_success "  代码同步完成"

# 3. 远程安装依赖
log_info "步骤 3/6: 远程安装依赖..."

# 先安装全部依赖（包括 devDependencies，用于构建）
# 使用 npm install 而不是 npm ci，避免某些包的 postinstall 权限问题
run_remote "cd $REMOTE_DIR && rm -rf node_modules && npm install --no-save"
log_success "  依赖安装完成"

# 4. 远程构建
log_info "步骤 4/6: 远程构建..."

run_remote "cd $REMOTE_DIR && npm run build"
log_success "  远程构建完成"

# 4.5. 清理开发依赖（可选，减少磁盘占用）
# run_remote "cd $REMOTE_DIR && npm prune --production"

# 5. 重启服务
log_info "步骤 5/6: 重启服务..."

case "$ENV" in
    "production")
        run_remote "cd $REMOTE_DIR && pm2 restart article-collector --update-env || pm2 start ecosystem.config.js --only article-collector"
        log_success "  生产环境服务已重启"
        ;;
    "development")
        run_remote "cd $REMOTE_DIR && pm2 restart article-collector-dev --update-env || pm2 start ecosystem.config.js --only article-collector-dev"
        log_success "  测试环境服务已重启"
        ;;
    "all")
        run_remote "cd $REMOTE_DIR && pm2 restart article-collector --update-env || pm2 start ecosystem.config.js --only article-collector"
        run_remote "cd $REMOTE_DIR && pm2 restart article-collector-dev --update-env || pm2 start ecosystem.config.js --only article-collector-dev"
        log_success "  所有服务已重启"
        ;;
    *)
        log_error "未知环境: $ENV"
        exit 1
        ;;
esac

# 6. 健康检查
log_info "步骤 6/6: 健康检查..."

# 等待服务启动
sleep 3

# 显示 PM2 状态
echo ""
log_info "PM2 服务状态:"
run_remote "pm2 list"

# 显示最近日志
echo ""
log_info "最近日志 (最后 10 行):"
case "$ENV" in
    "production")
        run_remote "pm2 logs article-collector --lines 10 --nostream" || true
        ;;
    "development")
        run_remote "pm2 logs article-collector-dev --lines 10 --nostream" || true
        ;;
    "all")
        run_remote "pm2 logs article-collector --lines 5 --nostream" || true
        echo "---"
        run_remote "pm2 logs article-collector-dev --lines 5 --nostream" || true
        ;;
esac

# 完成
echo ""
echo "========================================"
log_success "部署完成！"
echo "========================================"
echo ""
echo "常用命令："
echo "  查看日志:  ssh $REMOTE_HOST 'pm2 logs article-collector'"
echo "  查看状态:  ssh $REMOTE_HOST 'pm2 status'"
echo "  重启服务:  ssh $REMOTE_HOST 'pm2 restart article-collector'"
echo ""
