import Parser from 'rss-parser';
import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * RSS 播客单集信息
 */
export interface RSSPodcastEpisode {
  title: string;
  audioUrl: string;
  duration?: string;
  publishDate?: string;
  description?: string;
  author?: string;
  guid?: string;
  imageUrl?: string;
}

/**
 * RSS Feed 元信息
 */
export interface RSSFeedMeta {
  title: string;
  description?: string;
  link?: string;
  image?: string;
  author?: string;
  language?: string;
}

/**
 * RSS 播客完整信息
 */
export interface RSSPodcastInfo {
  feed: RSSFeedMeta;
  episodes: RSSPodcastEpisode[];
}

/**
 * RSS 播客提取器
 * 支持多种 RSS 格式：RSS 2.0、iTunes 扩展、Atom
 */
export class RSSPodcastFetcher {
  private parser: Parser;

  constructor() {
    // 配置解析器，支持 iTunes 扩展字段
    this.parser = new Parser({
      customFields: {
        feed: ['itunes:author', 'itunes:image', 'itunes:category'],
        item: [
          'enclosure',
          'itunes:duration',
          'itunes:author',
          'itunes:image',
          'itunes:explicit',
          'itunes:subtitle',
          'media:content',
          'content:encoded'
        ]
      },
      timeout: 30000 // 30秒超时
    });
  }

  /**
   * 从 RSS Feed URL 解析播客信息
   */
  async parseRSSFeed(rssUrl: string): Promise<RSSPodcastInfo> {
    try {
      logger.info(`开始解析 RSS Feed: ${rssUrl}`);
      
      const feed = await this.parser.parseURL(rssUrl);
      
      // 提取 Feed 元信息
      const feedMeta: RSSFeedMeta = {
        title: feed.title || '',
        description: feed.description || '',
        link: feed.link || '',
        image: this.extractFeedImage(feed),
        author: (feed as any)['itunes:author'] || feed.creator || '',
        language: feed.language || ''
      };

      // 提取所有单集信息
      const episodes: RSSPodcastEpisode[] = feed.items.map(item => this.extractEpisodeFromItem(item));

      logger.info(`成功解析 RSS Feed，共 ${episodes.length} 个单集`);
      
      return { feed: feedMeta, episodes };
    } catch (error: any) {
      logger.error(`RSS Feed 解析失败: ${error.message}`);
      throw new Error(`RSS Feed 解析失败: ${error.message}`);
    }
  }

  /**
   * 从 RSS Item 提取单集信息
   */
  private extractEpisodeFromItem(item: any): RSSPodcastEpisode {
    // 提取音频 URL（支持多种格式）
    const audioUrl = this.extractAudioUrl(item);
    
    // 提取时长
    const duration = (item as any)['itunes:duration'] || '';
    
    // 提取封面图
    const imageUrl = this.extractItemImage(item);

    return {
      title: item.title || '',
      audioUrl: audioUrl || '',
      duration,
      publishDate: item.pubDate || item.isoDate || '',
      description: item.contentSnippet || item.content || '',
      author: (item as any)['itunes:author'] || '',
      guid: item.guid || '',
      imageUrl
    };
  }

  /**
   * 提取音频 URL（支持多种格式）
   */
  private extractAudioUrl(item: any): string | null {
    // 方式1: enclosure 标签 (最常见)
    if (item.enclosure && item.enclosure.url) {
      return item.enclosure.url;
    }

    // 方式2: media:content (iTunes/Spotify)
    if (item['media:content']) {
      const mediaContent = Array.isArray(item['media:content']) 
        ? item['media:content'][0] 
        : item['media:content'];
      
      if (mediaContent && mediaContent.$ && mediaContent.$.url) {
        return mediaContent.$.url;
      }
    }

    // 方式3: link 标签直接指向音频
    if (item.link && this.isAudioFile(item.link)) {
      return item.link;
    }

    // 方式4: guid 如果是音频链接
    if (item.guid && this.isAudioFile(item.guid)) {
      return item.guid;
    }

    return null;
  }

  /**
   * 提取 Feed 封面图
   */
  private extractFeedImage(feed: any): string {
    // iTunes 扩展
    if (feed['itunes:image']) {
      if (typeof feed['itunes:image'] === 'string') {
        return feed['itunes:image'];
      }
      if (feed['itunes:image'].$ && feed['itunes:image'].$.href) {
        return feed['itunes:image'].$.href;
      }
    }

    // 标准 image 标签
    if (feed.image) {
      if (typeof feed.image === 'string') {
        return feed.image;
      }
      if (feed.image.url) {
        return feed.image.url;
      }
    }

    return '';
  }

  /**
   * 提取单集封面图
   */
  private extractItemImage(item: any): string {
    // iTunes 扩展
    if (item['itunes:image']) {
      if (typeof item['itunes:image'] === 'string') {
        return item['itunes:image'];
      }
      if (item['itunes:image'].$ && item['itunes:image'].$.href) {
        return item['itunes:image'].$.href;
      }
    }

    // media:content 中的图片
    if (item['media:content']) {
      const mediaContent = Array.isArray(item['media:content']) 
        ? item['media:content'][0] 
        : item['media:content'];
      
      if (mediaContent && mediaContent.$ && mediaContent.$.url) {
        const url = mediaContent.$.url;
        if (this.isImageFile(url)) {
          return url;
        }
      }
    }

    return '';
  }

  /**
   * 判断是否为音频文件
   */
  private isAudioFile(url: string): boolean {
    const audioExtensions = ['.mp3', '.m4a', '.mp4', '.wav', '.aac', '.ogg', '.opus', '.flac'];
    const lowerUrl = url.toLowerCase();
    return audioExtensions.some(ext => lowerUrl.includes(ext));
  }

