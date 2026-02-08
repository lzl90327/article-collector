# 视频/播客功能部署指南

## 概述

本文档指导如何为 article-collector 项目部署视频/播客功能，支持 B站、抖音、小宇宙、喜马拉雅等平台。

## 系统要求

### 必需环境

- **Node.js**: >= 20.0.0
- **Python**: >= 3.11
- **FFmpeg**: >= 4.0
- **磁盘空间**: 至少 10GB（用于 Whisper 模型）
- **内存**: 至少 4GB（运行 Whisper large-v3 需要）

### 可选环境

- **GPU**: 支持 CUDA 的显卡可大幅提升转录速度
- **Docker**: 用于部署 Douyin API 服务

## 快速开始

### 1. 一键安装依赖

运行自动安装脚本：

```bash
./scripts/setup-video-tools.sh
```

该脚本会自动：
- 检查 Python 版本
- 安装 yt-dlp
- 安装 FFmpeg
- 安装 faster-whisper
- 下载并测试 Whisper base 模型

### 2. 配置环境变量

编辑 `.env` 文件，添加视频/播客配置：

```bash
# ========== 视频/播客功能配置 ==========
# Whisper 模型选择（推荐 large-v3）
WHISPER_MODEL=large-v3

# OpenAI Whisper API（可选，用于短音频）
OPENAI_WHISPER_API_KEY=sk-xxx

# 转录策略阈值（秒）：超过600秒用本地，否则用API
TRANSCRIPTION_THRESHOLD=600

# B站 Cookie（高清视频需要）
BILIBILI_COOKIE=SESSDATA=xxx; bili_jct=xxx

# 抖音 API 服务地址
DOUYIN_API_URL=http://127.0.0.1:5557

# yt-dlp 路径（通常自动识别）
YT_DLP_PATH=yt-dlp

# 性能限制
MAX_VIDEO_SIZE_MB=500
MAX_AUDIO_DURATION_MINUTES=120
```

### 3. 配置知识库父节点

在飞书知识库中创建两个父节点，分别存放视频和播客内容：

```bash
# 视频内容保存位置
WIKI_VIDEO_PARENT_NODE_TOKEN=xxx

# 播客内容保存位置
WIKI_PODCAST_PARENT_NODE_TOKEN=xxx
```

### 4. 扩展 Bitable 字段

在飞书多维表格中添加以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 内容类型 | 单选 | 选项：文章/小红书/视频/播客 |
| 视频时长 | 数字 | 秒数 |
| 音频时长 | 数字 | 秒数 |
| 转录状态 | 单选 | 选项：待处理/转录中/已完成/失败 |
| 关键帧数量 | 数字 | 提取的关键帧数量 |

### 5. 启动服务

```bash
npm run dev
```

## 平台特殊配置

### B站视频

#### Cookie 获取（高清视频需要）

1. 登录 bilibili.com
2. 打开浏览器开发者工具（F12）
3. Application → Cookies → bilibili.com
4. 复制以下字段：
   - `SESSDATA`
   - `bili_jct`
   - `DedeUserID`

5. 配置格式：
```bash
BILIBILI_COOKIE="SESSDATA=xxx; bili_jct=yyy; DedeUserID=zzz"
```

#### 测试链接

```
https://www.bilibili.com/video/BV1xx411c7XD
https://b23.tv/xxxxx
```

### 抖音视频

#### 部署 Douyin API 服务

**方式 1: Docker 部署（推荐）**

```bash
# 克隆项目
git clone https://github.com/Evil0ctal/Douyin_TikTok_Download_API.git
cd Douyin_TikTok_Download_API

# Docker 运行
docker build -t douyin-api .
docker run -d -p 5557:80 douyin-api
```

**方式 2: 本地部署**

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

#### Cookie 管理

抖音 Cookie 有效期较短，需要定期更新。

获取方式：
1. 登录 douyin.com
2. 开发者工具 → Application → Cookies
3. 复制所有 Cookie
4. 更新到 Douyin API 配置中

#### 测试链接

```
https://www.douyin.com/video/7xxx
https://v.douyin.com/xxxxx
```

