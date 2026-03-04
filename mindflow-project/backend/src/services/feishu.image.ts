/**
 * 飞书图片服务
 * 处理文档中的图片获取
 */

import axios from 'axios';
import { feishuAuth } from './feishu.auth';
import { logger } from '../utils/logger';

interface ImageInfo {
  token: string;
  url: string;
  expiresAt: string;
}

class FeishuImageService {
  /**
   * 从文档内容中提取图片 tokens
   */
  extractImageTokens(content: string): string[] {
    const tokens: string[] = [];
    const regex = /<image\s+token="([^"]+)"/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      tokens.push(match[1]);
    }

    return [...new Set(tokens)]; // 去重
  }

  /**
   * 批量获取图片 URL
   * 使用飞书 API 获取图片下载链接
   */
  async getImageUrls(
    tokens: string[],
    userAccessToken?: string
  ): Promise<ImageInfo[]> {
    if (tokens.length === 0) return [];

    const images: ImageInfo[] = [];

    // 逐个获取图片 URL
    for (const imageToken of tokens) {
      try {
        const url = await this.getImageDownloadUrl(imageToken, userAccessToken);
        if (url) {
          images.push({
            token: imageToken,
            url: url,
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2小时后过期
          });
        }
      } catch (error) {
        logger.error(`获取图片 URL 失败: ${imageToken}`, error);
      }
    }

    return images;
  }

  /**
   * 获取单个图片的下载 URL
   * 调用飞书 API 获取临时下载链接
   */
  async getImageDownloadUrl(
    imageToken: string,
    userAccessToken?: string
  ): Promise<string | null> {
    try {
      const token = userAccessToken || (await feishuAuth.getAccessToken());

      // 调用飞书 API 获取图片下载链接
      const response = await axios.get(
        `https://open.feishu.cn/open-apis/drive/v1/medias/${imageToken}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.code === 0 && response.data.data?.url) {
        return response.data.data.url;
      }

      logger.warn(`获取图片下载链接失败: ${imageToken}, code: ${response.data.code}, msg: ${response.data.msg}`);
      return null;
    } catch (error: any) {
      logger.error(`获取图片下载链接失败: ${imageToken}`, error.message);
      return null;
    }
  }
}

export const feishuImage = new FeishuImageService();
