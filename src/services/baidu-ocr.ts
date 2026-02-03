/**
 * 百度千帆 OCR 服务
 * 使用百度千帆平台的视觉理解 API (qianfan-ocr) 识别图片中的文字
 * 
 * API 文档：https://cloud.baidu.com/doc/qianfan-api/s/rm7u7qdiq
 */

import axios from 'axios';
import fs from 'fs';
import { logger } from '../utils/logger';

// 百度千帆视觉理解 API 配置
const QIANFAN_API_URL = 'https://qianfan.baidubce.com/v2/chat/completions';
const QIANFAN_MODEL = 'qianfan-ocr';

/**
 * OCR 识别结果
 */
export interface OcrResult {
  /** 完整识别文本 */
  text: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * OCR 配置选项
 */
export interface OcrOptions {
  /** 百度 OCR API Key */
  apiKey: string;
  /** 自定义提示词（可选） */
  prompt?: string;
  /** 超时时间（毫秒），默认 60000 */
  timeout?: number;
}

/**
 * 识别图片中的文字
 * @param imageInput 图片数据，可以是 Buffer、Base64 字符串或本地文件路径
 * @param options OCR 配置选项
 * @returns OCR 识别结果
 */
export async function recognizeImage(
  imageInput: Buffer | string,
  options: OcrOptions
): Promise<OcrResult> {
  const { apiKey, prompt, timeout = 60000 } = options;

  if (!apiKey) {
    return {
      text: '',
      confidence: 0,
      success: false,
      error: 'BAIDU_OCR_API_KEY 未配置',
    };
  }

  try {
    // 1. 处理图片输入，转换为 base64
    let base64Image: string;

    if (Buffer.isBuffer(imageInput)) {
      base64Image = imageInput.toString('base64');
    } else if (imageInput.startsWith('data:image')) {
      // 已经是 data URL，提取 base64 部分
      base64Image = imageInput.split(',')[1] || imageInput;
    } else if (fs.existsSync(imageInput)) {
      // 文件路径
      const fileBuffer = fs.readFileSync(imageInput);
      base64Image = fileBuffer.toString('base64');
    } else {
      // 假设是 base64 字符串
      base64Image = imageInput;
    }

    // 2. 构建 data URL
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
    logger.debug(`OCR 图片大小: ${base64Image.length} 字符 (base64)`);

    // 3. 构建请求
    const authHeader = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    
    const defaultPrompt = '请识别这张图片中的所有文字信息，保持原有的排版格式。直接输出识别到的文字内容，不要添加额外解释。';
    
    const requestBody = {
      model: QIANFAN_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
            {
              type: 'text',
              text: prompt || defaultPrompt,
            },
          ],
        },
      ],
      temperature: 0.1,  // 低温度以获得更稳定的 OCR 结果
      max_tokens: 2048,
    };

    // 4. 调用 API
    logger.info('正在调用百度千帆 OCR API...');
    
    const response = await axios.post(QIANFAN_API_URL, requestBody, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      timeout,
      validateStatus: () => true,
    });

    // 5. 处理响应
    if (response.status === 401) {
      logger.error('百度千帆 API 认证失败 (401)');
      return {
        text: '',
        confidence: 0,
        success: false,
        error: '百度千帆 API 认证失败，请检查 API Key 配置',
      };
    }

    if (response.status !== 200) {
      const errorMsg = response.data?.error?.message || JSON.stringify(response.data);
      logger.error(`百度千帆 API 错误: ${response.status} - ${errorMsg}`);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: `API 请求失败: ${response.status}`,
      };
    }

    if (response.data.error) {
      const errorInfo = response.data.error;
      logger.error(`百度千帆 API 返回错误: ${errorInfo.message}`);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: errorInfo.message,
      };
    }

    // 6. 提取识别文本
    const choices = response.data.choices || [];
    let text = '';
    
    if (choices.length > 0 && choices[0].message?.content) {
      text = choices[0].message.content;
    }

    logger.info(`OCR 识别完成，文本长度: ${text.length}`);

    // 7. 计算置信度（基于文本长度的简单估算）
    let confidence = 0.5;
    if (text.length > 50) confidence += 0.2;
    if (text.length > 200) confidence += 0.2;
    confidence = Math.min(confidence, 0.95);

    return {
      text: text.trim(),
      confidence,
      success: true,
    };

  } catch (error: any) {
    logger.error('OCR 识别失败:', error.message);
    return {
      text: '',
      confidence: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * 批量识别多张图片
 * @param images 图片数据数组
 * @param options OCR 配置选项
 * @returns 每张图片的识别结果
 */
export async function recognizeImages(
  images: Array<Buffer | string>,
  options: OcrOptions
): Promise<OcrResult[]> {
  const results: OcrResult[] = [];

  for (let i = 0; i < images.length; i++) {
    logger.info(`识别图片 ${i + 1}/${images.length}...`);
    
    const result = await recognizeImage(images[i], options);
    results.push(result);

    // 添加延迟避免触发 API 限流
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * 合并多张图片的 OCR 结果为单个文本
 * @param results OCR 结果数组
 * @param separator 分隔符，默认为换行
 * @returns 合并后的文本
 */
export function mergeOcrResults(
  results: OcrResult[],
  separator: string = '\n\n---\n\n'
): string {
  return results
    .map((result, index) => {
      if (result.success && result.text) {
        return `### 图片 ${index + 1}\n\n${result.text}`;
      }
      return `### 图片 ${index + 1}\n\n[识别失败: ${result.error || '未知错误'}]`;
    })
    .join(separator);
}