### 小宇宙播客

无需特殊配置，直接使用。

#### 域名替换法

小宇宙支持通过域名替换直接下载：
```
原始: https://www.xiaoyuzhoufm.com/episode/xxx
替换: https://www.xiaoyuzhoufm.xlab.app/episode/xxx
```

#### 测试链接

```
https://www.xiaoyuzhoufm.com/episode/63e0c889e0bfab62b9d0e123
```

### 喜马拉雅播客

无需特殊配置，使用 Python 爬虫直接下载。

#### 测试链接

```
https://www.ximalaya.com/sound/12345678
```

## 音频转录配置

### 本地转录（faster-whisper）

#### 模型选择

| 模型 | 内存占用 | 速度 | 准确率 | 推荐场景 |
|------|----------|------|--------|---------|
| tiny | 400MB | 最快 | 低 | 测试 |
| base | 500MB | 很快 | 中 | 快速预览 |
| small | 1GB | 快 | 良好 | 一般场景 |
| medium | 2GB | 中 | 很好 | 推荐 |
| large-v3 | 3GB | 慢 | 最佳 | 生产环境 |

#### 下载模型

首次使用时自动下载，或手动下载：

```python
from faster_whisper import WhisperModel

# 下载指定模型
model = WhisperModel("large-v3", device="cpu", compute_type="int8")
```

模型存储位置：`~/.cache/huggingface/hub/`

#### GPU 加速（可选）

如果有 NVIDIA GPU：

```bash
# 安装 CUDA 支持
pip install faster-whisper[cuda]

# 配置使用 GPU
# 在代码中 device="cuda" 替代 device="cpu"
```

### 云端转录（OpenAI Whisper API）

#### 获取 API Key

1. 访问 https://platform.openai.com/api-keys
2. 创建新的 API Key
3. 配置到 `.env`:
```bash
OPENAI_WHISPER_API_KEY=sk-xxx
```

#### 成本估算

- 价格: $0.006/分钟
- 10分钟音频: $0.06
- 1小时音频: $0.36

#### 混合策略

默认策略（10分钟为界）：
- ≤10分钟: 使用 OpenAI API（快速）
- >10分钟: 使用本地模型（节省成本）

调整阈值：
```bash
# 改为 5 分钟
TRANSCRIPTION_THRESHOLD=300
```

## 关键帧提取配置

### FFmpeg 场景检测

默认参数（适合 PPT 类视频）：

```bash
# 场景检测阈值 0.2
# 仅在主要切换时提取关键帧
```

调整阈值（在代码中）：
- `0.05-0.1`: 捕获频繁变化（包括动画）
- `0.2`: 仅主要幻灯片切换（默认）
- `0.3`: 仅捕获剧烈变化

### 最大帧数限制

默认: 50 帧

避免生成过多图片占用空间。

## 性能优化

### 转录速度优化

1. **使用 GPU**（速度提升 5-10x）
```bash
pip install faster-whisper[cuda]
```

2. **使用量化模型**（内存减半）
```python
model = WhisperModel("large-v3", device="cpu", compute_type="int8")
```

3. **调整模型大小**
```bash
# 速度优先
WHISPER_MODEL=medium

# 准确度优先
WHISPER_MODEL=large-v3
```

### 内存优化

1. **限制最大音频时长**
```bash
MAX_AUDIO_DURATION_MINUTES=60
```

2. **限制最大视频大小**
```bash
MAX_VIDEO_SIZE_MB=300
```

3. **及时清理临时文件**
（代码中已实现）

### 并发处理

Redis 队列自动管理并发：

```bash
# 在 worker.ts 中调整并发数
WORKER_CONCURRENCY=3
```

## 故障排查

### 问题 1: Whisper 模型下载失败

**现象**: 转录时提示模型加载失败

**解决方案**:
```bash
# 检查网络连接
curl -I https://huggingface.co

# 手动下载模型
python3 -c "from faster_whisper import WhisperModel; WhisperModel('base')"

# 或使用镜像源
export HF_ENDPOINT=https://hf-mirror.com
```

