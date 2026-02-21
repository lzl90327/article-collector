/**
 * ChatInterface 滚动功能 E2E 测试
 * 使用 Playwright 或 Puppeteer 运行
 * 
 * 运行方式:
 * 1. 确保 H5 服务器在运行: npm run dev:h5
 * 2. 运行测试: npx playwright test e2e/chat-scroll.test.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:10086';

// 辅助函数：等待页面加载
async function waitForPage(page, phase) {
  await page.goto(`${BASE_URL}/#/pages/workflow/index?id=test-workflow-id`);
  await page.waitForLoadState('networkidle');
  
  // 等待特定 phase 的组件渲染
  if (phase === 2) {
    await page.waitForSelector('.chat-container', { timeout: 10000 });
  } else if (phase === 1.5) {
    await page.waitForSelector('.angle-selector', { timeout: 10000 });
  }
}

// 辅助函数：获取滚动位置
async function getScrollPosition(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  }, selector);
}

// 辅助函数：检查是否在底部
async function isScrolledToBottom(page, selector, threshold = 50) {
  const pos = await getScrollPosition(page, selector);
  if (!pos) return false;
  return pos.scrollHeight - pos.scrollTop - pos.clientHeight < threshold;
}

test.describe('ChatInterface 滚动功能测试', () => {
  
  test('Phase 2 页面应该显示输入框和发送按钮', async ({ page }) => {
    // Mock API 响应，直接进入 Phase 2
    await page.route('**/api/mindflow/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/state')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            workflowId: 'test-id',
            currentPhase: 2,
            context: {
              selectedAngle: '测试切入点',
              brief: { thesis: '测试论点' }
            },
            history: [
              { role: 'system', content: '系统消息' },
              { role: 'user', content: '用户问题' },
              { role: 'assistant', content: 'AI回复' },
            ]
          })
        });
      } else {
        await route.continue();
      }
    });

    await waitForPage(page, 2);

    // 验证输入框存在
    const input = await page.locator('.chat-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', '输入你的想法...');

    // 验证发送按钮存在
    const sendBtn = await page.locator('.send-btn');
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toHaveText('发送');

    // 验证消息列表存在
    const messages = await page.locator('.message-row');
    await expect(messages).toHaveCount(3); // 过滤后应该显示3条
  });

  test('发送消息后应该自动滚动到底部', async ({ page }) => {
    // Mock API 响应
    await page.route('**/api/mindflow/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/state')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            workflowId: 'test-id',
            currentPhase: 2,
            context: { selectedAngle: '测试切入点' },
            history: [
              { role: 'assistant', content: '初始消息' },
            ]
          })
        });
      } else if (url.includes('/chat')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            state: {
              workflowId: 'test-id',
              currentPhase: 2,
              context: { selectedAngle: '测试切入点' },
              history: [
                { role: 'assistant', content: '初始消息' },
                { role: 'user', content: '测试消息' },
                { role: 'assistant', content: 'AI回复' },
              ]
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    await waitForPage(page, 2);

    // 先滚动到顶部
    await page.evaluate(() => {
      const el = document.querySelector('.chat-history');
      if (el) el.scrollTop = 0;
    });

    // 等待滚动完成
    await page.waitForTimeout(300);

    // 输入并发送消息
    await page.fill('.chat-input', '测试消息');
    await page.click('.send-btn');

    // 等待消息渲染
    await page.waitForTimeout(500);

    // 验证是否滚动到底部
    const isAtBottom = await isScrolledToBottom(page, '.chat-history');
    expect(isAtBottom).toBe(true);
  });

  test('长消息应该有折叠功能', async ({ page }) => {
    const longContent = 'a'.repeat(300); // 超过200字符

    await page.route('**/api/mindflow/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workflowId: 'test-id',
          currentPhase: 2,
          context: { selectedAngle: '测试切入点' },
          history: [
            { role: 'assistant', content: longContent },
          ]
        })
      });
    });

    await waitForPage(page, 2);

    // 验证折叠提示存在
    const expandHint = await page.locator('.expand-hint');
    await expect(expandHint).toBeVisible();
    await expect(expandHint).toHaveText('点击展开更多');

    // 点击展开
    await expandHint.click();
    await page.waitForTimeout(400);

    // 验证收起提示出现
    const collapseHint = await page.locator('.collapse-hint');
    await expect(collapseHint).toBeVisible();
    await expect(collapseHint).toHaveText('点击收起');
  });

  test('展开长消息后应该自动滚动', async ({ page }) => {
    const longContent = 'a'.repeat(500);

    await page.route('**/api/mindflow/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workflowId: 'test-id',
          currentPhase: 2,
          context: { selectedAngle: '测试切入点' },
          history: [
            { role: 'assistant', content: longContent },
          ]
        })
      });
    });

    await waitForPage(page, 2);

    // 记录展开前的滚动位置
    const posBefore = await getScrollPosition(page, '.chat-history');

    // 点击展开
    await page.click('.expand-hint');
    await page.waitForTimeout(500);

    // 验证滚动位置有变化（应该向下滚动）
    const posAfter = await getScrollPosition(page, '.chat-history');
    expect(posAfter.scrollTop).toBeGreaterThan(posBefore.scrollTop);
  });
});

test.describe('AngleSelector 滚动功能测试', () => {
  
  test('Phase 1.5 页面应该可以滚动', async ({ page }) => {
    const angles = {
      mainstream: Array(5).fill(null).map((_, i) => ({
        title: `主流角度 ${i + 1}`,
        argument: `论点 ${i + 1}`,
        score: { R: 8, N: 7, C: 9 }
      })),
      contrarian: Array(5).fill(null).map((_, i) => ({
        title: `异见角度 ${i + 1}`,
        argument: `论点 ${i + 1}`,
        score: { R: 7, N: 8, C: 6 }
      }))
    };

    await page.route('**/api/mindflow/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workflowId: 'test-id',
          currentPhase: 1.5,
          context: { angles },
          history: []
        })
      });
    });

    await waitForPage(page, 1.5);

    // 验证角度卡片存在
    const cards = await page.locator('.angle-card');
    await expect(cards).toHaveCount(10); // 5主流 + 5异见

    // 验证容器可以滚动
    const container = await page.locator('.angle-selector');
    await expect(container).toHaveCSS('overflow-y', 'auto');

    // 尝试滚动
    await container.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });

    const scrollTop = await container.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });
});

// 运行测试前的准备
test.beforeAll(async () => {
  console.log('开始 E2E 测试...');
  console.log(`目标 URL: ${BASE_URL}`);
});

test.afterAll(async () => {
  console.log('E2E 测试完成');
});
