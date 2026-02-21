# MindFlow 部署指南

## 📋 部署前准备

### 1. 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Docker & Docker Compose** (可选，用于本地数据库)
- **微信小程序开发者工具**

### 2. 获取 API Keys

需要以下 AI 服务的 API Key：

1. **DeepSeek** (主要写作模型)
   - 注册: https://platform.deepseek.com
   - 获取 API Key

2. **Claude** (情感分析)
   - 注册: https://console.anthropic.com
   - 获取 API Key

3. **Perplexity** (事实核查)
   - 注册: https://www.perplexity.ai
   - 获取 API Key

4. **Supabase** (数据库)
   - 注册: https://supabase.com
   - 创建项目
   - 获取 Project URL 和 API Keys

## 🚀 部署步骤

### 步骤 1: 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Keys：

```env
# AI API Keys
DEEPSEEK_API_KEY=sk-your-deepseek-key
CLAUDE_API_KEY=sk-your-claude-key
PERPLEXITY_API_KEY=pplx-your-perplexity-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 步骤 2: 启动数据库 (可选)

如果使用本地数据库：

```bash
# 在项目根目录
docker-compose up -d postgres redis
```

如果使用 Supabase 云端数据库，跳过此步骤。

### 步骤 3: 运行数据库迁移

如果使用本地 PostgreSQL：

```bash
# 进入 PostgreSQL 容器
docker exec -it mindflow-postgres psql -U mindflow -d mindflow

# 执行迁移脚本
\i /docker-entrypoint-initdb.d/001_initial_schema.sql
```

如果使用 Supabase：

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 复制 `supabase/migrations/001_initial_schema.sql` 内容
4. 执行 SQL

### 步骤 4: 启动后端服务

```bash
cd backend
npm install
npm run dev
```

服务将在 http://localhost:3001 启动

验证后端：
```bash
curl http://localhost:3001/health
```

### 步骤 5: 配置前端

```bash
cd frontend
npm install
```

配置 API 地址：

编辑 `frontend/src/config/index.ts` (如果不存在则创建)：

```typescript
export const config = {
  API_BASE_URL: 'http://localhost:3001/api',
  // 生产环境
  // API_BASE_URL: 'https://your-api-domain.com/api',
};
```

### 步骤 6: 构建小程序

```bash
cd frontend
npm run dev:weapp
```

使用微信开发者工具打开 `frontend/dist` 目录。

## 🏭 生产环境部署

### 后端部署 (以 Railway/Render 为例)

1. **推送代码到 GitHub**
```bash
git remote add origin https://github.com/yourusername/mindflow.git
git push -u origin main
```

2. **在 Railway/Render 创建服务**
   - 连接 GitHub 仓库
   - 设置根目录为 `backend`
   - 配置环境变量
   - 部署

3. **配置域名和 HTTPS**
   - 在平台设置自定义域名
   - 启用 HTTPS

### 前端小程序发布

1. **构建生产版本**
```bash
cd frontend
npm run build:weapp
```

2. **微信开发者工具**
   - 点击"上传"
   - 填写版本号
   - 提交审核

3. **微信小程序后台**
   - 登录 https://mp.weixin.qq.com
   - 提交审核
   - 发布上线

## 🔧 配置检查清单

### 后端检查

- [ ] `.env` 文件已创建并配置
- [ ] 所有 API Keys 有效
- [ ] 数据库连接正常
- [ ] 后端服务启动无错误
- [ ] 健康检查端点可访问

### 前端检查

- [ ] API 地址配置正确
- [ ] 小程序 AppID 配置正确
- [ ] 构建成功无错误
- [ ] 真机测试通过

### 数据库检查

- [ ] 所有表已创建
- [ ] 索引已添加
- [ ] 触发器正常工作
- [ ] 连接权限正确

## 🐛 常见问题

### 1. 后端启动失败

**问题**: `Error: Cannot find module 'xxx'`

**解决**:
```bash
cd backend
npm install
```

### 2. 数据库连接失败

**问题**: `Connection refused`

**解决**:
- 检查 PostgreSQL 是否运行: `docker ps`
- 检查连接字符串是否正确
- 检查防火墙设置

### 3. LLM 调用失败

**问题**: `API Key not configured`

**解决**:
- 检查 `.env` 文件是否存在
- 检查 API Key 是否正确
- 检查 API Key 是否已激活

### 4. 小程序构建失败

**问题**: `Cannot resolve module`

**解决**:
```bash
cd frontend
rm -rf node_modules
npm install
```

## 📊 监控和日志

### 查看后端日志

```bash
# 开发环境
npm run dev

# 生产环境 (PM2)
pm2 logs mindflow
```

### 查看性能指标

后端会自动记录性能指标，包括：
- LLM 调用延迟
- API 请求延迟
- 缓存命中率
- 工作流完成率

### 健康检查

```bash
curl http://localhost:3001/health
```

## 🔒 安全建议

1. **不要在代码中硬编码 API Keys**
2. **使用环境变量管理敏感信息**
3. **生产环境启用 HTTPS**
4. **配置 CORS 白名单**
5. **定期轮换 API Keys**
6. **启用数据库访问控制**

## 📞 获取帮助

遇到问题？

1. 查看日志文件
2. 检查环境变量配置
3. 确认服务状态
4. 联系开发团队

---

**部署完成后，MindFlow 就可以使用了！** 🎉
