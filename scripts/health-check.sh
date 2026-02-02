#!/bin/bash
# 文章收藏助手健康检查脚本
# 用于诊断服务问题

echo "🔍 文章收藏助手健康检查"
echo "========================"
echo ""

cd ~/article-collector

# 1. 检查 Node.js
echo "[1/5] Node.js 环境"
if command -v node &> /dev/null; then
    echo "  ✅ Node.js $(node -v)"
else
    echo "  ❌ Node.js 未安装"
fi

# 2. 检查 Python 3.11+
echo ""
echo "[2/5] Python 环境"
PYTHON_PATH=""
for p in .venv/bin/python /usr/local/bin/python3.11 /usr/local/bin/python3.12 /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3.12; do
    if [ -x "$p" ]; then
        version=$($p --version 2>&1)
        if echo "$version" | grep -q "3.1[1-9]"; then
            PYTHON_PATH="$p"
            echo "  ✅ $version ($p)"
            break
        fi
    fi
done

if [ -z "$PYTHON_PATH" ]; then
    echo "  ❌ Python 3.11+ 未找到"
    echo "     请安装 Python 3.11+："
    echo "     curl -O https://www.python.org/ftp/python/3.11.9/python-3.11.9-macos11.pkg"
    echo "     sudo installer -pkg python-3.11.9-macos11.pkg -target /"
fi

# 3. 检查虚拟环境
echo ""
echo "[3/5] Python 虚拟环境"
if [ -d ".venv" ] && [ -f ".venv/bin/python" ]; then
    venv_version=$(.venv/bin/python --version 2>&1)
    echo "  ✅ 虚拟环境存在 ($venv_version)"
    
    # 检查依赖
    if .venv/bin/python -c "import playwright; import httpx" 2>/dev/null; then
        echo "  ✅ Python 依赖已安装"
    else
        echo "  ❌ Python 依赖缺失"
        echo "     运行: source .venv/bin/activate && pip install browser-use playwright openai python-dotenv markdownify httpx"
    fi
else
    echo "  ❌ 虚拟环境不存在"
    echo "     运行: python3.11 -m venv .venv"
fi

# 4. 检查 Playwright 浏览器
echo ""
echo "[4/5] Playwright 浏览器"
if [ -d "$HOME/Library/Caches/ms-playwright" ]; then
    chromium_count=$(find "$HOME/Library/Caches/ms-playwright" -name "chromium*" -type d 2>/dev/null | wc -l)
    if [ "$chromium_count" -gt 0 ]; then
        echo "  ✅ Chromium 浏览器已安装"
    else
        echo "  ❌ Chromium 浏览器未安装"
        echo "     运行: source .venv/bin/activate && python -m playwright install chromium"
    fi
else
    echo "  ❌ Playwright 缓存目录不存在"
    echo "     运行: source .venv/bin/activate && python -m playwright install chromium"
fi

# 5. 检查服务状态
echo ""
echo "[5/5] 服务状态"
if command -v pm2 &> /dev/null; then
    pm2_status=$(pm2 jlist 2>/dev/null | grep -o '"name":"article-collector"' || echo "")
    if [ -n "$pm2_status" ]; then
        status=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); print([p['pm2_env']['status'] for p in data if p['name']=='article-collector'][0])" 2>/dev/null || echo "unknown")
        if [ "$status" = "online" ]; then
            echo "  ✅ article-collector 服务运行中"
        else
            echo "  ⚠️  article-collector 服务状态: $status"
        fi
    else
        echo "  ❌ article-collector 服务未注册"
    fi
else
    echo "  ❌ PM2 未安装"
fi

# 6. 检查 .env 配置
echo ""
echo "[6/6] 配置文件"
if [ -f ".env" ]; then
    echo "  ✅ .env 文件存在"
    
    # 检查必要配置
    missing=""
    for key in LARK_APP_ID LARK_APP_SECRET WIKI_SPACE_ID BITABLE_APP_TOKEN BITABLE_TABLE_ID; do
        if ! grep -q "^$key=" .env; then
            missing="$missing $key"
        fi
    done
    
    if [ -z "$missing" ]; then
        echo "  ✅ 必要配置项齐全"
    else
        echo "  ❌ 缺少配置项:$missing"
    fi
else
    echo "  ❌ .env 文件不存在"
fi

echo ""
echo "========================"
echo "检查完成"
