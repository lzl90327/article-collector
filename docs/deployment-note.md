# 部署注意事项

## 环境说明

目前生产环境和测试环境使用**同一个飞书机器人应用**，因此：

⚠️ **不要同时运行生产环境和测试环境**，否则会导致消息重复处理！

## 当前配置

- **生产环境**: `article-collector` (正常运行)
- **测试环境**: `article-collector-dev` (已停止，避免重复处理)

## 部署建议

### 日常更新代码（推荐）

只部署生产环境：

```bash
./scripts/deploy.sh production
```

### 测试新功能

如果需要测试新功能，有两个选择：

**选项 1: 临时停止生产环境测试（推荐）**

```bash
# 1. 停止生产环境
ssh lizuolin_cloud@100.117.165.59 'pm2 stop article-collector'

# 2. 部署测试环境
./scripts/deploy.sh development

# 3. 测试完成后，恢复生产环境
ssh lizuolin_cloud@100.117.165.59 'pm2 start article-collector'
ssh lizuolin_cloud@100.117.165.59 'pm2 stop article-collector-dev'
```

**选项 2: 使用独立的测试机器人**

创建一个单独的飞书测试机器人应用，配置独立的 `LARK_APP_ID` 和 `LARK_APP_SECRET` 到 `.env.development`。

## 常用命令

```bash
# 查看服务状态
ssh lizuolin_cloud@100.117.165.59 'pm2 list'

# 查看生产环境日志
ssh lizuolin_cloud@100.117.165.59 'pm2 logs article-collector'

# 停止测试环境
ssh lizuolin_cloud@100.117.165.59 'pm2 stop article-collector-dev'

# 重启生产环境
ssh lizuolin_cloud@100.117.165.59 'pm2 restart article-collector'
```

## 问题排查

### 为什么会重复保存？

两个环境都连接到同一个飞书机器人应用，每收到一条消息：
- 生产环境处理一次 → 保存到多维表格
- 测试环境也处理一次 → 再次保存到多维表格

结果就是重复了。

### 如何清理重复数据？

1. 打开飞书多维表格
2. 按「收藏时间」排序
3. 手动删除重复的记录（通常是时间相近的两条）
