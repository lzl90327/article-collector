export const MODEL_CONFIG = {
  // 主笔：负责生成初稿
  writer: 'deepseek-chat', 

  // 审计团队：必须异构，打破回音室效应
  auditors: {
    logic: 'deepseek-reasoner',   // 判官：强推理 (R1)
    fact: 'perplexity-online',    // 核验：实时搜索 (需集成Perplexity API或DeepSeek联网版)
    emotion: 'claude-3-5-sonnet', // 情感：细腻感知
    dissenter: 'deepseek-reasoner' // 异见：反直觉 (R1)
  },

  // 提炼：长文本处理
  distiller: 'deepseek-chat' // 或 Kimi
};

export const LLM_PROVIDERS = {
  DEEPSEEK: {
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY'
  },
  CLAUDE: {
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'CLAUDE_API_KEY'
  },
  PERPLEXITY: {
    baseUrl: 'https://api.perplexity.ai',
    apiKeyEnv: 'PERPLEXITY_API_KEY'
  }
};
