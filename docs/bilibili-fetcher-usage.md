# B站视频信息提取和下载服务使用指南

## 功能概览

`bilibili-fetcher.ts` 提供了完整的 B站视频信息提取和下载功能：

- ✅ 视频元信息提取（标题、作者、时长、发布时间、简介、标签等）
- ✅ 视频下载
- ✅ 音频提取
- ✅ 短链自动展开（b23.tv → bilibili.com）
- ✅ Cookie 认证支持（高清视频）
- ✅ 完善的错误处理
- ✅ 文件大小和时长限制
- ✅ 自动临时文件管理

## 快速开始

### 1. 环境配置

在 `.env` 文件中添加配置：

```bash
# yt-dlp 路径（默认为全局命令）
YT_DLP_PATH=yt-dlp

# B站 Cookie（可选，高清视频需要）
BILIBILI_COOKIE=your_cookie_here

# 视频大小限制（MB）
MAX_VIDEO_SIZE_MB=500

# 音频时长限制（分钟）
MAX_AUDIO_DURATION_MINUTES=120
```

### 2. 安装 yt-dlp

```bash
# macOS
brew install yt-dlp

# 或使用 pip
pip install yt-dlp

# 验证安装
yt-dlp --version
```

### 3. 获取 B站 Cookie（可选）

高清视频可能需要 Cookie 认证：

1. 登录 bilibili.com
2. 打开浏览器开发者工具（F12）
3. 进入 Network 标签
4. 刷新页面
5. 找到任意请求，复制 Cookie 值
6. 将 Cookie 保存到 `.env` 文件

## 使用示例

### 示例 1：仅提取视频信息

```typescript
import { fetchBilibiliVideo } from './services/bilibili-fetcher';

async function getVideoInfo() {
  const result = await fetchBilibiliVideo('https://www.bilibili.com/video/BV1xx411c7XZ');
  
  if (result.success && result.info) {
    console.log('标题:', result.info.title);
    console.log('作者:', result.info.author);
    console.log('时长:', `${Math.floor(result.info.duration / 60)}分${result.info.duration % 60}秒`);
    console.log('发布时间:', result.info.publishDate);
    console.log('BV号:', result.info.bvid);
    console.log('观看数:', result.info.viewCount);
    console.log('点赞数:', result.info.likeCount);
    console.log('标签:', result.info.tags.join(', '));
  } else {
    console.error('提取失败:', result.error);
  }
}

getVideoInfo();
```

### 示例 2：下载视频

```typescript
import { fetchBilibiliVideo, cleanupFiles } from './services/bilibili-fetcher';

async function downloadVideo() {
  const result = await fetchBilibiliVideo(
    'https://www.bilibili.com/video/BV1xx411c7XZ',
    {
      downloadVideo: true,
    }
  );
  
  if (result.success && result.videoPath) {
    console.log('视频已下载到:', result.videoPath);
    
    // 使用完后清理
    cleanupFiles(result);
  } else {
    console.error('下载失败:', result.error);
  }
}

downloadVideo();
```

### 示例 3：提取音频

```typescript
import { fetchBilibiliVideo, cleanupFiles } from './services/bilibili-fetcher';

async function extractAudio() {
  const result = await fetchBilibiliVideo(
    'https://www.bilibili.com/video/BV1xx411c7XZ',
    {
      extractAudio: true,
    }
  );
  
  if (result.success && result.audioPath) {
    console.log('音频文件:', result.audioPath);
    console.log('音频时长:', result.info?.duration, '秒');
    
    // 处理音频（例如：转录、分析等）
    // ...
    
    // 使用完后清理
    cleanupFiles(result);
  } else {
    console.error('音频提取失败:', result.error);
  }
}

extractAudio();
```

### 示例 4：下载视频并提取音频

```typescript
import { fetchBilibiliVideo, cleanupFiles } from './services/bilibili-fetcher';

async function downloadVideoAndAudio() {
  const result = await fetchBilibiliVideo(
    'https://www.bilibili.com/video/BV1xx411c7XZ',
    {
      downloadVideo: true,
      extractAudio: true,
    }
  );
  
  if (result.success) {
    console.log('视频信息:');
    console.log('  标题:', result.info?.title);
    console.log('  作者:', result.info?.author);
    console.log('  时长:', result.info?.duration, '秒');
    
    if (result.videoPath) {
      console.log('视频文件:', result.videoPath);
    }
    
    if (result.audioPath) {
      console.log('音频文件:', result.audioPath);
    }
    
    // 使用完后清理
    cleanupFiles(result);
  } else {
    console.error('处理失败:', result.error);
  }
}

downloadVideoAndAudio();
```

