import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

const NODE_ENV = process.env.NODE_ENV || 'development';

function loadEnvFile(): void {
  const envFiles = [
    `.env.${NODE_ENV}.local`,
    `.env.${NODE_ENV}`,
    '.env.local',
    '.env',
  ];

  let rootDir = process.cwd();
  
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
    dotenv.config();
    console.log(`📁 使用默认配置 (.env)`);
  }
}

loadEnvFile();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10) || 3001).default('3001'),
  
  // MindFlow LLM Keys
  DEEPSEEK_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  R1_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),

  // Supabase
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().default('mindflow-secret-key-change-me'),
  
  // Redis
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof envSchema>;

function parseConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    if (process.env.NODE_ENV === 'test') {
      console.warn('⚠️ 测试环境下环境变量缺失，跳过校验');
      return {
        ...process.env,
        NODE_ENV: 'test',
        PORT: 3001,
        JWT_SECRET: 'test-secret',
      } as unknown as Config;
    }
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

export const config = parseConfig();

export const mindflowConfig = {
  llmKeys: {
    deepseek: config.DEEPSEEK_API_KEY,
    claude: config.CLAUDE_API_KEY,
    r1: config.R1_API_KEY,
    perplexity: config.PERPLEXITY_API_KEY,
  },
  supabase: {
    url: config.SUPABASE_URL,
    anonKey: config.SUPABASE_ANON_KEY,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  },
  security: {
    jwtSecret: config.JWT_SECRET,
  },
  redis: {
    url: config.REDIS_URL,
    password: config.REDIS_PASSWORD,
  }
};

export default config;
