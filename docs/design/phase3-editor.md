# Phase 3 设计文档: 编辑器功能开发

## 1. 概述

### 一句话描述
为 MindFlow 小程序开发支持 Markdown 的文章编辑器，实现本地自动保存、多模型 AI 辅助、版本历史管理，并与 Feishu 知识库同步。

### 目标用户
内容创作者，需要通过小程序随时随地进行文章创作和编辑。

### 成功指标
- [ ] 编辑器支持完整的 Markdown 语法
- [ ] 自动保存成功率 99%+
- [ ] Feishu 同步成功率 99%+
- [ ] 支持 DeepSeek + 其他模型的 AI 辅助

---

## 2. 需求分析

### 2.1 功能需求

#### Must-have
- [ ] **Markdown 编辑器**: 支持标准 Markdown 语法（标题、列表、引用、代码块、链接、图片）
- [ ] **本地自动保存**: 编辑时自动保存到本地存储，防止数据丢失
- [ ] **手动保存**: 用户可主动保存并同步到后端
- [ ] **Feishu 同步**: 将文章同步到 Feishu 知识库
- [ ] **文章状态管理**: 支持草稿、已发布等状态

#### Nice-to-have
- [ ] **版本历史**: 保存编辑历史，支持版本回滚
- [ ] **版本对比**: 对比不同版本的差异
- [ ] **AI 辅助**: 集成 DeepSeek 等模型 API，支持续写、润色、审校

### 2.2 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | 编辑器渲染 < 100ms，自动保存不卡顿 |
| 可靠性 | 本地存储 + 后端双重保障 |
| 兼容性 | 支持微信、支付宝等主流小程序平台 |
| 安全 | 敏感操作需要登录验证 |

---

## 3. 技术方案

### 3.1 编辑器选型