  /**
   * 判断是否为图片文件
   */
  private isImageFile(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  }

  /**
   * 根据 Episode ID 查找特定单集
   * 支持多种匹配策略：GUID、音频 URL、标题匹配
   * @param rssUrl RSS Feed URL
   * @param episodeId Episode ID
   * @param episodeTitle 可选的单集标题，用于标题匹配
   */
  async findEpisodeById(
    rssUrl: string, 
    episodeId: string, 
    episodeTitle?: string
  ): Promise<RSSPodcastEpisode | null> {
    try {
      const { episodes } = await this.parseRSSFeed(rssUrl);
      
      if (episodes.length === 0) {
        logger.warn('RSS Feed 中没有单集');
        return null;
      }
      
      // 策略1: 精确匹配 GUID、音频 URL
      let matchedEpisode = episodes.find(ep => {
        // 匹配 GUID
        if (ep.guid && ep.guid.includes(episodeId)) {
          return true;
        }
        // 匹配音频 URL
        if (ep.audioUrl && ep.audioUrl.includes(episodeId)) {
          return true;
        }
        return false;
      });

      if (matchedEpisode) {
        logger.info(`找到匹配的单集 (ID 精确匹配): ${matchedEpisode.title}`);
        return matchedEpisode;
      }
      
      // 策略2: Episode ID 包含在标题中（容错）
      matchedEpisode = episodes.find(ep => {
        if (ep.title && ep.title.includes(episodeId)) {
          return true;
        }
        return false;
      });
      
      if (matchedEpisode) {
        logger.info(`找到匹配的单集 (ID 标题匹配): ${matchedEpisode.title}`);
        return matchedEpisode;
      }

      // 策略3: 使用提供的标题进行模糊匹配
      if (episodeTitle) {
        logger.info(`尝试使用标题匹配: "${episodeTitle}"`);
        
        // 清理标题（移除序号、特殊字符等）
        const cleanTitle = (title: string) => {
          return title
            .replace(/^[（(]?[一二三四五六七八九十\d]+[）)]?[\s\-]*/g, '') // 移除开头的序号
            .replace(/[\s\-_]+/g, '') // 移除空格、横线、下划线
            .toLowerCase();
        };
        
        const targetTitle = cleanTitle(episodeTitle);
        
        // 精确匹配
        matchedEpisode = episodes.find(ep => {
          if (!ep.title) return false;
          const epTitle = cleanTitle(ep.title);
          return epTitle === targetTitle || epTitle.includes(targetTitle) || targetTitle.includes(epTitle);
        });
        
        if (matchedEpisode) {
          logger.info(`找到匹配的单集 (标题匹配): ${matchedEpisode.title}`);
          return matchedEpisode;
        }
        
        // 关键词匹配（至少包含2个关键字）
        const keywords = targetTitle.match(/[\u4e00-\u9fa5]{2,}/g) || []; // 提取中文关键词
        if (keywords.length >= 2) {
          matchedEpisode = episodes.find(ep => {
            if (!ep.title) return false;
            const epTitle = cleanTitle(ep.title);
            const matchedKeywords = keywords.filter(kw => epTitle.includes(kw));
            return matchedKeywords.length >= 2;
          });
          
          if (matchedEpisode) {
            logger.info(`找到匹配的单集 (关键词匹配): ${matchedEpisode.title}`);
            return matchedEpisode;
          }
        }
      }

      // 如果无法匹配，返回 null
      logger.warn(`未找到匹配 Episode ID ${episodeId} 的单集${episodeTitle ? `，标题: "${episodeTitle}"` : ''}`);
      return null;
      
    } catch (error: any) {
      logger.error(`查找单集失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取最新一集
   */
  async getLatestEpisode(rssUrl: string): Promise<RSSPodcastEpisode | null> {
    try {
      const { episodes } = await this.parseRSSFeed(rssUrl);
      
      if (episodes.length === 0) {
        logger.warn('RSS Feed 中没有单集');
        return null;
      }

      return episodes[0]; // 第一个通常是最新的
    } catch (error: any) {
      logger.error(`获取最新单集失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从网页中自动发现 RSS Feed URL
   */
  async discoverRSSFromPage(pageUrl: string): Promise<string | null> {
    try {
      logger.info(`尝试从页面发现 RSS Feed: ${pageUrl}`);
      
      const response = await axios.get(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const html = response.data;

      // RSS Feed 链接的常见模式
      const rssPatterns = [
        // 标准 RSS link 标签
        /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i,
        /<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i,
        // 其他常见模式
        /<link[^>]*href=["']([^"']*rss[^"']*)["']/i,
        /<link[^>]*href=["']([^"']*feed[^"']*)["']/i,
        /href=["']([^"']*\.xml)["']/i
      ];

      for (const pattern of rssPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          let rssUrl = match[1];
          
          // 处理相对 URL
          if (rssUrl.startsWith('/')) {
            const baseUrl = new URL(pageUrl);
            rssUrl = `${baseUrl.protocol}//${baseUrl.host}${rssUrl}`;
          } else if (!rssUrl.startsWith('http')) {
            const baseUrl = new URL(pageUrl);
            rssUrl = `${baseUrl.protocol}//${baseUrl.host}/${rssUrl}`;
          }

          logger.info(`发现 RSS Feed: ${rssUrl}`);
          return rssUrl;
        }
      }

      logger.warn('未在页面中发现 RSS Feed 链接');
      return null;
    } catch (error: any) {
      logger.error(`从页面发现 RSS Feed 失败: ${error.message}`);
      return null;
    }
  }
}

// 导出单例实例
export const rssPodcastFetcher = new RSSPodcastFetcher();
