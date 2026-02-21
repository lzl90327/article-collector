# MindFlow API 契约文档

> 版本: Phase1  
> 日期: 2026-02-20  
> 协议: REST + SSE (主) / Polling (兜底)

---

## 目录

1. [通用规范](#通用规范)
2. [Session API](#session-api)
3. [Artifact API](#artifact-api)
4. [Job API](#job-api)
5. [SSE 协议](#sse-协议)
6. [Polling 协议](#polling-协议)
7. [错误处理](#错误处理)

---

## 通用规范

### 基础 URL
```
https://api.mindflow.app/api
```

### 认证
所有请求需在 Header 中携带:
```
Authorization: Bearer {token}
```

### 响应格式
```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": 1739952000,
    "request_id": "req_xxx"
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "retryable": false
  }
}
```

### 分页参数
```
?limit=20&offset=0
```

---

## Session API

### POST /sessions
创建新会话

**Request:**
```typescript
{
  title: string;           // 文章标题
  mode: "argument" | "observation";
  initial_context?: object;
}
```

**Response:**
```typescript
{
  session: {
    id: string;
    title: string;
    mode: "argument" | "observation";
    phase: string;
    substate: "idle" | "await_confirm" | "await_select" | "await_free_text";
    pending_input: string | null;
    brief_confirmed: boolean;
    created_at: string;
    updated_at: string;
  }
}
```

---

### GET /sessions/:sessionId
获取会话详情

**Response:**
```typescript
{
  session: Session;
  latest_artifacts: {
    brief?: ArtifactSummary;
    outline?: ArtifactSummary;
    draft?: ArtifactSummary;
    review?: ArtifactSummary;
  };
}
```

---

### PATCH /sessions/:sessionId
更新会话

**Request:**
```typescript
{
  title?: string;
  phase?: string;
  substate?: "idle" | "await_confirm" | "await_select" | "await_free_text";
  pending_input?: string | null;
  state_json?: object;
  brief_confirmed?: boolean;
}
```

**Response:**
```typescript
{
  session: Session;
}
```

---

### GET /sessions/:sessionId/next-actions
获取下一步操作建议

**Response:**
```typescript
{
  next_actions: [
    { id: string; label: string; primary: boolean }
  ];
  context: {
    current_phase: string;
    substate: string;
    pending_input: string | null;
    can_proceed: boolean;
    blockers?: string[];
  };
}
```

---

## Artifact API

### GET /sessions/:sessionId/artifacts
获取会话的工件列表

**Query:**
```
?kind=draft&limit=20&offset=0
```

**Response:**
```typescript
{
  artifacts: ArtifactSummary[];
  total: number;
}
```

---

### POST /sessions/:sessionId/artifacts
创建工件（手动保存）

**Request:**
```typescript
{
  kind: "brief_card" | "outline" | "draft" | "review_report" | "publish_record";
  title?: string;
  content: string;         // Markdown
  meta_json?: object;
  source_job_id?: string;
}
```

**Response:**
```typescript
{
  artifact: Artifact;
}
```

---

### GET /artifacts/:artifactId
获取工件详情

**Response:**
```typescript
{
  artifact: {
    id: string;
    session_id: string;
    kind: string;
    version: number | null;
    title: string | null;
    content: string;
    meta_json: object;
    source_job_id: string | null;
    created_at: string;
  }
}
```

---

### POST /artifacts/:artifactId/rollback
回滚工件（创建新版本指向旧内容）

**Request:**
```typescript
{
  title?: string;
}
```

**Response:**
```typescript
{
  artifact: Artifact;  // 新创建的 artifact
}
```

---

### GET /sessions/:sessionId/artifacts/latest
获取最新工件

**Query:**
```
?kind=draft|outline|brief|review
```

**Response:**
```typescript
{
  artifact: Artifact | null;
}
```

---

## Job API

### POST /jobs
创建 Job

**Request:**
```typescript
{
  session_id: string;
  task: "generate_outline" | "generate_draft" | "review" | "rewrite_paragraph" | "publish_dry_run" | "publish";
  phase: string;
  inputs?: {
    brief_artifact_id?: string;
    outline_artifact_id?: string;
    style_preset?: string;
    paragraph_index?: number;
    original_text?: string;
    instruction?: string;
    artifact_id?: string;
    preset_id?: string;
    channels?: string[];
  };
}
```

**Response:**
```typescript
{
  job: {
    job_id: string;
    status: "queued" | "running" | "paused" | "failed" | "completed" | "committed" | "cancelled";
    seq: number;
  }
}
```

**错误码:**
- `409 BRIEF_NOT_CONFIRMED`: Brief 未确认时尝试生成大纲/草稿

---

### GET /jobs/:jobId
查询 Job 状态

**Response:**
```typescript
{
  job: {
    job_id: string;
    session_id: string;
    task: string;
    status: string;
    seq: number;
    snapshot: string;        // 当前累计输出
    progress: {
      step: string;
      percent: number;
    } | null;
    error: {
      code: string;
      message: string;
      retryable: boolean;
    } | null;
    updated_at: string;
  }
}
```

---

### POST /jobs/:jobId/commit
固化为 Artifact

**Request:**
```typescript
{
  artifact_kind: "draft" | "review_report" | "outline" | "brief_card";
  mode: "new_version";
  title?: string;
}
```

**Response:**
```typescript
{
  artifact: {
    artifact_id: string;
    kind: string;
    version: number | null;
    title: string | null;
    created_at: string;
  }
}
```

**注意:**
- `draft`/`review_report` 必须创建新版本（version +1）
- 其他 kind 版本可为 null

---

### POST /jobs/:jobId/cancel
取消 Job

**Response:**
```typescript
{
  success: boolean;
  job_id: string;
  status: "cancelled";
}
```

---

## SSE 协议

### GET /jobs/:jobId/stream
SSE 事件流（主通道）

**Headers:**
```
Accept: text/event-stream
Last-Event-ID: {last_seq}  // 可选，用于恢复
```

**SSE 格式:**
```
event: job.started
id: 0
data: {"job_id":"j1","session_id":"s1","task":"generate_draft","phase":"4","ts":1739952000}

event: job.delta
id: 1
data: {"job_id":"j1","seq":1,"delta":"第一段内容...","ts":1739952001}

event: job.progress
id: 2
data: {"job_id":"j1","seq":2,"step":"drafting","percent":0.3,"ts":1739952002}

event: job.delta
id: 3
data: {"job_id":"j1","seq":3,"delta":"第二段内容...","ts":1739952003}

event: job.completed
id: 99
data: {"job_id":"j1","seq":99,"is_final":true,"ts":1739952100}
```

**事件类型:**

| 事件 | 说明 |
|------|------|
| `job.started` | Job 开始执行 |
| `job.delta` | 文本增量 |
| `job.progress` | 进度更新 |
| `job.error` | 执行错误 |
| `job.completed` | 执行完成 |
| `session.state` | Session 状态变化（可选） |

---

## Polling 协议

### GET /jobs/:jobId/poll
Polling 兜底（SSE 不可用时）

**Query:**
```
?afterSeq=42
```

**Response:**
```typescript
{
  job: {
    job_id: string;
    status: string;
    seq: number;
    updated_at: string;
  };
  events: [
    {
      seq: 43;
      type: "delta";
      payload: { delta: "..." };
    },
    {
      seq: 44;
      type: "progress";
      payload: { step: "drafting", percent: 0.5 };
    }
  ];
}
```

**客户端轮询策略:**
- `running` 状态: 900ms 间隔
- 连续 5 次无新 events: 退到 1500ms
- 请求失败: 3s → 6s → 12s 指数退避
- SSE 恢复后自动切回 SSE

---

## 错误处理

### 错误码规范

| Code | HTTP | 说明 | 重试 |
|------|------|------|------|
| `BAD_REQUEST` | 400 | 请求参数错误 | 否 |
| `UNAUTHORIZED` | 401 | 未认证 | 否 |
| `FORBIDDEN` | 403 | 无权限 | 否 |
| `NOT_FOUND` | 404 | 资源不存在 | 否 |
| `BRIEF_NOT_CONFIRMED` | 409 | Brief 未确认 | 否 |
| `RATE_LIMIT` | 429 | 频率限制 | 是 |
| `LLM_TIMEOUT` | 504 | LLM 超时 | 是 |
| `INTERNAL_ERROR` | 500 | 内部错误 | 是 |

### 错误响应示例
```typescript
{
  "success": false,
  "error": {
    "code": "BRIEF_NOT_CONFIRMED",
    "message": "Brief 未确认，无法生成大纲或草稿",
    "retryable": false,
    "details": {
      "current_phase": "2",
      "required_phase": "3"
    }
  }
}
```

---

## 恢复机制

### 中断恢复流程

1. **进入页面** → 检查 storage 中的 `active_job_id`
2. **GET /jobs/:jobId** → 获取 `snapshot` + `seq`
3. **UI 渲染** → 直接显示 `snapshot`
4. **重连 SSE** → `/stream`，带 `Last-Event-ID: seq`
5. **SSE 失败** → 自动降级 Polling

### 本地存储 Keys
```typescript
// Taro Storage Keys
const STORAGE_KEYS = {
  ACTIVE_SESSION_ID: 'mindflow:active_session_id',
  ACTIVE_JOB_ID: 'mindflow:active_job_id',
  ACTIVE_JOB_SEQ: 'mindflow:active_job_seq',
  ACTIVE_JOB_SNAPSHOT: 'mindflow:active_job_snapshot',
};
```

---

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-02-20 | Phase1 | 初始版本，定义 Session + Artifact + Job 三层模型 |
