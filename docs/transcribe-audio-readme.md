# 音频转文字脚本 (transcribe_audio.py)

基于 faster-whisper 的高性能音频转文字工具。

## 快速开始

```bash
# 1. 安装依赖
pip install faster-whisper

# 2. 基础使用
python scripts/transcribe_audio.py --audio input.mp3

# 3. 运行测试
./scripts/test-transcribe.sh
```

## 主要特性

- ✅ 基于 faster-whisper（比原版 Whisper 快 4-5 倍）
- ✅ 自动语言检测（支持 99+ 语言）
- ✅ GPU/CPU 自动切换
- ✅ int8 量化优化性能
- ✅ 实时进度反馈
- ✅ 详细时间戳输出
- ✅ JSON 格式结果
- ✅ 完善的错误处理

## 输出格式

```json
{
  "text": "完整转录文本...",
  "segments": [
    {"start": 0.0, "end": 5.2, "text": "第一段文本"},
    {"start": 5.2, "end": 10.5, "text": "第二段文本"}
  ],
  "language": "zh",
  "language_probability": 0.9856,
  "duration": 120.5,
  "metadata": {
    "model": "large-v3",
    "device": "cuda",
    "transcribe_time": 15.23,
    "realtime_factor": 7.91,
    "segments_count": 45
  }
}
```

## 使用示例

### 命令行

```bash
# 自动检测语言
python scripts/transcribe_audio.py --audio podcast.mp3

# 指定中文，使用 medium 模型
python scripts/transcribe_audio.py \
  --audio podcast.mp3 \
  --model medium \
  --language zh

# 包含详细时间戳
python scripts/transcribe_audio.py \
  --audio meeting.mp3 \
  --timestamps

# 保存到文件
python scripts/transcribe_audio.py \
  --audio input.mp3 \
  --output result.json
```

### Node.js 集成

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function transcribeAudio(audioPath: string) {
  const { stdout } = await execAsync(
    `python scripts/transcribe_audio.py --audio "${audioPath}"`
  );
  return JSON.parse(stdout);
}

// 使用
const result = await transcribeAudio('input.mp3');
console.log('转录文本:', result.text);
```

## 模型选择

| 模型 | 大小 | 速度 | 准确度 | 推荐场景 |
|------|------|------|--------|----------|
| tiny | 75MB | 最快 | 较低 | 快速预览 |
| base | 150MB | 很快 | 一般 | 日常使用 |
| small | 500MB | 快 | 良好 | 平衡选择 |
| medium | 1.5GB | 中等 | 很好 | 高质量 |
| large-v3 | 3GB | 慢 | 最佳 | 专业用途（默认） |

## 性能参考

**GPU (RTX 3090) + large-v3:**
- 实时率: 20-30x
- 60 分钟音频 → 约 2-3 分钟

**CPU (i9-12900K) + medium:**
- 实时率: 3-5x
- 60 分钟音频 → 约 12-20 分钟

## 完整文档

详见 [docs/transcribe-audio-usage.md](../docs/transcribe-audio-usage.md)

## 测试

```bash
# 快速测试
./scripts/test-transcribe.sh

# 查看帮助
python scripts/transcribe_audio.py --help
```

## 常见问题

**Q: 首次运行很慢？**  
A: 首次使用会自动下载模型（约 3GB），后续使用会从缓存加载。

**Q: 如何使用 GPU 加速？**  
A: 安装 PyTorch CUDA 版本后会自动使用 GPU。

**Q: 支持哪些音频格式？**  
A: 通过 ffmpeg 支持几乎所有格式（mp3, wav, m4a, flac, ogg 等）。

**Q: 如何提高准确度？**  
A: 使用 `--model large-v3` 和 `--language zh` 指定语言。

## 系统要求

- Python 3.8+
- ffmpeg
- 可选：CUDA 11.x+（GPU 加速）

---

**创建日期**: 2025-02-08  
**作者**: Article Collector Team
