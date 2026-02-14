
import axios from 'axios';
import { BilibiliService } from '../../src/services/bilibili-service';
import { bilibiliSubtitleService } from '../../src/services/bilibili-subtitle';
import { asrService } from '../../src/services/asr-service';
import { mediaHandler } from '../../src/services/media-handler';
import { larkDocService } from '../../src/services/lark-doc';
import { qwenService } from '../../src/services/qwen-service';
import fs from 'fs';

// Mock 数据
const MOCK_VIDEO_INFO = {
  title: '【测试】这是一个测试视频',
  author: '测试UP主',
  description: '这是一个用于测试自动转录功能的模拟视频简介。',
  publishDate: '2023-01-01',
  duration: 120, // 2分钟
  cid: 123456,
  aid: 654321,
  bvid: 'BV1xx411c7xx',
  cover: 'http://example.com/cover.jpg',
  viewCount: 1000,
  likeCount: 100,
  url: 'https://www.bilibili.com/video/BV1xx411c7xx'
};

const MOCK_SUBTITLE = '这是一段测试字幕。它包含了一些中文内容，用于验证字幕提取功能是否正常工作。';
const MOCK_ASR_TEXT = '这是一段通过 ASR 转录生成的文本。如果字幕获取失败，系统应该降级使用 ASR 服务来生成这段文字。';
const MOCK_SUMMARY = '这是一个测试视频的 AI 摘要。';

// Mock 标志位
let mockSubtitleSuccess = true;
let mockDownloadSuccess = true;
let mockAsrSuccess = true;

export function setupBilibiliMock() {
  console.log('🚧 初始化 Bilibili Mock 环境...');

  // 1. Mock getVideoInfo
  jest.spyOn(BilibiliService.prototype, 'getVideoInfo').mockResolvedValue(MOCK_VIDEO_INFO);

  // 2. Mock bilibiliSubtitleService
  jest.spyOn(bilibiliSubtitleService, 'getSubtitle').mockImplementation(async () => {
    console.log(`[Mock] 尝试获取字幕... (成功: ${mockSubtitleSuccess})`);
    return mockSubtitleSuccess ? MOCK_SUBTITLE : '';
  });

  // 3. Mock mediaHandler
  jest.spyOn(mediaHandler, 'getPlayUrl').mockResolvedValue('http://mock.audio/stream.m4s');
  jest.spyOn(mediaHandler, 'downloadFile').mockImplementation(async (url, path) => {
    console.log(`[Mock] 下载音频: ${url} -> ${path}`);
    if (!mockDownloadSuccess) throw new Error('Mock Download Failed');
    // 创建一个空文件模拟下载
    fs.writeFileSync(path, 'mock audio content');
  });
  jest.spyOn(mediaHandler, 'processAudioForASR').mockImplementation(async (input) => {
    return input.replace('.m4s', '.mp3');
  });

  // 4. Mock asrService
  jest.spyOn(asrService, 'transcribeLongAudio').mockImplementation(async (path) => {
    console.log(`[Mock] ASR 转录: ${path} (成功: ${mockAsrSuccess})`);
    if (!mockAsrSuccess) {
        return { 
            success: false, 
            error: 'Mock ASR Failed',
            text: '', 
            backend: 'unknown',
            segments: []
        };
    }
    return { 
        success: true, 
        text: MOCK_ASR_TEXT,
        backend: 'faster-whisper',
        segments: [] 
    };
  });

  // 5. Mock AI 摘要
  jest.spyOn(qwenService, 'generateSummary').mockResolvedValue(MOCK_SUMMARY);
  jest.spyOn(qwenService, 'generateOneSentenceSummary').mockResolvedValue('一句话总结');
  jest.spyOn(qwenService, 'generateTags').mockResolvedValue(['测试', 'Mock']);

  // 6. Mock Lark
  jest.spyOn(larkDocService, 'createDocument').mockResolvedValue({
    url: 'https://mock.feishu.cn/docs/123',
    token: 'mock_token_123',
    documentId: 'mock_doc_id_123'
  });
}

export function setMockScenario(scenario: 'subtitle' | 'asr' | 'fail') {
  switch (scenario) {
    case 'subtitle':
      mockSubtitleSuccess = true;
      break;
    case 'asr':
      mockSubtitleSuccess = false;
      mockAsrSuccess = true;
      break;
    case 'fail':
      mockSubtitleSuccess = false;
      mockAsrSuccess = false;
      break;
  }
}
