# MindFlow - 隐页笔记写作工作流

基于「隐页笔记」Skill 规范的完整写作工作流系统，支持双核模式（论证模式/观察模式）和 17 个 Phase 的写作流程。

## 项目概述

MindFlow 是一个 AI 辅助的写作工作流工具，通过结构化的流程帮助用户完成从想法到发布的完整写作过程。系统实现了「隐页笔记」Skill 规范的所有要求，支持热更新和最小成本升级。

## 核心特性

### 双核写作模式

- **论证模式 (Argument Mode)**: 适合结构化论述文章
  - 完整的 15 个 Phase 流程
  - 从 Brief 到发布的完整闭环
  
- **观察模式 (Observation Mode)**: 适合日常观察记录
  - 包含观察片段收集和随想整理
  - 更灵活的写作流程

- **观察随想模式 (Observation Journal Mode)**: 纯记录模式
  - 跳过论证相关 Phase
  - 快速记录和发布

### 17 个 Phase 完整流程

| Phase | 名称 | 说明 |
|-------|------|------|
| -1 | Brief | 写作简报定义 |
| 0 | Material | 素材获取 |
| 0.5 | Pre-Angle | 预选题 |
| 0.8 | Auto-Sync | 自动同步 |
| 1 | Angle Confirmation | 选题确认 |
| 1.5 | Breakthrough | 切入点选择 |
| 2 | Discussion | 观点探讨 |
| 2-C | Observation Collection | 观察片段收集 |
| 2-D | Observation Journal | 观察随想整理 |
| 3 | Convergence | 观点收敛 |
| 4 | Drafting | 草稿生成 |
| 4.3 | Light Review | 轻量审阅 |
| 4.5 | Audit | 深度审核 |
| 4.8 | Images | 配图生成 |
| 5 | Publish | 发布 |
| 5.5 | Viewpoint | 观点提炼 |
| 6 | Retro | 发布后复盘 |

### MCP 服务集成

- **DeepSeek**: 辩论模拟、案例搜索
- **CyberEditorial**: 赛博编辑部多维度审计

### 发布平台支持

- **飞书**: 文档创建、内容同步
- **微信公众号**: 图文发布、草稿管理

## 技术架构

### 后端架构

```
backend/
├── src/
│   ├── core/
│   │   ├── config/          # 配置管理（PhaseLoader）
│   │   ├── engine/          # 工作流引擎
│   │   ├── phases/          # Phase 处理器
│   │   ├── services/        # MCP 服务
│   │   ├── artifact/        # 制品管理
│   │   ├── gating/          # 门控规则
│   │   └── mode/            # 模式路由
│   └── routes/              # API 路由
├── config/                  # Skill 配置
│   ├── phases/              # Phase 配置
│   └── triggers/            # 触发器配置
└── prisma/                  # 数据库模型
```

### 前端架构

```
frontend/
├── src/
│   ├── pages/
│   │   └── workflow/        # 工作流页面
│   │       └── components/  # Phase 组件
│   ├── types/               # 类型定义
│   └── api/                 # API 调用
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- PostgreSQL (可选，用于数据持久化)

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd mindflow-project

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 配置

1. 创建后端环境变量文件 `backend/.env`:

```env
# DeepSeek API
DEEPSEEK_API_KEY=your_api_key

# 飞书配置（可选）
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# 微信配置（可选）
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
```

2. 配置数据库（可选）:

```bash
cd backend
npx prisma migrate dev
```

### 启动开发服务器

```bash
# 启动后端
cd backend
npm run dev

# 启动前端（新终端）
cd frontend
npm run dev:weapp
```

## 使用指南

### 创建新文章

1. 在首页点击「新建文章」
2. 系统自动检测写作模式
3. 按照 Phase 流程逐步完成写作

### 模式切换

系统会自动根据输入内容检测写作模式：

- **论证模式信号**: "我认为", "本质是", "问题在于", "应该/不应该"
- **观察模式信号**: "今天", "刚刚", "在路上", "看到/听到"

### 发布文章

在 Phase 5 (Publish) 中：

1. 选择发布平台（飞书/微信/同时发布）
2. 确认发布配置
3. 等待发布完成
4. 获取发布链接

## 热更新机制

MindFlow 支持 Skill 配置的热更新：

```bash
# 修改 backend/config/phases/ 下的配置文件
# 系统会自动检测变更并热重载

# 查看配置状态
curl http://localhost:3000/api/config/status

# 手动触发重载
curl -X POST http://localhost:3000/api/config/reload
```

详见 [热更新文档](docs/HOT_UPDATE.md)

## 测试

```bash
# 运行后端测试
cd backend
npm test

# 运行特定测试
npm test -- --testPathPattern="PhaseHandlers"

# 检查 Skill 规范符合性
npm run check:skill-compliance
```

## 项目文档

- [热更新机制](docs/HOT_UPDATE.md) - 配置热更新详细说明
- [Skill 规范符合性](docs/SKILL_COMPLIANCE.md) - 规范检查清单
- [API 文档](docs/API.md) - 后端 API 接口文档

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

[MIT](LICENSE)

## 致谢

- 「隐页笔记」Skill 规范设计
- DeepSeek AI 服务
- 飞书开放平台
- 微信公众平台

---

**MindFlow** - 让写作像流水一样自然
