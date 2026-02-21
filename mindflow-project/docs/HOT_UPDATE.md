# MindFlow 热更新机制文档

## 概述

MindFlow 支持 Skill 的热更新机制，允许在 Skill 配置发生变化时，系统能够以最小成本进行升级，而无需重启服务或中断用户的工作流。

## 热更新架构

### 核心组件

```
┌─────────────────────────────────────────────────────────────────┐
│                      Hot Update Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Config     │───▶│ PhaseLoader  │───▶│   Cache      │      │
│  │   Files      │    │  (Watcher)   │    │  (Memory)    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                                     │
│         │                   ▼                                     │
│         │            ┌──────────────┐                            │
│         │            │  Event Bus   │                            │
│         │            └──────────────┘                            │
│         │                   │                                     │
│         ▼                   ▼                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Backup     │    │  Validation  │───▶│   Rollback   │      │
│  │   Store      │    │   Engine     │    │   Handler    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 热更新流程

```
1. 文件变更检测
   │
   ▼
2. 备份当前配置
   │
   ▼
3. 加载新配置
   │
   ▼
4. 验证配置有效性
   │
   ├── 验证失败 ──▶ 回滚到备份
   │
   ▼
5. 验证通过
   │
   ▼
6. 更新内存缓存
   │
   ▼
7. 通知所有订阅者
   │
   ▼
8. 记录更新日志
```

## 配置结构

### Skill Manifest

```json
{
  "skill": {
    "name": "隐页笔记",
    "version": "2.4.1",
    "hot_upgrade": {
      "enabled": true,
      "backup_count": 3,
      "validation": true,
      "auto_rollback": true
    }
  }
}
```

### Phase 配置

每个 Phase 都有独立的 JSON 配置文件：

```
/backend/config/
├── skill-manifest.json
├── phases/
│   ├── phase--1-brief.json
│   ├── phase-0-material.json
│   ├── phase-1.5-breakthrough.json
│   └── ...
└── triggers/
    └── triggers.json
```

## 热更新 API

### PhaseLoader 类

```typescript
export class PhaseLoader extends EventEmitter {
  // 初始化并启动文件监听
  async initialize(): Promise<void>;
  
  // 手动触发重载
  async reload(): Promise<ReloadResult>;
  
  // 获取当前配置
  getPhaseConfig(phaseId: string): PhaseConfig | undefined;
  
  // 获取所有配置
  getAllPhases(): Map<string, PhaseConfig>;
  
  // 事件监听
  on(event: 'config:changed', listener: (change: ConfigChange) => void): this;
  on(event: 'config:error', listener: (error: ConfigError) => void): this;
}
```

### 配置变更事件

```typescript
interface ConfigChange {
  type: 'added' | 'modified' | 'deleted';
  phaseId: string;
  timestamp: Date;
  previousVersion?: PhaseConfig;
  currentVersion: PhaseConfig;
}

