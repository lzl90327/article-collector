# 音频转文字脚本使用指南

## 概述

`transcribe_audio.py` 是一个基于 faster-whisper 的高性能音频转文字工具，支持自动语言检测、GPU 加速、实时进度反馈。

## 安装依赖

```bash
# 基础安装（CPU 版本）
pip install faster-whisper

# GPU 加速版本（需要 CUDA）
pip install faster-whisper torch
```

**系统要求：**
- Python 3.8+
- ffmpeg（用于音频处理）
- CUDA 11.x+（可选，用于 GPU 加速）

```bash
# macOS 安装 ffmpeg
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# 验证安装
ffmpeg -version
```

## 基础使用

### 1. 最简单的用法（自动检测语言）

```bash
python scripts/transcribe_audio.py --audio input.mp3
```

**输出示例：**
```json
{
  "text": "这是一段完整的转录文本...",
  "segments": [
    {"start": 0.0, "end": 5.2, "text": "这是第一段"},
    {"start": 5.2, "end": 10.5, "text": "这是第二段"}
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

### 2. 指定语言和模型

```bash
# 中文音频，使用 medium 模型（更快）
python scripts/transcribe_audio.py \
  --audio podcast.mp3 \
  --model medium \
  --language zh

# 英文音频，使用 large-v3 模型（最准确）
python scripts/transcribe_audio.py \
  --audio interview.mp3 \
  --model large-v3 \
  --language en
```

### 3. 包含详细时间戳

```bash
python scripts/transcribe_audio.py \
  --audio meeting.mp3 \
  --timestamps
```

### 4. 保存结果到文件

```bash
python scripts/transcribe_audio.py \
  --audio input.mp3 \
  --output result.json
```

## 高级用法

### 模型选择指南

| 模型 | 大小 | 速度 | 准确度 | 使用场景 |
|------|------|------|--------|----------|
| tiny | ~75MB | 最快 | 较低 | 实时转录、快速预览 |
| base | ~150MB | 很快 | 一般 | 日常使用 |
| small | ~500MB | 快 | 良好 | 平衡性能和质量 |
| medium | ~1.5GB | 中等 | 很好 | 高质量转录 |
| large-v2 | ~3GB | 慢 | 优秀 | 专业用途 |
| large-v3 | ~3GB | 慢 | 最佳 | 最高质量要求（默认） |

**推荐配置：**
- **播客/视频转录**：`large-v3` 或 `medium`
- **实时会议记录**：`small` 或 `base`
- **快速预览**：`tiny`

### 性能优化

#### 1. 使用 GPU 加速

```bash
# 自动检测并使用 GPU（如果可用）
python scripts/transcribe_audio.py --audio input.mp3

# 强制使用 CPU（即使有 GPU）
python scripts/transcribe_audio.py --audio input.mp3 --device cpu
```

**性能对比：**
- GPU (RTX 3090): ~20-30x 实时速率
- CPU (i9-12900K): ~3-5x 实时速率

#### 2. 调整计算精度

```bash
# int8 量化（默认，最快，GPU/CPU 都支持）
python scripts/transcribe_audio.py --audio input.mp3 --compute-type int8

# float16（GPU 专用，更快更准）
python scripts/transcribe_audio.py --audio input.mp3 --compute-type float16

# float32（最精确，最慢）
python scripts/transcribe_audio.py --audio input.mp3 --compute-type float32
```

### 批量处理

```bash
#!/bin/bash
# 批量转录脚本

for audio in *.mp3; do
    echo "正在处理: $audio"
    python scripts/transcribe_audio.py \
        --audio "$audio" \
        --model medium \
        --language zh \
        --output "${audio%.mp3}.json"
done

echo "批量转录完成！"
```

## 集成到 Node.js 项目

### 1. 直接调用

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function transcribeAudio(audioPath: string) {
  const command = `python scripts/transcribe_audio.py --audio "${audioPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    
    // stderr 包含进度信息
    console.log('进度:', stderr);
    
    // stdout 是 JSON 结果
    const result = JSON.parse(stdout);
    return result;
  } catch (error) {
    console.error('转录失败:', error);
    throw error;
  }
}

// 使用示例
const result = await transcribeAudio('input.mp3');
console.log('转录文本:', result.text);
console.log('语言:', result.language);
console.log('片段数量:', result.segments.length);
```

### 2. 使用 spawn（支持实时进度）

```typescript
import { spawn } from 'child_process';

function transcribeWithProgress(audioPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn('python', [
      'scripts/transcribe_audio.py',
      '--audio', audioPath,
      '--timestamps'
    ]);
    
    let stdout = '';
    let stderr = '';
    
    // 监听进度输出
    python.stderr.on('data', (data) => {
      const progress = data.toString();
      console.log('进度:', progress);
      stderr += progress;
    });
    
    // 收集结果
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error('JSON 解析失败'));
        }
      } else {
        reject(new Error(`进程退出码: ${code}\n${stderr}`));
      }
    });
  });
}
```

## 测试建议

### 单元测试

创建测试文件 `tests/test_transcribe.py`：

```python
import unittest
import json
import os
from scripts.transcribe_audio import transcribe_audio, format_timestamp

