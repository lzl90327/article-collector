# MindFlow 小程序测试指南

本文档描述了 MindFlow 小程序的测试策略、测试用例和运行方法。

## 测试架构

### 测试层次

```
┌─────────────────────────────────────────────────────────────┐
│                     E2E 测试 (Playwright)                    │
│              测试完整用户流程，模拟真实用户操作               │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   集成测试 (Integration)                     │
│              测试多个组件/模块的协作和交互                    │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    单元测试 (Unit Tests)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  组件测试     │  │  API 测试    │  │  工具函数测试 │      │
│  │  Components  │  │  API Layer   │  │   Utils      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 测试工具

- **Jest**: 单元测试框架
- **React Testing Library**: 组件测试工具
- **Playwright**: E2E 测试工具
- **ts-jest**: TypeScript 支持

## 测试配置

### 文件结构

```
mindflow-client/
├── jest.config.js              # Jest 配置文件
├── jest.setup.ts               # 测试环境初始化
├── src/
│   ├── __mocks__/              # Mock 文件
│   │   ├── taro.ts             # Taro API Mock
│   │   ├── taro-components.ts  # Taro 组件 Mock
│   │   └── nutui-react-taro.ts # NutUI 组件 Mock
│   ├── __tests__/              # 测试文件
│   │   ├── api.test.ts         # API 层测试
│   │   ├── utils/              # 工具函数测试
│   │   │   └── request.test.ts
│   │   └── components/         # 组件测试
│   │       ├── BriefCard.test.tsx
│   │       ├── AngleSelector.test.tsx
│   │       └── ...
│   └── types/                  # 类型定义
│       ├── workflow.ts
│       ├── api.ts
│       └── index.ts
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e

# 运行代码检查
npm run lint

# 自动修复代码问题
npm run lint:fix

# 类型检查
npm run typecheck
```

## 单元测试

### API 层测试

测试文件: `src/__tests__/api.test.ts`

测试内容:
- `startWorkflow`: 启动工作流
  - ✓ 成功启动工作流
  - ✓ 处理空输入
  - ✓ 处理网络错误
  - ✓ 处理服务器错误

- `getWorkflowState`: 获取工作流状态
  - ✓ 成功获取状态
  - ✓ 处理 404 错误

- `sendChatMessage`: 发送聊天消息
  - ✓ 成功发送消息
  - ✓ 处理空消息
  - ✓ 处理特殊字符

- `sendChatMessageStream`: 流式发送消息
  - ✓ 建立流式连接
  - ✓ 处理流式数据块
  - ✓ 处理流式错误

- `triggerPhase`: 触发阶段转换
  - ✓ 成功触发转换
  - ✓ 支持传递数据
  - ✓ 处理转换失败

### 工具函数测试

测试文件: `src/__tests__/utils/request.test.ts`

测试内容:
- `request`: 通用请求函数
  - ✓ 成功发送 GET 请求
  - ✓ 成功发送 POST 请求
  - ✓ 处理 200-299 状态码
  - ✓ 处理 300+ 状态码错误
  - ✓ 处理 400+ 状态码错误
  - ✓ 处理 500+ 状态码错误
  - ✓ 处理网络错误
  - ✓ 显示错误提示

- `streamRequest`: 流式请求函数
  - ✓ 建立流式请求
  - ✓ 处理流式数据块
  - ✓ 处理多个数据块
  - ✓ 处理中文字符
  - ✓ 处理特殊字符
  - ✓ 处理空数据块
  - ✓ 请求完成时调用 onComplete
  - ✓ 请求失败时调用 onError
  - ✓ H5 降级方案

### 组件测试

#### BriefCard 组件

测试文件: `src/__tests__/components/BriefCard.test.tsx`

测试内容:
- ✓ 正确渲染 Brief 数据
- ✓ 允许编辑 Brief 内容
- ✓ 点击确认按钮时调用 onConfirm
- ✓ 确认时传递更新后的数据
- ✓ loading 状态时禁用按钮
- ✓ loading 时显示加载状态
- ✓ data 为 null 时返回 null
- ✓ data 变化时更新表单
- ✓ 支持多行文本输入
- ✓ 正确处理所有字段的编辑

#### AngleSelector 组件

测试文件: `src/__tests__/components/AngleSelector.test.tsx`

测试内容:
- ✓ 正确渲染角度列表
- ✓ 允许选择角度
- ✓ 允许多选角度
- ✓ 允许取消选择
- ✓ 点击确认时调用 onConfirm
- ✓ 未选择时禁用确认按钮
- ✓ 点击刷新时调用 onRefresh
- ✓ loading 时禁用按钮
- ✓ data 为 null 时返回 null
- ✓ 显示角度评分
- ✓ 区分主流和异见标签

## Mock 数据

### 工作流状态

```typescript
const mockWorkflowState = {
  workflowId: 'test-workflow-id',
  currentPhase: -1, // -1 | 1.5 | 2 | 3 | 4 | 4.5 | 5
  context: {
    brief: {
      thesis: '核心主张',
      target_audience: '目标读者',
      existing_belief: '读者现状',
      change_goal: '改变目标',
    },
    angles: {
      mainstream: [],
      contrarian: [],
    },
    selectedAngle: '',
    draft: '',
    auditReport: null,
  },
  history: [],
};
```

### 消息

```typescript
const mockMessage = {
  role: 'user' | 'assistant' | 'system',
  content: '消息内容',
  timestamp: Date.now(),
};
```

### 角度

```typescript
const mockAngle = {
  title: '角度标题',
  argument: '论证内容',
  score: {
    R: 8, // 相关性
    N: 7, // 新颖性
    C: 9, // 可信度
  },
};
```

## 测试覆盖率目标

| 类别 | 目标覆盖率 | 当前状态 |
|------|-----------|----------|
| 语句 (Statements) | ≥ 80% | 🔄 进行中 |
| 分支 (Branches) | ≥ 70% | 🔄 进行中 |
| 函数 (Functions) | ≥ 80% | 🔄 进行中 |
| 行 (Lines) | ≥ 80% | 🔄 进行中 |

## 编写测试的最佳实践

### 1. 测试命名

使用描述性的测试名称，说明被测试的内容和期望的结果:

```typescript
// ✅ 好的命名
it('应该在点击确认按钮时调用 onConfirm', () => {
  // ...
});