interface ConfigError {
  phaseId: string;
  error: Error;
  timestamp: Date;
  autoRollback: boolean;
}
```

## 对现有功能的影响

### 1. 工作流状态

**影响程度：低**

- 工作流状态（WorkflowState）存储在数据库中，不受配置变更影响
- 当前正在执行的 Phase 会继续使用旧配置完成
- 新启动的工作流会使用最新配置

**处理策略：**
```typescript
// 在 Phase 切换时检查配置版本
if (state.configVersion !== currentConfigVersion) {
  // 记录版本差异，但不中断执行
  logger.info(`Config version mismatch: ${state.configVersion} -> ${currentConfigVersion}`);
}
```

### 2. 进行中的工作流

**影响程度：中**

- 已加载的 Phase Handler 实例不会立即更新
- 需要等待下一次 Phase 切换时才使用新配置
- 建议在工作流完成后再进行重大配置变更

**最佳实践：**
- 避免在用户活跃时段更新核心 Phase（如 Drafting、Audit）
- 使用蓝绿部署策略：先更新到绿色环境，验证后再切换

### 3. 制品（Artifacts）

**影响程度：无**

- 已生成的 Artifact 不受影响
- Artifact 类型定义变更需要版本控制

### 4. 前端组件

**影响程度：低**

- 前端通过 API 获取当前 Phase 信息
- 配置变更后，前端会自动获取最新配置
- 可能需要刷新页面才能看到新 Phase 的 UI 组件

## 热更新限制

### 不支持热更新的变更

1. **数据库 Schema 变更**
   - 需要停机迁移
   - 建议通过独立的迁移脚本处理

2. **API 接口变更**
   - 需要保持向后兼容
   - 重大变更需要版本升级

3. **核心架构变更**
   - Phase Handler 类结构变更
   - 工作流引擎核心逻辑变更

### 支持热更新的变更

1. **Phase 配置调整**
   - 字段定义修改
   - 提示词模板更新
   - 模型参数调整

2. **触发器规则**
   - 新增/修改触发器
   - 优先级调整

3. **过渡规则**
   - Phase 流转条件
   - 门控规则

## 回滚机制

### 自动回滚

当配置验证失败时，系统自动回滚到上一个有效版本：

```typescript
// PhaseLoader 中的回滚逻辑
private async handleConfigError(error: ConfigError): Promise<void> {
  if (this.manifest.hot_upgrade.auto_rollback) {
    const backup = await this.backupStore.getLatest();
    await this.restoreFromBackup(backup);
    this.emit('config:rollback', { error, backup });
  }
}
```

### 手动回滚

通过 API 手动触发回滚：

```typescript
// 回滚到指定版本
await phaseLoader.rollbackTo(version);

// 回滚到上一个版本
await phaseLoader.rollback();
```

## 监控与日志

### 更新事件日志

```typescript
// 记录所有配置变更
logger.info('Config updated', {
  phaseId: change.phaseId,
  type: change.type,
  version: change.currentVersion.skill.version,
  timestamp: change.timestamp
});
```

### 健康检查

```typescript
// 检查配置有效性
const health = await phaseLoader.healthCheck();

// 返回结果
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  phases: {
    total: 17,
    valid: 17,
    invalid: 0
  },
  lastUpdate: Date,
  backupAvailable: true
}
```

## 最佳实践

### 1. 配置版本控制

```json
{
  "skill": {
    "version": "2.4.1",
    "changelog": [
      {
        "version": "2.4.1",
        "date": "2024-01-15",
        "changes": ["优化 Drafting Phase 提示词"]
      }
    ]
  }
}
```

### 2. 渐进式更新

1. 先在测试环境验证配置
2. 更新单个非关键 Phase
3. 观察一段时间无异常
4. 逐步更新其他 Phase

### 3. 更新窗口

```typescript
// 检查是否为更新窗口
function isUpdateWindow(): boolean {
  const hour = new Date().getHours();
  // 建议在凌晨 2-6 点更新
  return hour >= 2 && hour <= 6;
}
```

### 4. 配置验证

在部署前验证配置：

```bash
# 验证所有配置文件
npm run validate:config

# 验证特定 Phase
npm run validate:config -- --phase=4.5
```

## 故障排除

### 常见问题

1. **配置加载失败**
   - 检查 JSON 语法
   - 验证必要字段
   - 查看错误日志

2. **Phase 找不到**
   - 确认 phase ID 正确
   - 检查配置文件路径
   - 验证 manifest 中的 phase 列表

3. **更新未生效**
   - 检查文件监听是否正常
   - 确认没有缓存问题
   - 查看事件是否触发

### 调试命令

```bash
# 查看当前配置状态
curl http://localhost:3000/api/config/status

# 手动触发重载
curl -X POST http://localhost:3000/api/config/reload

# 查看配置历史
curl http://localhost:3000/api/config/history
```

## 总结

MindFlow 的热更新机制提供了灵活的配置管理能力，同时保证了系统的稳定性。通过合理的设计，大多数配置变更可以在不中断服务的情况下完成，极大地提升了运维效率。

**关键要点：**
- 配置与代码分离，支持独立更新
- 自动备份与回滚机制保障安全
- 版本控制确保可追溯性
- 监控与日志支持故障排查
