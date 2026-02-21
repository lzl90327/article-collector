# MindFlow 内容创作平台

> 将「隐页笔记」Skill 的工作流复刻到小程序，支持随时随地进行内容创作和管理。

---

## 📖 项目概述

MindFlow 是一个面向内容创作者的全流程写作平台，复刻了「隐页笔记」Coze Skill 的 6 阶段写作工作流：

```
构思(-1) → Brief(0) → 资料收集(0.5) → 突破观点(1) → 观点讨论(1.5) 
→ 观点收敛(2) → 大纲(2.5) → 草稿(3) → 审校(3.5) → 审核(4) 
→ 预发布(4.5) → 发布(5) → 归档(5.5) → 完成(6)
```

### 核心特性

- 📝 **Markdown 编辑器**：实时预览，自动保存，支持标准 Markdown 语法
- 🤖 **赛博编辑部**：7 位 AI 编辑并行审阅，多维度优化内容
- 📚 **素材库**：与 Feishu 多维表格同步，分类管理素材
- 🔄 **全链路同步**：支持 Feishu 知识库和微信公众号发布
- 📱 **移动端优先**：随时随地进行创作和审阅

---

## 🏗️ 技术架构

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      小程序前端 (Taro 3.x)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 工作台   │ │ 素材库   │ │ 编辑器   │ │ 我的     │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                      后端 API (Express)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 用户管理 │ │ 文章管理 │ │ 素材同步 │ │ 审阅服务 │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      数据层                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ PostgreSQL   │ │ Feishu API   │ │ Coze Skill   │       │
│  │ (Prisma ORM) │ │ (知识库)     │ │ (AI 审阅)    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 小程序 | Taro + React + TypeScript | 3.6+ |
| 后端 | Node.js + Express | 18+ |
| 数据库 | PostgreSQL + Prisma | 15+ |
| 缓存 | Taro Storage | - |
| 测试 | Jest + Supertest | 29+ |

---

## 📁 项目结构

```
article-collector/
├── mindflow-client/          # 小程序前端
│   ├── src/
│   │   ├── api/             # API 客户端 (10 个模块)
│   │   ├── components/      # 公共组件 (Loading, Empty, ErrorBoundary)
│   │   ├── pages/           # 页面 (8 个)
│   │   ├── utils/           # 工具函数
│   │   └── app.ts           # 应用入口
│   └── package.json
│
├── mindflow-project/backend/ # 后端服务
│   ├── src/
│   │   ├── routes/          # API 路由
│   │   ├── services/        # 业务逻辑
│   │   ├── middleware/      # 中间件
│   │   └── types/           # 类型定义
│   ├── prisma/
│   │   └── schema.prisma    # 数据库模型
│   ├── tests/               # 测试套件
│   └── package.json
│
└── docs/design/             # 设计文档
    ├── phase1-backend.md
    ├── phase2-frontend.md
    ├── phase3-editor.md
    └── phase4-testing.md
```

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 15+ (或 Supabase)
- 微信开发者工具

### 安装依赖

```bash
# 后端
cd mindflow-project/backend
npm install

# 小程序
cd mindflow-client
npm install
```

### 配置环境变量

```bash
# mindflow-project/backend/.env
DATABASE_URL="postgresql://user:password@localhost:5432/mindflow"
JWT_SECRET="your-secret-key"
FEISHU_APP_ID="your-feishu-app-id"
FEISHU_APP_SECRET="your-feishu-app-secret"
COZE_API_KEY="your-coze-api-key"
```

### 数据库初始化

```bash
cd mindflow-project/backend
npx prisma migrate dev
npx prisma generate
```

### 启动服务

```bash
# 后端开发模式
npm run dev

# 小程序开发模式
cd mindflow-client
npm run dev:weapp
```

---

## 📱 功能模块

### 1. 工作台
- 进行中的任务展示
- 快捷入口（新建文章、素材库、记录灵感、同步数据）
- 实时同步状态

### 2. 素材库
- Feishu 多维表格同步
- 分类浏览（文章、视频、音频、图片）
- 搜索和筛选

### 3. 编辑器
- Markdown 编辑 + 实时预览
- 自动保存（3秒延迟）
- 工具栏（标题、加粗、列表、代码等）
- 本地存储 + 服务器同步

### 4. 赛博编辑部
- 7 位 AI 编辑并行审阅
  - 逻辑判官 (DeepSeek-Reasoner)
  - 情感共鸣 (GPT-4)
  - 主体性注入 (Claude-3)
  - 结构优化、文风润色、事实核查、受众分析
- 整合建议展示
- 一键应用/拒绝修改

### 5. 我的
- 用户信息管理
- 想法记录
- 设置

---

## 🧪 测试

```bash
# 运行所有测试
cd mindflow-project/backend
npm test

# 运行特定测试
npm test -- tests/integration/api.basic.test.ts

# 生成覆盖率报告
npm run test:coverage
```

---

## 📋 待办事项

### 高优先级
- [ ] Coze Skill 集成（审阅流程触发）
- [ ] Feishu API 配置（知识库同步）
- [ ] AI 模型配置（DeepSeek、GPT-4、Claude）
- [ ] 微信小程序上线配置

### 中优先级
- [ ] 版本历史功能
- [ ] 协作编辑
- [ ] 性能优化

### 低优先级
- [ ] 深色模式
- [ ] 多语言支持

---

## 📊 项目统计

| 指标 | 数值 |
|------|------|
| 开发阶段 | 4 个 Phase |
| 总任务数 | 125 个 |
| 前端页面 | 8 个 |
| API 模块 | 10 个 |
| 数据库模型 | 10 个 |
| 测试用例 | 7 个 |
| 代码行数 | 15,000+ |

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Taro](https://taro.zone/) - 小程序开发框架
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [Feishu](https://open.feishu.cn/) - 飞书开放平台
- [Coze](https://www.coze.cn/) - AI 应用开发平台

---

**项目完成日期**: 2026-02-21  
**版本**: v1.0.0
