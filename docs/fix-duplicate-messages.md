# 问题解决报告：微信文章重复保存

## 问题描述

用户转发小红书链接后，发现重复保存到了多维表格和知识库（保存了两次）。

## 根本原因

**生产环境和测试环境同时运行，且使用同一个飞书机器人应用。**

当机器人收到一条消息时：
1. `article-collector` (生产环境) 处理一次 → 保存到多维表格和知识库
2. `article-collector-dev` (测试环境) 也处理一次 → 再次保存

结果：每条消息被处理 2 次，产生重复数据。

## 解决方案

### ✅ 已实施：停止测试环境

```bash
ssh lizuolin_cloud@100.117.165.59 'pm2 stop article-collector-dev'
```

**当前状态：**
- ✅ 生产环境 (`article-collector`): **运行中**
- ⏸️ 测试环境 (`article-collector-dev`): **已停止**

### 📝 已添加防护措施

1. **创建了部署注意事项文档** (`docs/deployment-note.md`)
   - 说明了环境配置和注意事项
   - 提供了测试新功能的安全方法

2. **创建了服务管理脚本** (`scripts/manage-service.sh`)
   - 快速查看服务状态
   - 安全地启停服务
   - 带确认提示，避免误操作

3. **更新了部署脚本** (`scripts/deploy.sh`)
   - 添加了警告提示
   - 部署测试环境前会要求确认

## 长期解决方案

### 方案 A: 保持当前配置（推荐）

**只运行生产环境**，测试环境保持停止状态。

需要测试时：
1. 临时停止生产环境
2. 启动测试环境进行测试
3. 测试完成后恢复生产环境，停止测试环境

```bash
# 使用管理脚本
./scripts/manage-service.sh stop-prod    # 停止生产
./scripts/manage-service.sh start-dev    # 启动测试
# ... 测试完成 ...
./scripts/manage-service.sh restart      # 恢复生产
./scripts/manage-service.sh stop-dev     # 停止测试
```

### 方案 B: 创建独立测试机器人（未实施）

在飞书开放平台创建一个独立的测试机器人应用：
1. 创建新的飞书应用（测试专用）
2. 获取新的 `LARK_APP_ID` 和 `LARK_APP_SECRET`
3. 更新 `.env.development` 配置文件

**优点：** 两个环境完全独立，互不影响
**缺点：** 需要额外配置和维护

## 数据清理

如果多维表格中已有重复数据，手动清理步骤：
1. 打开飞书多维表格
2. 按「收藏时间」降序排序
3. 找到时间相近的重复记录（通常相差几秒）
4. 手动删除重复的条目

## 常用命令

```bash
# 查看服务状态
./scripts/manage-service.sh status

# 查看生产环境日志
./scripts/manage-service.sh logs

# 重启生产环境
./scripts/manage-service.sh restart

# 停止测试环境（避免重复）
./scripts/manage-service.sh stop-dev
```

## 总结

✅ **问题已解决**
- 测试环境已停止
- 不会再重复处理消息
- 添加了防护措施避免未来再次发生

📋 **建议**
- 保持测试环境停止状态
- 需要测试时，临时停止生产环境
- 或考虑创建独立的测试机器人应用

---

**日期**: 2026-02-07  
**处理人**: AI Assistant
