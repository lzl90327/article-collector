/**
 * URL 解析工具
 * 用于从消息中提取和验证文章链接
 */

/**
 * URL 类型枚举
 */
export enum UrlType {
  /** 飞书云文档 */
  FEISHU_DOC = 'feishu_doc',
  /** 飞书知识库 */
  FEISHU_WIKI = 'feishu_wiki',
  /** 微信公众号文章 */
  WECHAT_ARTICLE = 'wechat_article',
  /** 知乎文章 */
  ZHIHU_ARTICLE = 'zhihu_article',
  /** 知乎回答 */
  ZHIHU_ANSWER = 'zhihu_answer',
  /** 掘金文章 */
  JUEJIN_ARTICLE = 'juejin_article',
  /** 简书文章 */
  JIANSHU_ARTICLE = 'jianshu_article',
  /** 小红书笔记 */
  XIAOHONGSHU = 'xiaohongshu',
  /** B站视频 */
  BILIBILI_VIDEO = 'bilibili_video',
  /** 抖音视频 */
  DOUYIN_VIDEO = 'douyin_video',
  /** 小宇宙播客 */
  XIAOYUZHOU_PODCAST = 'xiaoyuzhou_podcast',
  /** 喜马拉雅播客 */
  XIMALAYA_PODCAST = 'ximalaya_podcast',
  /** 通用网页 */
  GENERIC = 'generic',
  /** 无效 URL */
  INVALID = 'invalid',
}

/**
 * URL 解析结果
 */
export interface ParsedUrl {
  /** URL 类型 */
  type: UrlType;
  /** 标准化后的 URL */
  url: string;
  /** 来源平台名称 */
  sourceName: string;
}

/**
 * 支持的文章来源模式
 */
const URL_PATTERNS = {
  // 微信公众号文章
  wechat: /https?:\/\/mp\.weixin\.qq\.com\/s[\w\-\/?=&%#.]+/gi,
  // 通用 HTTP/HTTPS 链接
  general: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
};

/**
 * 从文本中提取所有 URL
 */
export function extractUrls(text: string): string[] {
  const urls: string[] = [];
  
  // 匹配通用链接
  const matches = text.match(URL_PATTERNS.general);
  if (matches) {
    urls.push(...matches);
  }
  
  // 去重
  return [...new Set(urls)];
}

/**
 * 从文本中提取微信公众号文章链接
 */
export function extractWechatArticleUrls(text: string): string[] {
  const matches = text.match(URL_PATTERNS.wechat);
  return matches ? [...new Set(matches)] : [];
}

/**
 * 判断是否是微信公众号文章链接
 */
export function isWechatArticleUrl(url: string): boolean {
  return URL_PATTERNS.wechat.test(url);
}

/**
 * 判断是否是有效的文章链接
 * 目前支持：微信公众号、一般 HTTP/HTTPS 链接
 */
export function isValidArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 必须是 http 或 https 协议
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    // 排除一些非文章类型的链接
    const excludePatterns = [
      /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)$/i,  // 图片
      /\.(mp4|webm|avi|mov|wmv|flv)$/i,           // 视频
      /\.(mp3|wav|ogg|flac|aac)$/i,               // 音频
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,     // 文档
      /\.(zip|rar|7z|tar|gz)$/i,                  // 压缩包
    ];
    for (const pattern of excludePatterns) {
      if (pattern.test(parsed.pathname)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 URL 推断来源名称
 */
export function inferSourceFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // 特殊处理一些常见来源
    if (hostname.includes('mp.weixin.qq.com')) {
      return '微信公众号';
    }
    if (hostname.includes('zhihu.com')) {
      return '知乎';
    }
    if (hostname.includes('juejin.cn')) {
      return '掘金';
    }
    if (hostname.includes('csdn.net')) {
      return 'CSDN';
    }
    if (hostname.includes('jianshu.com')) {
      return '简书';
    }
    if (hostname.includes('36kr.com')) {
      return '36氪';
    }
    if (hostname.includes('infoq.cn')) {
      return 'InfoQ';
    }
    if (hostname.includes('bilibili.com') || hostname.includes('b23.tv')) {
      return 'B站';
    }
    if (hostname.includes('douyin.com')) {
      return '抖音';
    }
    if (hostname.includes('xiaoyuzhoufm.com')) {
      return '小宇宙';
    }
    if (hostname.includes('ximalaya.com')) {
      return '喜马拉雅';
    }
    
    // 默认使用域名
    return hostname.replace('www.', '');
  } catch {
    return '未知来源';
  }
}

