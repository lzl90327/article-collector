# B站视频信息提取服务

## 📦 文件清单

### 核心服务
- **`src/services/bilibili-fetcher.ts`** - B站视频信息提取和下载服务（主文件）

### 文档
- **`docs/bilibili-fetcher-usage.md`** - 完整使用指南和 API 文档

### 示例
- **`examples/bilibili-integration.ts`** - 与项目其他模块的集成示例

### 测试脚本
- **`scripts/test-bilibili.ts`** - TypeScript 测试脚本
- **`scripts/test-bilibili.sh`** - Shell 测试脚本（推荐）

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装 yt-dlp（必需）
brew install yt-dlp

# 安装 ffmpeg（音频提取需要）
brew install ffmpeg
```

### 2. 配置环境变量

在 `.env` 文件中添加：

```bash
# yt-dlp 路径（默认使用全局命令）
YT_DLP_PATH=yt-dlp

# B站 Cookie（可选，高清视频需要）
BILIBILI_COOKIE=your_cookie_here

# 视频大小限制（MB）
MAX_VIDEO_SIZE_MB=500

# 音频时长限制（分钟）
MAX_AUDIO_DURATION_MINUTES=120
```

### 3. 运行测试

```bash
# 仅提取信息
./scripts/test-bilibili.sh "https://www.bilibili.com/video/BV1xx411c7XZ"

# 下载视频
DOWNLOAD_VIDEO=true ./scripts/test-bilibili.sh "https://www.bilibili.com/video/BV1xx411c7XZ"

# 提取音频
EXTRACT_AUDIO=true ./scripts/test-bilibili.sh "https://www.bilibili.com/video/BV1xx411c7XZ"

# 完整测试（下载视频和音频）
DOWNLOAD_VIDEO=true EXTRACT_AUDIO=true ./scripts/test-bilibili.sh "https://www.bilibili.com/video/BV1xx411c7XZ"
```

## 📖 使用示例

### 仅提取视频信息

```typescript
import { fetchBilibiliVideo } from './services/bilibili-fetcher';

const result = await fetchBilibiliVideo('https://www.bilibili.com/video/BV1xx411c7XZ');

if (result.success && result.info) {
  console.log('标题:', result.info.title);
  console.log('作者:', result.info.author);
  console.log('时长:', result.info.duration, '秒');
  console.log('BV号:', result.info.bvid);
}
```

### 下载视频和提取音频

```typescript
import { fetchBilibiliVideo, cleanupFiles } from './services/bilibili-fetcher';

const result = await fetchBilibiliVideo(
  'https://www.bilibili.com/video/BV1xx411c7XZ',
  {
    downloadVideo: true,
    extractAudio: true,
  }
);

if (result.success) {
  console.log('视频:', result.videoPath);
  console.log('音频:', result.audioPath);
  
  // 使用完后清理
  cleanupFiles(result);
}
```

## 🎯 核心功能

### ✅ 已实现

- [x] 视频元信息提取
  - 标题、作者、时长、发布时间
  - 简介、标签、封面图
  - BV号、观看数、点赞数
- [x] 视频下载（支持高清）
- [x] 音频提取（WAV 格式）
- [x] 短链自动展开（b23.tv → bilibili.com）
- [x] Cookie 认证支持
- [x] 文件大小和时长限制
- [x] 完善的错误处理
- [x] 自动临时文件管理
- [x] 详细的日志记录

### 错误处理

服务能够识别和处理以下错误：

- ✅ URL 无效
- ✅ 视频不存在或已删除
- ✅ 访问被拒绝（需要 Cookie）
- ✅ Cookie 过期
- ✅ 视频文件过大
- ✅ 视频时长过长
- ✅ yt-dlp 未安装或执行失败
- ✅ 网络连接问题

## 📚 详细文档

- **使用指南**: `docs/bilibili-fetcher-usage.md`
  - 完整的 API 参考
  - 更多使用示例
  - 常见问题解答
  - 最佳实践

- **集成示例**: `examples/bilibili-integration.ts`
  - 飞书多维表格集成
  - 飞书知识库集成
  - Redis 队列集成
  - 批量处理
  - 错误重试机制

## 🔧 配置说明

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `YT_DLP_PATH` | 否 | `yt-dlp` | yt-dlp 命令路径 |
| `BILIBILI_COOKIE` | 否 | - | B站 Cookie（高清视频需要） |
| `MAX_VIDEO_SIZE_MB` | 否 | `500` | 视频大小限制（MB） |
| `MAX_AUDIO_DURATION_MINUTES` | 否 | `120` | 音频时长限制（分钟） |

### 临时文件

临时文件存储位置：

```
/tmp/article-collector-media/
```

- 自动清理：24小时后
- 手动清理：调用 `cleanupFiles(result)`

## 🛠️ 与项目集成

### 1. 保存到飞书多维表格

```typescript
import { saveBilibiliToFeishu } from '../examples/bilibili-integration';

