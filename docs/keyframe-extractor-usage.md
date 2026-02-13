# 关键帧提取功能使用指南

## 概述

`keyframe-extractor.ts` 是一个使用 FFmpeg 场景检测功能提取视频关键帧的服务，特别适合 PPT/演讲类视频的幻灯片提取。

## 功能特性

- ✅ 使用 FFmpeg 场景检测自动识别关键帧
- ✅ 支持自定义场景检测阈值
- ✅ 支持最大帧数限制
- ✅ 支持 JPG/PNG 输出格式
- ✅ 支持输出质量配置
- ✅ 完善的错误处理和日志记录
- ✅ 自动清理临时文件

## 安装依赖

### 1. 安装 FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**验证安装:**
```bash
ffmpeg -version
```

### 2. 项目依赖

项目依赖已包含在 `package.json` 中，运行：
```bash
npm install
```

## 基本使用

### 导入模块

```typescript
import { extractKeyframes, cleanupFrames, cleanupOutputDir } from './services/keyframe-extractor';
```

### 基本示例

```typescript
import { extractKeyframes } from './services/keyframe-extractor';
import path from 'path';

async function example() {
  const videoPath = './video.mp4';
  const outputDir = './keyframes';

  const result = await extractKeyframes(videoPath, outputDir);

  if (result.success) {
    console.log(`成功提取 ${result.totalFrames} 个关键帧`);
    result.frames?.forEach((frame, i) => {
      console.log(`${i + 1}. ${frame.path} - ${frame.timestamp.toFixed(2)}s`);
    });
  } else {
    console.error(`提取失败: ${result.error}`);
  }
}
```

### 自定义配置示例

```typescript
const result = await extractKeyframes(videoPath, outputDir, {
  sceneThreshold: 0.3,  // 场景检测阈值 (0.0-1.0)
  maxFrames: 20,         // 最大帧数
  format: 'png',         // 输出格式
  quality: 90,           // 输出质量 (1-100)
});
```

## API 参考

### `extractKeyframes`

提取视频关键帧的主函数。

**函数签名:**
```typescript
async function extractKeyframes(
  videoPath: string,
  outputDir: string,
  options?: KeyframeExtractionOptions
): Promise<KeyframeResult>
```

**参数:**

- `videoPath` (string): 视频文件路径
- `outputDir` (string): 输出目录路径
- `options` (可选): 提取选项

**返回值:**

```typescript
interface KeyframeResult {
  success: boolean;           // 是否成功
  frames?: KeyframeInfo[];   // 提取的关键帧列表
  totalFrames?: number;      // 总帧数
  error?: string;            // 错误信息
}

interface KeyframeInfo {
  path: string;      // 图片路径
  timestamp: number; // 时间戳（秒）
  index: number;     // 帧索引
}
```

### `KeyframeExtractionOptions`

```typescript
interface KeyframeExtractionOptions {
  sceneThreshold?: number;  // 场景检测阈值 (0.0-1.0)，默认 0.2
  maxFrames?: number;       // 最大帧数限制，默认 50
  format?: 'jpg' | 'png';  // 输出格式，默认 'jpg'
  quality?: number;         // 输出质量 (1-100)，默认 85
  ffmpegPath?: string;      // FFmpeg 路径，默认 'ffmpeg'
}
```

### `cleanupFrames`

清理指定的关键帧文件。

```typescript
function cleanupFrames(framePaths: string[]): void
```

**示例:**
```typescript
if (result.success && result.frames) {
  cleanupFrames(result.frames.map(f => f.path));
}
```

### `cleanupOutputDir`

清理输出目录中的所有关键帧文件。

```typescript
function cleanupOutputDir(outputDir: string, format?: 'jpg' | 'png'): void
```

**示例:**
```typescript
// 清理所有格式的关键帧
cleanupOutputDir('./keyframes');

// 只清理 JPG 格式
cleanupOutputDir('./keyframes', 'jpg');
```

## 配置说明

### 场景检测阈值 (`sceneThreshold`)

- **范围**: 0.0 - 1.0
- **默认值**: 0.2
- **说明**: 
  - 值越小，检测越敏感，提取的帧越多
  - 值越大，检测越严格，只提取明显场景变化的帧
  - 推荐值：
    - PPT/幻灯片视频: 0.2 - 0.3
    - 普通视频: 0.3 - 0.5
    - 快速切换场景: 0.1 - 0.2

### 最大帧数 (`maxFrames`)

- **默认值**: 50
- **说明**: 限制提取的关键帧数量，避免生成过多文件

### 输出格式 (`format`)

