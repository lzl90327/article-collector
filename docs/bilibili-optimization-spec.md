# B 站视频转录优化开发规格书

## 1. 目标
优化 B 站视频转录流程，支持长视频转录，统一 ASR 服务，并提供完善的自动化测试。

## 2. 核心改动
1.  **统一 ASR 服务**：废弃 `aliyunASRService`，全面接入 `asrService`。
2.  **长视频支持**：利用 `asrService` 的自动分段功能（55s/段）和多后端降级策略。
3.  **环境治理**：提供脚本自动检测和安装 `ffmpeg`、`Python`、`faster-whisper`。
4.  **Mock 测试**：开发基于 Mock 数据的测试脚本，模拟 B 站 API 响应和音频下载，实现离线/低成本自测。

## 3. 详细设计

### 3.1 依赖管理
创建 `scripts/setup-bili-env.sh`：
- 检测 `ffmpeg`：优先检测系统命令，其次检测 `ffmpeg-static`。
- 检测 `python3`：要求 3.8+。
- 安装 `faster-whisper`：创建 venv 并安装依赖。
- 验证环境：运行简单的转录测试。

### 3.2 Mock 测试框架
创建 `test/mock/bilibili-mock.ts`：
- **Mock Bilibili API**：拦截 `axios` 请求，返回预设的视频信息（`getVideoInfo`）。
- **Mock 音频流**：拦截下载请求，返回本地的测试音频文件（小文件，用于快速验证流程）。
- **Mock ASR**：拦截 `asrService` 调用，返回预设的转录文本。
- **Mock Lark**：拦截飞书 API，打印调用日志而不发送真实请求。

### 3.3 代码重构
修改 `src/services/bilibili-service.ts`：
- 移除 `aliyunASRService` 引用。
- 在 `getSubtitle` 失败后，调用 `asrService.transcribeLongAudio(audioPath)`。
- 确保 `audioPath` 是 `asrService` 可接受的格式（已由 `mediaHandler` 统一处理）。

## 4. 测试计划

### 4.1 单元测试 (Mock)
- **场景 1：有字幕**
  - 输入：Mock 视频 URL（含字幕）。
  - 预期：直接获取字幕，不调用 ASR。
- **场景 2：无字幕，短视频**
  - 输入：Mock 视频 URL（无字幕，<1分钟）。
  - 预期：下载音频 -> ASR (Mock 返回) -> 生成文档。
- **场景 3：无字幕，长视频**
  - 输入：Mock 视频 URL（无字幕，>1小时）。
  - 预期：下载音频 -> `transcribeLongAudio` (验证分段逻辑调用) -> 生成文档。

### 4.2 集成测试 (Real)
- **脚本**：`scripts/test-bili-real.sh <B站链接>`。
- **验证**：真实下载、真实转录（使用百度 ASR 兜底或本地 Whisper）、真实飞书文档生成。
- **前置**：需先运行 `setup-bili-env.sh` 准备环境。

## 5. 交付物
- `scripts/setup-bili-env.sh`
- `test/mock/bilibili-mock.ts`
- `test/bili-service.test.ts`
- 重构后的 `src/services/bilibili-service.ts`
- 测试报告
