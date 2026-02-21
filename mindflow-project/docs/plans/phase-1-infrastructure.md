# Phase 1: 基础设施搭建 - 详细实施计划

## 任务概览
- 总任务数: 30
- 预计总时间: 180 分钟 (3 小时)
- 检查点: 每 5 个任务汇报一次

## 任务组 1: 数据库设计 (任务 1-5)

### 任务 1: 创建 User 模型
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
在 Prisma schema 中添加 User 模型，支持微信登录

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/prisma/schema.prisma`

#### 代码内容
```prisma
model User {
  id        String   @id @default(uuid())
  openid    String   @unique
  unionid   String?
  nickname  String?
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // 关联
  sessions  Session[]
  ideas     Idea[]
}
```

#### 验证步骤
- [ ] 运行 `npx prisma validate` 无错误
- [ ] 模型包含所有必要字段

#### 完成标准
- [ ] User 模型已添加到 schema
- [ ] openid 字段有 @unique 约束

---

### 任务 2: 创建 SkillConfig 模型
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
创建 SkillConfig 模型，存储 Skill 配置和版本信息

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/prisma/schema.prisma`

#### 代码内容
```prisma
model SkillConfig {
  id        String   @id @default(uuid())
  version   String
  name      String
  config    Json     // 存储完整的 Skill 配置
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([isActive])
}
```

#### 验证步骤
- [ ] 运行 `npx prisma validate` 无错误
- [ ] config 字段类型为 Json

#### 完成标准
- [ ] SkillConfig 模型已添加
- [ ] isActive 字段有索引

---

### 任务 3: 创建 SyncRecord 模型
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
创建 SyncRecord 模型，记录数据同步状态

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/prisma/schema.prisma`

#### 代码内容
```prisma
model SyncRecord {
  id          String   @id @default(uuid())
  type        String   // 'sources', 'articles', 'viewpoints', 'ideas'
  lastSyncAt  DateTime
  recordCount Int      @default(0)
  status      String   // 'success', 'failed', 'syncing'
  error       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([type])
  @@index([status])
}
```

#### 验证步骤
- [ ] 运行 `npx prisma validate` 无错误
- [ ] type 和 status 字段有索引

#### 完成标准
- [ ] SyncRecord 模型已添加
- [ ] 包含必要的索引

---

### 任务 4: 创建 Idea 模型
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 任务 1

#### 目标
创建 Idea 模型，存储用户的想法记录

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/prisma/schema.prisma`

#### 代码内容
```prisma
model Idea {
  id        String   @id @default(uuid())
  content   String
  type      String   // 'text', 'voice'
  audioUrl  String?
  userId    String
  synced    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user      User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([synced])
}
```

#### 验证步骤
- [ ] 运行 `npx prisma validate` 无错误
- [ ] 外键关联正确

#### 完成标准
- [ ] Idea 模型已添加
- [ ] 与 User 模型关联正确

---

### 任务 5: 执行数据库迁移
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 1-4

#### 目标
执行 Prisma migrate，创建数据库表

#### 文件变更
- 创建: 迁移文件

#### 执行命令
```bash
cd /Users/zuolin1/article-collector/mindflow-project/backend
npx prisma migrate dev --name add_user_skill_sync_models
```

#### 验证步骤
- [ ] 迁移成功执行
- [ ] 数据库中创建了新表

#### 完成标准
- [ ] 迁移文件已生成
- [ ] 数据库表结构正确

---

## 任务组 2: 飞书服务封装 (任务 6-13)

### 任务 6: 创建 FeishuConfig 配置
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
创建飞书配置类型和常量

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/config/feishu.ts`

#### 代码内容
```typescript
export const feishuConfig = {
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
  // 多维表格
  bitable: {
    sourcesToken: process.env.FEISHU_SOURCES_BITABLE_TOKEN || '',
    viewpointsToken: process.env.FEISHU_VIEWPOINTS_BITABLE_TOKEN || '',
    ideasToken: process.env.FEISHU_IDEAS_BITABLE_TOKEN || '',
  },
  // 知识库
  wiki: {
    articleSpaceId: process.env.FEISHU_ARTICLE_WIKI_SPACE_ID || '',
    dialogueSpaceId: process.env.FEISHU_DIALOGUE_WIKI_SPACE_ID || '',
    weeklySpaceId: process.env.FEISHU_WEEKLY_WIKI_SPACE_ID || '',
  }
};

export interface FeishuTableRecord {
  record_id: string;
  fields: Record<string, any>;
  created_time?: string;
  updated_time?: string;
}
```

#### 验证步骤
- [ ] 文件可正确导入
- [ ] 配置项完整

#### 完成标准
- [ ] 配置类型已定义
- [ ] 包含所有必要的配置项

---

### 任务 7: 创建 FeishuAuth 服务
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 任务 6

#### 目标
创建飞书认证服务，管理 access_token

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/feishu.auth.ts`

