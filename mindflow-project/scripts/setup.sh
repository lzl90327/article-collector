#!/bin/bash

# MindFlow 项目初始化脚本

set -e

echo "🚀 MindFlow 项目初始化"
echo "========================"

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 >= 18"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 安装后端依赖
echo ""
echo "📦 安装后端依赖..."
cd backend
npm install
cd ..

# 安装前端依赖
echo ""
echo "📦 安装前端依赖..."
cd frontend
npm install
cd ..

# 创建环境变量文件
echo ""
echo "🔧 创建环境变量文件..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请编辑配置你的 API Keys"
else
    echo "⚠️ .env 文件已存在，跳过"
fi

# 创建前端环境变量
if [ ! -f frontend/.env ]; then
    cat > frontend/.env << EOF
# Frontend Environment Variables
TARO_APP_API_URL=http://localhost:3001/api
EOF
    echo "✅ 已创建 frontend/.env 文件"
fi

echo ""
echo "✅ 初始化完成！"
echo ""
echo "下一步:"
echo "  1. 编辑 .env 文件，配置你的 API Keys"
echo "  2. 运行后端: cd backend && npm run dev"
echo "  3. 运行前端: cd frontend && npm run dev:weapp"
echo "  4. 运行测试: npm test"