- **选项**: `'jpg'` | `'png'`
- **默认值**: `'jpg'`
- **说明**: 
  - JPG: 文件更小，适合预览
  - PNG: 质量更高，适合后续处理

### 输出质量 (`quality`)

- **范围**: 1 - 100
- **默认值**: 85
- **说明**: 
  - JPG: 1-100，值越大质量越高
  - PNG: 1-100，值越大压缩率越低（质量越高）

## 使用示例

### 示例 1: 提取 PPT 视频的关键帧

```typescript
import { extractKeyframes } from './services/keyframe-extractor';

const result = await extractKeyframes('presentation.mp4', './slides', {
  sceneThreshold: 0.25,  // PPT 切换通常比较明显
  maxFrames: 100,         // PPT 可能有较多幻灯片
  format: 'png',         // 保持高质量
  quality: 95,
});
```

### 示例 2: 提取视频缩略图

```typescript
const result = await extractKeyframes('video.mp4', './thumbnails', {
  sceneThreshold: 0.4,   // 只提取明显场景变化
  maxFrames: 10,          // 只需要少量缩略图
  format: 'jpg',          // JPG 更小
  quality: 75,            // 中等质量即可
});
```

### 示例 3: 批量处理多个视频

```typescript
import { extractKeyframes, cleanupOutputDir } from './services/keyframe-extractor';
import fs from 'fs';
import path from 'path';

async function batchExtract(videoDir: string, outputBaseDir: string) {
  const videos = fs.readdirSync(videoDir).filter(f => 
    f.endsWith('.mp4') || f.endsWith('.mov')
  );

  for (const video of videos) {
    const videoPath = path.join(videoDir, video);
    const outputDir = path.join(outputBaseDir, path.basename(video, path.extname(video)));
    
    console.log(`处理: ${video}`);
    const result = await extractKeyframes(videoPath, outputDir);
    
    if (result.success) {
      console.log(`✅ ${video}: ${result.totalFrames} 帧`);
    } else {
      console.error(`❌ ${video}: ${result.error}`);
    }
  }
}
```

## 运行测试

### 使用演示脚本

```bash
# 运行演示
ts-node examples/keyframe-extractor-demo.ts video.mp4

# 指定输出目录
ts-node examples/keyframe-extractor-demo.ts video.mp4 ./frames
```

### 使用测试脚本

```bash
# 运行测试脚本
./scripts/test-keyframe-extractor.sh video.mp4
```

## 错误处理

### 常见错误

1. **视频文件不存在**
   ```
   error: "视频文件不存在: /path/to/video.mp4"
   ```
   **解决**: 检查视频文件路径是否正确

2. **FFmpeg 执行失败**
   ```
   error: "FFmpeg 执行失败 (code 1): ..."
   ```
   **解决**: 
   - 检查 FFmpeg 是否已安装
   - 检查视频文件是否损坏
   - 检查输出目录权限

3. **未检测到关键帧**
   ```
   error: "未检测到关键帧，可能是场景变化阈值设置过高或视频没有明显的场景切换"
   ```
   **解决**: 
   - 降低 `sceneThreshold` 值（如 0.1）
   - 检查视频是否真的有场景变化

4. **输出目录创建失败**
   ```
   error: "无法创建输出目录: ..."
   ```
   **解决**: 检查目录权限，确保有写入权限

## 性能优化建议

1. **合理设置最大帧数**: 避免提取过多帧导致处理时间过长
2. **选择合适的格式**: JPG 文件更小，处理更快
3. **调整场景阈值**: 根据视频特点调整，避免提取过多或过少的帧
4. **批量处理**: 对于多个视频，考虑并行处理（注意资源限制）

## 技术细节

### FFmpeg 命令

内部使用的 FFmpeg 命令示例：

```bash
ffmpeg -i video.mp4 \
  -vf "select='gt(scene,0.2)',showinfo" \
  -vsync 0 \
  -frames:v 50 \
  -q:v 16 \
  -y frame%03d.jpg
```

### 场景检测原理

FFmpeg 的 `scene` 滤镜通过比较连续帧的差异来检测场景变化：
- 计算帧之间的差异值（0.0 - 1.0）
- 当差异超过阈值时，认为发生了场景切换
- `select='gt(scene,threshold)'` 只选择差异超过阈值的帧

## 相关资源

- [FFmpeg 官方文档](https://ffmpeg.org/documentation.html)
- [FFmpeg 场景检测文档](https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect)
- [项目 README](../README.md)

## 更新日志

- **v1.0.0** (2026-02-09): 初始版本
  - 实现基本的场景检测关键帧提取
  - 支持自定义配置选项
  - 完善的错误处理和日志记录
