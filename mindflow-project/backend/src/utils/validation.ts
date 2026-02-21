/**
 * 输入验证和清理模块
 * 提供统一的输入验证、数据清理和安全检查
 */

import { z } from 'zod';

// URL 验证和清理
export const UrlSchema = z.string()
  .min(1, 'URL 不能为空')
  .max(2048, 'URL 过长')
  .refine((val) => {
    try {
      const url = new URL(val);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }, '无效的 URL 格式');

// 文本内容验证
export const TextContentSchema = z.string()
  .min(1, '内容不能为空')
  .max(50000, '内容过长，最大支持 50000 字符')
  .transform((val) => sanitizeText(val));

// 消息 ID 验证
export const MessageIdSchema = z.string()
  .min(1, '消息 ID 不能为空')
  .max(100, '消息 ID 过长')
  .regex(/^[a-zA-Z0-9_-]+$/, '消息 ID 格式无效');

// 用户 ID 验证
export const UserIdSchema = z.string()
  .min(1, '用户 ID 不能为空')
  .max(100, '用户 ID 过长')
  .regex(/^[a-zA-Z0-9_-]+$/, '用户 ID 格式无效');

// 文件名验证
export const FileNameSchema = z.string()
  .min(1, '文件名不能为空')
  .max(255, '文件名过长')
  .regex(/^[^<>:"|?*\x00-\x1f]+$/, '文件名包含非法字符')
  .transform((val) => val.trim());

// 标题验证
export const TitleSchema = z.string()
  .min(1, '标题不能为空')
  .max(200, '标题过长，最大支持 200 字符')
  .transform((val) => sanitizeText(val).substring(0, 200));

// 作者名称验证
export const AuthorSchema = z.string()
  .max(100, '作者名称过长')
  .transform((val) => val ? sanitizeText(val).substring(0, 100) : '');

// HTML 标签白名单
const ALLOWED_HTML_TAGS = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre'];
const ALLOWED_HTML_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title'],
};

/**
 * 清理文本内容
 * 移除潜在危险的字符和脚本
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    // 移除 null 字节，替换为空格
    .replace(/\x00/g, ' ')
    // 移除控制字符（保留换行和制表符），替换为空格
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ')
    // 规范化空白字符
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 清理 HTML 内容
 * 只允许白名单内的标签和属性
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // 简单的 HTML 清理（生产环境建议使用 DOMPurify 或类似库）
  let cleaned = html;
  
  // 移除 script 标签及其内容
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // 移除 style 标签及其内容
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // 移除事件处理器
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // 移除 javascript: 伪协议
  cleaned = cleaned.replace(/javascript:/gi, '');
  
  // 移除 href 中的 javascript: 伪协议（保留 href 属性但清空值）
  cleaned = cleaned.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href=""');
  
  // 移除 data: URI
  cleaned = cleaned.replace(/data:[^;]*;base64,[a-zA-Z0-9+/=]*/gi, '');
  
  return cleaned;
}

/**
 * 验证并清理 URL
 */
export function validateAndCleanUrl(url: string): { valid: boolean; url?: string; error?: string } {
  try {
    const result = UrlSchema.safeParse(url.trim());
    if (!result.success) {
      return { valid: false, error: result.error.errors[0].message };
    }
    
    const parsed = new URL(result.data);
    
    // 移除跟踪参数
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    
    return { valid: true, url: parsed.toString() };
  } catch (error) {
    return { valid: false, error: 'URL 解析失败' };
  }
}

/**
 * 验证文件类型
 */
export function validateFileType(filename: string, allowedTypes: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  return allowedTypes.includes(ext);
}

/**
 * 验证文件大小
 */
export function validateFileSize(size: number, maxSizeMB: number): boolean {
  return size <= maxSizeMB * 1024 * 1024;
}

/**
 * 内容安全检查
 * 检查是否包含敏感信息或恶意内容
 */
export function securityCheck(content: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // 检查潜在的敏感信息模式
  const sensitivePatterns = [
    { pattern: /\b\d{16,19}\b/, name: '可能的银行卡号' },
    { pattern: /\b\d{18}\b/, name: '可能的身份证号' },
    { pattern: /\b1[3-9]\d{9}\b/, name: '可能的手机号' },
    { pattern: /password\s*[=:]\s*\S+/i, name: '可能的密码' },
    { pattern: /api[_-]?key\s*[=:]\s*\S+/i, name: '可能的 API Key' },
  ];
  
  sensitivePatterns.forEach(({ pattern, name }) => {
    if (pattern.test(content)) {
      issues.push(`检测到${name}`);
    }
  });
  
  return { safe: issues.length === 0, issues };
}

/**
 * 验证对象结构
 */
export function validateObject<T>(schema: z.ZodSchema<T>, data: unknown): { valid: boolean; data?: T; errors?: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data };
  } else {
    return { 
      valid: false, 
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) 
    };
  }
}

/**
 * 输入验证器类
 */
export class InputValidator {
  private errors: string[] = [];
  
  /**
   * 验证 URL
   */
  url(value: string, fieldName: string = 'URL'): this {
    const result = UrlSchema.safeParse(value);
    if (!result.success) {
      this.errors.push(`${fieldName}: ${result.error.errors[0].message}`);
    }
    return this;
  }
  
  /**
   * 验证文本内容
   */
  text(value: string, fieldName: string = '内容', maxLength: number = 50000): this {
    if (!value || value.trim().length === 0) {
      this.errors.push(`${fieldName}: 不能为空`);
    } else if (value.length > maxLength) {
      this.errors.push(`${fieldName}: 超过最大长度 ${maxLength}`);
    }
    return this;
  }
  
  /**
   * 验证必填字段
   */
  required(value: unknown, fieldName: string): this {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      this.errors.push(`${fieldName}: 必填字段`);
    }
    return this;
  }
  
  /**
   * 验证数组
   */
  array(value: unknown, fieldName: string, minLength: number = 0, maxLength: number = 1000): this {
    if (!Array.isArray(value)) {
      this.errors.push(`${fieldName}: 必须是数组`);
    } else {
      if (value.length < minLength) {
        this.errors.push(`${fieldName}: 至少需要 ${minLength} 个元素`);
      }
      if (value.length > maxLength) {
        this.errors.push(`${fieldName}: 最多允许 ${maxLength} 个元素`);
      }
    }
    return this;
  }
  
  /**
   * 自定义验证
   */
  custom(validator: () => boolean, errorMessage: string): this {
    if (!validator()) {
      this.errors.push(errorMessage);
    }
    return this;
  }
  
  /**
   * 获取验证结果
   */
  validate(): { valid: boolean; errors: string[] } {
    return { valid: this.errors.length === 0, errors: [...this.errors] };
  }
  
  /**
   * 重置验证器
   */
  reset(): this {
    this.errors = [];
    return this;
  }
}

// 导出验证器实例创建函数
export function createValidator(): InputValidator {
  return new InputValidator();
}

// 常用验证模式
export const ValidationPatterns = {
  // 邮箱
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // 手机号（中国大陆）
  phone: /^1[3-9]\d{9}$/,
  // 身份证号
  idCard: /^\d{17}[\dXx]$/,
  // 微信号
  wechat: /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/,
  // 小红书链接
  xiaohongshu: /^https?:\/\/(www\.)?xiaohongshu\.com/,
  // 微信公众号文章
  wechatArticle: /^https?:\/\/mp\.weixin\.qq\.com/,
  // B站视频
  bilibili: /^https?:\/\/(www\.)?bilibili\.com\/video/,
  // 抖音视频
  douyin: /^https?:\/\/(www\.)?douyin\.com/,
};
