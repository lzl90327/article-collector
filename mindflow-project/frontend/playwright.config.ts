import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置文件
 * 用于 E2E 测试
 */

export default defineConfig({
  testDir: './e2e',
  
  // 完全并行运行测试
  fullyParallel: true,
  
  // 失败时禁止重复测试
  forbidOnly: !!process.env.CI,
  
  // 重试次数
  retries: process.env.CI ? 2 : 0,
  
  // 并行工作线程数
  workers: process.env.CI ? 1 : undefined,
  
  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  
  // 共享配置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:10086',
    
    // 收集追踪信息
    trace: 'on-first-retry',
    
    // 截图配置
    screenshot: 'only-on-failure',
    
    // 视频配置
    video: 'on-first-retry',
    
    // 视口配置（默认 iPhone 尺寸）
    viewport: { width: 375, height: 812 },
    
    // 用户代理
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  },

  // 项目配置
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 }
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 375, height: 812 }
      },
    },
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5']
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12']
      },
    },
  ],

  // 本地开发服务器配置
  webServer: {
    command: 'npm run dev:h5',
    url: 'http://localhost:10086',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
