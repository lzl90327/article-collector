# MindFlow 完整流程图

## 后端 Phase 定义 (backend/src/core/engine/types.ts)

```typescript
enum Phase {
  BRIEF = -1,        // 生成 Brief
  MATERIAL = 0,      // (未使用)
  INSIGHT = 1,       // (未使用)
  BREAKTHROUGH = 1.5, // 生成角度
  DISCUSSION = 2,    // 讨论/聊天
  CONVERGENCE = 3,   // (未使用)
  DRAFTING = 4,      // 生成初稿
  AUDIT = 4.5,       // 审计报告
  PUBLISH = 5,       // 最终润色
  RETRO = 6          // (未使用)
}
```

## 前端期望的 Phase 映射

| 前端显示 | 后端 Phase | 说明 |
|---------|-----------|------|
| 首页输入 | -1 (BRIEF) | 用户输入主题 |
| Brief 页面 | 1.5 (BREAKTHROUGH) | 确认 Brief，生成角度 |
| 角度选择 | 2 (DISCUSSION) | 选择角度 |
| 聊天讨论 | 2 (DISCUSSION) | 多轮对话 |
| 初稿页面 | 4 (DRAFTING) | 显示初稿 |
| 审计报告 | 4.5 (AUDIT) | 显示审计结果 |

## 实际后端流程

```
用户输入主题
    ↓
Phase -1 (BRIEF) - 生成 Brief
    ↓
Phase 1.5 (BREAKTHROUGH) - 生成角度
    ↓
Phase 2 (DISCUSSION) - 讨论/聊天
    ↓
Phase 4 (DRAFTING) - 生成初稿
    ↓
Phase 4.5 (AUDIT) - 审计
    ↓
Phase 5 (PUBLISH) - 最终润色
```

## 问题分析

### 问题1：没有大纲阶段
- 后端确实没有大纲阶段（Phase 2.5/CONVERGENCE）
- 从 DISCUSSION 直接跳到 DRAFTING
- 这是设计如此，不是 Bug

### 问题2：页面叠加显示
- 前端条件判断：`(state.currentPhase === 4.5 || state.currentPhase === 4)`
- 导致 DraftViewer 和 AuditReport 同时显示
- 需要改为互斥条件

### 问题3：Phase 值不匹配
- 前端使用 1.5, 2, 3, 4, 4.5
- 后端使用 -1, 1.5, 2, 4, 4.5, 5
- 需要统一映射

## 修复方案

### 前端修复
1. 移除 `(state.currentPhase === 4.5 || state.currentPhase === 4)` 的错误条件
2. 使用精确的 Phase 值判断
3. 添加调试日志

### 后端修复
1. 确保每个 Phase 都有正确的处理逻辑
2. 返回正确的 Phase 值给前端

## 正确的条件渲染逻辑

```tsx
// Phase -1: Brief 生成中
{state.currentPhase === -1 && !state.context?.brief && <Loading />}

// Phase 1.5: 显示 Brief 和角度
{state.currentPhase === 1.5 && <BriefCard />}

// Phase 2: 角度选择和聊天
{state.currentPhase === 2 && !state.context?.selectedAngle && <AngleSelector />}
{state.currentPhase === 2 && state.context?.selectedAngle && <ChatInterface />}

// Phase 4: 显示初稿
{state.currentPhase === 4 && <DraftViewer />}

// Phase 4.5: 显示审计报告
{state.currentPhase === 4.5 && <AuditReport />}

// Phase 5: 显示最终文章
{state.currentPhase === 5 && <FinalArticle />}
```