/**
 * 清理 URL（移除追踪参数等）
 */
export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // 对于微信公众号文章，保留必要参数
    if (parsed.hostname.includes('mp.weixin.qq.com')) {
      // 微信文章需要保留原始参数
      return url;
    }
    
    // 对于其他链接，移除常见追踪参数
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'from', 'ref', 'source', 'share', 'isappinstalled',
    ];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * 提取飞书文档 token
 * 支持格式：
 * - https://feishu.cn/docx/{doc_token}
 * - https://bytedance.feishu.cn/docx/{doc_token}
 * - https://my.feishu.cn/docx/{doc_token}
 * - https://xxx.larkoffice.com/docx/{doc_token}
 */
export function extractFeishuDocToken(url: string): string | null {
  const patterns = [
    /\/docx\/([a-zA-Z0-9]+)/,
    /\/doc\/([a-zA-Z0-9]+)/,
    /\/docs\/([a-zA-Z0-9]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * 提取飞书知识库节点 token
 */
export function extractFeishuWikiToken(url: string): string | null {
  const match = url.match(/\/wiki\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * 检测是否是飞书文档链接
 */
export function isFeishuDocUrl(url: string): boolean {
  const feishuDomains = [
    'feishu.cn',
    'bytedance.feishu.cn',
    'my.feishu.cn',
    'larkoffice.com',
  ];
  
  return feishuDomains.some(domain => url.includes(domain)) && 
         (url.includes('/docx/') || url.includes('/doc/') || url.includes('/docs/'));
}

/**
 * 检测是否是飞书知识库链接
 */
export function isFeishuWikiUrl(url: string): boolean {
  const feishuDomains = [
    'feishu.cn',
    'bytedance.feishu.cn',
    'my.feishu.cn',
    'larkoffice.com',
  ];
  
  return feishuDomains.some(domain => url.includes(domain)) && url.includes('/wiki/');
}

/**
 * 检测是否是小红书链接
 * 支持格式：
 * - https://xhslink.com/xxx（短链）
 * - https://www.xiaohongshu.com/explore/xxx
 * - https://www.xiaohongshu.com/discovery/item/xxx
 * - http://xhslink.com/a/xxx（带路径的短链）
 */
export function isXiaohongshuUrl(url: string): boolean {
  const xhsPatterns = [
    /xhslink\.com/i,
    /xiaohongshu\.com\/explore\//i,
    /xiaohongshu\.com\/discovery\/item\//i,
    /xiaohongshu\.com\/user\/profile\//i,
  ];
  
  return xhsPatterns.some(pattern => pattern.test(url));
}

/**
 * 从小红书链接中提取笔记 ID
 * @param url 小红书链接（需要是展开后的真实链接）
 * @returns 笔记 ID 或 null
 */
export function extractXhsNoteId(url: string): string | null {
  // 匹配 /explore/xxx 或 /discovery/item/xxx 格式
  const patterns = [
    /xiaohongshu\.com\/explore\/([a-zA-Z0-9]+)/i,
    /xiaohongshu\.com\/discovery\/item\/([a-zA-Z0-9]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * 解析 URL 类型和来源
 * @param url 输入的 URL
 * @returns 解析结果
 */
export function parseUrl(url: string): ParsedUrl {
  const trimmedUrl = url.trim();

  // 飞书云文档
  if (isFeishuDocUrl(trimmedUrl)) {
    return {
      type: UrlType.FEISHU_DOC,
      url: trimmedUrl,
      sourceName: '飞书云文档',
    };
  }

  // 飞书知识库
  if (isFeishuWikiUrl(trimmedUrl)) {
    return {
      type: UrlType.FEISHU_WIKI,
      url: trimmedUrl,
      sourceName: '飞书知识库',
    };
  }

  // 检查是否为有效 URL
  if (!isValidArticleUrl(trimmedUrl)) {
    return {
      type: UrlType.INVALID,
      url: trimmedUrl,
      sourceName: '未知',
    };
  }

  // 微信公众号
  if (isWechatArticleUrl(trimmedUrl)) {
    return {
      type: UrlType.WECHAT_ARTICLE,
      url: trimmedUrl,
      sourceName: '微信公众号',
    };
  }

  // 知乎文章
  if (/^https?:\/\/zhuanlan\.zhihu\.com\/p\/\d+/i.test(trimmedUrl)) {
    return {
      type: UrlType.ZHIHU_ARTICLE,
      url: trimmedUrl,
      sourceName: '知乎专栏',
    };
  }

  // 知乎回答
  if (/^https?:\/\/www\.zhihu\.com\/question\/\d+\/answer\/\d+/i.test(trimmedUrl)) {
    return {
      type: UrlType.ZHIHU_ANSWER,
      url: trimmedUrl,
      sourceName: '知乎',
    };
  }

  // 掘金
  if (/^https?:\/\/juejin\.cn\/post\/\d+/i.test(trimmedUrl)) {
    return {
      type: UrlType.JUEJIN_ARTICLE,
      url: trimmedUrl,
      sourceName: '掘金',
    };
  }

  // 简书
  if (/^https?:\/\/www\.jianshu\.com\/p\/[a-zA-Z0-9]+/i.test(trimmedUrl)) {
    return {
      type: UrlType.JIANSHU_ARTICLE,
      url: trimmedUrl,
      sourceName: '简书',
    };
  }

  // 小红书
  if (isXiaohongshuUrl(trimmedUrl)) {
    return {
      type: UrlType.XIAOHONGSHU,
      url: trimmedUrl,
      sourceName: '小红书',
    };
  }

  // B站视频
  if (isBilibiliVideoUrl(trimmedUrl)) {
    return {
      type: UrlType.BILIBILI_VIDEO,
      url: trimmedUrl,
      sourceName: 'B站',
    };
  }

  // 抖音视频
  if (isDouyinVideoUrl(trimmedUrl)) {
    return {
      type: UrlType.DOUYIN_VIDEO,
      url: trimmedUrl,
      sourceName: '抖音',
    };
  }

  // 小宇宙播客
  if (isXiaoyuzhouPodcastUrl(trimmedUrl)) {
    return {
      type: UrlType.XIAOYUZHOU_PODCAST,
      url: trimmedUrl,
      sourceName: '小宇宙',
    };
  }

  // 喜马拉雅播客
  if (isXimalayaPodcastUrl(trimmedUrl)) {
    return {
      type: UrlType.XIMALAYA_PODCAST,
      url: trimmedUrl,
      sourceName: '喜马拉雅',
    };
  }

  // 通用网页
  return {
    type: UrlType.GENERIC,
    url: trimmedUrl,
    sourceName: inferSourceFromUrl(trimmedUrl),
  };
}

/**
 * 检测是否是B站视频链接
 * 支持格式：
 * - https://www.bilibili.com/video/BVxxx
 * - https://b23.tv/xxx（短链）
 * - https://www.bilibili.com/video/avxxx
 */
export function isBilibiliVideoUrl(url: string): boolean {
  const biliPatterns = [
    /bilibili\.com\/video\/[ABav][Vv0-9]+/i,
    /b23\.tv\/[a-zA-Z0-9]+/i,
  ];
  
  return biliPatterns.some(pattern => pattern.test(url));
}

/**
 * 从B站链接中提取视频ID
 * @param url B站视频链接
 * @returns 视频ID (BV号或av号) 或 null
 */
export function extractBilibiliVideoId(url: string): string | null {
  // 匹配 BV 号
  const bvMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
  if (bvMatch && bvMatch[1]) {
    return bvMatch[1];
  }
  
  // 匹配 av 号
  const avMatch = url.match(/bilibili\.com\/video\/(av\d+)/i);
  if (avMatch && avMatch[1]) {
    return avMatch[1];
  }
  
  // 短链需要展开后再解析
  return null;
}

/**
 * 检测是否是抖音视频链接
 * 支持格式：
 * - https://www.douyin.com/video/xxx
 * - https://v.douyin.com/xxx（短链）
 */
export function isDouyinVideoUrl(url: string): boolean {
  const douyinPatterns = [
    /douyin\.com\/video\/\d+/i,
    /v\.douyin\.com\/[a-zA-Z0-9]+/i,
    /www\.iesdouyin\.com\/share\/video/i,
  ];
  
  return douyinPatterns.some(pattern => pattern.test(url));
}

/**
 * 从抖音链接中提取视频ID
 * @param url 抖音视频链接
 * @returns 视频ID 或 null
 */
export function extractDouyinVideoId(url: string): string | null {
  const match = url.match(/douyin\.com\/video\/(\d+)/i);
  return match ? match[1] : null;
}

/**
 * 检测是否是小宇宙播客链接
 * 支持格式：
 * - https://www.xiaoyuzhoufm.com/episode/xxx
 * - https://www.xiaoyuzhoufm.com/episodes/xxx
 */
export function isXiaoyuzhouPodcastUrl(url: string): boolean {
  const xyzPatterns = [
    /xiaoyuzhoufm\.com\/episodes?\/[a-zA-Z0-9]+/i,
  ];
  
  return xyzPatterns.some(pattern => pattern.test(url));
}

/**
 * 从小宇宙链接中提取单集ID
 * @param url 小宇宙播客链接
 * @returns 单集ID 或 null
 */
export function extractXiaoyuzhouEpisodeId(url: string): string | null {
  const match = url.match(/xiaoyuzhoufm\.com\/episodes?\/([a-zA-Z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * 检测是否是喜马拉雅播客链接
 * 支持格式：
 * - https://www.ximalaya.com/sound/xxx
 * - https://m.ximalaya.com/xxx
 */
export function isXimalayaPodcastUrl(url: string): boolean {
  const xmlyPatterns = [
    /ximalaya\.com\/sound\/\d+/i,
    /ximalaya\.com\/\w+\/\d+\/\d+/i,
    /m\.ximalaya\.com/i,
  ];
  
  return xmlyPatterns.some(pattern => pattern.test(url));
}

/**
 * 从喜马拉雅链接中提取音频ID
 * @param url 喜马拉雅播客链接
 * @returns 音频ID 或 null
 */
export function extractXimalayaAudioId(url: string): string | null {
  const soundMatch = url.match(/ximalaya\.com\/sound\/(\d+)/i);
  if (soundMatch && soundMatch[1]) {
    return soundMatch[1];
  }
  
  const pathMatch = url.match(/ximalaya\.com\/\w+\/\d+\/(\d+)/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }
  
  return null;
}

/**
 * 从消息文本中提取第一个有效的文章 URL
 * @param text 消息文本
 * @returns 解析结果，如果没有找到则返回 null
 */
export function extractFirstArticleUrl(text: string): ParsedUrl | null {
  const urls = extractUrls(text);
  
  for (const url of urls) {
    const parsed = parseUrl(url);
    if (parsed.type !== UrlType.INVALID) {
      return parsed;
    }
  }

  return null;
}