// ❌ 差的命名
it('test onConfirm', () => {
  // ...
});
```

### 2. 测试结构

使用 Arrange-Act-Assert (AAA) 模式:

```typescript
it('应该成功发送消息', async () => {
  // Arrange: 准备测试数据
  const mockResponse = { state: mockWorkflowState };
  (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

  // Act: 执行被测试的操作
  const result = await sendChatMessage('workflow-123', '测试消息');

  // Assert: 验证结果
  expect(result).toEqual(mockResponse);
});
```

### 3. 使用 Mock

对于外部依赖，使用 Mock:

```typescript
// Mock Taro API
jest.mock('@tarojs/taro');

// Mock 组件
jest.mock('@nutui/nutui-react-taro', () => ({
  Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));
```

### 4. 清理和重置

在每个测试后清理 Mock:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

## CI/CD 集成

### GitHub Actions 配置

```yaml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run typecheck
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 调试测试

### 使用 VS Code 调试

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "runtimeArgs": [
        "--inspect-brk",
        "${workspaceRoot}/node_modules/.bin/jest",
        "--runInBand"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 使用 console.log

在测试中使用 `console.log` 调试:

```typescript
it('应该调试某些内容', () => {
  const result = someFunction();
  console.log('Result:', result);
  expect(result).toBeDefined();
});
```

## 常见问题

### Q: 测试运行很慢怎么办？

A: 
1. 使用 `--testPathPattern` 只运行特定测试
2. 使用 `--maxWorkers` 限制并行工作线程
3. 检查是否有耗时的异步操作未正确 Mock

### Q: 如何处理异步操作？

A:
```typescript
// 使用 waitFor 等待异步操作完成
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// 使用 act 包装状态更新
await act(async () => {
  await userEvent.click(button);
});
```

### Q: 如何测试样式？

A:
```typescript
// 使用 toHaveStyle
expect(element).toHaveStyle('background-color: rgb(255, 255, 255)');

// 使用 toHaveClass
expect(element).toHaveClass('active');
```

## 更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-02-17 | 1.0.0 | 初始版本，包含基础测试架构和 API 层测试 |

---

如有问题，请联系开发团队。
