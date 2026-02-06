/**
 * COROS 运动截图解析器
 * 使用百度 OCR 识别运动截图，并解析结构化的运动数据
 */

import { z } from 'zod';
import { recognizeImage, OcrOptions } from './baidu-ocr';
import { logger } from '../utils/logger';

/**
 * 运动类型
 */
export type SportType = 'run' | 'ride' | 'climb' | 'unknown';

/**
 * 运动记录解析结果 Schema
 */
export const SportRecordSchema = z.object({
  sportType: z.enum(['run', 'ride', 'climb', 'unknown']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  distanceKm: z.number().nullable(),
  elevationM: z.number().nullable(),
  durationMin: z.number().nullable(),
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
});

export type SportRecord = z.infer<typeof SportRecordSchema>;

/**
 * 运动截图识别关键词
 * 用于判断图片是否为运动截图
 */
const SPORT_KEYWORDS = [
  // 运动类型
  '跑步', '骑行', '骑车', '自行车', '爬升', '徒步', '登山', '游泳',
  'run', 'running', 'ride', 'cycling', 'bike', 'climb', 'hiking', 'swim',
  '户外跑', '室内跑', '越野跑', '马拉松',
  // 运动数据
  '配速', '心率', '步频', '步幅', '卡路里',
  'pace', 'bpm', 'cadence', 'calorie',
  // 设备品牌
  'COROS', 'Garmin', '佳明', 'Suunto', 'Polar',
  // 常见格式
  '/km', 'km/h', '公里', '千米', '米', '分钟',
];

/**
 * 判断 OCR 文本是否为运动截图
 * @param text OCR 识别的文本
 * @returns 是否为运动截图
 */
export function isSportScreenshot(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // 计算匹配的关键词数量
  let matchCount = 0;
  for (const keyword of SPORT_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }
  
  // 至少匹配 2 个关键词才判定为运动截图
  return matchCount >= 2;
}

/**
 * 解析 OCR 文本为结构化运动数据
 * @param text OCR 识别的文本
 * @returns 运动记录
 */
export function parseTextToSportRecord(text: string): SportRecord {
  // 默认值
  let sportType: SportType = 'unknown';
  let startDate: string | null = null;
  let distanceKm: number | null = null;
  let elevationM: number | null = null;
  let durationMin: number | null = null;

  const lowerText = text.toLowerCase();

  // 1. 识别运动类型
  if (
    lowerText.includes('跑步') ||
    lowerText.includes('run') ||
    lowerText.includes('running') ||
    lowerText.includes('户外跑') ||
    lowerText.includes('室内跑') ||
    lowerText.includes('越野跑')
  ) {
    sportType = 'run';
  } else if (
    lowerText.includes('骑行') ||
    lowerText.includes('ride') ||
    lowerText.includes('cycling') ||
    lowerText.includes('骑车') ||
    lowerText.includes('自行车') ||
    lowerText.includes('bike')
  ) {
    sportType = 'ride';
  } else if (
    lowerText.includes('爬楼') ||
    lowerText.includes('爬升') ||
    lowerText.includes('climb') ||
    lowerText.includes('hiking') ||
    lowerText.includes('登山') ||
    lowerText.includes('徒步') ||
    lowerText.includes('攀登') ||
    lowerText.includes('楼梯')
  ) {
    sportType = 'climb';
  }

  // 2. 提取日期
  const datePatterns = [
    /(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})[日]?/, // 2024-01-15, 2024/01/15, 2024年1月15日
    /(\d{1,2})[-\/月](\d{1,2})[日]?[,\s]+(\d{4})/, // 01-15, 2024 or 1月15日 2024
  ];

  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      let year: string, month: string, day: string;
      if (dateMatch[3] && dateMatch[3].length === 4) {
        // 格式: MM-DD, YYYY
        month = dateMatch[1];
        day = dateMatch[2];
        year = dateMatch[3];
      } else {
        // 格式: YYYY-MM-DD
        year = dateMatch[1];
        month = dateMatch[2];
        day = dateMatch[3];
      }
      startDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      break;
    }
  }

  // 如果没有日期，使用今天
  if (!startDate) {
    const today = new Date();
    startDate = today.toISOString().split('T')[0];
  }

  // 3. 提取距离（公里）
  const distancePatterns = [
    /(\d+\.?\d*)\s*(?:公里|千米|km|KM|Km)/i,
    /距离[：:\s]*(\d+\.?\d*)/,
    /(?:total\s+)?distance[：:\s]*(\d+\.?\d*)/i,
  ];
  for (const pattern of distancePatterns) {
    const match = text.match(pattern);
    if (match) {
      distanceKm = parseFloat(match[1]);
      break;
    }
  }

  // 4. 提取爬升高度（米）
  const elevationPatterns = [
    /(?:累计)?(?:爬升|上升)[：:\s]*(\d+\.?\d*)\s*(?:米|m|M)?/i,
    /(?:elevation|ascent)[：:\s]*(\d+\.?\d*)\s*(?:m|M)?/i,
    /(\d+\.?\d*)\s*(?:米|m)\s*(?:爬升|上升)/i,
  ];
  for (const pattern of elevationPatterns) {
    const match = text.match(pattern);
    if (match) {
      elevationM = parseFloat(match[1]);
      break;
    }
  }

  // 5. 提取时长
  // 优先匹配 HH:MM:SS 格式
  const hhmmssMatch = text.match(/(\d+):(\d{2}):(\d{2})/);
  if (hhmmssMatch) {
    const hours = parseInt(hhmmssMatch[1], 10);
    const minutes = parseInt(hhmmssMatch[2], 10);
    const seconds = parseInt(hhmmssMatch[3], 10);
    durationMin = hours * 60 + minutes + Math.round(seconds / 60);
  }

  // MM:SS 格式
  if (durationMin === null) {
    const mmssMatch = text.match(/(?:运动时间|时长|duration)[：:\s]*(\d+):(\d{2})/i);
    if (mmssMatch) {
      const minutes = parseInt(mmssMatch[1], 10);
      const seconds = parseInt(mmssMatch[2], 10);
      durationMin = minutes + Math.round(seconds / 60);
    }
  }

  // X小时X分X秒 格式
  if (durationMin === null) {
    const chineseMatch = text.match(
      /(\d+)\s*(?:小时|时)\s*(\d+)\s*(?:分钟?|分)\s*(?:(\d+)\s*秒)?/
    );
    if (chineseMatch) {
      const hours = parseInt(chineseMatch[1], 10) || 0;
      const minutes = parseInt(chineseMatch[2], 10) || 0;
      const seconds = parseInt(chineseMatch[3], 10) || 0;
      durationMin = hours * 60 + minutes + Math.round(seconds / 60);
    }
  }

  // 纯分钟数
  if (durationMin === null) {
    const minMatch = text.match(/(?:时长|duration)[：:\s]*(\d+)\s*(?:分钟?|min)/i);
    if (minMatch) {
      durationMin = parseInt(minMatch[1], 10);
    }
  }

  // 6. 计算置信度
  let confidence = 0.5;
  if (text.length > 50) confidence += 0.1;
  if (sportType !== 'unknown') confidence += 0.1;
  if (distanceKm !== null) confidence += 0.1;
  if (durationMin !== null) confidence += 0.1;
  confidence = Math.min(confidence, 0.95);

  return {
    sportType,
    startDate,
    distanceKm,
    elevationM,
    durationMin,
    rawText: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
    confidence,
  };
}

