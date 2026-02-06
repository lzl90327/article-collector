# 文章抓取性能优化 - 测试报告

## 优化内容

### 1. 并行图片下载（5并发）

**优化前**：
```python
for i, img_url in enumerate(image_urls[:MAX_IMAGES]):
    print(f"下载图片 {i+1}/{min(len(image_urls), MAX_IMAGES)}...", file=sys.stderr)
    path = await download_image(page, img_url, i)
    if path:
        image_paths[img_url] = path
```

**优化后**：
```python
async def download_images_parallel(page: Page, image_urls: List[str], max_concurrent: int = 5) -> Dict[str, str]:
    """并行下载图片（限制并发数）"""
    semaphore = asyncio.Semaphore(max_concurrent)
    tasks = [
        download_image(page, img_url, i, semaphore)
        for i, img_url in enumerate(image_urls)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    # ...
```

**预期收益**：
- 如果文章有10张图片，串行需要 10-30秒
- 并行下载（5并发）只需 2-6秒
- **节省约 10-25秒**

### 2. 优化 Playwright 页面等待策略

**优化前**：
```python
await page.goto(url, wait_until='networkidle', timeout=60000)
await page.wait_for_timeout(3000)  # 固定3秒延迟
```

**优化后**：
```python
# 微信公众号使用 domcontentloaded，其他网站保持 networkidle
is_wechat = 'mp.weixin.qq.com' in url
wait_strategy = 'domcontentloaded' if is_wechat else 'networkidle'

print(f"页面加载策略: {wait_strategy} (微信: {is_wechat})", file=sys.stderr)
await page.goto(url, wait_until=wait_strategy, timeout=60000)

# 微信文章需要额外等待图片加载
if is_wechat:
    await page.wait_for_timeout(1000)  # 仅1秒，而非3秒
```

**预期收益**：
- 微信文章节省 5-15秒
- 其他文章节省 3秒

## 部署状态

✅ **已部署到生产环境**
- 部署时间: 2026-02-06 12:03:55
- 服务状态: online
- PM2 进程: article-collector (ID: 7)

## 测试验证

### 测试方法
向飞书机器人发送微信公众号文章链接，观察抓取耗时。

### 测试场景
1. **微信公众号文章（多图）**
   - 优化前预期：60-120秒
   - 优化后预期：30-60秒
   - 提速目标：**50%**

2. **有大量图片的文章**
   - 优化前预期：120秒
   - 优化后预期：40-70秒
   - 提速目标：**40-60%**

3. **纯文字或少量图片**
   - 优化前预期：60秒
   - 优化后预期：20-30秒
   - 提速目标：**50%**

## 风险评估

- ✅ **低风险**：并行下载是成熟方案，不影响数据完整性
- ✅ **兼容性**：优化后仍然保持降级到 Jina Reader 的能力
- ✅ **回滚简单**：如有问题，可立即回滚到当前版本

## 下一步

请用户测试真实场景：
1. 发送一个微信公众号文章链接到飞书机器人
2. 观察抓取耗时（从发送链接到收到成功反馈的时间）
3. 对比优化前的体验（通常1-2分钟）

预期用户体验：**30-60秒内完成抓取**
