#!/usr/bin/env python3
"""
文章抓取器 v2.1
- 获取完整 HTML 内容（不截断）
- 下载文章图片到临时目录
- 使用 BeautifulSoup 清理 HTML
- 使用 markdownify 转换为 Markdown
- AI 只提取元信息（标题、作者、发布时间）
"""

import asyncio
import json
import sys
import re
import os
import tempfile
import base64
import uuid
from typing import Optional, Dict, Any, List, Tuple
import httpx
from playwright.async_api import async_playwright, Page
from bs4 import BeautifulSoup
import markdownify


# 百度千帆 DeepSeek API 配置
API_KEY = "bce-v3/ALTAK-8kFBIsY0Rmc5wtRbMaJTX/1be9a24a8a32dbfb5d7c0bf818261af57c70aa5c"
API_URL = "https://qianfan.baidubce.com/v2/chat/completions"
MODEL = "deepseek-v3.2"

# 图片临时目录
TEMP_IMAGE_DIR = os.path.join(tempfile.gettempdir(), 'article-collector-images')


def ensure_temp_dir():
    """确保临时目录存在"""
    if not os.path.exists(TEMP_IMAGE_DIR):
        os.makedirs(TEMP_IMAGE_DIR)


async def download_image(page: Page, img_url: str, index: int) -> Optional[str]:
    """
    下载图片 - 使用 Playwright 的 request API（更可靠）
    返回保存的临时文件路径
    """
    try:
        # 方法1：使用 Playwright 的 request context 下载（推荐）
        try:
            response = await page.context.request.get(img_url)
            if response.ok:
                img_bytes = await response.body()
                if img_bytes and len(img_bytes) > 1000:  # 有效图片至少 1KB
                    # 确定文件扩展名
                    ext = '.jpg'
                    content_type = response.headers.get('content-type', '')
                    if 'png' in content_type or 'png' in img_url:
                        ext = '.png'
                    elif 'gif' in content_type or 'gif' in img_url:
                        ext = '.gif'
                    elif 'webp' in content_type or 'webp' in img_url:
                        ext = '.webp'
                    
                    # 保存到临时文件
                    ensure_temp_dir()
                    filename = f"img_{uuid.uuid4().hex[:8]}_{index}{ext}"
                    filepath = os.path.join(TEMP_IMAGE_DIR, filename)
                    
                    with open(filepath, 'wb') as f:
                        f.write(img_bytes)
                    
                    print(f"图片 {index+1} 下载成功: {len(img_bytes)} bytes -> {filename}", file=sys.stderr)
                    return filepath
        except Exception as e1:
            print(f"方法1失败: {e1}", file=sys.stderr)
        
        # 方法2：使用浏览器 fetch（备选）
        try:
            img_data = await page.evaluate('''async (url) => {
                try {
                    // 尝试多种方式
                    const response = await fetch(url, {
                        method: 'GET',
                        mode: 'no-cors',
                        cache: 'force-cache'
                    });
                    
                    const blob = await response.blob();
                    if (blob.size < 1000) return null;
                    
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64 = reader.result.split(',')[1];
                            resolve(base64);
                        };
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    return null;
                }
            }''', img_url)
            
            if img_data:
                img_bytes = base64.b64decode(img_data)
                if len(img_bytes) > 1000:
                    ext = '.jpg'
                    if 'png' in img_url: ext = '.png'
                    elif 'gif' in img_url: ext = '.gif'
                    elif 'webp' in img_url: ext = '.webp'
                    
                    ensure_temp_dir()
                    filename = f"img_{uuid.uuid4().hex[:8]}_{index}{ext}"
                    filepath = os.path.join(TEMP_IMAGE_DIR, filename)
                    
                    with open(filepath, 'wb') as f:
                        f.write(img_bytes)
                    
                    print(f"图片 {index+1} (方法2) 下载成功: {len(img_bytes)} bytes", file=sys.stderr)
                    return filepath
        except Exception as e2:
            print(f"方法2失败: {e2}", file=sys.stderr)
        
        print(f"图片下载失败: {img_url[:80]}...", file=sys.stderr)
        return None
        
    except Exception as e:
        print(f"图片下载异常: {e}", file=sys.stderr)
        return None