/**
 * 解析运动截图
 * @param imageInput 图片数据（Buffer、Base64 或文件路径）
 * @param ocrOptions OCR 配置
 * @returns 运动记录
 */
export async function parseSportScreenshot(
  imageInput: Buffer | string,
  ocrOptions: OcrOptions
): Promise<SportRecord> {
  logger.info('开始解析运动截图...');

  // 1. OCR 识别
  const ocrResult = await recognizeImage(imageInput, {
    ...ocrOptions,
    prompt:
      '请识别这张运动记录截图中的所有文字信息，包括：运动类型、日期、距离、时长、爬升高度、配速等。请直接输出识别到的文字内容，不要添加额外解释。',
  });

  if (!ocrResult.success || !ocrResult.text) {
    logger.warn('OCR 识别失败:', ocrResult.error);
    return {
      sportType: 'unknown',
      startDate: new Date().toISOString().split('T')[0],
      distanceKm: null,
      elevationM: null,
      durationMin: null,
      rawText: `OCR 识别失败: ${ocrResult.error || '未知错误'}`,
      confidence: 0,
    };
  }

  logger.info(`OCR 识别完成，文本长度: ${ocrResult.text.length}`);
  logger.debug('OCR 原始文本:', ocrResult.text);

  // 2. 解析结构化数据
  const record = parseTextToSportRecord(ocrResult.text);

  // 验证结果
  const validated = SportRecordSchema.parse(record);
  logger.info('运动数据解析完成:', {
    sportType: validated.sportType,
    date: validated.startDate,
    distance: validated.distanceKm,
    elevation: validated.elevationM,
    duration: validated.durationMin,
    confidence: validated.confidence,
  });

  return validated;
}

/**
 * 生成运动记录去重键
 * @param record 运动记录
 * @returns 去重键
 */
export function generateDedupeKey(record: SportRecord): string {
  const parts = [
    record.sportType,
    record.startDate || 'no-date',
    record.distanceKm?.toFixed(1) || 'no-dist',
    record.elevationM?.toFixed(0) || 'no-elev',
  ];
  return parts.join('_');
}

/**
 * 运动类型中文映射
 */
export const SPORT_TYPE_LABELS: Record<SportType, string> = {
  run: '跑步',
  ride: '骑车',
  climb: '爬升',
  unknown: '未知',
};

/**
 * 运动类型选项（用于交互卡片）
 */
export const SPORT_TYPE_OPTIONS = [
  { value: 'run', text: '跑步' },
  { value: 'ride', text: '骑车' },
  { value: 'climb', text: '爬升' },
];
