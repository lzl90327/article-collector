# MindFlow 架构文档

## 系统概述

MindFlow 是一个符合"隐页笔记"Skill 规范的写作工作流工具，支持双核模式（论证模式/观察模式），提供从素材获取到发布的完整写作流程。

## 核心架构

### 1. 配置化架构 (Phase 1)

```
/backend/config/
├── skill-manifest.json          # Skill 元数据和热升级配置
├── phases/                      # 17 个 Phase 配置
│   ├── phase--1-brief.json
│   ├── phase-0-material.json
│   └── ... (共17个)
└── triggers/triggers.json       # 触发词配置
```

**核心组件：**
- **PhaseLoader**: 动态加载 Phase 配置，支持热升级
- **ModeRouter**: 双核模式路由（argument_mode/observation_mode）
- **ArtifactManager**: 产物版本管理
- **GatingRules**: 阶段间硬屏障验证

### 2. Phase 处理器 (Phase 2)

**17 个 Phase Handlers：**

| Phase | 名称 | 类型 |
|-------|------|------|
| 0 | Material | 可选 |
| 0.5 | Pre-Angle | 可选 |
| 0.8 | Auto-Sync | 可选 |
| 1 | Angle Confirmation | 可选 |
| -1 | Brief | 核心 |
| 1.5 | Breakthrough | 核心 |
| 2 | Discussion | 核心 |
| 2-C | Observation Collection | 观察模式 |
| 2-D | Observation Journal | 观察模式 |
| 3 | Convergence | 核心 |
| 4 | Drafting | 核心 |
| 4.3 | Light Review | 审阅 |
| 4.5 | Audit | 审阅 |
| 4.8 | Images | 发布准备 |
| 5 | Publish | 发布 |
| 5.5 | Viewpoint | 发布后续 |
| 6 | Retro | 复盘 |

### 3. 双核模式 (Phase 3)

**论证模式流程：**
```
Brief → Breakthrough → Discussion → Convergence → Drafting → Light Review → Audit → Images → Publish → Viewpoint → Retro
```

**观察模式流程：**
```
Brief → Observation Collection → Observation Journal → Light Review → Images → Publish → Viewpoint → Retro
```

### 4. 交互契约 (Phase 4)

**核心组件：**
- **ActionRegistry**: Action 注册和执行
- **SubstateManager**: 子状态管理
- **PendingInputManager**: 待输入管理

### 5. 外部服务集成 (Phase 5)

**DeepSeekService:**
- 对话生成 (chatCompletion)
- 辩论问题生成 (generateDebateQuestions)
- 案例搜索 (searchRelevantCases)
- 草稿生成 (generateDraft)
- 文章审核 (auditArticle)

**FeishuService:**
- 文档创建/更新 (createDocument/updateDocument)
- 素材搜索 (searchMaterials)
- 同步到飞书 (syncToDocument)

## 数据流

```
用户输入 → ModeRouter (模式检测)
    ↓
WorkflowEngine (工作流引擎)
    ↓
PhaseHandler (Phase 处理器)
    ↓
ActionRegistry/SubstateManager/PendingInputManager (交互契约)
    ↓
ArtifactManager (产物管理)
    ↓
外部服务 (DeepSeek/Feishu)
    ↓
GatingRules (门控验证)
    ↓
下一 Phase
```

## 热升级机制

1. **文件监听**: 监控 `/backend/config/` 目录
2. **配置验证**: JSON Schema 验证
3. **备份回滚**: 自动备份，失败时回滚
4. **事件通知**: 通过 EventEmitter 通知引擎更新

## 测试策略

- **单元测试**: 每个 Handler 独立测试
- **集成测试**: 完整工作流测试
- **双核模式测试**: 模式切换和流程验证

## 部署架构

```
Frontend (React/TypeScript)
    ↕ REST API / WebSocket
Backend (Node.js/TypeScript)
    ├── Core Layer (Phase/Mode/Artifact/Gating)
    ├── Service Layer (DeepSeek/Feishu)
    └── Config Layer (JSON Configs)
```

## 扩展点

1. **新增 Phase**: 继承 PhaseHandler，注册到 PhaseHandlerRegistry
2. **新增模式**: 在 ModeRouter 中添加模式检测逻辑
3. **新增服务**: 实现 Service 接口，注册到 ServiceContainer
