# 云服务器环境诊断说明

## 快速执行

### 方式一：SSH 远程执行（推荐）

在**本地**执行，将诊断脚本通过 SSH 传到云服务器并运行：

```bash
# 从项目根目录执行
ssh lizuolin_cloud@100.117.165.59 "cd /Users/lizuolin_cloud/article-collector && bash -s" < scripts/diagnose-cloud-env.sh
```

### 方式二：在云服务器上直接执行

SSH 登录后在项目目录执行：

```bash
ssh lizuolin_cloud@100.117.165.59
cd /Users/lizuolin_cloud/article-collector
./scripts/diagnose-cloud-env.sh
```

### 方式三：先拉取最新代码再诊断

若需确认 feature/video-podcast 是否已部署：

```bash
ssh lizuolin_cloud@100.117.165.59
cd /Users/lizuolin_cloud/article-collector
git fetch origin
git checkout feature/video-podcast
git pull origin feature/video-podcast
./scripts/diagnose-cloud-env.sh
```

---

## 诊断报告解读

### 1. PM2 进程状态

- **期望**：`article-collector` 状态为 `online`
- **异常**：`errored` / `stopped` → 查看 `pm2 logs article-collector --err`

### 2. 环境配置文件

| 配置项 | 说明 | 期望值 |
|--------|------|--------|
| NODE_ENV | 由 PM2 注入为 production | production |
| YT_DLP_PATH | yt-dlp 路径 | yt-dlp 或 /usr/local/bin/yt-dlp |
| FFMPEG_PATH | ffmpeg 路径 | ffmpeg 或 /usr/local/bin/ffmpeg |
| WIKI_VIDEO_PARENT_NODE_TOKEN | 视频知识库父节点 | 已配置（约 25 字符） |
| MAX_VIDEO_SIZE_MB | 视频大小限制 | 500 |
| MAX_AUDIO_DURATION_MINUTES | 音频时长限制 | 120 |
| TRANSCRIPTION_THRESHOLD | 转录阈值（秒） | 600 |
| WHISPER_MODEL | Whisper 模型 | large-v3 |

### 3. 代码分支

- **期望**：当前分支为 `feature/video-podcast`
- **若为 main/master**：需执行 `git checkout feature/video-podcast && git pull`

### 4. 关键文件检查

| 文件 | 检查点 | 期望 |
|------|--------|------|
| bilibili-fetcher.ts | `path.dirname(videoConfig.ffmpegPath)` | ✓ 包含 |
| lark-client.ts | `uploadImageToTemp` | ✓ 包含 |
| message.ts | `uploadImageToTemp(kf.path)` | ✓ 包含 |
| message.ts | `asrService.transcribe` | ✓ 包含 |
| message.ts | `processBilibiliVideo` | ✓ 包含 |

### 5. 编译产物

- `dist/index.js` 应存在
- `dist/services/bilibili-fetcher.js` 应包含 `path.dirname(videoConfig.ffmpegPath)`

### 6. 外部工具

- `yt-dlp` 和 `ffmpeg` 需在 PATH 中可执行

---

## 本地期望状态（供对比）

当前本地 `feature/video-podcast` 分支关键文件特征：

- **bilibili-fetcher.ts**：第 247、424 行使用 `--ffmpeg-location path.dirname(videoConfig.ffmpegPath)`
- **lark-client.ts**：包含 `uploadImage()` 和 `uploadImageToTemp()` 方法
- **message.ts**：`processBilibiliVideo` 中调用 `uploadImageToTemp(kf.path)` 和 `asrService.transcribe(audioPath)`

若云服务器上这些文件的检查结果为 ⚠ 或 ✗，说明代码未更新或未正确部署。

---

## 常见问题处理

| 现象 | 处理 |
|------|------|
| 分支不是 feature/video-podcast | `git checkout feature/video-podcast && git pull` |
| .env.production 缺少视频配置 | 参考 DEPLOY-INSTRUCTIONS.md 补充 |
| dist 未包含最新修复 | `npm run build && pm2 reload article-collector` |
| PM2 进程异常 | `pm2 logs article-collector --err --lines 100` |
| yt-dlp/ffmpeg 未找到 | 运行 `scripts/setup-video-tools.sh` |