选择 **[mp-html](https://github.com/jin-yufeng/mp-html)** 作为渲染引擎，原因：
- 成熟稳定，GitHub 2k+ stars
- 支持 Markdown 渲染
- 支持代码高亮
- 小程序原生支持

### 3.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      小程序前端                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Editor Page │  │  Markdown    │  │  Local Storage   │  │
│  │              │──│  Renderer    │  │  (Taro Storage)  │  │
│  │  - 编辑区    │  │              │  │                  │  │
│  │  - 预览区    │  │  - mp-html   │  │  - 自动保存      │  │
│  │  - 工具栏    │  │  - 代码高亮  │  │  - 版本历史      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                      后端 API                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Article API │  │  Feishu Sync │  │  AI Service      │  │
│  │              │  │              │  │                  │  │
│  │  - CRUD      │  │  - 知识库    │  │  - DeepSeek      │  │
│  │  - 版本管理  │  │  - 文档同步  │  │  - 其他模型      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 数据模型

```typescript
// 文章模型
interface Article {
  id: string;
  title: string;
  content: string;          // Markdown 内容
  contentHtml?: string;     // 渲染后的 HTML
  status: 'draft' | 'published' | 'archived';
  phase: string;            // Skill 阶段
  feishuWikiToken?: string; // Feishu 知识库 token
  createdAt: string;
  updatedAt: string;
}

// 版本历史模型
interface ArticleVersion {
  id: string;
  articleId: string;
  content: string;
  title: string;
  version: number;
  changeSummary?: string;   // 变更摘要（AI 生成）
  createdAt: string;
}

// 本地存储结构
interface LocalDraft {
  articleId: string;
  title: string;
  content: string;
  lastSaved: number;        // 时间戳
  syncStatus: 'synced' | 'pending' | 'conflict';
}
```

### 3.4 API 设计

#### 文章管理 API
```typescript
// 获取文章详情
GET /api/articles/:id

// 创建/更新文章
POST /api/articles
Body: { title, content, status, phase }

// 保存版本历史
POST /api/articles/:id/versions
Body: { content, changeSummary }

// 获取版本列表
GET /api/articles/:id/versions

// 对比版本
GET /api/articles/:id/versions/compare?v1=1&v2=2

// 回滚到指定版本
POST /api/articles/:id/versions/:versionId/rollback
```

#### AI 辅助 API
```typescript
// AI 续写
POST /api/ai/continue
Body: { content, cursorPosition, model: 'deepseek' | 'other' }

// AI 润色
POST /api/ai/polish
Body: { content, style: 'formal' | 'casual' | 'professional' }

// AI 审校
POST /api/ai/review
Body: { content }
Response: { suggestions: Array<{type, position, suggestion, reason}> }
```

#### 赛博编辑部审阅 API (Phase 4.5)
```typescript
// 提交审阅
POST /api/articles/:id/review/submit
Body: { content, title }
Response: { reviewId, status: 'processing' }

// 获取审阅报告
GET /api/articles/:id/review/report
Response: {
  reviewId: string;
  status: 'processing' | 'completed' | 'failed';
  
  // 整合建议（主 Agent - DeepSeek）
  consolidated: {
    summary: string;
    suggestions: ReviewSuggestion[];
  };
  
  // 各智能体独立输出
  agents: {
    logicJudge: AgentReview;      // 逻辑判官 - DeepSeek-Reasoner (R1)
    emotionDetector: AgentReview; // 情感共鸣检测
    subjectivity: AgentReview;    // 主体性注入
    agent4: AgentReview;
    agent5: AgentReview;
    agent6: AgentReview;
    agent7: AgentReview;
  };
}

// 应用审阅建议
POST /api/articles/:id/review/apply
Body: { 
  reviewId: string;
  action: 'accept_all' | 'reject_all' | 'selective';
  selectedSuggestions?: string[]; // selective 时指定
}

interface AgentReview {
  agentName: string;
  model: string;
  status: 'success' | 'error';
  issues: ReviewIssue[];
  summary: string;
  error?: string;
}
```

---

## 4. 实施计划

### 4.1 里程碑

#### 里程碑 1: 基础编辑器 (任务 1-8)
- [ ] 集成 mp-html 组件
- [ ] 实现 Markdown 编辑区
- [ ] 实现实时预览
- [ ] 添加基础工具栏（标题、列表、引用等）

#### 里程碑 2: 保存与同步 (任务 9-15)
- [ ] 本地自动保存机制
- [ ] 后端文章 API 开发
- [ ] Feishu 知识库同步
- [ ] 冲突处理策略

#### 里程碑 3: 版本历史 (任务 16-22)
- [ ] 版本历史存储
- [ ] 版本列表展示
- [ ] 版本回滚功能
- [ ] 版本对比（Nice-to-have）

#### 里程碑 4: AI 辅助 (任务 23-28)
- [ ] DeepSeek API 集成
- [ ] 多模型支持框架
- [ ] AI 续写功能
- [ ] AI 审校功能

#### 里程碑 5: 赛博编辑部审阅 (任务 29-35)
- [ ] 审阅提交 API
- [ ] 7 智能体审阅服务
- [ ] 审阅报告展示页面
- [ ] 一键应用/拒绝建议功能
- [ ] 各智能体意见展开查看
- [ ] 审阅结果本地存储
- [ ] 审阅流程端到端测试

### 4.2 任务清单

| 任务 | 描述 | 预估时间 | 依赖 |
|------|------|----------|------|
| 1 | 安装 mp-html 组件 | 10min | - |
| 2 | 创建编辑器页面框架 | 15min | 1 |
| 3 | 实现 Markdown 编辑区 | 20min | 2 |
| 4 | 实现实时预览区 | 20min | 2 |
| 5 | 添加基础工具栏 | 20min | 3,4 |
| 6 | 编辑器样式优化 | 15min | 5 |
| 7 | 编辑器页面路由配置 | 10min | 2 |
| 8 | 编辑器基础功能测试 | 15min | 6,7 |
| 9 | 本地存储服务封装 | 20min | - |
| 10 | 自动保存逻辑实现 | 20min | 9 |
| 11 | 后端文章 CRUD API | 30min | - |
| 12 | 前端文章 API 对接 | 20min | 11 |
| 13 | Feishu 文档同步服务 | 30min | 11 |
| 14 | 同步冲突处理 | 20min | 13 |
| 15 | 保存同步功能测试 | 15min | 10,14 |
| 16 | 版本历史数据模型 | 15min | 11 |
| 17 | 版本历史 API 开发 | 25min | 16 |
| 18 | 版本列表页面 | 20min | 17 |
| 19 | 版本回滚功能 | 20min | 17 |
| 20 | 版本对比算法 | 25min | 17 |
| 21 | 版本对比页面 | 20min | 20 |
| 22 | 版本功能测试 | 15min | 19,21 |
| 23 | AI 服务配置 | 15min | - |
| 24 | DeepSeek API 封装 | 25min | 23 |
| 25 | AI 续写功能 | 20min | 24 |
| 26 | AI 审校功能 | 25min | 24 |
| 27 | 多模型切换支持 | 20min | 25,26 |
| 28 | AI 功能测试 | 15min | 27 |

**总计: 28 个任务，约 9-10 小时工作量**

### 4.3 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| mp-html 组件兼容性问题 | 高 | 提前在真机测试，准备备选方案 |
| Feishu API 限制 | 中 | 实现重试机制，降级到本地存储 |
| AI API 响应慢 | 中 | 添加 loading 状态，支持取消请求 |
| 版本历史数据量大 | 低 | 限制保存版本数，定期清理旧版本 |

---

## 5. 验证标准

### 5.1 功能验收
- [ ] 可以正常输入 Markdown 并实时预览
- [ ] 自动保存触发正常，数据不丢失
- [ ] 可以成功同步到 Feishu 知识库
- [ ] 版本历史正确记录每次保存
- [ ] AI 续写和审校功能可用

### 5.2 性能验收
- [ ] 编辑器首屏渲染 < 1s
- [ ] 输入响应延迟 < 50ms
- [ ] 自动保存不阻塞用户输入
- [ ] AI 请求响应 < 5s（有 loading 提示）

---

## 6. 依赖项

### 6.1 前端依赖
```json
{
  "mp-html": "^2.5.0",
  "diff-match-patch": "^1.0.5"  // 版本对比
}
```

### 6.2 后端依赖
- DeepSeek API Key
- 其他模型 API Key（按需）

---

**设计文档版本**: v1.0
**创建日期**: 2026-02-21
**状态**: 待审批
