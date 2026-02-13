# 播客音频下载解决方案 - 快速指南

## 新功能概览

### 1. RSS Feed 支持
现在支持通过 RSS Feed 下载播客音频，大多数播客平台都提供 RSS Feed，这是最通用的下载方式。

### 2. 多策略下载
当一种方法失败时，自动尝试其他方法：
- **Apple Podcasts**: iTunes API → RSS Feed → 网页抓取
- **小宇宙**: 域名替换 → RSSHub → RSS Feed

### 3. 自动重试
下载失败时自动重试（最多 3 次），使用指数退避策略（1秒、2秒、4秒）。

## 使用方法

### Apple Podcasts

```typescript
import { fetchApplePodcast } from './services/apple-podcasts-fetcher';

// 下载音频
const result = await fetchApplePodcast(
  'https://podcasts.apple.com/cn/podcast/id1234567?i=1000123456',
  { downloadAudio: true }
);

if (result.success && result.audioPath) {
  console.log(`音频已下载: ${result.audioPath}`);
}
```

**工作原理**:
1. 从 URL 提取 podcast ID 和 episode ID
2. 调用 iTunes API 获取 RSS Feed URL
3. 解析 RSS Feed 找到对应单集的音频链接
4. 下载音频文件

### 小宇宙

```typescript
import { fetchXiaoyuzhouPodcast } from './services/xiaoyuzhou-fetcher';

// 下载音频
const result = await fetchXiaoyuzhouPodcast(
  'https://www.xiaoyuzhoufm.com/episode/abc123',
  { downloadAudio: true }
);

if (result.success && result.audioPath) {
  console.log(`音频已下载: ${result.audioPath}`);
}
```

**工作原理**:
1. 先尝试域名替换法（xiaoyuzhoufm.com → xiaoyuzhoufm.xlab.app）
2. 如果遇到 402 付费墙，自动切换到 RSSHub 方案
3. 通过 RSSHub 获取 RSS Feed 并下载音频

### 通用 RSS Feed

```typescript
import { rssPodcastFetcher } from './services/rss-podcast-fetcher';

// 解析 RSS Feed
const feedInfo = await rssPodcastFetcher.parseRSSFeed('https://example.com/feed.rss');

// 获取最新单集
const latestEpisode = await rssPodcastFetcher.getLatestEpisode('https://example.com/feed.rss');

// 查找特定单集
const episode = await rssPodcastFetcher.findEpisodeById('https://example.com/feed.rss', 'episode-id');

// 从网页自动发现 RSS
const rssUrl = await rssPodcastFetcher.discoverRSSFromPage('https://example.com/podcast');
```

## 配置选项

### 最大时长限制

在 `.env` 或配置文件中设置：

```env
MAX_AUDIO_DURATION_MINUTES=120
```

### 最大文件大小

```env
MAX_VIDEO_SIZE_MB=500
```

### 重试次数

重试次数固定为 3 次，使用指数退避策略（1秒、2秒、4秒）。

## 错误处理

系统会区分不同类型的错误：

- **付费内容** (402): 立即失败，不重试
- **访问被拒绝** (403): 立即失败，不重试
- **限流** (429): 立即失败，不重试
- **文件过大/时长过长**: 立即失败，不重试
- **网络错误**: 自动重试（最多 3 次）

## 日志级别

```typescript
logger.info('[Apple Podcasts] 开始处理播客');     // 常规信息
logger.warn('[Apple Podcasts] 短链展开失败');      // 警告
logger.error('[Apple Podcasts] 下载失败');         // 错误
logger.debug('[Apple Podcasts] 找到音频链接');     // 调试
```

## 测试脚本

### 测试 Apple Podcasts

```bash
node scripts/test-apple-podcasts-rss.js
```

### 测试小宇宙

```bash
node scripts/test-xiaoyuzhou-multi-strategy.js
```

### 测试通用 RSS

```bash
node scripts/test-rss-podcast.js
```

## 常见问题

### Q: 为什么 Apple Podcasts 下载失败？

A: 可能的原因：
1. 播客时长超过限制（默认 120 分钟）
2. 播客需要 Apple Music 订阅（部分付费内容）
3. RSS Feed 中没有音频链接

**解决方案**:
- 调整 `MAX_AUDIO_DURATION_MINUTES` 配置
- 确认播客是否为免费内容

### Q: 小宇宙为什么显示 402 错误？

A: 这是小宇宙的付费墙保护机制。

**解决方案**:
- 系统会自动尝试 RSSHub 方案
- 如果仍然失败，说明该内容需要会员权限

### Q: RSS Feed 解析超时怎么办？

A: 可能的原因：
1. RSS Feed URL 不可访问
2. 网络连接问题
3. RSS Feed 文件过大

**解决方案**:
- 检查 RSS URL 是否正确
- 确认网络连接正常
- 尝试使用代理

### Q: 如何自部署 RSSHub？

A: 参考 [RSSHub 官方文档](https://docs.rsshub.app/deploy/)

部署后，需要修改小宇宙 fetcher 中的 RSSHub 地址：

```typescript
// 在 xiaoyuzhou-fetcher.ts 中
const rsshubUrl = `https://your-rsshub-instance.com/xiaoyuzhou/podcast/${podcastId}`;
```

## 性能优化建议

1. **启用 RSS Feed 缓存**: 避免重复解析同一 Feed
2. **使用本地 RSSHub**: 提高小宇宙下载成功率
3. **调整超时时间**: 根据网络情况调整 axios timeout
4. **并发控制**: 避免同时下载过多播客

## 相关文件

- `src/services/rss-podcast-fetcher.ts` - RSS Feed 解析器
- `src/services/apple-podcasts-fetcher.ts` - Apple Podcasts 处理
- `src/services/xiaoyuzhou-fetcher.ts` - 小宇宙处理
- `src/services/media-downloader.ts` - 下载管理器

## 更新日志

### 2026-02-09
- ✅ 添加 RSS Feed 支持
- ✅ 实现多策略下载
- ✅ 增强重试机制
- ✅ 优化错误处理

---

**最后更新**: 2026-02-09  
**维护者**: AI Assistant