#### 代码内容
```typescript
import axios from 'axios';
import { feishuConfig } from '../config/feishu';
import { logger } from '../utils/logger';

class FeishuAuthService {
  private accessToken: string = '';
  private expireTime: number = 0;

  async getAccessToken(): Promise<string> {
    // 如果 token 还有效，直接返回
    if (this.accessToken && Date.now() < this.expireTime) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
        {
          app_id: feishuConfig.appId,
          app_secret: feishuConfig.appSecret,
        }
      );

      if (response.data.code === 0) {
        this.accessToken = response.data.app_access_token;
        // 提前 5 分钟过期
        this.expireTime = Date.now() + (response.data.expire - 300) * 1000;
        return this.accessToken;
      } else {
        throw new Error(`获取 access_token 失败: ${response.data.msg}`);
      }
    } catch (error) {
      logger.error('获取飞书 access_token 失败', error);
      throw error;
    }
  }
}

export const feishuAuth = new FeishuAuthService();
```

#### 验证步骤
- [ ] 服务可正确导入
- [ ] 包含 token 缓存逻辑

#### 完成标准
- [ ] FeishuAuth 服务已创建
- [ ] 实现了 token 自动刷新

---

### 任务 8: 创建 FeishuBitable 服务
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 7

#### 目标
创建飞书多维表格服务，支持读取和写入

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/feishu.bitable.ts`

#### 代码内容
```typescript
import axios from 'axios';
import { feishuAuth } from './feishu.auth';
import { FeishuTableRecord } from '../config/feishu';
import { logger } from '../utils/logger';