### 问题 2: yt-dlp 下载失败

**现象**: B站视频下载报错

**解决方案**:
```bash
# 更新 yt-dlp 到最新版本
pip3 install -U yt-dlp

# 或使用 brew
brew upgrade yt-dlp

# 检查版本
yt-dlp --version
```

### 问题 3: Cookie 过期

**现象**: 提示需要登录或无权限

**解决方案**:
1. 重新获取 Cookie（参考上面步骤）
2. 更新 `.env` 文件
3. 重启服务

### 问题 4: FFmpeg 未找到

**现象**: 关键帧提取失败

**解决方案**:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# 验证安装
ffmpeg -version
```

### 问题 5: 内存不足

**现象**: 转录时进程被杀死

**解决方案**:
1. 使用更小的模型（medium 或 small）
2. 限制最大音频时长
3. 增加系统交换空间（swap）

## 监控和日志

### 查看日志

```bash
# 实时日志
tail -f logs/article-collector.log

# 搜索错误
grep ERROR logs/article-collector.log

# 搜索特定平台
grep "bilibili" logs/article-collector.log
```

### 性能监控

```bash
# Redis 队列长度
redis-cli xlen article-collector:tasks

# 内存占用
ps aux | grep node

# CPU 占用
top -p $(pgrep -f "node.*article-collector")
```

## 安全建议

### Cookie 安全

1. **不要提交 Cookie 到 Git**
   - `.env` 文件已在 `.gitignore` 中
   
2. **定期轮换 Cookie**
   - 每月更新一次
   
3. **使用环境变量**
   - 生产环境使用密钥管理系统

### API Key 安全

1. **设置支出限额**
   - OpenAI Dashboard 设置月度限额
   
2. **监控使用量**
   - 定期检查 API 调用统计

### 数据安全

1. **临时文件清理**
   - 代码自动清理下载的视频/音频
   
2. **备份重要数据**
   - 定期备份 Bitable 数据

## 更新和维护

### 工具更新

```bash
# 更新 yt-dlp
pip3 install -U yt-dlp

# 更新 faster-whisper
pip3 install -U faster-whisper

# 更新 FFmpeg
brew upgrade ffmpeg  # macOS
```

### 依赖检查

```bash
# 运行依赖检查脚本
./scripts/setup-video-tools.sh

# 检查 Python 包
pip3 list | grep -E "faster-whisper|yt-dlp"

# 检查 Node.js 包
npm list fluent-ffmpeg
```

## 支持的链接格式

### B站

```
✅ https://www.bilibili.com/video/BV1xx411c7XD
✅ https://www.bilibili.com/video/av12345678
✅ https://b23.tv/xxxxx
```

### 抖音

```
✅ https://www.douyin.com/video/7xxx
✅ https://v.douyin.com/xxxxx
✅ https://www.iesdouyin.com/share/video/xxx
```

### 小宇宙

```
✅ https://www.xiaoyuzhoufm.com/episode/xxx
✅ https://www.xiaoyuzhoufm.com/episodes/xxx
```

### 喜马拉雅

```
✅ https://www.ximalaya.com/sound/12345678
✅ https://www.ximalaya.com/album/xxx/12345678
```

## 常见问题 FAQ

**Q: 支持哪些视频格式？**
A: 支持 MP4, WebM, FLV 等常见格式，由 yt-dlp 和 FFmpeg 自动处理。

**Q: 转录准确率如何？**
A: 使用 large-v3 模型，中文准确率可达 90-95%。

**Q: 可以批量处理吗？**
A: 可以，通过 Redis 队列自动批量处理。

**Q: 支持字幕导出吗？**
A: 当前版本暂不支持，计划在后续版本添加 SRT 导出功能。

**Q: 需要梯子吗？**
A: 国内平台（B站、抖音、小宇宙、喜马拉雅）无需梯子。OpenAI API 可能需要。

## 下一步

部署完成后，您可以：

1. 测试各平台链接解析
2. 查看转录质量和速度
3. 调整配置参数优化性能
4. 监控服务运行状态

有问题请查看 [故障排查](#故障排查) 章节。
