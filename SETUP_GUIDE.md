# MindFlow 配置指南

> 项目已上传至 GitHub，按照本指南完成配置后即可运行。

---

## 📍 GitHub 仓库地址

**仓库 URL**: https://github.com/lzl90327/article-collector.git

**提交记录**: `63f1f6d` - feat: MindFlow v1.0.0 - 完整内容创作平台

---

## 🔧 必须完成的配置

### 1. 后端环境配置

**文件**: `mindflow-project/backend/.env`

```bash
# 1. 复制环境变量模板
cd mindflow-project/backend
cp .env.example .env

# 2. 编辑 .env 文件，填写以下配置
```

**必填项**:

| 配置项 | 说明 | 获取方式 |
|--------|------|----------|
| `DATABASE_URL` | PostgreSQL 数据库连接 | Supabase 或本地 PostgreSQL |
| `JWT_SECRET` | JWT 签名密钥 | 随机生成 32 位以上字符串 |
| `WECHAT_APPID` | 微信小程序 AppID | 微信公众平台 |
| `WECHAT_SECRET` | 微信小程序密钥 | 微信公众平台 |

**可选配置** (功能受限):

| 配置项 | 说明 | 获取方式 |
|--------|------|----------|
| `FEISHU_APP_ID` | 飞书应用 ID | 飞书开放平台 |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | 飞书开放平台 |
| `COZE_API_KEY` | Coze API 密钥 | Coze 平台 |
| `DEEPSEEK_API_KEY` | DeepSeek API | DeepSeek 官网 |
| `OPENAI_API_KEY` | OpenAI API | OpenAI 官网 |

---

### 2. 小程序配置

**文件**: `mindflow-client/.env`

```bash
# 1. 复制环境变量模板
cd mindflow-client
cp .env.example .env

# 2. 编辑 .env 文件
```

**必填项**:

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `TARO_APP_API_URL` | 后端 API 地址 | `http://localhost:3000/api` |
| `TARO_APP_ID` | 小程序 AppID | `wx1234567890abcdef` |

---

### 3. 微信小程序配置

**微信公众平台**: https://mp.weixin.qq.com

**需要配置**:

1. **开发设置** → **服务器域名**
   - request 合法域名: `https://your-domain.com`
   - uploadFile 合法域名: `https://your-domain.com`
   - downloadFile 合法域名: `https://your-domain.com`

2. **开发设置** → **AppID 和 AppSecret**
   - 记录 AppID 和 AppSecret，填入后端 `.env`

---

### 4. 数据库初始化

```bash
cd mindflow-project/backend

# 1. 安装依赖
npm install

# 2. 生成 Prisma 客户端
npx prisma generate

# 3. 执行数据库迁移
npx prisma migrate dev

# 4. (可选) 查看数据库
npx prisma studio
```

---

### 5. 启动服务

**终端 1 - 启动后端**:
```bash
cd mindflow-project/backend
npm run dev
# 服务运行在 http://localhost:3000
```

**终端 2 - 构建小程序**:
```bash
cd mindflow-client
npm install
npm run build:weapp
# 编译后的代码在 dist/ 目录
```

---

### 6. 微信开发者工具配置

1. **下载安装**: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

2. **导入项目**:
   - 点击「+」→「导入项目」
   - 项目目录: `/Users/zuolin1/article-collector/mindflow-client`
   - AppID: 填写你的小程序 AppID
   - 点击「导入」

3. **开发设置**:
   - 点击「详情」→「本地设置」
   - ✅ 勾选「不校验合法域名、web-view...」
   - ✅ 勾选「启用代码压缩」

4. **预览测试**:
   - 点击「编译」查看效果
   - 点击「预览」生成二维码，手机扫码测试

---

## 🚀 部署上线

### 后端部署 (以 Railway 为例)

1. 登录 https://railway.app
2. 点击「New Project」→「Deploy from GitHub repo」
3. 选择 `article-collector` 仓库
4. 设置根目录: `mindflow-project/backend`
5. 添加环境变量 (从 `.env` 复制)
6. 部署完成后记录域名

### 小程序上线

1. **微信公众平台** → **版本管理**
2. 点击「提交审核」
3. 填写版本信息、功能介绍
4. 等待审核通过
5. 点击「发布」

---

## 📋 配置检查清单

### 开发环境

- [ ] 后端 `.env` 配置完成
- [ ] 小程序 `.env` 配置完成
- [ ] 数据库迁移成功
- [ ] 后端服务启动正常
- [ ] 小程序编译成功
- [ ] 微信开发者工具导入成功
- [ ] 登录功能测试通过

### 生产环境

- [ ] 后端部署到云服务器
- [ ] 数据库使用生产环境
- [ ] 小程序服务器域名配置
- [ ] 小程序提交审核
- [ ] 小程序发布上线

---

## 🐛 常见问题

### 1. 后端启动失败

```bash
# 错误: DATABASE_URL 未配置
# 解决: 确保 .env 文件存在且配置正确
cp .env.example .env
# 编辑 .env 填写数据库地址
```

### 2. 小程序编译失败

```bash
# 错误: 找不到模块
# 解决: 重新安装依赖
cd mindflow-client
rm -rf node_modules
npm install
npm run build:weapp
```

### 3. 登录失败

```bash
# 错误: 微信登录失败
# 检查:
# 1. WECHAT_APPID 和 WECHAT_SECRET 是否正确
# 2. 小程序 AppID 是否匹配
# 3. 后端服务是否正常运行
```

### 4. API 请求失败

```bash
# 错误: request:fail
# 解决:
# 1. 微信开发者工具 → 详情 → 本地设置 → 勾选「不校验合法域名」
# 2. 或配置服务器域名
```

---

## 📞 技术支持

- **GitHub Issues**: https://github.com/lzl90327/article-collector/issues
- **微信开发者文档**: https://developers.weixin.qq.com/miniprogram/dev/
- **Taro 文档**: https://taro.zone/
- **Prisma 文档**: https://www.prisma.io/docs/

---

**配置完成日期**: 2026-02-21  
**版本**: v1.0.0