### 示例 5：使用自定义 Cookie

```typescript
import { fetchBilibiliVideo } from './services/bilibili-fetcher';

async function downloadWithCookie() {
  const myCookie = 'your_cookie_string_here';
  
  const result = await fetchBilibiliVideo(
    'https://www.bilibili.com/video/BV1xx411c7XZ',
    {
      downloadVideo: true,
      cookie: myCookie, // 使用自定义 Cookie
    }
  );
  
  if (result.success && result.videoPath) {
    console.log('高清视频已下载:', result.videoPath);
  } else {
    console.error('下载失败:', result.error);
  }
}

downloadWithCookie();
```

### 示例 6：处理短链接

```typescript
import { fetchBilibiliVideo } from './services/bilibili-fetcher';

async function handleShortUrl() {
  // 短链会自动展开
  const result = await fetchBilibiliVideo('https://b23.tv/abc123');
  
  if (result.success && result.info) {
    console.log('视频标题:', result.info.title);
    console.log('BV号:', result.info.bvid);
  }
}

handleShortUrl();
```

### 示例 7：错误处理

```typescript
import { fetchBilibiliVideo } from './services/bilibili-fetcher';

async function handleErrors() {
  const result = await fetchBilibiliVideo('https://www.bilibili.com/video/BVinvalid');
  
  if (!result.success) {
    // 错误类型：
    // - "URL 无效：不是有效的 B站链接"
    // - "视频不存在或已删除"
    // - "访问被拒绝，可能需要 Cookie 认证"
    // - "Cookie 可能已过期"
    // - "视频文件过大 (限制: 500MB)"
    // - "视频时长过长: XX分钟 (限制: 120分钟)"
    // - "yt-dlp 未找到或执行失败"
    
    console.error('错误:', result.error);
    
    // 部分错误仍返回视频信息
    if (result.info) {
      console.log('虽然失败，但仍获取到部分信息:');
      console.log('  标题:', result.info.title);
      console.log('  时长:', result.info.duration);
    }
  }
}

handleErrors();
```

## 完整脚本示例

创建文件 `scripts/test-bilibili.ts`：

