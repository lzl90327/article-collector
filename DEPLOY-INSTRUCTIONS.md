# 部署到云服务器 - 快速指令

## 当前状态
✅ 代码已提交到 Git
✅ 代码已推送到 GitHub (feature/video-podcast 分支)
✅ 本地编译通过

## 需要在云服务器上执行的命令

### 方式一：如果可以 SSH 到云服务器

```bash
# 1. SSH 连接到云服务器
ssh lizuolin_cloud@<服务器IP>

# 2. 进入项目目录
cd /Users/lizuolin_cloud/article-collector

# 3. 拉取最新代码
git fetch origin
git checkout feature/video-podcast
git pull origin feature/video-podcast

# 4. 更新 .env.production 配置
# 在文件末尾添加以下内容（如果还没有）：
cat >> .env.production <<'EOF'

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
EOF

# 5. 编译代码
npm run build

# 6. 重启服务
pm2 reload article-collector

# 7. 查看状态和日志
pm2 status
pm2 logs article-collector --lines 50
```

### 方式二：使用 deploy-to-cloud.sh 脚本（需要修改）

如果可以 SSH，可以使用自动化脚本：

```bash
# 1. 编辑脚本，修改 CLOUD_HOST
nano deploy-to-cloud.sh
# 将 CLOUD_HOST="localhost" 改为实际的服务器 IP 或域名
# 例如：CLOUD_HOST="192.168.1.100" 或 CLOUD_HOST="cloud.example.com"

# 2. 运行部署脚本
./deploy-to-cloud.sh
```

### 方式三：如果是通过控制面板或其他方式

1. 登录到云服务器控制面板
2. 打开终端或 SSH 连接
3. 执行"方式一"中的命令

## 验证部署

部署完成后，发送一个 B站视频链接到飞书机器人测试：

```
https://www.bilibili.com/video/BV1xx411c7mu/
```

检查：
- [ ] 文档是否在 https://my.feishu.cn/wiki/NHnMwAwdEiQs3CkQtrEcc7aVnNd 下
- [ ] 关键帧图片是否正常显示（不是 file:// 路径）
- [ ] 是否包含音频转录文字
- [ ] 飞书消息是否显示完整信息

## 故障排查

### 如果编译失败
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 如果 PM2 重启失败
```bash
# 查看错误日志
pm2 logs article-collector --err --lines 50

# 停止并重新启动
pm2 stop article-collector
pm2 start ecosystem.config.js --only article-collector
```

### 如果需要查看详细日志
```bash
# 实时查看日志
pm2 logs article-collector

# 查看错误日志
tail -f /Users/lizuolin_cloud/.pm2/logs/article-collector-error.log

# 查看输出日志
tail -f /Users/lizuolin_cloud/.pm2/logs/article-collector-out.log
```

## 需要帮助？

- 查看完整部署指南：`cat DEPLOYMENT-GUIDE.md`
- 查看代码变更：`git log -1 --stat`
- 查看配置文件：`cat .env.production`
