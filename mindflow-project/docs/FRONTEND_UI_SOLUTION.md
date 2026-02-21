# MindFlow 小程序前端 UI/UE 解决方案

## 技术栈选型

### 跨端框架选择

| 框架 | 推荐指数 | 特点 | 适用场景 |
|------|---------|------|---------|
| **Taro 4.x** | ⭐⭐⭐⭐⭐ | React/Vue 语法，京东出品，生态完善 | 大型项目，需要多端输出 |
| **uni-app** | ⭐⭐⭐⭐ | Vue 语法，DCloud 出品，上手快 | 中小型项目，快速开发 |

**推荐：Taro 4.x + React**
- 更好的 TypeScript 支持
- 更接近 Web 开发体验
- 组件生态更丰富
- 支持微信小程序、H5、React Native 多端输出

### UI 组件库选择

| 组件库 | 推荐指数 | 特点 | GitHub Stars |
|--------|---------|------|--------------|
| **TDesign 小程序版** | ⭐⭐⭐⭐⭐ | 腾讯出品，设计体系完整，企业级 | 3k+ |
| **Vant Weapp** | ⭐⭐⭐⭐⭐ | 有赞出品，组件丰富，文档完善 | 17k+ |
| **WeUI** | ⭐⭐⭐⭐ | 微信官方，风格统一，轻量 | 15k+ |
| **NutUI** | ⭐⭐⭐⭐ | 京东出品，适合电商场景 | 6k+ |
| **Wot Design Uni** | ⭐⭐⭐ | 支持 Vue3，现代化设计 | 1k+ |

**推荐组合：TDesign + Vant Weapp**
- TDesign：基础组件、布局、导航
- Vant Weapp：业务组件（如：SKU选择、地址选择等）

## 推荐方案详解

### 方案一：Taro + TDesign（主推方案）

```bash
# 安装 Taro
npm install -g @tarojs/cli

# 创建项目
taro init mindflow-mini
# 选择：React + TypeScript + 微信小程序 + 使用模板

# 安装 TDesign
npm install tdesign-miniprogram
```

**优势：**
- 腾讯设计体系，专业度高
- 支持深色模式
- 完善的 TypeScript 类型定义
- 主题定制能力强

**适用组件：**
- Button、Icon、Badge 基础组件
- Input、Textarea、Form 表单组件
- Dialog、Toast、ActionSheet 反馈组件
- Steps、Progress、Timeline 流程组件
- Collapse、Tabs、Swiper 展示组件

### 方案二：Taro + Vant Weapp（备选方案）

```bash
# 安装 Vant Weapp
npm install @vant/weapp
```

**优势：**
- 组件数量最多（60+）
- 业务组件丰富（商品卡片、优惠券等）
- 社区活跃，问题响应快
- 支持自定义主题

**特色组件：**
- Card、GoodsAction、SubmitBar 电商组件
- Area、AddressEdit 地址组件
- ShareSheet、Contact 业务组件

## 富文本编辑器方案

### 方案一：小程序原生 Editor（推荐）

```typescript
// 使用小程序原生 editor 组件
<Editor
  id="editor"
  placeholder="开始写作..."
  bindready="onEditorReady"
  bindinput="onInput"
/>
```

**优势：**
- 性能最好
- 与系统输入法配合好
- 支持图片、视频插入

**缺点：**
- 功能相对简单
- 自定义程度有限

### 方案二：markdown 编辑器

**推荐：ByteMD（字节跳动开源）**

```bash
npm install @bytemd/vue
```

**特点：**
- 轻量级，Svelte 构建
- 插件系统丰富
- 支持 SSR
- 安全（已处理 XSS）

**适用场景：**
- 需要 Markdown 语法的写作场景
- 需要代码高亮、数学公式

### 方案三： Isle-Editor（新兴方案）

```bash
npm install isle-editor
```

**特点：**
- 支持 Notion Style 块编辑
- 支持富文本 + Markdown 双模式
- 输出 HTML 或 JSON
- 支持拖拽重组内容块

**适用场景：**
- 需要类似 Notion 的块编辑体验
- 需要灵活的内容组织方式

## MindFlow 专用组件设计

### 1. Phase 进度指示器

```typescript
// 组件设计
interface PhaseStep {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  mode?: 'argument' | 'observation';
}

<PhaseProgress 
  steps={phaseSteps}
  currentPhase="2"
  mode="argument_mode"
/>
```

**UI 参考：**
- TDesign Steps 步骤条
- 支持双核模式切换动画
- 已完成 Phase 可点击查看产物

### 2. 对话式输入组件

```typescript
interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  type?: 'text' | 'card' | 'action';
  actions?: Action[];
}

<ChatInterface
  messages={messages}
  onSend={handleSend}
  placeholder="输入你的想法..."
  quickActions={['confirm', 'modify', 'skip']}
/>
```

**UI 参考：**
- 微信聊天界面风格
- 支持卡片式消息（Brief Card、Angle Card 等）
- 底部快捷操作栏

### 3. Brief 卡片组件

```typescript
interface BriefCardProps {
  targetAudience: string;
  existingBelief: string;
  changeGoal: string;
  thesis: string;
  evidenceStrategy: string;
  status: 'draft' | 'confirmed';
  onConfirm: () => void;
  onModify: () => void;
}

<BriefCard {...briefData} />
```