```typescript
import { fetchBilibiliVideo, cleanupFiles } from '../src/services/bilibili-fetcher';
import { logger } from '../src/utils/logger';

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('用法: ts-node scripts/test-bilibili.ts <B站视频链接>');
    process.exit(1);
  }
  
  logger.info('=== B站视频信息提取测试 ===');
  
  // 1. 提取信息
  logger.info('1. 提取视频信息...');
  const infoResult = await fetchBilibiliVideo(url);
  
  if (!infoResult.success) {
    logger.error(`提取失败: ${infoResult.error}`);
    process.exit(1);
  }
  
  const info = infoResult.info!;
  logger.info(`标题: ${info.title}`);
  logger.info(`作者: ${info.author}`);
  logger.info(`时长: ${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`);
  logger.info(`发布时间: ${info.publishDate}`);
  logger.info(`BV号: ${info.bvid}`);
  logger.info(`观看数: ${info.viewCount?.toLocaleString() || 'N/A'}`);
  logger.info(`点赞数: ${info.likeCount?.toLocaleString() || 'N/A'}`);
  logger.info(`标签: ${info.tags.slice(0, 5).join(', ')}`);
  logger.info(`封面: ${info.thumbnail.substring(0, 60)}...`);
  
  // 2. 下载视频和音频
  logger.info('\n2. 下载视频和提取音频...');
  const downloadResult = await fetchBilibiliVideo(url, {
    downloadVideo: true,
    extractAudio: true,
  });
  
  if (downloadResult.success) {
    if (downloadResult.videoPath) {
      logger.info(`✓ 视频文件: ${downloadResult.videoPath}`);
    }
    if (downloadResult.audioPath) {
      logger.info(`✓ 音频文件: ${downloadResult.audioPath}`);
    }
    
    // 清理文件
    logger.info('\n3. 清理临时文件...');
    cleanupFiles(downloadResult);
    logger.info('✓ 清理完成');
  } else {
    logger.error(`下载失败: ${downloadResult.error}`);
  }
  
  logger.info('\n=== 测试完成 ===');
}

main().catch((error) => {
  logger.error('测试失败:', error);
  process.exit(1);
});
```

运行测试：

```bash
# 使用 ts-node
npx ts-node scripts/test-bilibili.ts "https://www.bilibili.com/video/BV1xx411c7XZ"

# 或编译后运行
npm run build
node dist/scripts/test-bilibili.js "https://www.bilibili.com/video/BV1xx411c7XZ"
```

## API 参考

### `fetchBilibiliVideo(url, options?)`

主函数，提取 B站视频信息和下载。

**参数：**
- `url`: `string` - B站视频链接（支持短链）
- `options`: `FetchOptions` (可选)
  - `downloadVideo`: `boolean` - 是否下载视频，默认 `false`
  - `extractAudio`: `boolean` - 是否提取音频，默认 `false`
  - `cookie`: `string` - 自定义 Cookie（覆盖配置）

**返回：** `Promise<BilibiliVideoResult>`

```typescript
interface BilibiliVideoResult {
  success: boolean;
  info?: BilibiliVideoInfo;
  videoPath?: string;
  audioPath?: string;
  error?: string;
}
```

### `cleanupFiles(result)`

清理下载的临时文件。

**参数：**
- `result`: `BilibiliVideoResult` - `fetchBilibiliVideo` 的返回结果

### 类型定义

```typescript
interface BilibiliVideoInfo {
  title: string;          // 标题
  author: string;         // 作者
  duration: number;       // 时长（秒）
  publishDate: string;    // 发布时间 (YYYY-MM-DD)
  description: string;    // 简介
  tags: string[];         // 标签数组
  thumbnail: string;      // 封面图 URL
  bvid: string;          // BV号
  viewCount?: number;     // 观看数
  likeCount?: number;     // 点赞数
}
```

## 常见问题

### Q1: yt-dlp 命令未找到

**A:** 请先安装 yt-dlp：

```bash
# macOS
brew install yt-dlp

# Linux
pip install yt-dlp

# 或下载二进制文件
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Q2: 提示需要 Cookie 认证

**A:** 部分高清视频需要 Cookie：

1. 登录 bilibili.com
2. 复制浏览器 Cookie
3. 设置到 `.env` 文件的 `BILIBILI_COOKIE`

### Q3: 视频下载失败

**A:** 可能的原因：

- 视频文件过大（超过 `MAX_VIDEO_SIZE_MB` 限制）
- Cookie 过期或无效
- 网络连接问题
- 视频已删除或不可用

检查日志中的具体错误信息。

### Q4: 如何只提取音频不下载视频

**A:** 使用 `extractAudio: true` 且不设置 `downloadVideo`：

```typescript
const result = await fetchBilibiliVideo(url, {
  extractAudio: true, // 只提取音频
});
```

这样会直接下载音频格式，更快更省空间。

### Q5: 临时文件在哪里？

**A:** 临时文件存储在：

```
/tmp/article-collector-media/
```

文件会自动清理（24小时后），也可以手动调用 `cleanupFiles()` 清理。

## 与项目集成

### 与 Redis 队列集成

```typescript
import { queueVideoProcessing } from './services/redis-queue';
import { fetchBilibiliVideo } from './services/bilibili-fetcher';

async function processVideoFromQueue(videoUrl: string) {
  // 提取信息并下载
  const result = await fetchBilibiliVideo(videoUrl, {
    downloadVideo: true,
    extractAudio: true,
  });
  
  if (result.success && result.audioPath) {
    // 加入转录队列
    await queueVideoProcessing({
      url: videoUrl,
      audioPath: result.audioPath,
      metadata: result.info,
    });
  }
}
```

### 与飞书多维表格集成

```typescript
import { fetchBilibiliVideo } from './services/bilibili-fetcher';
import { createBitableRecord } from './services/lark-bitable';

async function saveToFeishu(videoUrl: string) {
  const result = await fetchBilibiliVideo(videoUrl);
  
  if (result.success && result.info) {
    await createBitableRecord({
      [fieldConfig.title]: result.info.title,
      [fieldConfig.author]: result.info.author,
      [fieldConfig.source]: 'B站',
      [fieldConfig.originalUrl]: videoUrl,
      [fieldConfig.summary]: result.info.description,
      [fieldConfig.publishTime]: result.info.publishDate,
      [extendedFieldConfig.videoDuration]: result.info.duration,
    });
  }
}
```

## 最佳实践

1. **及时清理文件**：使用完临时文件后立即调用 `cleanupFiles()`
2. **设置合理限制**：根据实际需求配置 `MAX_VIDEO_SIZE_MB` 和 `MAX_AUDIO_DURATION_MINUTES`
3. **使用 Cookie**：对于需要高清画质的场景，配置 Cookie
4. **错误处理**：始终检查 `result.success` 和处理 `result.error`
5. **日志监控**：使用项目的 logger 记录关键操作

## 更新日志

- **v1.0.0** (2026-02-08)
  - 初始版本
  - 支持视频信息提取
  - 支持视频下载
  - 支持音频提取
  - 短链展开
  - Cookie 认证
  - 完善的错误处理
