/**
 * 配置管理模块
 * 使用 Zod 进行环境变量校验
 * 支持多环境配置（development/production）
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// 确定当前环境
const NODE_ENV = process.env.NODE_ENV || 'development';

// 根据环境加载对应的配置文件
function loadEnvFile(): void {
  const envFiles = [
    `.env.${NODE_ENV}.local`,  // 最高优先级：本地环境特定配置
    `.env.${NODE_ENV}`,        // 环境特定配置
    '.env.local',              // 本地通用配置
    '.env',                    // 默认配置
  ];

  // 查找项目根目录
  let rootDir = process.cwd();
  
  // 如果从 dist 目录运行，向上查找
  if (rootDir.includes('dist')) {
    rootDir = path.resolve(rootDir, '..');
  }

  let loaded = false;
  for (const envFile of envFiles) {
    const envPath = path.resolve(rootDir, envFile);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`📁 加载配置文件: ${envFile} (${NODE_ENV})`);
      loaded = true;
      break;
    }
  }

  if (!loaded) {
    // 回退到默认 dotenv 行为
    dotenv.config();
    console.log(`📁 使用默认配置 (.env)`);
  }
}

loadEnvFile();

// 环境变量 Schema 定义
const envSchema = z.object({
  // 飞书应用配置（必填）
  LARK_APP_ID: z.string().min(1, 'LARK_APP_ID 不能为空'),
  LARK_APP_SECRET: z.string().min(1, 'LARK_APP_SECRET 不能为空'),

  // 知识库配置（必填）
  WIKI_SPACE_ID: z.string().min(1, 'WIKI_SPACE_ID 不能为空'),
  // 微信公众号文章保存的父节点
  WIKI_ARTICLE_PARENT_NODE_TOKEN: z.string().optional().default(''),
  // 小红书笔记保存的父节点（向后兼容，保留原有配置名）
  WIKI_PARENT_NODE_TOKEN: z.string().optional().default(''),
  // 视频内容保存的父节点
  WIKI_VIDEO_PARENT_NODE_TOKEN: z.string().optional().default(''),
  // 播客内容保存的父节点
  WIKI_PODCAST_PARENT_NODE_TOKEN: z.string().optional().default(''),

  // 多维表格配置（必填）- 素材库
  BITABLE_APP_TOKEN: z.string().min(1, 'BITABLE_APP_TOKEN 不能为空'),
  BITABLE_TABLE_ID: z.string().min(1, 'BITABLE_TABLE_ID 不能为空'),

  // 多维表格字段名称配置 - 素材库
  FIELD_TITLE: z.string().default('标题'),
  FIELD_AUTHOR: z.string().default('作者'),
  FIELD_PUBLISH_TIME: z.string().default('发布时间'),
  FIELD_SOURCE: z.string().default('来源'),
  FIELD_ORIGINAL_URL: z.string().default('原文链接'),
  FIELD_SUMMARY: z.string().default('摘要'),
  FIELD_DOC_URL: z.string().default('文档链接'),
  FIELD_COLLECT_TIME: z.string().default('收藏时间'),

  // ========== 碎片想法库配置 ==========
  IDEAS_BITABLE_APP_TOKEN: z.string().optional(),
  IDEAS_BITABLE_TABLE_ID: z.string().optional(),

  // 碎片想法库字段名称配置
  IDEA_FIELD_CONTENT: z.string().default('文本'),
  IDEA_FIELD_TIME: z.string().default('记录时间'),
  IDEA_FIELD_INPUT_TYPE: z.string().default('输入方式'),
  IDEA_FIELD_SCENE: z.string().default('来源场景'),
  IDEA_FIELD_EMOTION: z.string().default('情绪标签'),
  IDEA_FIELD_RELATED_URL: z.string().default('关联素材'),
  IDEA_FIELD_RELATED_TITLE: z.string().default('关联素材标题'),
  IDEA_FIELD_VOICE_DURATION: z.string().default('语音时长'),
  IDEA_FIELD_TOPICS: z.string().default('主题标签'),
  IDEA_FIELD_MATURITY: z.string().default('成熟度'),
  IDEA_FIELD_SUMMARIZED: z.string().default('已汇总'),

  // ========== DeepSeek LLM 配置 ==========
  DEEPSEEK_API_KEY: z.string().optional(),

  // ========== 百度语音识别配置 ==========
  BAIDU_ASR_API_KEY: z.string().optional(),
  BAIDU_ASR_SECRET_KEY: z.string().optional(),

  // ========== 百度 OCR 配置（千帆平台） ==========
  BAIDU_OCR_API_KEY: z.string().optional(),

  // ========== COROS 运动记录配置 ==========
  COROS_ENABLED: z.string().transform((val) => val === 'true' || val === '1').default('false'),
  // COROS 专用飞书应用凭证（运动入库助手）
  COROS_LARK_APP_ID: z.string().optional(),
  COROS_LARK_APP_SECRET: z.string().optional(),
  // COROS 多维表格配置
  COROS_BITABLE_APP_TOKEN: z.string().optional(),
  COROS_BITABLE_TABLE_ID: z.string().optional(),
  
  // COROS 多维表格字段名称配置
  COROS_FIELD_DATE: z.string().default('运动日期'),
  COROS_FIELD_SPORT: z.string().default('运动项目'),
  COROS_FIELD_RUN_KM: z.string().default('跑步距离'),
  COROS_FIELD_RIDE_KM: z.string().default('骑行距离'),
  COROS_FIELD_ELEV_M: z.string().default('爬升高度'),
  COROS_FIELD_NOTES: z.string().default('备注'),
  COROS_FIELD_SOURCE: z.string().default('数据源'),
  COROS_FIELD_RAW: z.string().default('原始凭证'),
  COROS_FIELD_CONF: z.string().default('置信度'),
  COROS_FIELD_DEDUPE: z.string().default('去重键'),

  // ========== Redis 配置 ==========
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  // ========== 知识提炼功能开关 ==========
  REFINERY_ENABLED: z.string().transform((val) => val === 'true' || val === '1').default('true'),

  // ========== 视频/播客功能配置 ==========
  // Whisper 模型配置
  WHISPER_MODEL: z.string().default('large-v3'),
  OPENAI_WHISPER_API_KEY: z.string().optional(),
  TRANSCRIPTION_THRESHOLD: z.string().transform((val) => parseInt(val, 10) || 600).default('600'), // 10分钟

  // B站 Cookie（高清视频需要）
  BILIBILI_COOKIE: z.string().optional(),

  // 抖音 API 配置
  DOUYIN_API_URL: z.string().default('http://127.0.0.1:5557'),

  // yt-dlp 路径配置
  YT_DLP_PATH: z.string().default('yt-dlp'),

  // 性能配置
  MAX_VIDEO_SIZE_MB: z.string().transform((val) => parseInt(val, 10) || 500).default('500'),
  MAX_AUDIO_DURATION_MINUTES: z.string().transform((val) => parseInt(val, 10) || 120).default('120'),

  // ========== 多维表格扩展字段 ==========
  FIELD_CONTENT_TYPE: z.string().default('内容类型'),
  FIELD_IMAGE_COUNT: z.string().default('图片数量'),
  FIELD_VIDEO_DURATION: z.string().default('视频时长'),
  FIELD_AUDIO_DURATION: z.string().default('音频时长'),
  FIELD_TRANSCRIPTION_STATUS: z.string().default('转录状态'),
  FIELD_KEYFRAME_COUNT: z.string().default('关键帧数量'),

  // 可选配置
  JINA_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEBUG: z.string().transform((val) => val === 'true' || val === '1').default('false'),
});

// 导出配置类型
export type Config = z.infer<typeof envSchema>;

// 解析并校验环境变量
function parseConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ 环境变量校验失败:');
    result.error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    console.error('\n请检查 .env 文件配置');
    process.exit(1);
  }

  console.log('✅ 环境变量校验通过');
  return result.data;
}

// 导出配置对象
export const config = parseConfig();

// 便捷的配置访问方法
export const larkConfig = {
  appId: config.LARK_APP_ID,
  appSecret: config.LARK_APP_SECRET,
};

export const wikiConfig = {
  spaceId: config.WIKI_SPACE_ID,
  // 微信文章保存位置
  articleParentNodeToken: config.WIKI_ARTICLE_PARENT_NODE_TOKEN || undefined,
  // 小红书笔记保存位置
  xhsParentNodeToken: config.WIKI_PARENT_NODE_TOKEN || undefined,
  // 视频内容保存位置
  videoParentNodeToken: config.WIKI_VIDEO_PARENT_NODE_TOKEN || undefined,
  // 播客内容保存位置
  podcastParentNodeToken: config.WIKI_PODCAST_PARENT_NODE_TOKEN || undefined,
  // 向后兼容
  parentNodeToken: config.WIKI_PARENT_NODE_TOKEN || undefined,
};

export const bitableConfig = {
  appToken: config.BITABLE_APP_TOKEN,
  tableId: config.BITABLE_TABLE_ID,
};

export const jinaConfig = {
  apiKey: config.JINA_API_KEY,
};

export const fieldConfig = {
  title: config.FIELD_TITLE,
  author: config.FIELD_AUTHOR,
  publishTime: config.FIELD_PUBLISH_TIME,
  source: config.FIELD_SOURCE,
  originalUrl: config.FIELD_ORIGINAL_URL,
  summary: config.FIELD_SUMMARY,
  docUrl: config.FIELD_DOC_URL,
  collectTime: config.FIELD_COLLECT_TIME,
};

// ========== 碎片想法库配置 ==========
export const ideasBitableConfig = {
  appToken: config.IDEAS_BITABLE_APP_TOKEN || '',
  tableId: config.IDEAS_BITABLE_TABLE_ID || '',
  enabled: !!(config.IDEAS_BITABLE_APP_TOKEN && config.IDEAS_BITABLE_TABLE_ID),
};

export const ideasFieldConfig = {
  content: config.IDEA_FIELD_CONTENT,
  recordTime: config.IDEA_FIELD_TIME,
  inputType: config.IDEA_FIELD_INPUT_TYPE,
  scene: config.IDEA_FIELD_SCENE,
  emotion: config.IDEA_FIELD_EMOTION,
  relatedUrl: config.IDEA_FIELD_RELATED_URL,
  relatedTitle: config.IDEA_FIELD_RELATED_TITLE,
  voiceDuration: config.IDEA_FIELD_VOICE_DURATION,
  topics: config.IDEA_FIELD_TOPICS,
  maturity: config.IDEA_FIELD_MATURITY,
  summarized: config.IDEA_FIELD_SUMMARIZED,
};

// ========== DeepSeek 配置 ==========
export const deepseekConfig = {
  apiKey: config.DEEPSEEK_API_KEY || '',
  enabled: !!config.DEEPSEEK_API_KEY,
};

// ========== 百度 ASR 配置 ==========
export const baiduASRConfig = {
  apiKey: config.BAIDU_ASR_API_KEY || '',
  secretKey: config.BAIDU_ASR_SECRET_KEY || '',
  enabled: !!(config.BAIDU_ASR_API_KEY && config.BAIDU_ASR_SECRET_KEY),
};

// ========== 百度 OCR 配置（千帆平台） ==========
export const baiduOCRConfig = {
  apiKey: config.BAIDU_OCR_API_KEY || '',
  enabled: !!config.BAIDU_OCR_API_KEY,
};

// ========== 扩展字段配置 ==========
export const extendedFieldConfig = {
  appToken: config.BITABLE_APP_TOKEN,
  tableId: config.BITABLE_TABLE_ID,
  contentType: config.FIELD_CONTENT_TYPE,
  imageCount: config.FIELD_IMAGE_COUNT,
  videoDuration: config.FIELD_VIDEO_DURATION,
  audioDuration: config.FIELD_AUDIO_DURATION,
  transcriptionStatus: config.FIELD_TRANSCRIPTION_STATUS,
  keyframeCount: config.FIELD_KEYFRAME_COUNT,
};

// ========== 文章多维表格配置（用于知识提炼功能） ==========
export const article = {
  appToken: config.BITABLE_APP_TOKEN,
  tableId: config.BITABLE_TABLE_ID,
};

// ========== COROS 运动记录配置 ==========
export const corosLarkConfig = {
  appId: config.COROS_LARK_APP_ID || '',
  appSecret: config.COROS_LARK_APP_SECRET || '',
  // 是否使用独立凭证
  useOwnCredentials: !!(config.COROS_LARK_APP_ID && config.COROS_LARK_APP_SECRET),
};

export const corosBitableConfig = {
  appToken: config.COROS_BITABLE_APP_TOKEN || '',
  tableId: config.COROS_BITABLE_TABLE_ID || '',
  enabled: config.COROS_ENABLED && !!(config.COROS_BITABLE_APP_TOKEN && config.COROS_BITABLE_TABLE_ID),
};

export const corosFieldConfig = {
  date: config.COROS_FIELD_DATE,
  sport: config.COROS_FIELD_SPORT,
  runKm: config.COROS_FIELD_RUN_KM,
  rideKm: config.COROS_FIELD_RIDE_KM,
  elevM: config.COROS_FIELD_ELEV_M,
  notes: config.COROS_FIELD_NOTES,
  source: config.COROS_FIELD_SOURCE,
  raw: config.COROS_FIELD_RAW,
  confidence: config.COROS_FIELD_CONF,
  dedupeKey: config.COROS_FIELD_DEDUPE,
};

// ========== 视频/播客配置 ==========
export const videoConfig = {
  whisperModel: config.WHISPER_MODEL,
  openaiApiKey: config.OPENAI_WHISPER_API_KEY || '',
  transcriptionThreshold: config.TRANSCRIPTION_THRESHOLD, // 秒数
  bilibiliCookie: config.BILIBILI_COOKIE || '',
  douyinApiUrl: config.DOUYIN_API_URL,
  ytDlpPath: config.YT_DLP_PATH,
  maxVideoSizeMB: config.MAX_VIDEO_SIZE_MB,
  maxAudioDurationMinutes: config.MAX_AUDIO_DURATION_MINUTES,
  // 功能开关
  hasOpenAI: !!config.OPENAI_WHISPER_API_KEY,
  hasBilibiliCookie: !!config.BILIBILI_COOKIE,
};

export default config;
