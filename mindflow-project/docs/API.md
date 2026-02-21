# MindFlow API 文档

## 基础信息

- Base URL: `http://localhost:3001/api/mindflow`
- Content-Type: `application/json`

## 接口列表

### 1. 创建工作流

```http
POST /start
```

**请求体**
```json
{
  "input": "用户输入的主题"
}
```

**响应**
```json
{
  "workflowId": "uuid",
  "state": {
    "workflowId": "uuid",
    "currentPhase": -1,
    "context": {},
    "history": []
  },
  "response": null
}
```

### 2. 发送消息

```http
POST /:workflowId/chat
```

**请求体**
```json
{
  "input": "用户消息"
}
```

**响应**
```json
{
  "response": "AI 回复",
  "state": {
    "currentPhase": 2,
    "context": {...}
  }
}
```

### 3. 流式对话

```http
POST /:workflowId/chat/stream
```

**特性**: Server-Sent Events (SSE)

**请求体**
```json
{
  "input": "用户消息"
}
```

**响应**: 流式文本输出

### 4. 获取状态

```http
GET /:workflowId
```

**响应**
```json
{
  "workflowId": "uuid",
  "currentPhase": 4,
  "context": {...},
  "history": [...]
}
```

### 5. 触发阶段转换

```http
POST /:workflowId/trigger
```

**用途**: 强制触发下一阶段（如从 Discussion 进入 Drafting）

## 阶段说明

| Phase | 值 | 说明 |
|-------|-----|------|
| BRIEF | -1 | 生成写作简报 |
| BREAKTHROUGH | 1.5 | 破题阶段 |
| DISCUSSION | 2 | 苏格拉底式对话 |
| DRAFTING | 4 | 生成初稿 |
| AUDIT | 4.5 | 多 Agent 审计 |
| PUBLISH | 5 | 最终润色 |

## 错误处理

```json
{
  "error": "错误信息"
}
```

**状态码**
- 200: 成功
- 500: 服务器错误