class TestTranscribeAudio(unittest.TestCase):
    
    def test_format_timestamp(self):
        """测试时间戳格式化"""
        self.assertEqual(format_timestamp(0), "00:00:00.000")
        self.assertEqual(format_timestamp(61.5), "00:01:01.500")
        self.assertEqual(format_timestamp(3661.234), "01:01:01.234")
    
    def test_transcribe_short_audio(self):
        """测试短音频转录"""
        # 需要准备一个测试音频文件
        test_audio = "tests/fixtures/short_audio.mp3"
        
        if os.path.exists(test_audio):
            result = transcribe_audio(
                audio_path=test_audio,
                model_name='tiny',  # 使用最小模型加快测试
                device='cpu'
            )
            
            self.assertIn('text', result)
            self.assertIn('segments', result)
            self.assertIn('language', result)
            self.assertGreater(len(result['text']), 0)
    
    def test_file_not_found(self):
        """测试文件不存在的情况"""
        with self.assertRaises(FileNotFoundError):
            transcribe_audio("nonexistent.mp3")
    
    def test_empty_file(self):
        """测试空文件"""
        # 创建空文件
        empty_file = "/tmp/empty.mp3"
        open(empty_file, 'w').close()
        
        with self.assertRaises(ValueError):
            transcribe_audio(empty_file)
        
        os.remove(empty_file)

if __name__ == '__main__':
    unittest.main()
```

### 集成测试

```bash
#!/bin/bash
# tests/test_transcribe_integration.sh

set -e

echo "测试 1: 基础转录"
python scripts/transcribe_audio.py \
  --audio tests/fixtures/test_audio.mp3 \
  --model tiny \
  --output /tmp/test_result_1.json

echo "✓ 测试 1 通过"

echo "测试 2: 指定语言"
python scripts/transcribe_audio.py \
  --audio tests/fixtures/test_audio.mp3 \
  --language zh \
  --model tiny \
  --output /tmp/test_result_2.json

echo "✓ 测试 2 通过"

echo "测试 3: 时间戳"
python scripts/transcribe_audio.py \
  --audio tests/fixtures/test_audio.mp3 \
  --timestamps \
  --model tiny \
  --output /tmp/test_result_3.json

# 验证 JSON 格式
python -c "import json; json.load(open('/tmp/test_result_3.json'))"

echo "✓ 测试 3 通过"

echo "所有测试通过！"
```

### 性能基准测试

```python
# tests/benchmark_transcribe.py
import time
import os
from scripts.transcribe_audio import transcribe_audio

def benchmark_model(audio_path, model_name, device='cpu'):
    """基准测试不同模型的性能"""
    start = time.time()
    
    result = transcribe_audio(
        audio_path=audio_path,
        model_name=model_name,
        device=device
    )
    
    elapsed = time.time() - start
    duration = result['duration']
    realtime_factor = duration / elapsed
    
    return {
        'model': model_name,
        'device': device,
        'audio_duration': duration,
        'transcribe_time': elapsed,
        'realtime_factor': realtime_factor,
        'text_length': len(result['text'])
    }

# 运行基准测试
test_audio = "tests/fixtures/benchmark_audio.mp3"

if os.path.exists(test_audio):
    models = ['tiny', 'base', 'small', 'medium']
    
    print("模型性能对比:")
    print("-" * 70)
    print(f"{'模型':<10} {'设备':<8} {'音频时长':<10} {'转录耗时':<10} {'实时率':<10}")
    print("-" * 70)
    
    for model in models:
        stats = benchmark_model(test_audio, model, device='cpu')
        print(f"{stats['model']:<10} {stats['device']:<8} "
              f"{stats['audio_duration']:<10.2f} "
              f"{stats['transcribe_time']:<10.2f} "
              f"{stats['realtime_factor']:<10.2f}x")
```

## 常见问题

### 1. 模型下载慢

首次使用会自动下载模型，可以预先下载：

```python
from faster_whisper import WhisperModel

# 预下载所有常用模型
for model_name in ['tiny', 'base', 'small', 'medium', 'large-v3']:
    print(f"下载模型: {model_name}")
    WhisperModel(model_name, device='cpu', compute_type='int8')
```

### 2. CUDA 内存不足

```bash
# 使用更小的模型
python scripts/transcribe_audio.py --audio input.mp3 --model medium

# 或强制使用 CPU
python scripts/transcribe_audio.py --audio input.mp3 --device cpu
```

### 3. 音频格式不支持

faster-whisper 通过 ffmpeg 支持几乎所有格式，如果遇到问题：

```bash
# 转换为标准格式
ffmpeg -i input.xxx -ar 16000 -ac 1 output.mp3
```

### 4. 准确度不够

```bash
# 使用最大模型
python scripts/transcribe_audio.py \
  --audio input.mp3 \
  --model large-v3 \
  --compute-type float16 \
  --language zh
```

## 性能调优建议

1. **模型选择**：根据需求平衡速度和准确度
2. **批处理**：如果有多个文件，可以并行处理
3. **音频预处理**：降低采样率到 16kHz 可以加快处理
4. **指定语言**：避免自动检测可节省时间
5. **使用 GPU**：有 CUDA 的情况下性能提升 10-20 倍

## 进一步优化

如需更高性能，可以考虑：

1. 使用 `insanely-fast-whisper`（基于 Transformers）
2. 使用 OpenAI Whisper API（云端）
3. 实现音频预分段并行处理
4. 使用 TensorRT 优化模型

---

**作者**: Article Collector Team  
**版本**: v1.0  
**更新时间**: 2025-02-08