class FeishuBitableService {
  private async request(method: string, url: string, data?: any) {
    const token = await feishuAuth.getAccessToken();
    try {
      const response = await axios({
        method,
        url: `https://open.feishu.cn/open-apis${url}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      if (response.data.code !== 0) {
        throw new Error(`飞书 API 错误: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error(`飞书请求失败: ${method} ${url}`, error);
      throw error;
    }
  }

  // 读取表格记录
  async getRecords(appToken: string, tableId: string, params?: {
    pageSize?: number;
    pageToken?: string;
    filter?: string;
  }): Promise<{ items: FeishuTableRecord[]; hasMore: boolean; pageToken?: string }> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());
    if (params?.pageToken) queryParams.append('page_token', params.pageToken);
    if (params?.filter) queryParams.append('filter', params.filter);

    const data = await this.request(
      'GET',
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records?${queryParams.toString()}`
    );

    return {
      items: data.items || [],
      hasMore: data.has_more || false,
      pageToken: data.page_token,
    };
  }

  // 创建记录
  async createRecord(appToken: string, tableId: string, fields: Record<string, any>): Promise<FeishuTableRecord> {
    return this.request(
      'POST',
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      { fields }
    );
  }
}

export const feishuBitable = new FeishuBitableService();
```

#### 验证步骤
- [ ] 服务可正确导入
- [ ] 包含错误处理

#### 完成标准
- [ ] FeishuBitable 服务已创建
- [ ] 支持读取和创建记录

---

### 任务 9: 创建 FeishuWiki 服务
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 任务 7

#### 目标
创建飞书知识库服务，支持读取文档

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/feishu.wiki.ts`

#### 代码内容
```typescript
import axios from 'axios';
import { feishuAuth } from './feishu.auth';
import { logger } from '../utils/logger';

class FeishuWikiService {
  private async request(method: string, url: string, data?: any) {
    const token = await feishuAuth.getAccessToken();
    try {
      const response = await axios({
        method,
        url: `https://open.feishu.cn/open-apis${url}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      if (response.data.code !== 0) {
        throw new Error(`飞书 API 错误: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error(`飞书 Wiki 请求失败: ${method} ${url}`, error);
      throw error;
    }
  }

  // 获取知识库节点列表
  async getWikiNodes(spaceId: string, parentNodeToken?: string): Promise<any[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('space_id', spaceId);
    if (parentNodeToken) queryParams.append('parent_node_token', parentNodeToken);

    const data = await this.request(
      'GET',
      `/wiki/v2/spaces/${spaceId}/nodes?${queryParams.toString()}`
    );

    return data.items || [];
  }

  // 获取文档内容
  async getDocumentContent(documentId: string): Promise<string> {
    const data = await this.request(
      'GET',
      `/docx/v1/documents/${documentId}/content`
    );
    return data.content || '';
  }

  // 获取文档元数据
  async getDocumentMeta(documentId: string): Promise<any> {
    return this.request(
      'GET',
      `/docx/v1/documents/${documentId}`
    );
  }
}

export const feishuWiki = new FeishuWikiService();
```

#### 验证步骤
- [ ] 服务可正确导入
- [ ] 包含文档读取方法

#### 完成标准
- [ ] FeishuWiki 服务已创建
- [ ] 支持读取知识库节点和文档

---

### 任务 10: 创建 Source 同步服务
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 8

#### 目标
创建素材同步服务，将飞书多维表格数据同步到本地

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/sync.sources.ts`

#### 代码内容
```typescript
import { feishuBitable } from './feishu.bitable';
import { feishuConfig } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  type: 'article' | 'video' | 'audio' | 'image';
  tags: string[];
  summary?: string;
  createdAt: Date;
}

class SourceSyncService {
  async sync(): Promise<{ count: number; error?: string }> {
    try {
      const appToken = feishuConfig.bitable.sourcesToken;
      // 假设表格 ID 为 'tbllyDDUwGMFogD2'，从用户提供的链接中获取
      const tableId = 'tbllyDDUwGMFogD2';

      let allRecords: any[] = [];
      let pageToken: string | undefined;
      let hasMore = true;

      // 分页获取所有记录
      while (hasMore) {
        const result = await feishuBitable.getRecords(appToken, tableId, {
          pageSize: 500,
          pageToken,
        });

        allRecords = allRecords.concat(result.items);
        hasMore = result.hasMore;
        pageToken = result.pageToken;
      }

      // 转换并保存到数据库
      const sources = allRecords.map(this.transformRecord);

      // 批量 upsert
      for (const source of sources) {
        await prisma.source.upsert({
          where: { id: source.id },
          update: source,
          create: source,
        });
      }

      // 更新同步记录
      await this.updateSyncRecord(allRecords.length);

      logger.info(`素材同步完成: ${sources.length} 条`);
      return { count: sources.length };
    } catch (error) {
      logger.error('素材同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message };
    }
  }

  private transformRecord(record: any): SourceRecord {
    const fields = record.fields;
    return {
      id: record.record_id,
      title: fields['标题'] || fields['title'] || '无标题',
      url: fields['链接'] || fields['url'] || '',
      type: this.detectType(fields),
      tags: fields['标签'] || fields['tags'] || [],
      summary: fields['摘要'] || fields['summary'],
      createdAt: new Date(record.created_time || Date.now()),
    };
  }

  private detectType(fields: any): 'article' | 'video' | 'audio' | 'image' {
    const url = fields['链接'] || fields['url'] || '';
    if (url.includes('bilibili.com') || url.includes('youtube.com')) return 'video';
    if (url.includes('xiaoyuzhoufm.com') || url.includes('ximalaya.com')) return 'audio';
    if (url.includes('xiaohongshu.com')) return 'image';
    return 'article';
  }

  private async updateSyncRecord(count: number, error?: string) {
    await prisma.syncRecord.create({
      data: {
        type: 'sources',
        lastSyncAt: new Date(),
        recordCount: count,
        status: error ? 'failed' : 'success',
        error,
      },
    });
  }
}

export const sourceSync = new SourceSyncService();
```

#### 验证步骤
- [ ] 服务可正确导入
- [ ] 包含数据转换逻辑

#### 完成标准
- [ ] SourceSync 服务已创建
- [ ] 支持分页获取和批量保存

---

### 任务 11: 创建 Article 同步服务
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 9

#### 目标
创建文章同步服务，将飞书知识库文章同步到本地

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/sync.articles.ts`

#### 代码内容
```typescript
import { feishuWiki } from './feishu.wiki';
import { feishuConfig } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface ArticleRecord {
  id: string;
  title: string;
  content?: string;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

class ArticleSyncService {
  async sync(): Promise<{ count: number; error?: string }> {
    try {
      const spaceId = feishuConfig.wiki.articleSpaceId;

      // 获取知识库节点
      const nodes = await feishuWiki.getWikiNodes(spaceId);

      // 只同步文档类型的节点
      const documents = nodes.filter(node => node.obj_type === 'docx');

      for (const doc of documents) {
        try {
          const meta = await feishuWiki.getDocumentMeta(doc.obj_token);
          const content = await feishuWiki.getDocumentContent(doc.obj_token);

          await prisma.article.upsert({
            where: { id: doc.obj_token },
            update: {
              title: meta.title || doc.title,
              content,
              updatedAt: new Date(),
            },
            create: {
              id: doc.obj_token,
              title: meta.title || doc.title,
              content,
              status: 'published',
              createdAt: new Date(meta.create_time * 1000),
              updatedAt: new Date(meta.update_time * 1000),
            },
          });
        } catch (error) {
          logger.error(`同步文章失败: ${doc.title}`, error);
        }
      }

      await this.updateSyncRecord(documents.length);

      logger.info(`文章同步完成: ${documents.length} 篇`);
      return { count: documents.length };
    } catch (error) {
      logger.error('文章同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message };
    }
  }

  private async updateSyncRecord(count: number, error?: string) {
    await prisma.syncRecord.create({
      data: {
        type: 'articles',
        lastSyncAt: new Date(),
        recordCount: count,
        status: error ? 'failed' : 'success',
        error,
      },
    });
  }
}

export const articleSync = new ArticleSyncService();
```

#### 验证步骤
- [ ] 服务可正确导入
- [ ] 包含错误处理

#### 完成标准
- [ ] ArticleSync 服务已创建
- [ ] 支持知识库文档同步

---

### 任务 12: 创建 Viewpoint 同步服务
**优先级**: P1
**预计时间**: 4 分钟
**依赖**: 任务 8

#### 目标
创建观点库同步服务

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/sync.viewpoints.ts`

#### 代码内容
```typescript
import { feishuBitable } from './feishu.bitable';
import { feishuConfig } from '../config/feishu';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface ViewpointRecord {
  id: string;
  content: string;
  sourceArticle?: string;
  tags: string[];
  createdAt: Date;
}

class ViewpointSyncService {
  async sync(): Promise<{ count: number; error?: string }> {
    try {
      const appToken = feishuConfig.bitable.viewpointsToken;
      const tableId = 'tbltuRo6sSWbWsYh';

      let allRecords: any[] = [];
      let pageToken: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await feishuBitable.getRecords(appToken, tableId, {
          pageSize: 500,
          pageToken,
        });

        allRecords = allRecords.concat(result.items);
        hasMore = result.hasMore;
        pageToken = result.pageToken;
      }

      const viewpoints = allRecords.map(this.transformRecord);

      for (const viewpoint of viewpoints) {
        await prisma.viewpoint.upsert({
          where: { id: viewpoint.id },
          update: viewpoint,
          create: viewpoint,
        });
      }

      await this.updateSyncRecord(viewpoints.length);

      logger.info(`观点同步完成: ${viewpoints.length} 条`);
      return { count: viewpoints.length };
    } catch (error) {
      logger.error('观点同步失败', error);
      await this.updateSyncRecord(0, error.message);
      return { count: 0, error: error.message };
    }
  }

  private transformRecord(record: any): ViewpointRecord {
    const fields = record.fields;
    return {
      id: record.record_id,
      content: fields['观点'] || fields['content'] || '',
      sourceArticle: fields['来源文章'] || fields['source'],
      tags: fields['标签'] || fields['tags'] || [],
      createdAt: new Date(record.created_time || Date.now()),
    };
  }

  private async updateSyncRecord(count: number, error?: string) {
    await prisma.syncRecord.create({
      data: {
        type: 'viewpoints',
        lastSyncAt: new Date(),
        recordCount: count,
        status: error ? 'failed' : 'success',
        error,
      },
    });
  }
}

export const viewpointSync = new ViewpointSyncService();
```

#### 验证步骤
- [ ] 服务可正确导入
- [ ] 包含数据转换

#### 完成标准
- [ ] ViewpointSync 服务已创建

---

### 任务 13: 导出所有服务
**优先级**: P0
**预计时间**: 2 分钟
**依赖**: 任务 8-12

#### 目标
创建服务索引文件，统一导出所有服务

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/index.ts`

#### 代码内容
```typescript
export { feishuAuth } from './feishu.auth';
export { feishuBitable } from './feishu.bitable';
export { feishuWiki } from './feishu.wiki';
export { sourceSync } from './sync.sources';
export { articleSync } from './sync.articles';
export { viewpointSync } from './sync.viewpoints';
```

#### 验证步骤
- [ ] 文件可正确导入
- [ ] 所有服务已导出

#### 完成标准
- [ ] 服务索引文件已创建

---

## 任务组 3: API 开发 (任务 14-25)

### 任务 14: 创建微信登录 API
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 5

#### 目标
创建微信登录接口，换取 openid 并生成 JWT

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/auth.routes.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: '缺少 code 参数' });
    }

    // 调用微信接口换取 openid
    const wxResponse = await axios.get(
      'https://api.weixin.qq.com/sns/jscode2session',
      {
        params: {
          appid: process.env.WECHAT_APP_ID,
          secret: process.env.WECHAT_APP_SECRET,
          js_code: code,
          grant_type: 'authorization_code',
        },
      }
    );

    const { openid, unionid, session_key } = wxResponse.data;

    if (!openid) {
      return res.status(400).json({ error: '微信登录失败', detail: wxResponse.data });
    }

    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { openid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          openid,
          unionid,
        },
      });
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, openid },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    logger.error('登录失败', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 更新用户信息
router.put('/profile', async (req, res) => {
  try {
    const { userId } = req.user as any;
    const { nickname, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { nickname, avatar },
    });

    res.json({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
    });
  } catch (error) {
    logger.error('更新用户信息失败', error);
    res.status(500).json({ error: '更新失败' });
  }
});

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入
- [ ] 包含微信登录逻辑

#### 完成标准
- [ ] 登录 API 已创建
- [ ] 支持 JWT 生成

---

### 任务 15: 创建素材管理 API
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 10

#### 目标
创建素材列表和详情接口

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/sources.routes.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sourceSync } from '../services/sync.sources';
import { logger } from '../utils/logger';

const router = Router();

// 获取素材列表
router.get('/', async (req, res) => {
  try {
    const { type, page = '1', pageSize = '20' } = req.query;

    const where: any = {};
    if (type) where.type = type;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const [sources, total] = await Promise.all([
      prisma.source.findMany({
        where,
        skip,
        take: parseInt(pageSize as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.source.count({ where }),
    ]);

    res.json({
      items: sources,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      hasMore: skip + sources.length < total,
    });
  } catch (error) {
    logger.error('获取素材列表失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取素材详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const source = await prisma.source.findUnique({
      where: { id },
    });

    if (!source) {
      return res.status(404).json({ error: '素材不存在' });
    }

    res.json(source);
  } catch (error) {
    logger.error('获取素材详情失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 添加素材（从小程序）
router.post('/', async (req, res) => {
  try {
    const { title, url, type, tags, summary } = req.body;

    // 这里可以调用飞书 API 直接添加到多维表格
    // 暂时先保存到本地数据库
    const source = await prisma.source.create({
      data: {
        title,
        url,
        type,
        tags,
        summary,
      },
    });

    res.json(source);
  } catch (error) {
    logger.error('添加素材失败', error);
    res.status(500).json({ error: '添加失败' });
  }
});

// 手动触发同步
router.post('/sync', async (req, res) => {
  try {
    const result = await sourceSync.sync();
    res.json(result);
  } catch (error) {
    logger.error('同步素材失败', error);
    res.status(500).json({ error: '同步失败' });
  }
});

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入
- [ ] 包含 CRUD 操作

#### 完成标准
- [ ] 素材管理 API 已创建
- [ ] 支持分页和筛选

---

### 任务 16: 创建文章管理 API
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 11

#### 目标
创建文章列表和详情接口

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/articles.routes.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { articleSync } from '../services/sync.articles';
import { logger } from '../utils/logger';

const router = Router();

// 获取文章列表
router.get('/', async (req, res) => {
  try {
    const { status, page = '1', pageSize = '20' } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip,
        take: parseInt(pageSize as string),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.article.count({ where }),
    ]);

    res.json({
      items: articles,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      hasMore: skip + articles.length < total,
    });
  } catch (error) {
    logger.error('获取文章列表失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取文章详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    res.json(article);
  } catch (error) {
    logger.error('获取文章详情失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 手动触发同步
router.post('/sync', async (req, res) => {
  try {
    const result = await articleSync.sync();
    res.json(result);
  } catch (error) {
    logger.error('同步文章失败', error);
    res.status(500).json({ error: '同步失败' });
  }
});

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入
- [ ] 包含列表和详情

#### 完成标准
- [ ] 文章管理 API 已创建

---

### 任务 17: 创建想法记录 API
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 任务 5

#### 目标
创建想法记录接口，支持离线同步

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/ideas.routes.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { feishuBitable } from '../services/feishu.bitable';
import { feishuConfig } from '../config/feishu';
import { logger } from '../utils/logger';

const router = Router();

// 获取想法列表
router.get('/', async (req, res) => {
  try {
    const { userId } = req.user as any;
    const { page = '1', pageSize = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const [ideas, total] = await Promise.all([
      prisma.idea.findMany({
        where: { userId },
        skip,
        take: parseInt(pageSize as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.idea.count({ where: { userId } }),
    ]);

    res.json({
      items: ideas,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      hasMore: skip + ideas.length < total,
    });
  } catch (error) {
    logger.error('获取想法列表失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 创建想法
router.post('/', async (req, res) => {
  try {
    const { userId } = req.user as any;
    const { content, type, audioUrl } = req.body;

    // 先保存到本地
    const idea = await prisma.idea.create({
      data: {
        content,
        type,
        audioUrl,
        userId,
        synced: false,
      },
    });

    // 尝试同步到飞书
    try {
      await feishuBitable.createRecord(
        feishuConfig.bitable.ideasToken,
        'tblLpXgnhfxuaJYh',
        {
          '想法': content,
          '类型': type,
          '用户ID': userId,
          '创建时间': new Date().toISOString(),
        }
      );

      // 更新同步状态
      await prisma.idea.update({
        where: { id: idea.id },
        data: { synced: true },
      });
    } catch (syncError) {
      logger.error('同步想法到飞书失败', syncError);
      // 不影响返回，稍后由定时任务重试
    }

    res.json(idea);
  } catch (error) {
    logger.error('创建想法失败', error);
    res.status(500).json({ error: '创建失败' });
  }
});

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入
- [ ] 包含同步逻辑

#### 完成标准
- [ ] 想法记录 API 已创建
- [ ] 支持飞书同步

---

### 任务 18: 创建观点库 API
**优先级**: P1
**预计时间**: 3 分钟
**依赖**: 任务 12

#### 目标
创建观点库查询接口

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/viewpoints.routes.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { viewpointSync } from '../services/sync.viewpoints';
import { logger } from '../utils/logger';

const router = Router();

// 获取观点列表
router.get('/', async (req, res) => {
  try {
    const { page = '1', pageSize = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const [viewpoints, total] = await Promise.all([
      prisma.viewpoint.findMany({
        skip,
        take: parseInt(pageSize as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.viewpoint.count(),
    ]);

    res.json({
      items: viewpoints,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      hasMore: skip + viewpoints.length < total,
    });
  } catch (error) {
    logger.error('获取观点列表失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 手动触发同步
router.post('/sync', async (req, res) => {
  try {
    const result = await viewpointSync.sync();
    res.json(result);
  } catch (error) {
    logger.error('同步观点失败', error);
    res.status(500).json({ error: '同步失败' });
  }
});

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入

#### 完成标准
- [ ] 观点库 API 已创建

---

### 任务 19: 创建同步状态 API
**优先级**: P1
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
创建同步状态查询接口

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/sync.routes.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// 获取同步状态
router.get('/status', async (req, res) => {
  try {
    const records = await prisma.syncRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 按类型分组，取最新的
    const status: Record<string, any> = {};
    for (const record of records) {
      if (!status[record.type]) {
        status[record.type] = {
          lastSyncAt: record.lastSyncAt,
          recordCount: record.recordCount,
          status: record.status,
          error: record.error,
        };
      }
    }

    res.json(status);
  } catch (error) {
    logger.error('获取同步状态失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入

#### 完成标准
- [ ] 同步状态 API 已创建

---

### 任务 20: 创建 Skill 配置 API
**优先级**: P1
**预计时间**: 4 分钟
**依赖**: 无

#### 目标
创建 Skill 配置查询接口

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/skill.routes.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// 获取当前 Skill 配置
router.get('/config', async (req, res) => {
  try {
    const config = await prisma.skillConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      return res.status(404).json({ error: '未找到 Skill 配置' });
    }

    res.json({
      version: config.version,
      name: config.name,
      config: config.config,
    });
  } catch (error) {
    logger.error('获取 Skill 配置失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取版本历史
router.get('/versions', async (req, res) => {
  try {
    const versions = await prisma.skillConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json(versions);
  } catch (error) {
    logger.error('获取版本历史失败', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取版本对比
router.get('/compare', async (req, res) => {
  try {
    const { v1, v2 } = req.query;

    const [config1, config2] = await Promise.all([
      prisma.skillConfig.findFirst({ where: { version: v1 as string } }),
      prisma.skillConfig.findFirst({ where: { version: v2 as string } }),
    ]);

    if (!config1 || !config2) {
      return res.status(404).json({ error: '版本不存在' });
    }

    // 简单的对比逻辑
    const differences = this.compareConfigs(config1.config, config2.config);

    res.json({
      v1: config1.version,
      v2: config2.version,
      differences,
    });
  } catch (error) {
    logger.error('对比版本失败', error);
    res.status(500).json({ error: '对比失败' });
  }
});

function compareConfigs(c1: any, c2: any): any[] {
  const diffs: any[] = [];
  // 对比 phases
  if (JSON.stringify(c1.phases) !== JSON.stringify(c2.phases)) {
    diffs.push({ type: 'phases', description: 'Phase 配置有变更' });
  }
  // 对比 prompts
  if (JSON.stringify(c1.prompts) !== JSON.stringify(c2.prompts)) {
    diffs.push({ type: 'prompts', description: 'Prompt 配置有变更' });
  }
  return diffs;
}

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入

#### 完成标准
- [ ] Skill 配置 API 已创建

---

### 任务 21: 更新主路由文件
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 任务 14-20

#### 目标
在主路由文件中注册所有新路由

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/src/routes/index.ts`

#### 代码内容
```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import sourceRoutes from './sources.routes';
import articleRoutes from './articles.routes';
import ideaRoutes from './ideas.routes';
import viewpointRoutes from './viewpoints.routes';
import syncRoutes from './sync.routes';
import skillRoutes from './skill.routes';

const router = Router();

// 认证相关
router.use('/auth', authRoutes);

// 素材管理
router.use('/sources', sourceRoutes);

// 文章管理
router.use('/articles', articleRoutes);

// 想法记录
router.use('/ideas', ideaRoutes);

// 观点库
router.use('/viewpoints', viewpointRoutes);

// 同步状态
router.use('/sync', syncRoutes);

// Skill 配置
router.use('/skill', skillRoutes);

export default router;
```

#### 验证步骤
- [ ] 路由可正确导入
- [ ] 所有路由已注册

#### 完成标准
- [ ] 主路由文件已更新

---

### 任务 22: 创建 JWT 认证中间件
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 无

#### 目标
创建 JWT 认证中间件，保护需要登录的接口

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/middleware/auth.ts`

#### 代码内容
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    openid: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

    req.user = {
      userId: decoded.userId,
      openid: decoded.openid,
    };

    next();
  } catch (error) {
    logger.error('认证失败', error);
    return res.status(401).json({ error: '认证失败' });
  }
}

// 可选认证中间件（游客模式）
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      req.user = {
        userId: decoded.userId,
        openid: decoded.openid,
      };
    }

    next();
  } catch (error) {
    // 可选认证失败不阻止请求
    next();
  }
}
```

#### 验证步骤
- [ ] 中间件可正确导入
- [ ] 包含游客模式支持

#### 完成标准
- [ ] JWT 认证中间件已创建

---

### 任务 23: 更新环境变量配置
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
更新 .env.example 文件，添加所有需要的配置项

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/.env.example`

#### 代码内容
```
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mindflow"

# JWT
JWT_SECRET="your-secret-key"

# WeChat Mini Program
WECHAT_APP_ID="wx5e27b578595da3c7"
WECHAT_APP_SECRET="41ce7a57dc2a96642a99259717cf90b9"

# Feishu
FEISHU_APP_ID="cli_a9f883f1bb781cef"
FEISHU_APP_SECRET="nWEK1LtWOrcIYuor4CcA2flNYtilGcGZ"

# Feishu Bitable Tokens
FEISHU_SOURCES_BITABLE_TOKEN=""
FEISHU_VIEWPOINTS_BITABLE_TOKEN=""
FEISHU_IDEAS_BITABLE_TOKEN=""

# Feishu Wiki Space IDs
FEISHU_ARTICLE_WIKI_SPACE_ID=""
FEISHU_DIALOGUE_WIKI_SPACE_ID=""
FEISHU_WEEKLY_WIKI_SPACE_ID=""
```

#### 验证步骤
- [ ] 包含所有必要配置

#### 完成标准
- [ ] 环境变量示例已更新

---

### 任务 24: 更新主应用文件
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 任务 21-22

#### 目标
在主应用文件中注册路由和中间件

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/src/app.ts`

#### 代码内容
```typescript
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  logger.info(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public Routes (不需要认证)
app.use('/api/auth', routes);

// Protected Routes (需要认证)
app.use('/api', authMiddleware, routes);

// Optional Auth Routes (游客模式)
app.use('/api/public', optionalAuthMiddleware, routes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('[HTTP ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
```

#### 验证步骤
- [ ] 应用可正确启动
- [ ] 路由和中间件已注册

#### 完成标准
- [ ] 主应用文件已更新

---

### 任务 25: 安装依赖包
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 无

#### 目标
安装所有需要的 npm 包

#### 执行命令
```bash
cd /Users/zuolin1/article-collector/mindflow-project/backend
npm install jsonwebtoken axios
npm install --save-dev @types/jsonwebtoken
```

#### 验证步骤
- [ ] 包安装成功
- [ ] package.json 已更新

#### 完成标准
- [ ] 所有依赖已安装

---

## 任务组 4: 同步服务 (任务 26-30)

### 任务 26: 创建定时任务调度器
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 10-12

#### 目标
创建定时任务调度器，定期执行数据同步

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/services/scheduler.ts`

#### 代码内容
```typescript
import cron from 'node-cron';
import { sourceSync } from './sync.sources';
import { articleSync } from './sync.articles';
import { viewpointSync } from './sync.viewpoints';
import { logger } from '../utils/logger';

class SchedulerService {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  start() {
    // 每 5 分钟同步素材
    this.tasks.set('sources', cron.schedule('*/5 * * * *', async () => {
      logger.info('开始定时同步素材...');
      try {
        await sourceSync.sync();
      } catch (error) {
        logger.error('定时同步素材失败', error);
      }
    }));

    // 每 10 分钟同步文章
    this.tasks.set('articles', cron.schedule('*/10 * * * *', async () => {
      logger.info('开始定时同步文章...');
      try {
        await articleSync.sync();
      } catch (error) {
        logger.error('定时同步文章失败', error);
      }
    }));

    // 每 15 分钟同步观点
    this.tasks.set('viewpoints', cron.schedule('*/15 * * * *', async () => {
      logger.info('开始定时同步观点...');
      try {
        await viewpointSync.sync();
      } catch (error) {
        logger.error('定时同步观点失败', error);
      }
    }));

    logger.info('定时任务调度器已启动');
  }

  stop() {
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`定时任务 ${name} 已停止`);
    }
    this.tasks.clear();
  }

  getStatus() {
    return {
      running: this.tasks.size > 0,
      tasks: Array.from(this.tasks.keys()),
    };
  }
}

export const scheduler = new SchedulerService();
```

#### 验证步骤
- [ ] 服务可正确导入
- [ ] 包含启动和停止方法

#### 完成标准
- [ ] 定时任务调度器已创建

---

### 任务 27: 创建限流控制器
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 无

#### 目标
创建限流控制器，防止飞书 API 调用频率过高

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/utils/rate-limiter.ts`

#### 代码内容
```typescript
import { logger } from './logger';

interface RateLimiterConfig {
  maxRequests: number;  // 最大请求数
  windowMs: number;     // 时间窗口（毫秒）
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // 清理过期的请求记录
    this.requests = this.requests.filter(time => now - time < this.config.windowMs);

    // 检查是否超过限制
    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.config.windowMs - (now - oldestRequest);

      logger.warn(`触发限流，等待 ${waitTime}ms`);
      await this.sleep(waitTime);
      return this.acquire(); // 递归重试
    }

    // 记录本次请求
    this.requests.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      currentRequests: this.requests.length,
      maxRequests: this.config.maxRequests,
      remaining: this.config.maxRequests - this.requests.length,
    };
  }
}

// 飞书 API 限流器：每秒 20 次
export const feishuRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 1000,
});

// 微信 API 限流器：每秒 10 次
export const wechatRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 1000,
});
```

#### 验证步骤
- [ ] 限流器可正确导入
- [ ] 包含等待逻辑

#### 完成标准
- [ ] 限流控制器已创建

---

### 任务 28: 创建请求队列
**优先级**: P0
**预计时间**: 5 分钟
**依赖**: 任务 27

#### 目标
创建请求队列，管理并发请求

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/utils/request-queue.ts`

#### 代码内容
```typescript
import { logger } from './logger';

interface QueueItem<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
  maxRetries: number;
}

class RequestQueue<T> {
  private queue: QueueItem<T>[] = [];
  private running: number = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  async add(fn: () => Promise<T>, options: { maxRetries?: number } = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        id: Math.random().toString(36).substring(7),
        fn,
        resolve,
        reject,
        retries: 0,
        maxRetries: options.maxRetries || 3,
      };

      this.queue.push(item);
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      if (item.retries < item.maxRetries) {
        item.retries++;
        logger.warn(`请求失败，第 ${item.retries} 次重试: ${item.id}`);
        this.queue.unshift(item);
      } else {
        item.reject(error);
      }
    } finally {
      this.running--;
      // 继续处理队列
      setImmediate(() => this.process());
    }
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

// 全局请求队列
export const globalRequestQueue = new RequestQueue(5);
```

#### 验证步骤
- [ ] 队列可正确导入
- [ ] 包含重试逻辑

#### 完成标准
- [ ] 请求队列已创建

---

### 任务 29: 创建重试机制包装器
**优先级**: P0
**预计时间**: 4 分钟
**依赖**: 无

#### 目标
创建通用的重试机制包装器

#### 文件变更
- 创建: `/Users/zuolin1/article-collector/mindflow-project/backend/src/utils/retry.ts`

#### 代码内容
```typescript
import { logger } from './logger';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  timeout: number;
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  timeout: 10000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config };
  let lastError: any;

  for (let i = 0; i <= finalConfig.maxRetries; i++) {
    try {
      // 使用 Promise.race 实现超时
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('请求超时')), finalConfig.timeout)
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error;

      // 判断是否可重试
      if (!isRetryableError(error) || i === finalConfig.maxRetries) {
        throw error;
      }

      // 计算退避时间
      const delay = finalConfig.retryDelay * Math.pow(finalConfig.backoffMultiplier, i);
      logger.warn(`请求失败，${delay}ms 后重试 (${i + 1}/${finalConfig.maxRetries})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryableError(error: any): boolean {
  // 网络错误、超时、限流等可重试
  if (error.code === 'ECONNRESET') return true;
  if (error.code === 'ETIMEDOUT') return true;
  if (error.response?.status === 429) return true; // 限流
  if (error.response?.status >= 500) return true; // 服务器错误
  if (error.message === '请求超时') return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### 验证步骤
- [ ] 包装器可正确导入
- [ ] 包含超时和退避逻辑

#### 完成标准
- [ ] 重试机制已创建

---

### 任务 30: 在主入口启动定时任务
**优先级**: P0
**预计时间**: 3 分钟
**依赖**: 任务 26

#### 目标
在主入口文件中启动定时任务调度器

#### 文件变更
- 修改: `/Users/zuolin1/article-collector/mindflow-project/backend/src/index.ts`

#### 代码内容
```typescript
import { scheduler } from './services/scheduler';

// ... 其他导入

// 启动定时任务
scheduler.start();

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('正在关闭服务...');
  scheduler.stop();
  // ... 其他清理
  process.exit(0);
});
```

#### 验证步骤
- [ ] 定时任务在应用启动时启动
- [ ] 在应用关闭时停止

#### 完成标准
- [ ] 定时任务已集成到主入口

---

## 检查点设置

### 检查点 1: 数据库设计完成（任务 1-5）
汇报内容：
- User、SkillConfig、SyncRecord、Idea 模型已创建
- 数据库迁移已执行
- 表结构验证通过

### 检查点 2: 飞书服务完成（任务 6-13）
汇报内容：
- FeishuAuth、FeishuBitable、FeishuWiki 服务已创建
- Source、Article、Viewpoint 同步服务已创建
- 服务导出已配置

### 检查点 3: API 开发完成（任务 14-25）
汇报内容：
- 登录、素材、文章、想法、观点、同步、Skill 等 API 已创建
- JWT 认证中间件已创建
- 路由已注册

### 检查点 4: 同步服务完成（任务 26-30）
汇报内容：
- 定时任务调度器已创建
- 限流控制器已创建
- 请求队列已创建
- 重试机制已创建
- 定时任务已集成

---

## 完成标准

Phase 1 完成的标志：
- [ ] 所有数据库表已创建
- [ ] 飞书服务可以正常调用 API
- [ ] 所有 API 路由可以正常访问
- [ ] 定时任务可以正常执行
- [ ] 限流和重试机制工作正常
