/**
 * 小红书内容提取服务
 * 
 * 优先使用 XHS-Downloader API 模式（需要先启动服务）
 * 备用：直接 HTTP 请求（受反爬限制较大）
 * 
 * XHS-Downloader 安装与启动：
 * 1. git clone https://github.com/JoeanAmier/XHS-Downloader.git
 * 2. cd XHS-Downloader && uv sync
 * 3. uv run main.py api  # 启动 API 服务（端口 5556）
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';
import { extractXhsNoteId } from '../utils/url-parser';

/**
 * 小红书笔记类型
 */
export type XhsNoteType = 'image' | 'video' | 'unknown';

/**
 * 小红书图片信息
 */
export interface XhsImageInfo {
  /** 图片索引 */
  index: number;
  /** 原始图片 URL */
  url: string;
  /** 本地临时文件路径（下载后） */
  localPath?: string;
}

/**
 * 小红书笔记信息
 */
export interface XhsNoteInfo {
  /** 笔记 ID */
  noteId: string;
  /** 笔记类型 */
  type: XhsNoteType;
  /** 标题 */
  title: string;
  /** 描述文字 */
  description: string;
  /** 作者昵称 */
  author: string;
  /** 作者 ID */
  authorId?: string;
  /** 图片列表 */
  images: XhsImageInfo[];
  /** 原始链接 */
  originalUrl: string;
  /** 展开后的链接 */
  expandedUrl: string;
  /** 发布时间 */
  publishTime?: string;
}

/**
 * 提取结果
 */
export interface XhsFetchResult {
  success: boolean;
  data?: XhsNoteInfo;
  error?: string;
  /** 是否是视频笔记（暂不支持） */
  isVideo?: boolean;
}

// XHS-Downloader API 服务地址
const XHS_API_URL = process.env.XHS_API_URL || 'http://127.0.0.1:5556';

// 临时目录
const TEMP_DIR = path.join(os.tmpdir(), 'xhs-images');

// 请求 User-Agent（备用模式）
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

/**
 * 确保临时目录存在
 */
