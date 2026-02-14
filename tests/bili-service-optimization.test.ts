
import { setupBilibiliMock, setMockScenario } from './mock/bilibili-mock';

// 在导入任何服务之前 Mock 环境变量
process.env.LARK_APP_ID = 'mock_app_id';
process.env.LARK_APP_SECRET = 'mock_app_secret';
process.env.WIKI_SPACE_ID = 'mock_space_id';
process.env.BITABLE_APP_TOKEN = 'mock_app_token';
process.env.BITABLE_TABLE_ID = 'mock_table_id';
process.env.WIKI_VIDEO_PARENT_NODE_TOKEN = 'mock_video_token';
process.env.WIKI_PODCAST_PARENT_NODE_TOKEN = 'mock_podcast_token';
// 添加其他必要的环境变量
process.env.JINA_API_KEY = 'mock_jina_key';
process.env.QWEN_API_KEY = 'mock_qwen_key';
process.env.DEEPSEEK_API_KEY = 'mock_deepseek_key';
process.env.OPENAI_API_KEY = 'mock_openai_key';

import { bilibiliService } from '../src/services/bilibili-service';
import { bilibiliSubtitleService } from '../src/services/bilibili-subtitle';
import { asrService } from '../src/services/asr-service';
import { mediaHandler } from '../src/services/media-handler';
import { larkDocService } from '../src/services/lark-doc';
import { qwenService } from '../src/services/qwen-service';
import { BilibiliService } from '../src/services/bilibili-service';

// 启用 Mock
jest.mock('axios');
jest.mock('fs');
jest.mock('../src/services/lark-client');
jest.mock('../src/services/lark-doc');
jest.mock('../src/services/lark-wiki');
jest.mock('../src/services/qwen-service');
jest.mock('../src/services/asr-service');
jest.mock('../src/services/media-handler');
jest.mock('../src/services/bilibili-subtitle');

describe('BilibiliService 优化流程测试', () => {
  let bilibiliServiceInstance: BilibiliService;

  beforeAll(() => {
    setupBilibiliMock();
    bilibiliServiceInstance = new BilibiliService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('场景 1: 有字幕时应直接使用字幕', async () => {
    setMockScenario('subtitle');
    
    const result = await bilibiliServiceInstance.processVideo('https://www.bilibili.com/video/BV1xx411c7xx');
    
    expect(bilibiliSubtitleService.getSubtitle).toHaveBeenCalled();
    expect(mediaHandler.downloadFile).not.toHaveBeenCalled(); // 不应下载音频
    expect(asrService.transcribeLongAudio).not.toHaveBeenCalled(); // 不应调用 ASR
    expect(result.subtitle).toContain('这是一段测试字幕');
    expect(result.docUrl).toBe('https://mock.feishu.cn/docs/123');
  });

  test('场景 2: 无字幕时应自动降级到 ASR', async () => {
    setMockScenario('asr');
    
    const result = await bilibiliServiceInstance.processVideo('https://www.bilibili.com/video/BV1xx411c7xx');
    
    expect(bilibiliSubtitleService.getSubtitle).toHaveBeenCalled();
    expect(mediaHandler.downloadFile).toHaveBeenCalled(); // 应该下载音频
    expect(asrService.transcribeLongAudio).toHaveBeenCalled(); // 应该调用 ASR
    expect(result.subtitle).toContain('这是一段通过 ASR 转录生成的文本');
  });

  test('场景 3: ASR 失败时应使用简介', async () => {
    setMockScenario('fail');
    
    const result = await bilibiliServiceInstance.processVideo('https://www.bilibili.com/video/BV1xx411c7xx');
    
    expect(asrService.transcribeLongAudio).toHaveBeenCalled();
    expect(result.subtitle).toContain('以下是视频简介');
  });
});
