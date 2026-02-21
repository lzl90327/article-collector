# B 站视频转录优化方案

## 1. 问题分析

当前 B 站视频转录功能存在以下问题：
1. **长视频转录失败**：目前的实现使用阿里云 ASR 服务 (`aliyunASRService`)，缺乏对长音频的分段处理逻辑。当视频时长超过一定限制（通常为 1 小时或文件大小限制）时，转录会失败。
2. **代码逻辑冗余**：项目中存在两套 ASR 处理逻辑（`aliyunASRService` 和 `asrService`），且 `mediaHandler` 中包含了重复的音频转码逻辑。
3. **字幕提取策略单一**：目前仅依赖 B 站 API 获取 JSON 字幕，虽然速度快但通用性不如 `yt-dlp`。

## 2. 优化目标

1. **支持长视频转录**：复用已验证的 `asrService`，支持任意时长的 B 站视频转录（自动分段、多后端切换）。
2. **统一 ASR 服务**：移除冗余的 `aliyunASRService`，统一使用 `asrService`。
3. **提升稳定性**：利用 `asrService` 的重试和降级机制（OpenAI -> Faster Whisper -> 百度 ASR）。

## 3. 详细方案

### 3.1 架构调整

```mermaid
graph TD
    A[BilibiliService] --> B{有字幕?}
    B -- 是 --> C[使用字幕]
    B -- 否 --> D[下载音频]
    D --> E[AsrService.transcribeLongAudio]
    E --> F[自动分段 (55s)]
    F --> G[多后端识别 (OpenAI/Local/Baidu)]
    G --> H[合并文本]
    H --> I[生成摘要 & 文档]
```

### 3.2 具体实施步骤

1. **废弃 `aliyunASRService`**：
   - 移除 `src/services/aliyun-asr.ts` 及其引用。
   - 移除 `src/services/media-handler.ts` 中的 `processAudioForASR` 方法（不再需要手动转码）。

2. **重构 `BilibiliService`**：
   - 引入 `src/services/asr-service.ts`。
   - 在未找到字幕时，调用 `asrService.transcribeLongAudio(audioPath)`。
   - 利用 `asrService` 内置的 `splitAudio` 能力，自动处理长视频分段（每段 55 秒，适配百度 ASR 限制）。

3. **保留现有下载逻辑**：
   - 继续使用 `mediaHandler.downloadFile` 下载 B 站音频流（m4s 格式）。
   - `asrService` 会自动处理 m4s 到 m4a/wav 的格式转换，无需额外处理。

### 3.3 预期效果

- **长视频支持**：支持 2 小时甚至更长的 B 站视频转录。
- **成本降低**：优先使用本地 Faster Whisper 或免费的百度 ASR，仅在必要时使用 OpenAI。
- **维护性提升**：统一 ASR 入口，减少重复代码。

## 4. 风险控制

- **音频格式兼容性**：B 站下载的音频流通常是 DASH 格式（m4s）。`asrService` 内部依赖 `ffmpeg` 进行转换，需要确保 `ffmpeg` 能正确处理 m4s 容器。
  - *验证计划*：在开发阶段验证 m4s 文件的直接转录能力。

---

请确认是否按此方案进行开发？
