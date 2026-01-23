# 文章收藏助手 - 飞书机器人

一个飞书机器人，帮你自动收藏网络文章到飞书云文档和知识库。

## 功能特点

- **一键收藏**: 发送文章链接给机器人，自动完成抓取和保存
- **飞书剪存支持**: 支持飞书云文档链接，自动转存到知识库（解决微信/知乎防爬问题）
- **智能提取**: 使用 Jina Reader API 智能提取文章内容和元信息
- **直接内容保存**: 复制文章内容直接发送，也能保存到云文档
- **云文档存储**: 自动创建飞书云文档，保留原文格式
- **知识库整理**: 自动添加到指定知识库，便于管理
- **表格记录**: 元信息写入多维表格，方便检索和统计
- **重复检测**: 自动检测已收藏文章，避免重复
- **防爬处理**: 智能检测防爬网站，提供替代方案

## 支持的文章来源

- 微信公众号
- 知乎
- 掘金
- CSDN
- 简书
- 36氪
- InfoQ
- 其他网页文章

## 快速开始

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret

### 2. 配置应用权限

在「权限管理」中申请以下权限：

| 权限 | 说明 |
|------|------|
| `im:message` | 接收消息 |
| `im:message:send_as_bot` | 发送消息 |
| `docx:document` | 创建云文档 |
| `wiki:wiki` | 知识库操作 |
| `bitable:app` | 多维表格操作 |

### 3. 启用机器人能力

1. 在「应用能力」中启用「机器人」
2. 在「事件订阅」中选择「使用长连接接收事件」
3. 添加事件 `im.message.receive_v1`

### 4. 准备知识库和多维表格

1. 创建一个知识库空间，记录空间 ID
2. 创建一个多维表格，包含以下字段：

| 字段名 | 类型 |
|--------|------|
| 标题 | 文本 |
| 作者 | 文本 |
| 发布时间 | 日期 |
| 来源 | 文本 |
| 原文链接 | 超链接 |
| 摘要 | 文本 |
| 文档链接 | 超链接 |
| 收藏时间 | 日期 |

### 5. 安装和配置

```bash
# 克隆项目
cd article-collector

# 安装依赖
npm install

# 复制配置文件
cp .env.example .env

# 编辑配置
vim .env
```

配置 `.env` 文件：

```bash
# 飞书应用配置（必填）
LARK_APP_ID=cli_xxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxx

# 知识库配置（必填）
WIKI_SPACE_ID=xxxxxxxx
WIKI_PARENT_NODE_TOKEN=  # 可选，指定父节点

# 多维表格配置（必填）
BITABLE_APP_TOKEN=xxxxxxxx
BITABLE_TABLE_ID=tblxxxxxxxx

# 可选配置
JINA_API_KEY=  # Jina Reader API Key，可增加配额
LOG_LEVEL=info
```

### 6. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 使用方法

### 方式 1：发送文章链接（推荐）

直接给机器人发送文章链接：

```
https://www.ruanyifeng.com/blog/2025/01/weekly-issue-334.html
```

机器人会自动：
1. 抓取文章内容
2. 创建云文档
3. 添加到知识库
4. 记录到多维表格

### 方式 2：使用飞书剪存（微信/知乎推荐）

**适用场景**：微信公众号、知乎等有防爬机制的网站

**步骤**：
1. 在微信/知乎打开文章
2. 点击「分享」→「剪存到飞书」
3. 复制生成的飞书文档链接
4. 发送给机器人

机器人会自动将文档转存到知识库并记录。

### 方式 3：直接发送内容

复制文章全文（200字以上）直接发送给机器人，会弹出确认卡片，点击确认后保存。

### 命令列表

| 命令 | 说明 |
|------|------|
| `/帮助` | 显示帮助信息 |
| `/状态` | 查看服务状态 |

## 项目结构

```
article-collector/
├── src/
│   ├── index.ts              # 主入口
│   ├── config.ts             # 配置管理
│   ├── handlers/
│   │   └── message.ts        # 消息处理器
│   ├── services/
│   │   ├── lark-client.ts    # 飞书 API 客户端
│   │   ├── lark-doc.ts       # 云文档服务
│   │   ├── lark-wiki.ts      # 知识库服务
│   │   ├── lark-bitable.ts   # 多维表格服务
│   │   └── jina-reader.ts    # 文章抓取服务
│   ├── utils/
│   │   ├── logger.ts         # 日志工具
│   │   └── url-parser.ts     # URL 解析
│   └── types/
│       └── article.ts        # 类型定义
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 技术栈

- **运行时**: Node.js 20+
- **语言**: TypeScript
- **飞书 SDK**: @larksuiteoapi/node-sdk
- **HTTP 客户端**: axios
- **配置校验**: zod

## 常见问题

### Q: 文章抓取失败怎么办？

A: 检查以下几点：
1. 文章链接是否有效
2. 网络是否正常
3. 部分网站可能有反爬措施，可尝试配置 Jina API Key

### Q: 文档创建失败怎么办？

A: 检查应用权限是否已申请并审批通过：
- `docx:document`
- `wiki:wiki`

### Q: 如何获取知识库空间 ID？

A: 打开知识库，从 URL 中获取：
```
https://feishu.cn/wiki/{space_id}/...
```

### Q: 如何获取多维表格 Token？

A: 打开多维表格，从 URL 中获取：
```
https://feishu.cn/base/{app_token}?table={table_id}
```

## License

MIT
