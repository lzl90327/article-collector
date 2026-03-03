# 飞书知识库集成说明

## 功能概述

MindFlow 小程序已集成飞书知识库功能，支持：

- ✅ 飞书 OAuth 授权
- ✅ 获取知识库文档列表
- ✅ 查看文档层级结构
- ✅ 浏览文档内容
- ✅ 创建和编辑文档

## 页面路由

| 页面 | 路径 | 说明 |
|-----|------|------|
| 飞书授权 | `/pages/feishu-auth/index` | 引导用户完成飞书授权 |
| 知识库列表 | `/pages/feishu-wiki/index` | 展示知识库文档列表 |
| 文档详情 | `/pages/feishu-doc/index?nodeToken={token}&title={title}` | 查看文档内容 |

## 使用方法

### 1. 首次使用 - 完成授权

1. 进入"我的"页面
2. 点击"飞书知识库"入口
3. 点击"开始授权"按钮
4. 复制授权链接到浏览器打开
5. 在浏览器中完成飞书授权
6. 返回小程序，即可查看知识库

### 2. 浏览文档

1. 进入知识库列表页面
2. 点击文件夹进入子目录
3. 点击文档查看内容
4. 使用面包屑导航返回上级

### 3. 代码示例

```typescript
// 跳转到飞书授权页面
Taro.navigateTo({
  url: '/pages/feishu-auth/index'
});

// 跳转到知识库列表
Taro.navigateTo({
  url: '/pages/feishu-wiki/index'
});

// 查看文档详情
Taro.navigateTo({
  url: `/pages/feishu-doc/index?nodeToken=${nodeToken}&title=${encodeURIComponent(title)}`
});
```

## API 接口

### 获取授权 URL
```typescript
import { getFeishuAuthUrl } from '@/api/feishu';

const res = await getFeishuAuthUrl();
// res.data.authUrl: 飞书授权页面 URL
```

### 获取文档列表
```typescript
import { getWikiNodes } from '@/api/feishu';

// 获取根节点
const res = await getWikiNodes('space_id');

// 获取子节点
const res = await getWikiNodes('space_id', 'parent_node_token');
```

### 获取文档内容
```typescript
import { getWikiNodeContent } from '@/api/feishu';

const res = await getWikiNodeContent('node_token');
// res.data.title: 文档标题
// res.data.content: 文档内容
```

## 文件结构

```
src/
├── api/
│   └── feishu.ts          # 飞书相关 API
├── pages/
│   ├── feishu-auth/       # 授权页面
│   │   ├── index.tsx
│   │   ├── index.scss
│   │   └── index.config.ts
│   ├── feishu-wiki/       # 知识库列表页面
│   │   ├── index.tsx
│   │   ├── index.scss
│   │   └── index.config.ts
│   └── feishu-doc/        # 文档详情页面
│       ├── index.tsx
│       ├── index.scss
│       └── index.config.ts
└── app.config.ts          # 小程序配置（已添加页面路由）
```

## 后端服务

后端服务已实现以下接口：

- `GET /api/auth/feishu` - 获取授权 URL
- `GET /api/auth/feishu/status/:userId` - 检查授权状态
- `GET /api/auth/feishu/callback` - 授权回调
- `GET /api/wiki/spaces/:spaceId/nodes` - 获取知识库节点
- `GET /api/wiki/nodes/:nodeToken/content` - 获取文档内容
- `POST /api/wiki/documents` - 创建文档
- `PUT /api/wiki/documents/:docId` - 更新文档

## 注意事项

1. **授权有效期**：飞书 UAT 有效期为 2 小时，过期后需要重新授权
2. **数据持久化**：UAT 已保存到文件，服务器重启后无需重新授权
3. **权限要求**：用户需要授权 `wiki:wiki:readonly` 等权限
4. **知识库 ID**：当前默认使用 `7597246840014130375`（文章素材库）

## 后续优化

- [ ] 支持多知识库切换
- [ ] 支持文档搜索
- [ ] 支持文档收藏
- [ ] 支持离线阅读
- [ ] 支持文档同步到本地
