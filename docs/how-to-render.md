# 使用系统 Chrome 渲染小红书图片

## 🚀 快速开始

已为您配置好使用系统 Google Chrome 的渲染脚本：`render_with_chrome.js`

### 基础用法

```bash
cd /Users/zuolin1/article-collector

node render_with_chrome.js <你的markdown文件> -t <主题> -m <模式> -o <输出目录>
```

---

## 📋 常用命令

### 1. Professional 主题（推荐用于职场内容）

```bash
node render_with_chrome.js your-content.md \
  -t professional \
  -m auto-split \
  -o output/professional
```

### 2. Sketch 主题（适合思考类内容）

```bash
node render_with_chrome.js your-content.md \
  -t sketch \
  -m auto-fit \
  -o output/sketch
```

### 3. Terminal 主题（适合技术内容）

```bash
node render_with_chrome.js your-content.md \
  -t terminal \
  -m dynamic \
  -o output/terminal
```

---

## 🎨 可用主题

| 主题 | 参数 | 适合内容 |
|---|---|---|
| 专业商务 | `-t professional` | 职场、商业、严肃话题 |
| 手绘素描 | `-t sketch` | 思考、哲学、人文 |
| 终端命令行 | `-t terminal` | 技术、理性分析 |
| 复古怀旧 | `-t retro` | 回忆、时代感 |
| 植物自然 | `-t botanical` | 健康、环保 |
| 活泼几何 | `-t playful-geometric` | 轻松、创意 |
| 新粗野主义 | `-t neo-brutalism` | 前卫、设计 |
| 默认简约 | `-t default` | 通用 |

---

## 📏 分页模式

| 模式 | 参数 | 说明 | 适合场景 |
|---|---|---|---|
| 自动切分 | `-m auto-split` | 智能分页 | 长文（推荐） |
| 手动分隔 | `-m separator` | 按 `---` 分隔 | 精确控制 |
| 自动缩放 | `-m auto-fit` | 固定尺寸缩放 | 短文 |
| 动态高度 | `-m dynamic` | 根据内容调整 | 中等长度 |

---

## 📝 Markdown 文件格式

```markdown
---
emoji: "💡"
title: "核心主题（≤15字）"
subtitle: "副标题说明（≤15字）"
---

# 第一部分标题

内容文字...

## 小标题

- 列表项 1
- 列表项 2

> 引用文字

---

# 第二部分标题

更多内容...
```

---

## ⚙️ 高级参数

```bash
node render_with_chrome.js content.md \
  --theme professional \
  --mode auto-split \
  --output-dir output/ \
  --width 1080 \
  --height 1440 \
  --dpr 2
```

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--width` | 图片宽度 | 1080 |
| `--height` | 图片高度 | 1440 |
| `--max-height` | 最大高度（dynamic模式） | 2160 |
| `--dpr` | 设备像素比（清晰度） | 2 |

---

## 🔧 如果要修改 Chrome 路径

编辑 `render_with_chrome.js`，找到第 431 行：

```javascript
const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
```

改为你的 Chrome 路径。

---

## 📁 输出结果

渲染完成后，输出目录会包含：

```
output/
├── cover.png       # 封面
├── card_1.png      # 第1张卡片
├── card_2.png      # 第2张卡片
└── ...
```

---

## 💡 使用技巧

### 1. 批量渲染多个主题

```bash
# 一次生成 3 套主题对比
node render_with_chrome.js content.md -t professional -m auto-split -o output/pro
node render_with_chrome.js content.md -t sketch -m auto-split -o output/sketch
node render_with_chrome.js content.md -t terminal -m auto-split -o output/term
```

### 2. 提高清晰度

```bash
# 使用 3x 像素比（文件会更大）
node render_with_chrome.js content.md -t professional --dpr 3 -o output/
```

### 3. 自定义尺寸

```bash
# 生成正方形图片（1:1）
node render_with_chrome.js content.md --width 1080 --height 1080 -o output/
```

---

## ⚠️ 常见问题

### Q: 渲染很慢？
A: 首次启动 Chrome 需要 20-40 秒，属于正常现象。

### Q: 图片模糊？
A: 增加 `--dpr 3` 参数提高清晰度。

### Q: 内容被截断？
A: 使用 `-m auto-split` 模式自动分页。

### Q: 字体不好看？
A: 脚本使用 Google Fonts 的"思源黑体"，需要网络加载。

---

## 📚 示例：本次测试命令

```bash
# 测试 1: Professional（完整版）
node render_with_chrome.js xhs-test-full.md \
  -t professional \
  -m auto-split \
  -o xhs-test-output/professional

# 测试 2: Sketch（精简版）
node render_with_chrome.js xhs-test-short.md \
  -t sketch \
  -m auto-fit \
  -o xhs-test-output/sketch

# 测试 3: Terminal（中等版）
node render_with_chrome.js xhs-test-medium.md \
  -t terminal \
  -m dynamic \
  -o xhs-test-output/terminal
```

---

**位置**: `/Users/zuolin1/article-collector/render_with_chrome.js`  
**文档**: `docs/` 目录下有完整的使用指南和测试报告