**UI 参考：**
- TDesign Card 卡片
- 字段分组展示
- 确认/修改操作按钮

### 4. 草稿编辑器组件

```typescript
interface DraftEditorProps {
  content: string;
  version: number;
  onSave: (content: string) => void;
  onSubmit: () => void;
  history: DraftVersion[];
}

<DraftEditor
  content={draftContent}
  version={currentVersion}
  history={draftHistory}
/>
```

**UI 参考：**
- 左侧：版本历史列表
- 中间：编辑器（支持 markdown）
- 右侧：AI 助手对话

### 5. 审核报告组件

```typescript
interface AuditReportProps {
  overallScore: number;
  checks: {
    category: string;
    score: number;
    passed: boolean;
    issues: string[];
    suggestions: string[];
  }[];
}

<AuditReport report={auditData} />
```

**UI 参考：**
- TDesign Progress 进度条
- TDesign Collapse 折叠面板
- 雷达图展示各维度评分

## 主题设计

### 配色方案

```scss
// 主色调
$primary: #0052D9;      // 腾讯蓝
$primary-light: #E6F0FF;
$primary-dark: #003BB3;

// 双核模式标识色
$argument-mode: #0052D9;    // 蓝色 - 论证模式
$observation-mode: #00A870; // 绿色 - 观察模式

// 功能色
$success: #00A870;
$warning: #ED7B2F;
$error: #E34D59;
$info: #0052D9;

// 中性色
$text-primary: #1D2129;
$text-secondary: #4E5969;
$text-tertiary: #86909C;
$border: #C9CDD4;
$bg: #F2F3F5;
```

### 字体规范

```scss
// 字体栈
$font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
              'Helvetica Neue', Arial, 'Noto Sans', sans-serif;

// 字号
$font-size-xs: 20rpx;    // 辅助文字
$font-size-sm: 24rpx;    // 正文（小）
$font-size-base: 28rpx;  // 正文
$font-size-lg: 32rpx;    // 小标题
$font-size-xl: 36rpx;    // 标题
$font-size-xxl: 40rpx;   // 大标题
```

## 页面结构设计

```
pages/
├── index/                 # 首页 - 开始写作
├── workflow/
│   ├── index.tsx         # 工作流主页面
│   ├── components/
│   │   ├── ChatInterface/   # 对话组件
│   │   ├── PhaseProgress/   # Phase 进度
│   │   ├── BriefCard/       # Brief 卡片
│   │   ├── DraftEditor/     # 草稿编辑器
│   │   ├── AuditReport/     # 审核报告
│   │   └── PublishConfig/   # 发布配置
│   └── hooks/
│       └── useWorkflow.ts   # 工作流状态管理
├── history/              # 历史记录
├── library/              # 素材库
└── settings/             # 设置
```

## 性能优化建议

### 1. 列表优化

```typescript
// 使用虚拟列表
import { VirtualList } from '@tarojs/components-advanced';

<VirtualList
  height={800}
  itemData={messages}
  itemSize={100}
  renderItem={renderMessage}
/>
```

### 2. 图片优化

```typescript
// 懒加载 + 占位图
<Image
  src={imageUrl}
  lazyLoad
  placeholder="base64编码的占位图"
  mode="aspectFill"
/>
```

### 3. 数据缓存

```typescript
// 使用 Taro 缓存 API
Taro.setStorageSync('workflow_draft', draftData);

// 或使用 React Query
import { useQuery } from 'react-query';

const { data } = useQuery('workflow', fetchWorkflow, {
  staleTime: 5 * 60 * 1000, // 5分钟
});
```

## 推荐开发工具

| 工具 | 用途 |
|------|------|
| **Taro CLI** | 项目脚手架、编译 |
| **VS Code** | 代码编辑器 |
| **Taro VS Code Plugin** | 代码提示、跳转 |
| **微信小程序开发者工具** | 调试、预览 |
| **Figma** | UI 设计 |
| **Iconfont** | 图标资源 |

## 开源资源汇总

### 组件库
- [TDesign 小程序版](https://github.com/Tencent/tdesign-miniprogram)
- [Vant Weapp](https://github.com/vant-ui/vant-weapp)
- [WeUI](https://github.com/Tencent/weui-wxss)
- [NutUI](https://github.com/jdf2e/nutui)

### 编辑器
- [ByteMD](https://github.com/bytedance/bytemd)
- [Isle-Editor](https://github.com/isle-editor/isle-editor)
- [Editor.md](https://github.com/pandao/editor.md)

### 工具库
- [Taro](https://github.com/NervJS/taro)
- [uni-app](https://github.com/dcloudio/uni-app)

## 实施建议

### 第一阶段：基础搭建（1-2周）
1. 搭建 Taro + React + TypeScript 项目
2. 引入 TDesign 组件库
3. 配置主题色和字体
4. 搭建页面路由结构

### 第二阶段：核心功能（3-4周）
1. 实现 ChatInterface 对话组件
2. 实现 PhaseProgress 进度组件
3. 对接后端 API
4. 实现 Brief、Discussion、Drafting 等核心 Phase

### 第三阶段：优化完善（1-2周）
1. 性能优化（虚拟列表、图片懒加载）
2. 离线缓存支持
3. 错误处理和重试机制
4. 用户反馈收集

### 第四阶段：发布迭代（持续）
1. 微信小程序发布
2. H5 版本发布
3. 根据用户反馈迭代优化
