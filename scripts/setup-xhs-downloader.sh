#!/bin/bash
# XHS-Downloader 安装与启动脚本
# 用于小红书内容提取

set -e

XHS_DIR="${HOME}/XHS-Downloader"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "XHS-Downloader 安装与启动脚本"
echo "========================================"

# 检查 Python 版本
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        echo "✓ Python 版本: $PYTHON_VERSION"
        
        # 检查版本是否 >= 3.12
        MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 12 ]); then
            echo "⚠ 警告: XHS-Downloader 需要 Python 3.12+，当前版本为 $PYTHON_VERSION"
            echo "  请安装 Python 3.12 或更高版本"
            return 1
        fi
    else
        echo "✗ Python 未安装"
        return 1
    fi
    return 0
}

# 检查 uv 是否安装
check_uv() {
    if command -v uv &> /dev/null; then
        echo "✓ uv 已安装"
        return 0
    else
        echo "✗ uv 未安装，正在安装..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.local/bin:$PATH"
        echo "✓ uv 安装完成"
        return 0
    fi
}

# 安装 XHS-Downloader
install_xhs() {
    if [ -d "$XHS_DIR" ]; then
        echo "✓ XHS-Downloader 已存在于 $XHS_DIR"
        echo "  更新中..."
        cd "$XHS_DIR"
        git pull origin master || true
    else
        echo "正在克隆 XHS-Downloader..."
        git clone https://github.com/JoeanAmier/XHS-Downloader.git "$XHS_DIR"
        cd "$XHS_DIR"
    fi
    
    echo "同步依赖..."
    uv sync
    echo "✓ XHS-Downloader 安装完成"
}

# 启动 API 服务
start_api() {
    cd "$XHS_DIR"
    echo ""
    echo "========================================"
    echo "启动 XHS-Downloader API 服务"
    echo "API 地址: http://127.0.0.1:5556"
    echo "API 文档: http://127.0.0.1:5556/docs"
    echo "========================================"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo ""
    uv run main.py api
}

# 主流程
main() {
    case "${1:-install}" in
        install)
            check_python || exit 1
            check_uv || exit 1
            install_xhs
            echo ""
            echo "========================================"
            echo "安装完成！"
            echo ""
            echo "启动 API 服务："
            echo "  $0 start"
            echo ""
            echo "或手动启动："
            echo "  cd $XHS_DIR && uv run main.py api"
            echo "========================================"
            ;;
        start)
            if [ ! -d "$XHS_DIR" ]; then
                echo "XHS-Downloader 未安装，请先运行: $0 install"
                exit 1
            fi
            start_api
            ;;
        *)
            echo "用法: $0 [install|start]"
            echo ""
            echo "  install  安装 XHS-Downloader（默认）"
            echo "  start    启动 API 服务"
            exit 1
            ;;
    esac
}

main "$@"
