#!/bin/bash
# 快速管理云服务器上的 article-collector 服务
# 使用方法：./scripts/manage-service.sh [命令]

REMOTE_HOST="lizuolin_cloud@100.117.165.59"

case "$1" in
    status|"")
        echo "📊 查看服务状态..."
        ssh "$REMOTE_HOST" 'zsh -l -c "pm2 list"'
        ;;
    
    logs)
        ENV="${2:-production}"
        if [ "$ENV" = "dev" ]; then
            echo "📝 查看测试环境日志..."
            ssh "$REMOTE_HOST" 'zsh -l -c "pm2 logs article-collector-dev"'
        else
            echo "📝 查看生产环境日志..."
            ssh "$REMOTE_HOST" 'zsh -l -c "pm2 logs article-collector"'
        fi
        ;;
    
    restart)
        echo "🔄 重启生产环境..."
        ssh "$REMOTE_HOST" 'zsh -l -c "pm2 restart article-collector"'
        echo "✅ 生产环境已重启"
        ;;
    
    stop-dev)
        echo "🛑 停止测试环境..."
        ssh "$REMOTE_HOST" 'zsh -l -c "pm2 stop article-collector-dev"'
        echo "✅ 测试环境已停止（避免重复处理消息）"
        ;;
    
    start-dev)
        echo "⚠️  警告: 启动测试环境会导致消息重复处理！"
        echo "建议先停止生产环境: ./scripts/manage-service.sh stop-prod"
        read -p "确定要启动测试环境吗? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ssh "$REMOTE_HOST" 'zsh -l -c "pm2 start article-collector-dev"'
            echo "✅ 测试环境已启动"
        else
            echo "❌ 已取消"
        fi
        ;;
    
    stop-prod)
        echo "⚠️  警告: 将停止生产环境服务！"
        read -p "确定要停止生产环境吗? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ssh "$REMOTE_HOST" 'zsh -l -c "pm2 stop article-collector"'
            echo "✅ 生产环境已停止"
        else
            echo "❌ 已取消"
        fi
        ;;
    
    health)
        echo "🏥 健康检查..."
        ssh "$REMOTE_HOST" 'zsh -l -c "pm2 logs article-collector --lines 20 --nostream"'
        ;;
    
    *)
        echo "用法: $0 [命令]"
        echo ""
        echo "可用命令:"
        echo "  status      - 查看所有服务状态（默认）"
        echo "  logs [dev]  - 查看日志（默认生产环境，加 dev 查看测试环境）"
        echo "  restart     - 重启生产环境"
        echo "  stop-dev    - 停止测试环境（推荐，避免重复处理）"
        echo "  start-dev   - 启动测试环境（需谨慎）"
        echo "  stop-prod   - 停止生产环境（需谨慎）"
        echo "  health      - 健康检查（查看最近日志）"
        echo ""
        echo "示例:"
        echo "  $0               # 查看服务状态"
        echo "  $0 logs          # 查看生产环境日志"
        echo "  $0 logs dev      # 查看测试环境日志"
        echo "  $0 stop-dev      # 停止测试环境"
        ;;
esac
