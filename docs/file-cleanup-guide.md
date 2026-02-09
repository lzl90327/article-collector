# 文件自动清理功能

## 概述

为了避免临时文件占用过多磁盘空间，系统提供了自动清理功能，可以定期删除指定天数以上的临时文件。

---

## 📦 两种使用方式

### 方式 1: Shell 脚本（推荐用于定时任务）

#### 手动执行
```bash
# 清理 30 天以上的文件（默认）
./scripts/cleanup-old-files.sh

# 自定义清理天数
MAX_AGE_DAYS=7 ./scripts/cleanup-old-files.sh
```

#### 配置 Crontab 定时任务
```bash
# 编辑 crontab
crontab -e

# 添加定时任务（每天凌晨 2 点执行）
0 2 * * * cd /path/to/article-collector && ./scripts/cleanup-old-files.sh >> logs/cleanup.log 2>&1

# 或每周日凌晨 3 点执行
0 3 * * 0 cd /path/to/article-collector && MAX_AGE_DAYS=30 ./scripts/cleanup-old-files.sh >> logs/cleanup.log 2>&1
```

#### Crontab 时间说明
```
┌───────────── 分钟 (0-59)
│ ┌─────────── 小时 (0-23)
│ │ ┌───────── 日期 (1-31)
│ │ │ ┌─────── 月份 (1-12)
│ │ │ │ ┌───── 星期 (0-6, 0=周日)
│ │ │ │ │
* * * * * command

常用示例:
0 2 * * *     # 每天凌晨 2 点
0 */6 * * *   # 每 6 小时
0 0 * * 0     # 每周日凌晨
0 3 1 * *     # 每月 1 号凌晨 3 点
```

---

### 方式 2: TypeScript 服务（推荐用于应用内调用）

#### 在应用中使用

```typescript
import { fileCleanupService } from './services/file-cleanup-service';

// 1. 手动执行清理
const results = await fileCleanupService.cleanupAll();
console.log(`删除了 ${results.reduce((s, r) => s + r.deletedCount, 0)} 个文件`);

// 2. 启动定时清理（每 24 小时）
fileCleanupService.startScheduledCleanup(24);

// 3. 添加自定义清理策略
fileCleanupService.addPolicy({
  directory: '/path/to/custom/dir',
  maxAgeDays: 7,
  extensions: ['.tmp', '.cache'],
  recursive: true,
});

// 4. 获取目录统计
const stats = await fileCleanupService.getDirectoryStats('./temp');
console.log(`临时目录: ${stats.totalFiles} 个文件, ${stats.totalSize} 字节`);

// 5. 停止定时任务
fileCleanupService.stopScheduledCleanup();
```

#### 在主程序中启动

在 `src/index.ts` 中添加：

```typescript
import { fileCleanupService } from './services/file-cleanup-service';

// 启动定时清理（每 24 小时）
fileCleanupService.startScheduledCleanup(24);

logger.info('文件自动清理服务已启动');
```

---

## 🎯 清理策略

### 默认策略

| 目录 | 最大保留 | 文件类型 | 递归 |
|------|---------|---------|------|
| `temp/downloads/` | 30天 | .mp4, .mp3, .m4a, .wav, .webm, .flv | ✅ |
| `temp/audio/` | 30天 | .wav, .mp3, .m4a | ❌ |
| `temp/keyframes/` | 30天 | .jpg, .png | ✅ |
| `temp/videos/` | 30天 | .mp4, .webm, .flv | ❌ |

### 自定义策略

```typescript
// 添加新的清理策略
fileCleanupService.addPolicy({
  directory: '/path/to/dir',
  maxAgeDays: 7,              // 7 天
  extensions: ['.log', '.tmp'], // 只清理这些扩展名
  pattern: '^temp-.*',         // 文件名匹配模式
  minSize: 1024 * 1024,       // 最小 1MB（小文件不清理）
  recursive: true,            // 递归扫描子目录
});

// 移除策略
fileCleanupService.removePolicy('/path/to/dir');

// 查看所有策略
const policies = fileCleanupService.getPolicies();
```

---

## 📊 监控和日志

### 查看清理日志
```bash
# 查看最近的清理日志
tail -f logs/cleanup.log

# 查看今天的清理记录
grep "$(date '+%Y-%m-%d')" logs/cleanup.log
```

### 日志格式
```
[INFO] 2026-02-09 02:00:00 - 开始执行文件清理任务
[INFO] 2026-02-09 02:00:00 - 清理目录: 视频下载临时文件 (/path/to/temp/downloads)
[INFO] 2026-02-09 02:00:01 - 删除: video-20260101.mp4 (15.3MB)
[SUCCESS] 2026-02-09 02:00:01 - 完成: 扫描 150 个文件，删除 45 个，释放 680MB
[SUCCESS] 2026-02-09 02:00:05 - 总计删除: 45 个文件，释放空间: 680MB
```

---

## 🔧 配置选项

### 环境变量

在 `.env` 文件中配置：

