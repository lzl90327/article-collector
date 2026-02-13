/**
 * URL 解析工具单元测试
 */

import {
  extractUrls,
  isValidArticleUrl,
  cleanUrl,
  parseUrl,
  UrlType,
  extractFeishuDocToken,
  extractFeishuWikiToken,
} from '../../src/utils/url-parser';

describe('extractUrls', () => {
  it('应该从文本中提取 URL', () => {
    const text = '查看这篇文章 https://example.com/article 和 https://test.com/page';
    const urls = extractUrls(text);

    expect(urls).toContain('https://example.com/article');
    expect(urls).toContain('https://test.com/page');
    expect(urls).toHaveLength(2);
  });

  it('应该处理没有 URL 的文本', () => {
    const text = '这是一段没有链接的文本';
    const urls = extractUrls(text);

    expect(urls).toHaveLength(0);
  });

  it('应该提取微信公众号文章链接', () => {
    const text = 'https://mp.weixin.qq.com/s?__biz=MzA1Mz...';
    const urls = extractUrls(text);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('mp.weixin.qq.com');
  });

  it('应该处理多个相同 URL 的情况', () => {
    const text = '链接1: https://example.com 链接2: https://example.com';
    const urls = extractUrls(text);

    // 实际实现会提取到 URL（可能去重也可能不去重，取决于实现）
    expect(urls.length).toBeGreaterThanOrEqual(1);
    expect(urls).toContain('https://example.com');
  });
});

describe('isValidArticleUrl', () => {
  it('应该识别有效的文章 URL', () => {
    expect(isValidArticleUrl('https://example.com/article')).toBe(true);
    expect(isValidArticleUrl('https://mp.weixin.qq.com/s/xxx')).toBe(true);
    expect(isValidArticleUrl('https://zhuanlan.zhihu.com/p/123')).toBe(true);
  });

  it('应该拒绝无效的 URL', () => {
    expect(isValidArticleUrl('')).toBe(false);
    expect(isValidArticleUrl('not-a-url')).toBe(false);
    expect(isValidArticleUrl('ftp://example.com/file')).toBe(false);
  });

  it('应该拒绝文件下载链接', () => {
    expect(isValidArticleUrl('https://example.com/file.pdf')).toBe(false);
    expect(isValidArticleUrl('https://example.com/image.jpg')).toBe(false);
  });
});

describe('cleanUrl', () => {
  it('应该移除跟踪参数', () => {
    const url = 'https://example.com/article?utm_source=newsletter&utm_medium=email';
    const cleaned = cleanUrl(url);

    expect(cleaned).not.toContain('utm_source');
    expect(cleaned).not.toContain('utm_medium');
    expect(cleaned).toBe('https://example.com/article');
  });

  it('应该保留必要的参数', () => {
    const url = 'https://example.com/article?id=123&page=2';
    const cleaned = cleanUrl(url);

    expect(cleaned).toContain('id=123');
    expect(cleaned).toContain('page=2');
  });

  it('应该处理没有参数的 URL', () => {
    const url = 'https://example.com/article';
    const cleaned = cleanUrl(url);

    expect(cleaned).toBe(url);
  });
});

describe('parseUrl', () => {
  it('应该识别微信公众号文章', () => {
    const result = parseUrl('https://mp.weixin.qq.com/s/xxx');
    expect(result.type).toBe(UrlType.WECHAT_ARTICLE);
  });

  it('应该识别知乎文章', () => {
    const result = parseUrl('https://zhuanlan.zhihu.com/p/123456');
    expect(result.type).toBe(UrlType.ZHIHU_ARTICLE);
  });

  it('应该识别 B 站视频', () => {
    const result = parseUrl('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(result.type).toBe(UrlType.BILIBILI_VIDEO);
  });

  it('应该识别小红书笔记', () => {
    const result = parseUrl('https://www.xiaohongshu.com/explore/123456');
    expect(result.type).toBe(UrlType.XIAOHONGSHU);
  });

  it('应该识别飞书文档', () => {
    const result = parseUrl('https://feishu.cn/docx/AbCdEfGh');
    expect(result.type).toBe(UrlType.FEISHU_DOC);
  });

  it('应该识别飞书知识库', () => {
    const result = parseUrl('https://feishu.cn/wiki/AbCdEfGh');
    expect(result.type).toBe(UrlType.FEISHU_WIKI);
  });

  it('应该将未知 URL 标记为通用文章', () => {
    const result = parseUrl('https://example.com/article');
    expect(result.type).toBe(UrlType.GENERIC);
  });
});

describe('extractFeishuDocToken', () => {
  it('应该从飞书文档 URL 中提取 token', () => {
    const url = 'https://feishu.cn/docx/AbCdEfGh123';
    const token = extractFeishuDocToken(url);

    expect(token).toBe('AbCdEfGh123');
  });

  it('应该处理包含查询参数的 URL', () => {
    const url = 'https://feishu.cn/docx/AbCdEfGh123?from=from_parent_note';
    const token = extractFeishuDocToken(url);

    expect(token).toBe('AbCdEfGh123');
  });

  it('应该对无效 URL 返回 null', () => {
    expect(extractFeishuDocToken('https://example.com')).toBeNull();
    expect(extractFeishuDocToken('')).toBeNull();
  });
});

describe('extractFeishuWikiToken', () => {
  it('应该从飞书知识库 URL 中提取 token', () => {
    const url = 'https://feishu.cn/wiki/AbCdEfGh123';
    const token = extractFeishuWikiToken(url);

    expect(token).toBe('AbCdEfGh123');
  });

  it('应该处理包含查询参数的 URL', () => {
    const url = 'https://feishu.cn/wiki/AbCdEfGh123?from=space_home';
    const token = extractFeishuWikiToken(url);

    expect(token).toBe('AbCdEfGh123');
  });

  it('应该对无效 URL 返回 null', () => {
    expect(extractFeishuWikiToken('https://example.com')).toBeNull();
    expect(extractFeishuWikiToken('')).toBeNull();
  });
});
