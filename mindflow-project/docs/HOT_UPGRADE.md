# MindFlow 热升级机制文档

## 1. 概述

MindFlow 支持基于配置的热升级机制，允许在不停机的情况下更新 Skill 定义、Phase 配置和触发器规则。这是实现"隐页笔记"规范的关键能力。

## 2. 热升级架构

### 2.1 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Hot Upgrade System                        │
├─────────────────────────────────────────────────────────────┤
│  File Watcher  →  Config Loader  →  Validator  →  Switcher  │
│       │                │               │            │       │
│       ▼                ▼               ▼            ▼       │
│  config/          PhaseLoader    Schema Check   Atomic      │
│  directory        Registry       Rules          Update      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 配置层级

```
backend/config/
├── skill-manifest.json          # Skill 元数据 & 全局设置
├── phases/
│   ├── phase--1-brief.json      # Phase -1: Brief
│   ├── phase-0-material.json    # Phase 0: Material
│   └── ...                      # 其他 Phase 配置
└── triggers/
    └── triggers.json            # 自然语言触发器
```

## 3. 热升级流程

### 3.1 自动检测

```typescript
// PhaseLoader.startWatching()
private startWatching(): void {
  const watchPath = path.join(process.cwd(), 'config');
  const watcher = fs.watch(watchPath, { recursive: true }, 
    (eventType, filename) => {
      if (filename.endsWith('.json')) {
        this.handleConfigChange(eventType, filename);
      }
    }
  );
  this.watchers.push(watcher);
}
```

### 3.2 变更处理

```
文件变更
    │
    ▼
┌─────────────┐
│ 1. 防抖处理  │ ← 300ms 延迟，合并连续变更
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 2. 备份当前  │ ← 复制到 .backup/
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 3. 加载新配置 │ ← JSON 解析
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 4. 验证配置  │ ← Schema 校验
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 5. 差异分析  │ ← 计算变更影响
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 6. 原子切换  │ ← 无停机更新
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 7. 事件通知  │ ← 通知所有订阅者
└─────────────┘
```

### 3.3 代码实现

```typescript
// PhaseLoader.handleConfigChange()
private async handleConfigChange(
  eventType: string, 
  filePath: string
): Promise<void> {
  // 防抖
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
  }
  
  this.debounceTimer = setTimeout(async () => {
    try {
      // 1. 备份
      await this.backupConfig();
      
      // 2. 重新加载
      if (filePath.includes('skill-manifest')) {
        await this.loadManifest();
      } else if (filePath.includes('phase')) {
        await this.reloadPhase(filePath);
      } else if (filePath.includes('trigger')) {
        await this.loadTriggers();
      }
      
      // 3. 验证
      const validation = this.validateConfig();
      if (!validation.valid) {
        await this.rollback();
        throw new Error(`Config validation failed: ${validation.errors}`);
      }
      
      // 4. 通知
      this.emit('config:reloaded', {
        file: filePath,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Hot upgrade failed:', error);
      await this.rollback();
    }
  }, 300);
}
```

## 4. 升级类型与影响

### 4.1 Phase 配置变更

| 变更类型 | 影响级别 | 处理方式 | 用户感知 |
|---------|---------|---------|---------|
| 系统提示词 (system_prompt) | 低 | 即时生效 | 无 |
| 字段定义 (fields) | 中 | 新会话生效 | 无 |
| 产物定义 (artifacts) | 高 | 需迁移 | 提示 |
| 入口/出口条件 (gating) | 高 | 即时生效 | 可能阻断 |
| 模型配置 (models) | 低 | 即时生效 | 无 |
| UI 组件 (ui_component) | 中 | 刷新生效 | 需刷新 |

### 4.2 Skill Manifest 变更

| 变更类型 | 影响级别 | 处理方式 |
|---------|---------|---------|
| 版本号 (version) | 低 | 记录日志 |
| 核心模式 (core_modes) | 高 | 需重启 |
| 热升级设置 (hot_upgrade) | 中 | 即时生效 |
| 依赖服务 (mcp_services) | 中 | 重新连接 |

### 4.3 触发器变更

| 变更类型 | 影响级别 | 处理方式 |
|---------|---------|---------|
| 触发词 (triggers) | 低 | 即时生效 |
| 优先级 (priority) | 低 | 即时生效 |
| 目标 Phase (target_phase) | 中 | 新会话生效 |

## 5. 回滚机制

### 5.1 自动回滚触发条件

- JSON 解析失败
- Schema 验证失败
- 循环依赖检测
- 必需 Phase 缺失

### 5.2 回滚实现

