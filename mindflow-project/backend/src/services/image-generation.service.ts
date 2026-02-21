/**
 * 配图生成服务
 * Phase 4.8: Apple Keynote 风格配图生成
 */

import { logger } from '../utils/logger';

/**
 * 配图配置
 */
export interface ImageConfig {
  width: number;
  height: number;
  style: 'keynote' | 'minimal' | 'gradient';
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

/**
 * 配图请求
 */
export interface ImageGenerationRequest {
  title: string;
  subtitle?: string;
  section?: string;
  config?: Partial<ImageConfig>;
}

/**
 * 生成的配图
 */
export interface GeneratedImage {
  id: string;
  url: string;
  base64?: string;
  metadata: {
    title: string;
    section?: string;
    width: number;
    height: number;
  };
}

// 默认配置 - Apple Keynote 风格
const DEFAULT_CONFIG: ImageConfig = {
  width: 1200,
  height: 630,
  style: 'keynote',
  backgroundColor: '#F5F5F7',
  textColor: '#1D1D1F',
  accentColor: '#007AFF',
};

/**
 * 生成配图
 * @param request 配图请求
 */
export async function generateImage(
  request: ImageGenerationRequest
): Promise<GeneratedImage> {
  try {
    const config = { ...DEFAULT_CONFIG, ...request.config };

    // 构建 SVG（简化版，实际应该调用图像生成 API）
    const svg = buildKeynoteStyleSVG(request, config);

    // 将 SVG 转换为 Base64
    const base64 = Buffer.from(svg).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64}`;

    return {
      id: `img-${Date.now()}`,
      url: dataUrl,
      base64,
      metadata: {
        title: request.title,
        section: request.section,
        width: config.width,
        height: config.height,
      },
    };
  } catch (error) {
    logger.error('Generate image failed:', error);
    throw error;
  }
}

/**
 * 批量生成配图
 * @param sections 文章段落
 */
export async function generateImagesForArticle(
  sections: Array<{ title: string; content: string }>
): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = [];

  // 生成封面图
  const coverImage = await generateImage({
    title: sections[0]?.title || '文章封面',
    subtitle: 'Cover',
    config: { height: 630 },
  });
  images.push(coverImage);

  // 为每个主要段落生成配图
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    if (section.content.length > 200) {
      const image = await generateImage({
        title: section.title,
        section: `Section ${i}`,
        config: { height: 400 },
      });
      images.push(image);
    }
  }

  return images;
}

/**
 * 构建 Apple Keynote 风格 SVG
 */
function buildKeynoteStyleSVG(
  request: ImageGenerationRequest,
  config: ImageConfig
): string {
  const { title, subtitle } = request;
  const { width, height, backgroundColor, textColor, accentColor } = config;

  // 计算字体大小
  const titleFontSize = Math.min(72, width / (title.length * 0.6));
  const subtitleFontSize = titleFontSize * 0.4;

  // 生成装饰元素
  const decorations = generateDecorations(width, height, accentColor);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${backgroundColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustColor(backgroundColor, -10)};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- 背景 -->
  <rect width="100%" height="100%" fill="url(#bgGradient)"/>
  
  <!-- 装饰元素 -->
  ${decorations}
  
  <!-- 标题 -->
  <text x="${width / 2}" y="${height / 2}" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${titleFontSize}"
        font-weight="700"
        fill="${textColor}"
        text-anchor="middle"
        dominant-baseline="middle">
    ${escapeXml(title)}
  </text>
  
  <!-- 副标题 -->
  ${subtitle ? `
  <text x="${width / 2}" y="${height / 2 + titleFontSize * 1.2}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${subtitleFontSize}"
        font-weight="400"
        fill="${adjustColor(textColor, 40)}"
        text-anchor="middle"
        dominant-baseline="middle">
    ${escapeXml(subtitle)}
  </text>
  ` : ''}
  
  <!-- 底部装饰线 -->
  <rect x="${width * 0.2}" y="${height - 40}" 
        width="${width * 0.6}" height="4" 
        fill="${accentColor}" 
        rx="2"/>
</svg>`;
}

/**
 * 生成装饰元素
 */
function generateDecorations(
  width: number,
  height: number,
  accentColor: string
): string {
  const decorations = [];

  // 左上角圆形
  decorations.push(
    `<circle cx="${width * 0.1}" cy="${height * 0.15}" r="${width * 0.05}" fill="${accentColor}" opacity="0.1"/>`
  );

  // 右下角圆形
  decorations.push(
    `<circle cx="${width * 0.9}" cy="${height * 0.85}" r="${width * 0.08}" fill="${accentColor}" opacity="0.08"/>`
  );

  // 中间小圆点
  decorations.push(
    `<circle cx="${width * 0.85}" cy="${height * 0.2}" r="${width * 0.02}" fill="${accentColor}" opacity="0.15"/>`
  );

  // 左侧线条
  decorations.push(
    `<rect x="${width * 0.05}" y="${height * 0.4}" width="3" height="${height * 0.2}" fill="${accentColor}" opacity="0.2" rx="1.5"/>`
  );

  return decorations.join('\n  ');
}

/**
 * 调整颜色亮度
 */
function adjustColor(color: string, amount: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 获取配色方案
 */
export function getColorSchemes(): Array<{
  name: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}> {
  return [
    {
      name: 'Light',
      backgroundColor: '#F5F5F7',
      textColor: '#1D1D1F',
      accentColor: '#007AFF',
    },
    {
      name: 'Dark',
      backgroundColor: '#1D1D1F',
      textColor: '#F5F5F7',
      accentColor: '#0A84FF',
    },
    {
      name: 'Warm',
      backgroundColor: '#FFF8F0',
      textColor: '#2C2C2C',
      accentColor: '#FF9500',
    },
    {
      name: 'Cool',
      backgroundColor: '#F0F8FF',
      textColor: '#1D1D1F',
      accentColor: '#5856D6',
    },
    {
      name: 'Nature',
      backgroundColor: '#F0FFF4',
      textColor: '#1D1D1F',
      accentColor: '#34C759',
    },
  ];
}

/**
 * 生成配图提示词（用于 AI 图像生成）
 * @param title 标题
 * @param style 风格
 */
export function generateImagePrompt(
  title: string,
  style: 'minimal' | 'abstract' | 'conceptual' = 'minimal'
): string {
  const stylePrompts = {
    minimal: 'minimalist design, clean lines, simple geometric shapes, Apple Keynote style',
    abstract: 'abstract art, flowing shapes, gradient colors, modern design',
    conceptual: 'conceptual illustration, symbolic imagery, thought-provoking visuals',
  };

  return `Create a professional header image for an article titled "${title}". 
${stylePrompts[style]}
No text in the image. Professional, high-quality, suitable for a tech blog or newsletter.
Aspect ratio: 1200:630`;
}
