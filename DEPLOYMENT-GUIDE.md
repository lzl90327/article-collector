# B站视频功能修复 - 部署指南

## 修复完成总结

所有代码修改已完成并通过编译。以下是具体完成的任务：

### ✅ 已完成的修改

1. **环境配置更新** (`.env.production`)
   - 添加 `WIKI_VIDEO_PARENT_NODE_TOKEN=NHnMwAwdEiQs3CkQtrEcc7aVnNd`
   - 添加 `WIKI_PODCAST_PARENT_NODE_TOKEN=NHnMwAwdEiQs3CkQtrEcc7aVnNd`
   - 添加完整的视频/播客处理配置（YT_DLP_PATH, FFMPEG_PATH, WHISPER_MODEL 等）

2. **新增图片上传方法** (`src/services/lark-client.ts`)
   - 添加 `uploadImageToTemp()` 方法
   - 使用飞书消息图片上传 API (`/im/v1/images`)
   - 返回 `image_key` 可直接用于文档

3. **重构 B站视频处理逻辑** (`src/handlers/message.ts`)
   - 启用音频提取：`extractAudio: true`
   - 实现音频转录（带重试机制）
   - 实现关键帧上传到飞书（带重试机制）
   - 添加临时文件清理
   - 优化错误处理和用户提示

4. **修改文档内容构建** (`src/handlers/message.ts`)
   - 更新函数签名支持 `fileToken` 和 `transcription` 参数
   - 使用 `![IMG:0](TOKEN:xxx)` 格式显示关键帧
   - 添加音频转录文字到文档

5. **编译验证**
   - TypeScript 编译成功
   - 无 linter 错误

## 部署到云服务器

### 步骤 1: 上传代码到云服务器

```bash
# 在本地
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /Users/zuolin1/article-collector/ \
  lizuolin_cloud@your-server:/Users/lizuolin_cloud/article-collector/
```

或者使用 Git：

```bash
# 在云服务器上
cd /Users/lizuolin_cloud/article-collector
git pull origin feature/video-podcast
```

### 步骤 2: 安装依赖（如需要）

```bash
cd /Users/lizuolin_cloud/article-collector
npm install
```

### 步骤 3: 编译代码

```bash
npm run build
```

### 步骤 4: 重启服务

```bash
# 重启 article-collector 服务
pm2 reload article-collector

# 查看日志确认启动成功
pm2 logs article-collector --lines 50

# 查看服务状态
pm2 status
```

## 测试验证清单

发送一个 B站视频链接到飞书机器人，然后检查：

### ✅ 检查项

1. **知识库路径**
   - [ ] 文档是否保存在 `https://my.feishu.cn/wiki/NHnMwAwdEiQs3CkQtrEcc7aVnNd` 下
   - [ ] 如果移动失败，是否有提示"文档当前在根目录，请手动移动"

2. **关键帧图片**
   - [ ] 文档中是否显示了关键帧图片（不是 file:// 链接）
   - [ ] 关键帧数量是否正确（例如 5 张）
   - [ ] 图片是否可以正常查看

3. **音频转录**
   - [ ] 文档中是否包含"文字稿"章节
   - [ ] 转录文字是否有时间戳格式
   - [ ] 转录内容是否准确

4. **临时文件清理**
   - [ ] 检查临时目录文件是否被清理
   ```bash
   ls -lh /tmp/article-collector-media/
   ```

5. **错误处理**
   - [ ] 如果转录失败，是否继续保存文档
   - [ ] 如果部分关键帧上传失败，是否显示成功的关键帧
   - [ ] 错误日志是否记录完整

6. **飞书消息**
   - [ ] 是否显示处理进度（获取信息、转录中、上传关键帧）
   - [ ] 最终成功消息是否包含所有信息（关键帧数量、转录状态）

## 测试示例

发送以下消息到飞书机器人：

```
https://www.bilibili.com/video/BV1xx411c7mu/
```

期望结果：

```
✅ **B 站视频保存成功**

📹 **[视频标题]**
👤 UP主: [UP主名称]
⏱️ 时长: X分X秒
📊 播放: XXXXX 次
🖼️ 关键帧: 5/5 张
📝 转录: ✓ 已完成

📄 [查看文档](https://feishu.cn/docx/xxx)
🔗 [原视频](https://www.bilibili.com/video/BV1xx411c7mu/)
```

## 错误处理验证

### 场景 1: 转录失败
- 预期：文档保存成功，但不包含转录文字
- 消息显示：`📝 转录: ✗ 未转录`

### 场景 2: 部分关键帧上传失败
- 预期：显示成功上传的关键帧
- 消息显示：`🖼️ 关键帧: 3/5 张`

### 场景 3: 知识库移动失败
- 预期：文档保存在根目录，有提示信息
- 消息显示：`⚠️ 注意：文档当前在根目录，请手动移动到目标位置`

## 监控日志

实时查看日志：

```bash
# 实时查看
pm2 logs article-collector

# 查看错误日志
pm2 logs article-collector --err

# 查看最近 100 行
pm2 logs article-collector --lines 100
```

关键日志标记：
- `[B站]` - B站处理相关
- `转录完成` - 转录成功
- `关键帧上传成功` - 图片上传成功
- `临时文件清理完成` - 文件清理成功

## 回滚方案

如果部署后发现问题，可以快速回滚：

```bash
# 切换到之前的分支
git checkout main

# 重新编译
npm run build

# 重启服务
pm2 reload article-collector
```

## 注意事项

1. **权限检查**：确保飞书应用有以下权限
   - `wiki:wiki` - 知识库操作
   - `docx:document` - 文档读写
   - `im:message` - 消息发送
   - `im:image` - 图片上传

2. **依赖检查**：确保服务器安装了
   - `yt-dlp` - 视频下载
   - `ffmpeg` - 音视频处理
   - `python3` - ASR 转录（如使用 faster-whisper）

3. **磁盘空间**：视频处理会占用临时空间，确保有足够磁盘空间

4. **性能监控**：转录操作消耗 CPU，注意服务器负载

## 故障排查

### 问题：编译失败
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 问题：PM2 重启失败
```bash
# 停止服务
pm2 stop article-collector

# 删除进程
pm2 delete article-collector

# 重新启动
pm2 start ecosystem.config.js --only article-collector
```

### 问题：文档不在知识库中
- 检查 `.env.production` 中的 `WIKI_VIDEO_PARENT_NODE_TOKEN` 是否正确
- 检查飞书应用权限
- 查看日志中的错误信息

### 问题：关键帧图片不显示
- 检查图片是否成功上传（日志中搜索 "临时图片上传成功"）
- 检查飞书应用是否有 `im:image` 权限
- 查看文档内容格式是否正确（应该是 `![IMG:0](TOKEN:xxx)`）

### 问题：没有转录文字
- 检查是否安装了 ASR 服务（faster-whisper 或 OpenAI API）
- 查看日志中的转录错误信息
- 检查 `.env.production` 中的 `WHISPER_MODEL` 配置

## 完成时间

- 开发完成：2026-02-10
- 编译通过：✅
- 待部署到生产环境
