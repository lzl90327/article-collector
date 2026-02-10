
import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import { llmConfig } from '../config';

export class AliyunASRService {
  private apiKey: string;
  private baseUrl: string = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor() {
    this.apiKey = llmConfig.apiKey;
    if (!this.apiKey) {
      logger.warn('Aliyun API Key not configured, ASR will fail');
    }
  }

  /**
   * 转录音频文件
   * @param filePath 本地音频文件路径
   * @returns 转录文本
   */
  async transcribe(filePath: string): Promise<string> {
    logger.info(`开始 ASR 转录: ${filePath}`);
    
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('model', 'paraformer-v1');
      form.append('response_format', 'text');

      const response = await axios.post(
        `${this.baseUrl}/audio/transcriptions`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${this.apiKey}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 300000, // 5分钟超时
        }
      );

      logger.info('ASR 转录成功');
      
      // 处理响应数据
      // OpenAI 兼容接口通常返回 JSON: { "text": "..." }
      if (typeof response.data === 'string') {
        return response.data;
      } else if (response.data && response.data.text) {
        return response.data.text;
      } else {
        logger.warn('ASR 响应格式未识别', response.data);
        return JSON.stringify(response.data);
      }
    } catch (error: any) {
      logger.error('ASR 转录失败', error.response?.data || error.message);
      throw error;
    }
  }
}

export const aliyunASRService = new AliyunASRService();