```typescript
private async backupConfig(): Promise<void> {
  const backupDir = path.join(process.cwd(), 'config', '.backup');
  const timestamp = Date.now();
  
  // 备份所有配置
  await fs.copy(
    path.join(process.cwd(), 'config'),
    path.join(backupDir, `${timestamp}`)
  );
}

private async rollback(): Promise<void> {
  const backupDir = path.join(process.cwd(), 'config', '.backup');
  const backups = await fs.readdir(backupDir);
  const latest = backups.sort().pop();
  
  if (latest) {
    await fs.copy(
      path.join(backupDir, latest),
      path.join(process.cwd(), 'config')
    );
    
    // 重新加载备份配置
    await this.initialize();
    
    this.emit('config:rollback', { to: latest });
  }
}
```

## 6. 对现有功能的影响

### 6.1 工作流状态

```
场景：用户正在进行 Phase 2 (Discussion)
变更：Phase 2 的系统提示词更新

影响：
- 当前会话：继续使用旧提示词（已加载到内存）
- 新会话：使用新提示词
- 状态数据：不受影响

处理：无需操作，自然过渡
```

### 6.2 产物数据

```
场景：产物定义变更（如添加新字段）

影响：
- 已有产物：字段缺失，使用默认值
- 新产物：包含所有字段

处理：
- 向后兼容：新代码读取旧数据
- 迁移策略：按需升级旧数据
```

### 6.3 Gating 规则

```
场景：Phase 4 (Draft) 新增入口条件

影响：
- 正在进行：不受影响
- 新进入：必须满足新条件

处理：
- 即时生效
- 用户可能看到新的阻断提示
```

## 7. 最佳实践

### 7.1 配置变更规范

1. **小步快跑**：每次只变更一个 Phase
2. **验证先行**：在开发环境验证后再部署
3. **监控告警**：关注升级失败日志
4. **版本标记**：重大变更更新 Skill 版本号

### 7.2 兼容性保证

```typescript
// 向后兼容示例：产物字段默认值
interface AnglePool {
  angles: Angle[];
  selected_angle?: number;  // 新增字段，可选
  metadata?: {              // 新增字段，可选
    generated_at: string;
    model: string;
  };
}

// 读取时提供默认值
const anglePool = {
  angles: [],
  selected_angle: undefined,
  metadata: undefined,
  ...loadedData  // 覆盖默认值
};
```

### 7.3 测试策略

```typescript
// 热升级测试用例
describe('Hot Upgrade', () => {
  it('should reload phase config without restart', async () => {
    // 修改配置文件
    await modifyConfig('phase-1-angle.json', { 
      system_prompt: 'New prompt' 
    });
    
    // 等待热升级
    await wait(500);
    
    // 验证新配置生效
    const config = phaseLoader.getPhase('1-angle');
    expect(config.system_prompt).toBe('New prompt');
  });
  
  it('should rollback on invalid config', async () => {
    // 写入无效 JSON
    await modifyConfig('phase-1-angle.json', 'invalid json');
    
    // 等待处理
    await wait(500);
    
    // 验证回滚
    const config = phaseLoader.getPhase('1-angle');
    expect(config).toBeDefined(); // 仍可使用
  });
});
```

## 8. 监控与日志

### 8.1 事件订阅

```typescript
phaseLoader.on('config:reloaded', (event) => {
  logger.info(`Config reloaded: ${event.file}`);
  metrics.increment('config.reload.success');
});

phaseLoader.on('config:rollback', (event) => {
  logger.error(`Config rolled back to: ${event.to}`);
  metrics.increment('config.reload.failure');
  alert.send('Config rollback triggered');
});
```

### 8.2 健康检查

```typescript
// /health/config
app.get('/health/config', (req, res) => {
  const status = {
    manifest_loaded: !!phaseLoader.getManifest(),
    phases_count: phaseLoader.getAllPhases().length,
    last_reload: phaseLoader.getLastReloadTime(),
    errors: phaseLoader.getRecentErrors()
  };
  
  res.json(status);
});
```

## 9. 故障排查

### 9.1 常见问题

| 问题 | 原因 | 解决 |
|-----|-----|-----|
| 配置未生效 | 文件权限/路径错误 | 检查 config 目录权限 |
| 升级后报错 | Schema 不兼容 | 检查备份，回滚后修复 |
| 内存泄漏 | 事件监听器未清理 | 检查 cleanup 调用 |
| 循环依赖 | Phase 配置错误 | 验证 next_phase 配置 |

### 9.2 调试命令

```bash
# 查看当前配置
curl http://localhost:3000/api/config/current

# 强制重新加载
curl -X POST http://localhost:3000/api/config/reload

# 查看配置历史
curl http://localhost:3000/api/config/history

# 手动回滚
curl -X POST http://localhost:3000/api/config/rollback
```

## 10. 总结

热升级机制使 MindFlow 能够：

1. **零停机更新**：不停机即可更新 Skill 配置
2. **快速迭代**：配置变更即时生效
3. **安全回滚**：自动检测失败并回滚
4. **向后兼容**：保证已有数据可用性

这是实现"隐页笔记"规范动态演进的关键基础设施。
