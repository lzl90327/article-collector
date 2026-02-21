# Phase2 开发计划

## 概述

Phase2 主要实现第三方集成和高级功能，包括飞书 Bitable 集成、微信小程序集成、存储设置等。

## 功能模块

### 1. 飞书 Bitable 集成 (P1)

#### 1.1 后端实现
- [ ] 飞书 OAuth 授权流程
- [ ] Bitable API 封装
- [ ] 数据同步服务
- [ ] Webhook 接收处理

#### 1.2 前端实现
- [ ] 飞书授权页面
- [ ] Bitable 配置界面
- [ ] 同步状态展示

#### 1.3 数据模型扩展
```prisma
model Integration {
  id            String   @id @default(cuid())
  user_id       String
  provider      String   // feishu, wechat
  access_token  String
  refresh_token String?
  expires_at    DateTime?
  config_json   String   @default("{}")
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
}
```

### 2. 微信小程序集成 (P1)

#### 2.1 后端实现
- [ ] 微信登录接口
- [ ] 小程序码生成
- [ ] 消息推送服务

#### 2.2 前端实现
- [ ] 微信登录按钮
- [ ] 分享功能
- [ ] 小程序码展示

### 3. 存储设置 (P2)

#### 3.1 存储策略
- [ ] 本地存储 (SQLite)
- [ ] 云端存储 (PostgreSQL)
- [ ] 混合存储模式

#### 3.2 设置界面
- [ ] 存储位置选择
- [ ] 自动同步配置
- [ ] 数据清理选项

### 4. 数据导入导出 (P2)

#### 4.1 导出功能
- [ ] Markdown 导出
- [ ] JSON 备份
- [ ] PDF 生成

#### 4.2 导入功能
- [ ] Markdown 导入
- [ ] JSON 恢复

### 5. 用户反馈 (P3)

#### 5.1 反馈系统
- [ ] 反馈表单
- [ ] 截图上传
- [ ] 反馈列表

## API 扩展

### 飞书集成 API
```typescript
// 飞书授权
POST /api/integrations/feishu/auth

// 获取 Bitable 列表
GET /api/integrations/feishu/bitable

// 同步到 Bitable
POST /api/integrations/feishu/sync

// 获取同步状态
GET /api/integrations/feishu/status
```

### 微信集成 API
```typescript
// 微信登录
POST /api/auth/wechat/login

// 获取小程序码
GET /api/wechat/qrcode

// 发送订阅消息
POST /api/wechat/subscribe
```

### 存储设置 API
```typescript
// 获取存储配置
GET /api/settings/storage

// 更新存储配置
PUT /api/settings/storage

// 导出数据
POST /api/export

// 导入数据
POST /api/import
```

## 开发顺序

1. **Week 1**: 飞书 Bitable 基础集成
2. **Week 2**: 微信小程序集成
3. **Week 3**: 存储设置和数据导入导出
4. **Week 4**: 用户反馈和优化

## 技术选型

- **飞书 SDK**: @larksuiteoapi/node-sdk
- **微信 SDK**: wechat-miniprogram-api
- **PDF 生成**: puppeteer / html-pdf

## 注意事项

1. 飞书应用需要申请权限
2. 微信小程序需要企业认证
3. 数据导出注意隐私保护
4. 同步操作需要幂等性保证