def process_html_with_images(html: str, image_paths: Dict[str, str]) -> Tuple[str, List[Dict[str, str]]]:
    """
    处理 HTML，将图片替换为占位符，返回处理后的 HTML 和图片信息
    image_paths: {原始URL: 本地文件路径}
    """
    soup = BeautifulSoup(html, 'html.parser')
    
    # 移除脚本、样式、iframe 等
    for tag in soup.find_all(['script', 'style', 'noscript', 'iframe', 'svg', 'canvas']):
        tag.decompose()
    
    # 移除微信特有的广告和推荐元素
    for selector in [
        '.qr_code_pc_outer', '.rich_media_tool', '.weui-footer',
        '#js_pc_qr_code', '.reward_area', '#js_tags', '.original_area_wrap',
    ]:
        for elem in soup.select(selector):
            elem.decompose()
    
    # 处理图片
    images_info = []
    img_index = 0
    
    for img in soup.find_all('img'):
        # 获取图片 URL（微信使用 data-src）
        img_url = img.get('data-src') or img.get('src') or ''
        
        # 跳过表情包等小图
        if not img_url or 'emoji' in img_url.lower() or len(img_url) < 20:
            img.decompose()
            continue
        
        # 检查是否已下载
        if img_url in image_paths and image_paths[img_url]:
            # 替换为特殊占位符
            placeholder = f'{{{{IMG:{img_index}}}}}'
            images_info.append({
                'index': img_index,
                'url': img_url,
                'path': image_paths[img_url],
                'alt': img.get('alt', ''),
            })
            img.replace_with(placeholder)
            img_index += 1
        else:
            # 图片下载失败，显示占位文字
            alt = img.get('alt', '')
            if alt:
                img.replace_with(f'[图片: {alt}]')
            else:
                img.decompose()
    
    return str(soup), images_info


def html_to_markdown_with_images(html: str, images_info: List[Dict[str, str]]) -> str:
    """将 HTML 转换为 Markdown，保留图片占位符"""
    # 转换为 Markdown
    md = markdownify.markdownify(
        html,
        heading_style="ATX",
        bullets="-",
        strip=['a'],
    )
    
    # 清理多余的空行
    md = re.sub(r'\n{3,}', '\n\n', md)
    md = md.strip()
    
    # 将占位符转换为 Markdown 图片语法
    for img_info in images_info:
        placeholder = f'{{{{IMG:{img_info["index"]}}}}}'
        # 使用特殊标记，Node.js 会识别并替换
        md_img = f'![IMG:{img_info["index"]}](LOCAL:{img_info["path"]})'
        md = md.replace(placeholder, md_img)
    
    return md


async def fetch_page_data_with_images(url: str) -> Dict[str, Any]:
    """使用 Playwright 获取完整的网页数据，包括下载图片"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            await page.goto(url, wait_until='networkidle', timeout=60000)
            await page.wait_for_timeout(3000)
            
            # 获取文章主体的完整 HTML
            html_content = await page.evaluate('''() => {
                const wxContent = document.querySelector('#js_content, .rich_media_content');
                if (wxContent) return wxContent.innerHTML;
                const article = document.querySelector('article, .Post-RichText, .article-content, main, .content');
                if (article) return article.innerHTML;
                return document.body.innerHTML;
            }''')
            
            # 获取元信息
            title = await page.evaluate('''() => {
                const wxTitle = document.querySelector('#activity-name, .rich_media_title');
                if (wxTitle) return wxTitle.innerText.trim();
                const og = document.querySelector('meta[property="og:title"]');
                if (og && og.content) return og.content;
                const h1 = document.querySelector('h1');
                if (h1) return h1.innerText.trim();
                return document.title;
            }''')
            
            author = await page.evaluate('''() => {
                const wxAuthor = document.querySelector('#js_name, .rich_media_meta_text, .profile_nickname');
                if (wxAuthor) return wxAuthor.innerText.trim();
                const meta = document.querySelector('meta[name="author"]');
                if (meta && meta.content) return meta.content;
                return '';
            }''')
            
            publish_time = await page.evaluate('''() => {
                const wxTime = document.querySelector('#publish_time, .rich_media_meta_list em');
                if (wxTime) return wxTime.innerText.trim();
                const time = document.querySelector('time');
                if (time) return time.innerText.trim() || time.getAttribute('datetime');
                return '';
            }''')
            
            # 提取所有图片 URL
            image_urls = await page.evaluate('''() => {
                const images = document.querySelectorAll('#js_content img, .rich_media_content img');
                const urls = [];
                images.forEach(img => {
                    const url = img.getAttribute('data-src') || img.src;
                    if (url && url.startsWith('http') && !url.includes('emoji')) {
                        urls.push(url);
                    }
                });
                return urls;
            }''')
            
            print(f"发现 {len(image_urls)} 张图片", file=sys.stderr)
            
            # 下载图片（限制数量，避免太慢）
            MAX_IMAGES = 20
            image_paths = {}
            
            for i, img_url in enumerate(image_urls[:MAX_IMAGES]):
                print(f"下载图片 {i+1}/{min(len(image_urls), MAX_IMAGES)}...", file=sys.stderr)
                path = await download_image(page, img_url, i)
                if path:
                    image_paths[img_url] = path
            
            return {
                'html': html_content,
                'title': title,
                'author': author,
                'publish_time': publish_time,
                'image_paths': image_paths,
            }
            
        finally:
            await browser.close()


async def extract_metadata_with_ai(title: str, author: str, publish_time: str, content_preview: str) -> Dict[str, Any]:
    """使用 AI 提取/优化元信息"""
    if title and len(title) > 3:
        formatted_time = None
        if publish_time:
            date_match = re.search(r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})', publish_time)
            if date_match:
                formatted_time = f"{date_match.group(1)}-{date_match.group(2).zfill(2)}-{date_match.group(3).zfill(2)}"
        
        return {
            'title': title.strip(),
            'author': author.strip() if author else '',
            'publishTime': formatted_time,
        }
    
    prompt = f"""从以下网页信息中提取文章元信息：

