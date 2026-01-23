#!/usr/bin/env python3
"""
文章抓取器
使用 Playwright 抓取网页内容，DeepSeek AI 提取结构化信息
"""

import asyncio
import json
import sys
import os
import re
from typing import Optional
import httpx
from playwright.async_api import async_playwright


# 百度千帆 DeepSeek API 配置
API_KEY = "bce-v3/ALTAK-8kFBIsY0Rmc5wtRbMaJTX/1be9a24a8a32dbfb5d7c0bf818261af57c70aa5c"
API_URL = "https://qianfan.baidubce.com/v2/chat/completions"
MODEL = "deepseek-v3.2"


async def fetch_page_content(url: str) -> str:
    """使用 Playwright 获取网页内容"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            await page.goto(url, wait_until='networkidle', timeout=30000)
            # 等待内容加载
            await page.wait_for_timeout(2000)
            
            # 获取页面文本内容
            content = await page.evaluate('''() => {
                // 移除脚本和样式
                const scripts = document.querySelectorAll('script, style, noscript');
                scripts.forEach(s => s.remove());
                
                // 获取主要内容区域
                const article = document.querySelector('article, .rich_media_content, #js_content, .Post-RichText, .article-content, main, .content');
                if (article) {
                    return article.innerText;
                }
                return document.body.innerText;
            }''')
            
            # 获取标题
            title = await page.title()
            
            # 尝试获取 meta 信息
            meta_title = await page.evaluate('''() => {
                const og = document.querySelector('meta[property="og:title"]');
                if (og) return og.content;
                const h1 = document.querySelector('h1');
                if (h1) return h1.innerText;
                return '';
            }''')
            
            meta_author = await page.evaluate('''() => {
                const og = document.querySelector('meta[property="og:article:author"], meta[name="author"]');
                if (og) return og.content;
                const author = document.querySelector('.rich_media_meta_text, .UserLink-link, .author-name');
                if (author) return author.innerText;
                return '';
            }''')
            
            return json.dumps({
                'title': meta_title or title,
                'author': meta_author,
                'content': content[:15000]  # 限制内容长度
            }, ensure_ascii=False)
            
        finally:
            await browser.close()


async def extract_with_ai(page_data: str, url: str) -> dict:
    """使用 DeepSeek AI 提取结构化信息"""
    
    # 解析已有的基础数据
    try:
        base_data = json.loads(page_data)
        existing_title = base_data.get('title', '')
        existing_author = base_data.get('author', '')
        content_text = base_data.get('content', '')[:8000]  # 限制内容长度
    except:
        existing_title = ''
        existing_author = ''
        content_text = page_data[:8000]
    
    prompt = f"""你是一个网页内容提取专家。请从以下信息中整理文章。

已提取的标题: {existing_title}
已提取的作者: {existing_author}
网页正文内容:
{content_text}

原始URL: {url}

请返回 JSON 格式结果：
1. title: 使用已提取的标题，或从内容推断
2. author: 使用已提取的作者，或从内容中查找"作者"、"文/"等标识
3. publishTime: 发布时间（格式 YYYY-MM-DD，找不到则为 null）
4. content: 整理后的文章正文（Markdown 格式，保留格式，去除广告）

只返回 JSON：
{{"title": "...", "author": "...", "publishTime": null, "content": "..."}}"""

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            API_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {API_KEY}"
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"API 请求失败: {response.status_code} - {response.text}")
        
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        print(f"AI 原始响应: {content[:500]}...", file=sys.stderr)
        
        # 提取 JSON - 尝试多种方式
        # 方式1: 直接匹配 JSON
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError as e:
                print(f"JSON 解析失败: {e}", file=sys.stderr)
        
        # 方式2: 尝试从 markdown 代码块提取
        code_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', content)
        if code_match:
            try:
                return json.loads(code_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # 方式3: 如果 AI 没有返回 JSON，尝试手动构建
        print("尝试手动构建结果...", file=sys.stderr)
        return {
            "title": existing_title or "未知标题",
            "author": existing_author or "",
            "publishTime": None,
            "content": content_text[:5000] if content_text else content[:5000]
        }


async def fetch_article(url: str) -> dict:
    """抓取文章的主函数"""
    try:
        # 1. 使用 Playwright 获取网页内容
        print(f"正在获取网页: {url}", file=sys.stderr)
        page_data = await fetch_page_content(url)
        print(f"网页内容获取成功，长度: {len(page_data)}", file=sys.stderr)
        
        # 2. 使用 AI 提取结构化信息
        print("正在调用 AI 提取信息...", file=sys.stderr)
        result = await extract_with_ai(page_data, url)
        print(f"AI 提取完成: {result.get('title', 'N/A')}", file=sys.stderr)
        
        return result
        
    except Exception as e:
        import traceback
        print(f"错误: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"error": str(e)}


async def main():
    """主函数：从命令行参数读取 URL 并抓取"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "请提供文章 URL"}), file=sys.stdout)
        sys.exit(1)
    
    url = sys.argv[1]
    
    try:
        result = await fetch_article(url)
        print(json.dumps(result, ensure_ascii=False), file=sys.stdout)
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stdout)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
