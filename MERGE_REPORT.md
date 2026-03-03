# 飞书知识库功能合并报告

## 合并时间
2026-03-03

## 功能概述
将飞书知识库同步功能集成到 MindFlow 项目中，支持：
- 飞书 OAuth 授权
- 获取知识库文档列表（支持层级结构）
- Token 自动刷新机制
- 小程序端知识库浏览

---

## 后端代码变更

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `backend/src/lib/feishuAuth.db.ts` | UAT 文件存储实现 |
| `backend/src/services/feishu.auth.refresh.ts` | Token 自动刷新服务 |
| `backend/src/routes/wiki.routes.ts` | Wiki API 路由 |
| `backend/data/feishu-auth.json` | 授权信息存储文件（自动生成） |

### 修改文件

| 文件路径 | 变更内容 |
|---------|---------|
| `backend/src/server.ts` | 注册 Wiki 路由 |

### 依赖
- 无需新增 npm 依赖

---

## 前端（小程序）代码变更

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `client/src/api/feishu.ts` | 飞书相关 API 封装 |
| `client/src/pages/feishu-auth/index.tsx` | 飞书授权页面 |
| `client/src/pages/feishu-auth/index.scss` | 授权页面样式 |
| `client/src/pages/feishu-auth/index.config.ts` | 授权页面配置 |
| `client/src/pages/feishu-wiki/index.tsx` | 知识库列表页面 |
| `client/src/pages/feishu-wiki/index.scss` | 列表页面样式 |
| `client/src/pages/feishu-wiki/index.config.ts` | 列表页面配置 |
| `client/src/pages/feishu-doc/index.tsx` | 文档详情页面 |
| `client/src/pages/feishu-doc/index.scss` | 详情页面样式 |
| `client/src/pages/feishu-doc/index.config.ts` | 详情页面配置 |
| `client/docs/feishu-integration.md` | 集成说明文档 |

### 修改文件

| 文件路径 | 变更内容 |
|---------|---------|
| `client/src/app.config.ts` | 添加新页面路由 |

---

## 配置说明

### 环境变量（已配置）
```env
FEISHU_APP_ID=cli_a9068e73e1ba9cc2
FEISHU_APP_SECRET=your_app_secret
FEISHU_REDIRECT_URI=http://localhost:3000/api/auth/feishu/callback
```

### 知识库配置
- 默认知识库 ID：`7597246840014130375`（文章素材库）

---

## API 接口列表

### 后端接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/auth/feishu` | 获取授权 URL |
| GET | `/api/auth/feishu/status/:userId` | 检查授权状态 |
| GET | `/api/auth/feishu/callback` | 授权回调 |
| GET | `/api/wiki/spaces/:spaceId/nodes` | 获取知识库节点 |
| GET | `/api/wiki/nodes/:nodeToken/content` | 获取文档信息 |

### 小程序接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/pages/feishu-auth/index` | 授权页面 |
| GET | `/pages/feishu-wiki/index` | 知识库列表 |
| GET | `/pages/feishu-doc/index` | 文档详情 |

---

## 测试状态

| 测试项 | 状态 |
|-------|------|
| UAT 持久化存储 | ✅ 通过 |
| 获取知识库根节点 | ✅ 通过 |
| 获取子文档列表 | ✅ 通过 |
| 授权状态 API | ✅ 通过 |
| Token 自动刷新 | ✅ 已实现 |

---

## 使用说明

### 首次使用
1. 访问小程序"我的"页面
2. 点击"飞书知识库"入口
3. 完成飞书 OAuth 授权
4. 即可浏览知识库文档

### 代码示例
```typescript
// 跳转到授权页面
Taro.navigateTo({ url: '/pages/feishu-auth/index' });

// 跳转到知识库列表
Taro.navigateTo({ url: '/pages/feishu-wiki/index' });
```

---

## 注意事项

1. **Token 有效期**：
   - access_token: 6900 秒（约 1.9 小时）
   - refresh_token: 约 30 天
   - 后端自动刷新，无需用户操作

2. **权限要求**：
   - `wiki:wiki:readonly` - 读取知识库
   - `docx:document:readonly` - 读取文档（可选）

3. **数据存储**：
   - UAT 存储在 `backend/data/feishu-auth.json`
   - 服务器重启后数据不丢失

---

## 后续优化建议

- [ ] 添加 Docx API 支持完整文档内容读取
- [ ] 支持多知识库切换
- [ ] 添加文档搜索功能
- [ ] 支持文档收藏
- [ ] 添加文档同步到本地功能

---

## 合并检查清单

- [x] 后端代码已添加
- [x] 前端代码已添加
- [x] API 接口已测试
- [x] 文档已更新
- [x] 配置文件已更新
