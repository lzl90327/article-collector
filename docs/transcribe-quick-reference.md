# 音频转文字快速参考卡

## 📝 基础命令

```bash
# 最简单用法（自动检测语言）
python scripts/transcribe_audio.py --audio input.mp3

# 指定语言和模型
python scripts/transcribe_audio.py --audio input.mp3 --model medium --language zh

# 包含时间戳并保存
python scripts/transcribe_audio.py --audio input.mp3 --timestamps --output result.json
```

## 🎛️ 参数速查

| 参数 | 简写 | 说明 | 示例值 |
|------|------|------|--------|
| `--audio` | 必需 | 音频文件路径 | `input.mp3` |
| `--model` | 可选 | 模型名称 | `tiny`, `base`, `small`, `medium`, `large-v2`, `large-v3` |
| `--language` | 可选 | 语言代码 | `zh`, `en`, `ja`, `ko`, `auto` |
| `--device` | 可选 | 计算设备 | `cpu`, `cuda` |
| `--compute-type` | 可选 | 计算精度 | `int8`, `float16`, `float32` |
| `--timestamps` | 可选 | 输出时间戳 | 开关参数（无值） |
| `--output` | 可选 | 输出文件 | `result.json` |

## 🚀 模型速查

| 模型 | 大小 | CPU 速度 | GPU 速度 | 准确度 | 推荐场景 |
|------|------|---------|---------|--------|----------|
| **tiny** | 75MB | 32x | 100x | ⭐⭐ | 快速预览 |
| **base** | 150MB | 16x | 50x | ⭐⭐⭐ | 日常使用 |
| **small** | 500MB | 8x | 25x | ⭐⭐⭐⭐ | 平衡选择 |
| **medium** | 1.5GB | 4x | 15x | ⭐⭐⭐⭐⭐ | **推荐** |
| **large-v3** | 3GB | 1x | 5x | ⭐⭐⭐⭐⭐⭐ | 专业用途 |

*速度倍率为相对于音频时长的实时倍率*

## 🌍 常用语言代码

| 语言 | 代码 | 示例 |
|------|------|------|
| 自动检测 | `auto` | `--language auto` |
| 中文 | `zh` | `--language zh` |
| 英语 | `en` | `--language en` |
| 日语 | `ja` | `--language ja` |
| 韩语 | `ko` | `--language ko` |
| 法语 | `fr` | `--language fr` |
| 德语 | `de` | `--language de` |
| 西班牙语 | `es` | `--language es` |

## 💡 典型场景命令

### 场景 1: 播客转录（高质量）
```bash
python scripts/transcribe_audio.py \
  --audio podcast_ep01.mp3 \
  --model large-v3 \
  --language zh \
  --timestamps \
  --output podcast_transcript.json
```

### 场景 2: 会议记录（快速）
```bash
python scripts/transcribe_audio.py \
  --audio meeting.m4a \
  --model medium \
  --timestamps \
  --output meeting_notes.json
```

### 场景 3: 快速预览
```bash
python scripts/transcribe_audio.py \
  --audio long_video.mp3 \
  --model tiny
```

### 场景 4: CPU 批量处理
```bash
for file in *.mp3; do
  python scripts/transcribe_audio.py \
    --audio "$file" \
    --model small \
    --device cpu \
    --output "${file%.mp3}.json"
done
```

### 场景 5: GPU 高性能
```bash
python scripts/transcribe_audio.py \
  --audio interview.mp3 \
  --model large-v3 \
  --device cuda \
  --compute-type float16
```

## 📊 输出格式示例

```json
{
  "text": "这是完整的转录文本内容...",
  "segments": [
    {
      "start": 0.0,
      "end": 5.234,
      "text": "第一段文本"
    }
  ],
  "language": "zh",
  "language_probability": 0.9856,
  "duration": 120.5,
  "metadata": {
    "model": "medium",
    "device": "cuda",
    "transcribe_time": 8.5,
    "realtime_factor": 14.2
  }
}
```

## 🔧 故障排除

### 问题: `ModuleNotFoundError: No module named 'faster_whisper'`
```bash
pip install faster-whisper
```

### 问题: 音频格式不支持
```bash
# 安装 ffmpeg
brew install ffmpeg  # macOS
# 或
sudo apt install ffmpeg  # Ubuntu

# 转换音频格式
ffmpeg -i input.xxx -ar 16000 -ac 1 output.mp3
```

### 问题: CUDA 内存不足
```bash
# 使用更小的模型
--model small

# 或强制使用 CPU
--device cpu
```

### 问题: 转录速度太慢
```bash
# 使用更小的模型
--model medium  # 而不是 large-v3

# 使用 int8 量化（默认已启用）
--compute-type int8

# 如果有 GPU，确保使用 GPU
--device cuda
```

### 问题: 准确度不够
```bash
# 使用最大模型
--model large-v3

# 明确指定语言
--language zh

# 提高音频质量（预处理）
ffmpeg -i noisy.mp3 -af "highpass=f=200, lowpass=f=3000" clean.mp3
```

## 🧪 测试命令

```bash
# 运行完整测试
./scripts/test-transcribe.sh

# 查看帮助
python scripts/transcribe_audio.py --help

# 运行交互式演示
./scripts/demo-transcribe.sh test.mp3
```

## 📖 文档链接

- **快速入门**: `docs/transcribe-audio-readme.md`
- **详细使用**: `docs/transcribe-audio-usage.md`
- **集成示例**: `docs/transcribe-example.ts`
- **完成总结**: `docs/transcribe-audio-summary.md`

## 💻 Node.js 快速集成

```javascript
// 简单调用
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function transcribe(audioPath) {
  const { stdout } = await execAsync(
    `python scripts/transcribe_audio.py --audio "${audioPath}"`
  );
  return JSON.parse(stdout);
}

// 使用
const result = await transcribe('input.mp3');
console.log(result.text);
```

## ⚡ 性能优化提示

1. **首次运行慢？** → 模型会自动下载（仅一次）
2. **想要最快速度？** → 使用 `--model tiny` 或 `--model small`
3. **想要最高质量？** → 使用 `--model large-v3 --language zh`
4. **有 GPU？** → 自动使用，速度提升 10-20 倍
5. **批量处理？** → 使用循环并行处理多个文件

## 📞 获取帮助

```bash
# 查看所有参数
python scripts/transcribe_audio.py --help

# 查看文档
cat docs/transcribe-audio-usage.md

# 运行测试
./scripts/test-transcribe.sh

# 查看示例
./scripts/demo-transcribe.sh test.mp3
```

---

**快速开始**: `python scripts/transcribe_audio.py --audio input.mp3`  
**推荐模型**: `medium`（平衡速度和质量）  
**提示**: 指定 `--language zh` 可提高中文准确度