function ensureTempDir(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * 检查 XHS-Downloader API 服务是否可用
 */
async function isXhsApiAvailable(): Promise<boolean> {
  try {
    const response = await axios.get(`${XHS_API_URL}/docs`, { timeout: 2000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * 通过 XHS-Downloader API 获取笔记信息
 * @param url 小红书链接
 * @param downloadImages 是否下载图片
 */
async function fetchViaXhsApi(url: string, downloadImages: boolean): Promise<XhsFetchResult> {
  logger.info(`[XHS-API] 调用 XHS-Downloader API: ${url}`);

  try {
    const response = await axios.post(
      `${XHS_API_URL}/xhs/detail`,
      {
        url,
        download: downloadImages,
      },
      {
        timeout: 60000, // API 可能需要较长时间下载图片
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const responseData = response.data;
    logger.debug(`[XHS-API] 响应: ${JSON.stringify(responseData).substring(0, 500)}`);

    // 检查是否成功 - API 返回格式: { message, params, data }
    if (!responseData || responseData.error) {
      return {
        success: false,
        error: responseData?.error || 'API 返回空数据',
      };
    }

    // 实际数据在 data 字段中
    const data = responseData.data || responseData;
    logger.debug(`[XHS-API] 解析数据 keys: ${Object.keys(data).join(', ')}`);

    // 检查是否是视频
    const noteType = data['作品类型'] || data.type || '';
    if (noteType === '视频' || noteType === 'video') {
      return {
        success: false,
        isVideo: true,
        error: '视频笔记暂不支持',
      };
    }

    // 解析图片列表
    const images: XhsImageInfo[] = [];
    const imageUrls = data['下载地址'] || data.download_urls || data.images || [];
    
    logger.debug(`[XHS-API] 下载地址类型: ${typeof imageUrls}, 是数组: ${Array.isArray(imageUrls)}, 长度: ${Array.isArray(imageUrls) ? imageUrls.length : 'N/A'}`);
    
    if (Array.isArray(imageUrls)) {
      for (let i = 0; i < imageUrls.length; i++) {
        const imgUrl = typeof imageUrls[i] === 'string' ? imageUrls[i] : imageUrls[i]?.url;
        if (imgUrl) {
          images.push({
            index: i,
            url: imgUrl,
          });
        }
      }
    }

    logger.info(`[XHS-API] 解析到 ${images.length} 张图片`);

    // 如果需要下载图片且有图片 URL
    if (downloadImages && images.length > 0) {
      ensureTempDir();
      logger.info(`[XHS-API] 开始下载 ${images.length} 张图片到临时目录`);
      for (const img of images) {
        const localPath = await downloadImageToTemp(img.url, img.index);
        if (localPath) {
          img.localPath = localPath;
        }
      }
    }

    const noteInfo: XhsNoteInfo = {
      noteId: data['作品ID'] || data.note_id || extractXhsNoteId(url) || '',
      type: 'image',
      title: data['作品标题'] || data.title || '',
      description: data['作品描述'] || data.description || data.desc || '',
      author: data['作者昵称'] || data.author || data.user?.nickname || '未知',
      authorId: data['作者ID'] || data.author_id || data.user?.id || '',
      images,
      originalUrl: url,
      expandedUrl: data['作品链接'] || url,
      publishTime: data['发布时间'] || data.publish_time || '',
    };

    logger.info(`[XHS-API] 成功获取笔记: ${noteInfo.title || '无标题'}, ${images.length} 张图片`);

    return {
      success: true,
      data: noteInfo,
    };
  } catch (error: any) {
    logger.error(`[XHS-API] 调用失败: ${error.message}`);
    return {
      success: false,
      error: `XHS-API 调用失败: ${error.message}`,
    };
  }
}

/**
 * 下载图片到临时目录
 */
async function downloadImageToTemp(imageUrl: string, index: number): Promise<string | null> {
  ensureTempDir();
  
  const fileName = `xhs_${Date.now()}_${index}.jpg`;
  const filePath = path.join(TEMP_DIR, fileName);

  try {
    logger.debug(`下载图片 ${index}: ${imageUrl.substring(0, 80)}...`);
    
    const response = await axios.get(imageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.xiaohongshu.com/',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    fs.writeFileSync(filePath, response.data);
    logger.debug(`图片 ${index} 下载完成: ${filePath}`);
    
    return filePath;
  } catch (error: any) {
    logger.warn(`下载图片 ${index} 失败: ${error.message}`);
    return null;
  }
}

/**
 * 备用方案：展开短链接
 */
async function expandShortUrl(shortUrl: string): Promise<string> {
  if (shortUrl.includes('xiaohongshu.com')) {
    return shortUrl;
  }

  logger.info(`[备用] 展开短链接: ${shortUrl}`);

  try {
    const response = await axios.get(shortUrl, {
      headers: { 'User-Agent': USER_AGENT },
      maxRedirects: 5,
      timeout: 10000,
      validateStatus: () => true,
    });

    const finalUrl = response.request?.res?.responseUrl || response.config?.url || shortUrl;
    logger.info(`[备用] 短链接展开为: ${finalUrl}`);
    return finalUrl;
  } catch (error: any) {
    logger.warn(`[备用] 短链接展开失败: ${error.message}`);
    return shortUrl;
  }
}

/**
 * 备用方案：直接 HTTP 请求（受限于反爬）
 */
async function fetchViaHttp(url: string, downloadImages: boolean): Promise<XhsFetchResult> {
  logger.info(`[备用-HTTP] 尝试直接请求: ${url}`);

  try {
    const expandedUrl = await expandShortUrl(url);
    const noteId = extractXhsNoteId(expandedUrl);

    const response = await axios.get(expandedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      logger.warn(`[备用-HTTP] 请求返回: HTTP ${response.status}`);
    }

    const html = response.data;
    if (!html || typeof html !== 'string') {
      return {
        success: false,
        error: '页面内容为空',
      };
    }

    // 尝试从页面中提取基本信息
    let title = '';
    let author = '';
    let description = '';

    // 从 meta 标签提取
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    }

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (!title && titleMatch) {
      title = titleMatch[1].replace(' - 小红书', '').trim();
    }

    const authorMatch = html.match(/<meta[^>]*name="author"[^>]*content="([^"]*)"[^>]*>/i);
    if (authorMatch) {
      author = authorMatch[1];
    }

    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    if (descMatch) {
      description = descMatch[1];
    }

    // 备用模式无法可靠提取图片（反爬限制）
    logger.warn('[备用-HTTP] 直接 HTTP 请求无法提取图片，建议启动 XHS-Downloader API 服务');

    return {
      success: true,
      data: {
        noteId: noteId || '',
        type: 'image',
        title: title || `小红书笔记`,
        description,
        author: author || '未知',
        images: [], // 备用模式无法获取图片
        originalUrl: url,
        expandedUrl,
      },
    };
  } catch (error: any) {
    logger.error(`[备用-HTTP] 请求失败: ${error.message}`);
    return {
      success: false,
      error: `HTTP 请求失败: ${error.message}`,
    };
  }
}

/**
 * 从小红书链接获取笔记信息（主入口）
 * 
 * @param url 小红书链接（短链或完整链接）
 * @param downloadImages 是否下载图片到本地，默认 true
 * @returns 提取结果
 */
export async function fetchXhsNote(
  url: string,
  downloadImages: boolean = true
): Promise<XhsFetchResult> {
  logger.info(`开始提取小红书笔记: ${url}`);

  // 1. 优先尝试 XHS-Downloader API
  const apiAvailable = await isXhsApiAvailable();
  
  if (apiAvailable) {
    logger.info('XHS-Downloader API 可用，使用 API 模式');
    const result = await fetchViaXhsApi(url, downloadImages);
    if (result.success || result.isVideo) {
      return result;
    }
    logger.warn(`API 模式失败: ${result.error}，尝试备用方案`);
  } else {
    logger.warn('XHS-Downloader API 不可用，使用备用方案');
    logger.warn('提示: 启动 XHS-Downloader API 可获得更好的提取效果');
    logger.warn('命令: cd XHS-Downloader && uv run main.py api');
  }

  // 2. 备用方案：直接 HTTP 请求
  return fetchViaHttp(url, downloadImages);
}

/**
 * 清理临时图片文件
 */
export function cleanupTempImages(images: XhsImageInfo[]): void {
  for (const img of images) {
    if (img.localPath && fs.existsSync(img.localPath)) {
      try {
        fs.unlinkSync(img.localPath);
        logger.debug(`清理临时文件: ${img.localPath}`);
      } catch (error: any) {
        logger.warn(`清理临时文件失败: ${error.message}`);
      }
    }
  }
}
