import { test, expect } from '@playwright/test';

/**
 * MindFlow 工作流 E2E 测试
 * 
 * 测试完整的工作流程:
 * 1. 首页加载
 * 2. 创建工作流
 * 3. Brief 编辑
 * 4. 角度选择
 * 5. 聊天交互
 * 6. 初稿生成
 * 7. 审计流程
 */

test.describe('MindFlow 完整工作流测试', () => {
  
  test.beforeEach(async ({ page }) => {
    // 设置视口为 iPhone 尺寸
    await page.setViewportSize({ width: 375, height: 812 });
    
    // 访问小程序 H5 版本
    await page.goto('http://localhost:10086');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test('首页加载测试', async ({ page }) => {
    // 检查标题
    await expect(page.locator('text=MindFlow')).toBeVisible();
    
    // 检查输入框
    await expect(page.locator('textarea[placeholder*="我想写一篇"]')).toBeVisible();
    
    // 检查开始按钮
    await expect(page.locator('button:has-text("开始写作")')).toBeVisible();
  });

  test('创建工作流测试', async ({ page }) => {
    // 输入主题
    const textarea = page.locator('textarea');
    await textarea.fill('AI焦虑的本质与应对');
    
    // 点击开始按钮
    await page.click('button:has-text("开始写作")');
    
    // 等待跳转到工作流页面
    await page.waitForURL(/\/pages\/workflow\/index/);
    
    // 等待 Brief 页面加载
    await expect(page.locator('text=写作 Brief')).toBeVisible({ timeout: 10000 });
  });

  test('Brief 编辑功能测试', async ({ page }) => {
    // 等待 Brief 页面
    await expect(page.locator('text=写作 Brief')).toBeVisible();
    
    // 检查所有 section
    await expect(page.locator('text=核心主张')).toBeVisible();
    await expect(page.locator('text=目标读者')).toBeVisible();
    await expect(page.locator('text=读者现状')).toBeVisible();
    await expect(page.locator('text=改变目标')).toBeVisible();
    
    // 点击编辑按钮
    await page.click('text=点击编辑');
    
    // 等待弹窗出现
    await expect(page.locator('.edit-modal')).toBeVisible();
    
    // 编辑内容
    const editTextarea = page.locator('.edit-textarea');
    await editTextarea.fill('这是编辑后的内容');
    
    // 点击保存
    await page.click('.edit-btn-save');
    
    // 等待弹窗关闭
    await expect(page.locator('.edit-modal')).not.toBeVisible();
  });

  test('确认并生成切入点测试', async ({ page }) => {
    // 等待 Brief 页面
    await expect(page.locator('text=写作 Brief')).toBeVisible();
    
    // 点击确认按钮
    await page.click('button:has-text("确认并生成切入点")');
    
    // 等待角度选择页面
    await expect(page.locator('text=选择切入点')).toBeVisible({ timeout: 15000 });
  });

  test('角度选择测试', async ({ page }) => {
    // 等待角度选择页面
    await expect(page.locator('text=选择切入点')).toBeVisible();
    
    // 选择一个角度（第一个）
    await page.click('.angle-card:first-child');
    
    // 输入补充想法
    const thoughtsInput = page.locator('.thoughts-input');
    await thoughtsInput.fill('我希望从这个角度深入探讨');
    
    // 点击确认
    await page.click('button:has-text("确认选择")');
    
    // 等待聊天界面
    await expect(page.locator('.chat-container')).toBeVisible({ timeout: 15000 });
  });

  test('聊天交互测试', async ({ page }) => {
    // 等待聊天界面
    await expect(page.locator('.chat-container')).toBeVisible();
    
    // 发送消息
    const input = page.locator('.chat-input-textarea');
    await input.fill('请帮我优化这个角度');
    
    await page.click('button:has-text("发送")');
    
    // 等待 AI 回复（检查消息气泡）
    await expect(page.locator('.bubble-ai').first()).toBeVisible({ timeout: 10000 });
  });

  test('初稿页面边界管理测试', async ({ page }) => {
    // 假设已经在初稿页面
    await page.goto('http://localhost:10086/#/pages/workflow/index?id=test&phase=3');
    
    // 检查页面内容
    await expect(page.locator('text=文章初稿')).toBeVisible();
    
    // 检查内容是否溢出（通过检查滚动）
    const content = page.locator('.draft-content');
    const scrollWidth = await content.evaluate(el => el.scrollWidth);
    const clientWidth = await content.evaluate(el => el.clientWidth);
    
    // 确保内容没有水平溢出
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 允许 1px 误差
  });

  test('审计流程测试', async ({ page }) => {
    // 假设已经在初稿页面
    await page.goto('http://localhost:10086/#/pages/workflow/index?id=test&phase=3');
    
    // 点击确认并审计
    await page.click('button:has-text("确认并审计")');
    
    // 等待审计报告页面
    await expect(page.locator('text=审计报告')).toBeVisible({ timeout: 15000 });
    
    // 检查评分显示
    await expect(page.locator('.total-score')).toBeVisible();
  });

  test('返回修改功能测试', async ({ page }) => {
    // 假设已经在初稿页面
    await page.goto('http://localhost:10086/#/pages/workflow/index?id=test&phase=3');
    
    // 点击返回修改
    await page.click('button:has-text("返回修改")');
    
    // 等待确认对话框
    await expect(page.locator('text=返回修改')).toBeVisible();
    
    // 选择直接返回
    await page.click('button:has-text("直接返回")');
    
    // 等待回到聊天界面
    await expect(page.locator('.chat-container')).toBeVisible();
  });
});

test.describe('样式和布局测试', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('响应式布局测试 - iPhone 12', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:10086');
    
    // 检查布局是否正常
    await expect(page.locator('.mindflow-home')).toBeVisible();
  });

  test('响应式布局测试 - iPhone SE', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:10086');
    
    // 检查布局是否正常
    await expect(page.locator('.mindflow-home')).toBeVisible();
  });

  test('边界溢出检查', async ({ page }) => {
    await page.goto('http://localhost:10086');
    
    // 获取 body 元素
    const body = page.locator('body');
    
    // 检查是否有水平滚动条（表示溢出）
    const hasOverflow = await body.evaluate(el => {
      return el.scrollWidth > el.clientWidth;
    });
    
    expect(hasOverflow).toBeFalsy();
  });
});

test.describe('性能测试', () => {
  
  test('页面加载性能', async ({ page }) => {
    // 记录加载时间
    const startTime = Date.now();
    
    await page.goto('http://localhost:10086');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // 页面加载时间应该小于 3 秒
    expect(loadTime).toBeLessThan(3000);
  });

  test('组件渲染性能', async ({ page }) => {
    await page.goto('http://localhost:10086');
    
    // 使用 Performance API 测量
    const metrics = await page.evaluate(() => {
      return {
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
      };
    });
    
    // DOM 内容加载应该小于 2 秒
    expect(metrics.domContentLoaded).toBeLessThan(2000);
  });
});