```bash
# 文件清理配置
CLEANUP_MAX_AGE_DAYS=30          # 最大保留天数
CLEANUP_INTERVAL_HOURS=24        # 清理间隔（小时）
CLEANUP_ENABLED=true             # 是否启用自动清理
```

### 代码配置

```typescript
// 在 config.ts 中
export const cleanupConfig = {
  maxAgeDays: parseInt(process.env.CLEANUP_MAX_AGE_DAYS || '30', 10),
  intervalHours: parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24', 10),
  enabled: process.env.CLEANUP_ENABLED === 'true',
};
```

---

## 🧪 测试清理功能

### 测试命令
```bash
# 1. 预演模式（不实际删除）
DRY_RUN=1 ./scripts/cleanup-old-files.sh

# 2. 清理 7 天以上的文件（测试）
MAX_AGE_DAYS=7 ./scripts/cleanup-old-files.sh

# 3. 使用 TypeScript 服务测试
npx ts-node << 'EOF'
import { fileCleanupService } from './src/services/file-cleanup-service';

(async () => {
  // 获取统计信息
  const stats = await fileCleanupService.getDirectoryStats('./temp');
  console.log('临时目录统计:', stats);
  
  // 执行清理
  const results = await fileCleanupService.cleanupAll();
  console.log('清理结果:', results);
})();
EOF
```

---

## 📋 最佳实践

### 1. 合理设置清理周期

| 场景 | 推荐保留时间 |
|------|------------|
| 开发/测试环境 | 7 天 |
| 生产环境 | 30 天 |
| 高频使用 | 14 天 |
| 低频使用 | 60 天 |

### 2. 监控磁盘空间

```bash
# 查看临时目录占用
du -sh temp/*

# 查看最大的文件
find temp/ -type f -exec du -h {} + | sort -rh | head -10
```

### 3. 错误处理

- ✅ 文件删除失败会记录错误但继续执行
- ✅ 目录不存在会跳过并警告
- ✅ 权限问题会记录日志

### 4. 安全建议

- ⚠️ 不要在清理策略中包含重要数据目录
- ⚠️ 首次运行建议使用预演模式测试
- ⚠️ 定期检查清理日志确认无误删

---

## 🚀 生产部署

### 步骤 1: 配置环境变量
```bash
# 在 .env 文件中
CLEANUP_MAX_AGE_DAYS=30
CLEANUP_INTERVAL_HOURS=24
CLEANUP_ENABLED=true
```

### 步骤 2: 在应用中启动清理服务
```typescript
// 在 src/index.ts 或主入口文件中
import { fileCleanupService } from './services/file-cleanup-service';
import { cleanupConfig } from './config';

if (cleanupConfig.enabled) {
  fileCleanupService.startScheduledCleanup(cleanupConfig.intervalHours);
  logger.info('文件自动清理服务已启动', {
    intervalHours: cleanupConfig.intervalHours,
    maxAgeDays: cleanupConfig.maxAgeDays,
  });
}
```

### 步骤 3: 配置 Crontab（可选，作为备份）
```bash
# 每天凌晨 2 点执行清理
crontab -e

# 添加
0 2 * * * cd /path/to/article-collector && ./scripts/cleanup-old-files.sh >> logs/cleanup.log 2>&1
```

### 步骤 4: 验证
```bash
# 检查 crontab 配置
crontab -l

# 查看清理日志
tail -f logs/cleanup.log
```

---

## 📊 效果评估

### 预期效果

**场景**: 每天处理 10 个视频（平均每个 50MB）

| 时间 | 累计文件 | 占用空间 | 清理后 |
|------|---------|---------|--------|
| 第 1 天 | 10 | 500MB | 500MB |
| 第 7 天 | 70 | 3.5GB | 3.5GB |
| 第 30 天 | 300 | 15GB | 15GB |
| 第 31 天 | 310 | 15.5GB | **15GB** ✅ |
| 第 60 天 | 600 | 30GB | **15GB** ✅ |

**结论**: 启用自动清理后，磁盘占用将稳定在一个可控的水平。

---

## 🛠️ 故障排查

### 问题 1: Crontab 任务未执行
```bash
# 检查 cron 服务状态
launchctl list | grep cron

# 查看系统日志
tail -f /var/log/system.log | grep cron

# 检查脚本权限
ls -l scripts/cleanup-old-files.sh
chmod +x scripts/cleanup-old-files.sh
```

### 问题 2: 权限不足
```bash
# 确保脚本有执行权限
chmod +x scripts/cleanup-old-files.sh

# 确保临时目录可写
chmod -R u+w temp/
```

### 问题 3: 磁盘空间仍然不足
```bash
# 手动强制清理（7天）
MAX_AGE_DAYS=7 ./scripts/cleanup-old-files.sh

# 清理所有临时文件（危险！）
rm -rf temp/downloads/* temp/audio/* temp/keyframes/*
```

---

## 📚 相关文档

- `src/services/file-cleanup-service.ts` - TypeScript 清理服务
- `src/services/media-downloader.ts` - 媒体下载器（已集成清理功能）
- `scripts/cleanup-old-files.sh` - Shell 清理脚本

---

**更新时间**: 2026-02-09  
**版本**: v1.0.0
