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

  // 通用网页
  return {
    type: UrlType.GENERIC,
    url: trimmedUrl,
    sourceName: inferSourceFromUrl(trimmedUrl),
  };
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
