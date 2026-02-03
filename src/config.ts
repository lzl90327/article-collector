/**
 * 配置管理模块
 * 使用 Zod 进行环境变量校验
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// 环境变量 Schema 定义
const envSchema = z.object({
  // 飞书应用配置（必填）
  LARK_APP_ID: z.string().min(1, 'LARK_APP_ID 不能为空'),
  LARK_APP_SECRET: z.string().min(1, 'LARK_APP_SECRET 不能为空'),

  // 知识库配置（必填）
  WIKI_SPACE_ID: z.string().min(1, 'WIKI_SPACE_ID 不能为空'),
  WIKI_PARENT_NODE_TOKEN: z.string().optional().default(''),

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

  // ========== 多维表格扩展字段 ==========
  FIELD_CONTENT_TYPE: z.string().default('内容类型'),
  FIELD_IMAGE_COUNT: z.string().default('图片数量'),

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
  contentType: config.FIELD_CONTENT_TYPE,
  imageCount: config.FIELD_IMAGE_COUNT,
};

export default config;