网页标题: {title}
作者信息: {author}
时间信息: {publish_time}
内容前500字: {content_preview[:500]}

请返回 JSON 格式：
{{"title": "文章标题", "author": "作者名", "publishTime": "YYYY-MM-DD或null"}}

只返回 JSON，不要其他内容。"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                API_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {API_KEY}"
                },
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                if result and 'choices' in result and len(result['choices']) > 0:
                    ai_content = result['choices'][0]['message']['content']
                    json_match = re.search(r'\{[\s\S]*\}', ai_content)
                    if json_match:
                        return json.loads(json_match.group())
    except Exception as e:
        print(f"AI 提取元信息失败: {e}", file=sys.stderr)
    
    return {
        'title': title or '未知标题',
        'author': author or '',
        'publishTime': None,
    }


async def fetch_article(url: str) -> Dict[str, Any]:
    """抓取文章的主函数"""
    try:
        # 1. 获取网页数据和图片
        print(f"正在获取网页: {url}", file=sys.stderr)
        page_data = await fetch_page_data_with_images(url)
        
        html_content = page_data.get('html', '')
        if not html_content:
            raise Exception("网页内容获取失败：HTML 为空")
        
        image_paths = page_data.get('image_paths', {})
        print(f"HTML 获取成功，长度: {len(html_content)}, 图片: {len(image_paths)} 张", file=sys.stderr)
        
        # 2. 处理 HTML 和图片
        print("正在处理 HTML 和图片...", file=sys.stderr)
        processed_html, images_info = process_html_with_images(html_content, image_paths)
        
        # 3. 转换为 Markdown
        print("正在转换为 Markdown...", file=sys.stderr)
        markdown_content = html_to_markdown_with_images(processed_html, images_info)
        print(f"Markdown 转换完成，长度: {len(markdown_content)}", file=sys.stderr)
        
        if len(markdown_content) < 100:
            raise Exception(f"内容太短: {len(markdown_content)} 字符")
        
        # 4. 提取元信息
        print("正在提取元信息...", file=sys.stderr)
        metadata = await extract_metadata_with_ai(
            page_data.get('title', ''),
            page_data.get('author', ''),
            page_data.get('publish_time', ''),
            markdown_content
        )
        
        title = metadata.get('title', '未知标题')
        print(f"文章标题: {title}", file=sys.stderr)
        print(f"文章作者: {metadata.get('author', 'N/A')}", file=sys.stderr)
        print(f"包含图片: {len(images_info)} 张", file=sys.stderr)
        
        # 5. 返回结果
        return {
            'title': title,
            'author': metadata.get('author', ''),
            'publishTime': metadata.get('publishTime'),
            'content': markdown_content,
            'images': images_info,  # 图片信息列表
        }
        
    except Exception as e:
        import traceback
        print(f"错误: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"error": str(e)}


async def main():
    """主函数"""
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
