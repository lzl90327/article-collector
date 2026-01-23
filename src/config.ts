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

  // 多维表格配置（必填）
  BITABLE_APP_TOKEN: z.string().min(1, 'BITABLE_APP_TOKEN 不能为空'),
  BITABLE_TABLE_ID: z.string().min(1, 'BITABLE_TABLE_ID 不能为空'),

  // 多维表格字段名称配置
  FIELD_TITLE: z.string().default('标题'),
  FIELD_AUTHOR: z.string().default('作者'),
  FIELD_PUBLISH_TIME: z.string().default('发布时间'),
  FIELD_SOURCE: z.string().default('来源'),
  FIELD_ORIGINAL_URL: z.string().default('原文链接'),
  FIELD_SUMMARY: z.string().default('摘要'),
  FIELD_DOC_URL: z.string().default('文档链接'),
  FIELD_COLLECT_TIME: z.string().default('收藏时间'),

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

export default config;
