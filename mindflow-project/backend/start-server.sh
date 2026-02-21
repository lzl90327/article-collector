#!/bin/bash
# 启动 MindFlow 后端服务

export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=512"

cd /Users/lizuolin_cloud/mindflow/backend

# 使用 node 直接启动，确保内存限制生效
exec node --max-old-space-size=512 dist/server.js
