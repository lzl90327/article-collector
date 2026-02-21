# MindFlow 自动化测试指南

## 📋 测试概述

本项目包含完整的自动化测试套件，包括：
- **单元测试** (Jest) - 组件和函数测试
- **E2E 测试** (Playwright) - 端到端流程测试
- **样式检查** (ESLint + TypeScript) - 代码质量检查
- **性能测试** - 页面加载和渲染性能

## 🚀 快速开始

### 1. 运行所有测试

```bash
# 在项目根目录运行
./scripts/run-tests.sh all
```

### 2. 运行特定测试

```bash
# 仅运行单元测试
./scripts/run-tests.sh unit

# 仅运行 E2E 测试
./scripts/run-tests.sh e2e

# 仅运行样式检查
./scripts/run-tests.sh style
```

### 3. 使用 npm 命令

```bash
cd frontend

# 单元测试
npm test

# 单元测试（带覆盖率）
npm run test:coverage

# E2E 测试
npm run test:e2e

# E2E 测试（UI 模式）
npm run test:e2e:ui

# 运行所有测试
npm run test:all

# 生成测试报告
npm run test:report
```

## 📁 测试文件结构

```
mindflow-project/
├── frontend/
│   ├── e2e/                          # E2E 测试文件
│   │   └── workflow.spec.ts          # 工作流测试
│   ├── src/
│   │   └── **/*.test.ts              # 单元测试文件
│   ├── playwright.config.ts          # Playwright 配置
│   └── jest.config.js                # Jest 配置
├── backend/
│   └── src/
│       └── **/*.test.ts              # 后端单元测试
└── scripts/
    ├── run-tests.sh                  # 测试运行脚本
    └── generate-test-report.js       # 报告生成工具
```

## 🧪 测试用例说明

### 单元测试

| 测试文件 | 测试内容 |
|---------|---------|
| `BriefCard.test.tsx` | 组件渲染、编辑功能、事件处理 |
| `DraftViewer.test.tsx` | 内容渲染、边界检查、滚动行为 |
| `ChatInterface.test.tsx` | 消息渲染、折叠展开、输入处理 |
| `api.test.ts` | API 接口调用、错误处理 |

### E2E 测试

| 测试场景 | 描述 |
|---------|------|
| 首页加载 | 验证标题、输入框、按钮显示 |
| 创建工作流 | 输入主题、点击开始、跳转验证 |
| Brief 编辑 | 点击编辑、修改内容、保存验证 |
| 角度选择 | 选择角度、输入想法、确认验证 |
| 聊天交互 | 发送消息、接收回复、消息显示 |
| 初稿生成 | 页面加载、内容显示、边界检查 |
| 审计流程 | 点击审计、报告显示、评分验证 |
| 返回修改 | 点击返回、对话框、跳转验证 |

### 样式和布局测试

| 测试项 | 描述 |
|-------|------|
| iPhone 12 响应式 | 390x844 视口测试 |
| iPhone SE 响应式 | 375x667 视口测试 |
| 边界溢出检查 | 检查水平滚动条 |

### 性能测试

| 测试项 | 标准 |
|-------|------|
| 页面加载时间 | < 3 秒 |
| DOM 内容加载 | < 2 秒 |
| 组件渲染 | 无明显卡顿 |

## 📊 测试报告

运行测试后会生成以下报告：

1. **控制台输出** - 实时显示测试进度和结果
2. **覆盖率报告** - `frontend/coverage/lcov-report/index.html`
3. **E2E 报告** - `frontend/playwright-report/index.html`
4. **综合报告** - `TEST-REPORT.md`

## 🔧 配置说明

### Playwright 配置

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:10086',
    viewport: { width: 375, height: 812 },
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
});
```

### Jest 配置

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
```

## 🐛 调试技巧

### E2E 测试调试

```bash
# 调试模式
npm run test:e2e:debug

# UI 模式（可视化操作）
npm run test:e2e:ui

# 单文件测试
npx playwright test e2e/workflow.spec.ts

# 带浏览器显示
npx playwright test --headed
```

### 单元测试调试

```bash
# 监听模式
npm run test:watch

# 单文件测试
npm test -- BriefCard.test.tsx

# 带调试信息
npm test -- --verbose
```

## 📝 添加新测试

### 添加单元测试

```typescript
// src/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 添加 E2E 测试

```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('my feature works', async ({ page }) => {
  await page.goto('http://localhost:10086');
  await page.click('text=Button');
  await expect(page.locator('text=Success')).toBeVisible();
});
```

## 🔄 CI/CD 集成

### GitHub Actions 示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd frontend && npm ci
          cd ../backend && npm ci
          
      - name: Run tests
        run: ./scripts/run-tests.sh all
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 📞 常见问题

### Q: E2E 测试失败，提示页面未加载
A: 确保后端服务已启动：`./scripts/run-tests.sh` 会自动检查并启动

### Q: 测试覆盖率太低
A: 添加更多测试用例，特别是边界条件和错误处理

### Q: Playwright 浏览器未安装
A: 运行 `npx playwright install` 安装浏览器

### Q: 测试超时
A: 增加超时时间或检查网络连接

## 📚 相关文档

- [Jest 文档](https://jestjs.io/)
- [Playwright 文档](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