await saveBilibiliToFeishu('https://www.bilibili.com/video/BV1xx411c7XZ');
```

### 2. 创建飞书知识库文档

```typescript
import { createBilibiliWikiDoc } from '../examples/bilibili-integration';

const docUrl = await createBilibiliWikiDoc('https://www.bilibili.com/video/BV1xx411c7XZ');
console.log('文档地址:', docUrl);
```

### 3. 完整工作流

```typescript
import { processBilibiliVideoComplete } from '../examples/bilibili-integration';

const result = await processBilibiliVideoComplete('https://www.bilibili.com/video/BV1xx411c7XZ');
// result 包含: bitableRecordId, wikiDocUrl, audioPath, transcription
```

## 📝 API 接口

### `fetchBilibiliVideo(url, options?)`

主函数，提取 B站视频信息和下载。

**参数：**
```typescript
url: string                    // B站视频链接
options?: {
  downloadVideo?: boolean;     // 是否下载视频
  extractAudio?: boolean;      // 是否提取音频
  cookie?: string;             // 自定义 Cookie
}
```

**返回：**
```typescript
Promise<BilibiliVideoResult> {
  success: boolean;            // 是否成功
  info?: BilibiliVideoInfo;    // 视频信息
  videoPath?: string;          // 视频文件路径
  audioPath?: string;          // 音频文件路径
  error?: string;              // 错误信息
}
```

### `cleanupFiles(result)`

清理临时文件。

**参数：**
```typescript
result: BilibiliVideoResult    // fetchBilibiliVideo 的返回结果
```

## 💡 使用技巧

1. **Cookie 认证**
   - 高清视频建议配置 Cookie
   - Cookie 从浏览器开发者工具复制

2. **性能优化**
   - 仅提取信息不下载视频最快
   - 需要音频时，直接提取音频比下载视频后提取更快

3. **错误处理**
   - 始终检查 `result.success`
   - 部分错误仍返回 `result.info`（视频信息）

4. **文件清理**
   - 使用完临时文件后立即调用 `cleanupFiles()`
   - 系统会自动清理 24 小时前的文件

## 🐛 故障排除

### yt-dlp 命令未找到

```bash
# macOS
brew install yt-dlp

# Linux
pip install yt-dlp

# 验证
yt-dlp --version
```

### 提示需要 Cookie

1. 登录 bilibili.com
2. 打开浏览器开发者工具（F12）
3. 查看 Network 标签
4. 刷新页面，找到任意请求
5. 复制 Cookie 值到 `.env` 文件

### 音频提取失败

确保已安装 ffmpeg：

```bash
brew install ffmpeg
ffmpeg -version
```

## 📊 测试数据

测试脚本会输出类似以下信息：

```
✅ 视频信息提取成功:

  📌 标题: 测试视频标题
  👤 作者: 测试作者
  🕒 时长: 5:30
  📅 发布时间: 2024-01-15
  🔗 BV号: BV1xx411c7XZ
  👁️  观看数: 12,345
  👍 点赞数: 678
  🏷️  标签: 科技, 教程, 编程
  🖼️  封面: https://i2.hdslb.com/bfs/...
```

## 🔗 相关资源

- [yt-dlp 官方文档](https://github.com/yt-dlp/yt-dlp)
- [B站开放平台](https://open.bilibili.com/)
- [FFmpeg 文档](https://ffmpeg.org/documentation.html)

## 📄 License

MIT

---

**创建时间**: 2026-02-08  
**作者**: Article Collector 项目组  
**版本**: v1.0.0
