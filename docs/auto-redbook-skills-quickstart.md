# Auto-Redbook-Skills 快速开始指南

## 🎯 一分钟上手

### 前置准备（仅首次需要）

```bash
# 1. 确认项目已安装
ls ~/.cursor/skills/Auto-Redbook-Skills

# 2. 安装 Chromium 浏览器（必须）
cd ~/.cursor/skills/Auto-Redbook-Skills
npx playwright install chromium

# 如果网络不稳定,使用镜像：
export PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
npx playwright install chromium
```

---

## 🚀 三步生成小红书图片

### Step 1: 准备 Markdown 文件

创建文件 `my-note.md`:

```markdown
---
emoji: "💡"
title: "你的标题（≤15字）"
subtitle: "副标题（≤15字）"
---

# 第一部分标题

这里是内容...

---

# 第二部分标题

更多内容...
```

### Step 2: 渲染图片

```bash
# 推荐命令（自动分页）
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  my-note.md \
  -t professional \
  -m auto-split \
  -o output

# 简化版
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py my-note.md
```

### Step 3: 查看结果

```bash
ls output/
# cover.png    <- 封面
# card_1.png   <- 正文卡片1
# card_2.png   <- 正文卡片2
# ...
```

---

## 🎨 主题选择速查

| 主题 | 风格 | 适合内容 | 命令参数 |
|---|---|---|---|
| **professional** | 专业商务 | 职场、商业、严肃话题 | `-t professional` |
| **terminal** | 命令行 | 技术、理性分析、数据 | `-t terminal` |
| **sketch** | 手绘素描 | 思考、哲学、人文 | `-t sketch` |
| **retro** | 复古怀旧 | 回忆、时代感 | `-t retro` |
| **botanical** | 植物自然 | 健康、环保、生活 | `-t botanical` |
| **playful-geometric** | 活泼几何 | 轻松、创意、年轻 | `-t playful-geometric` |
| **neo-brutalism** | 新粗野 | 前卫、设计感 | `-t neo-brutalism` |
| **default** | 简约灰 | 通用 | 默认或 `-t default` |

---

## 📐 分页模式速查

| 模式 | 特点 | 适合场景 | 命令参数 |
|---|---|---|---|
| **auto-split** ⭐ | 自动智能切分 | 长文内容(推荐) | `-m auto-split` |
| **separator** | 手动 `---` 分隔 | 精确控制分页 | `-m separator` 或默认 |
| **auto-fit** | 固定尺寸缩放 | 封面+单张内容 | `-m auto-fit` |
| **dynamic** | 动态调整高度 | 中等长度(<550字) | `-m dynamic` |

---

## 💡 实战案例

### 案例 1: 职场深度分析文章

**内容**: 2000字的职场洞察  
**推荐方案**:
```bash
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  workplace-analysis.md \
  -t professional \
  -m auto-split \
  -o output/workplace
```

### 案例 2: 技术教程

**内容**: 包含代码块的技术文章  
**推荐方案**:
```bash
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  tech-tutorial.md \
  -t terminal \
  -m auto-split \
  -o output/tech
```

### 案例 3: 生活感悟

**内容**: 300字的短小感悟  
**推荐方案**:
```bash
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  life-thoughts.md \
  -t sketch \
  -m auto-fit \
  -o output/life
```

---

## 🔧 常见问题

### Q1: 渲染一直卡住不动？
**A**: Chromium 浏览器未安装或启动失败
```bash
# 检查是否已安装
npx playwright list

# 重新安装
npx playwright install chromium
```

### Q2: 提示 "Cannot find module"？
**A**: Node.js 依赖未完整安装
```bash
cd ~/.cursor/skills/Auto-Redbook-Skills
npm install yaml marked playwright
```

### Q3: 图片太模糊？
**A**: 提高 DPR（设备像素比）
```bash
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  my-note.md \
  --dpr 3
```

### Q4: 内容被截断了？
**A**: 切换到 auto-split 模式
```bash
-m auto-split
```

### Q5: 想自定义尺寸？
**A**: 使用 --width 和 --height
```bash
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  my-note.md \
  --width 1200 \
  --height 1600
```

---

## 📝 Markdown 写作技巧

### 封面元数据
```markdown
---
emoji: "💡"        # 封面装饰 emoji
title: "核心主题"   # 大标题（≤15字）
subtitle: "副标题"  # 副标题（≤15字）
---
```

### 正文排版
- **标题**: 使用 `#` `##` `###`
- **段落**: 空行分隔
- **列表**: 使用 `-` 或 `1.`
- **引用**: 使用 `>`
- **代码**: 使用 ` ``` `
- **强调**: 使用 `**粗体**`

### 分页控制
```markdown
# 第一部分内容
...

---

# 第二部分内容
...
```

---

## 🎯 本次测试文件

如果要测试飞书文档内容,已为你准备好3个版本:

```bash
# 完整版（2200字，4-5张卡片）
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  /Users/zuolin1/article-collector/xhs-test-full.md \
  -t professional \
  -m auto-split \
  -o /Users/zuolin1/article-collector/xhs-test-output/professional

# 精简版（400字，1张卡片）
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  /Users/zuolin1/article-collector/xhs-test-short.md \
  -t sketch \
  -m auto-fit \
  -o /Users/zuolin1/article-collector/xhs-test-output/sketch

# 中等版（900字，1-2张卡片）
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/render_xhs.py \
  /Users/zuolin1/article-collector/xhs-test-medium.md \
  -t terminal \
  -m dynamic \
  -o /Users/zuolin1/article-collector/xhs-test-output/terminal
```

---

## 📤 小红书发布（可选）

### 1. 配置 Cookie
```bash
cp ~/.cursor/skills/Auto-Redbook-Skills/env.example.txt \
   ~/.cursor/skills/Auto-Redbook-Skills/.env

# 编辑 .env 文件，添加:
# XHS_COOKIE=your_cookie_here
```

### 2. 发布笔记
```bash
python3 ~/.cursor/skills/Auto-Redbook-Skills/scripts/publish_xhs.py \
  --title "你的笔记标题" \
  --desc "笔记描述内容 #标签1 #标签2" \
  --images output/cover.png output/card_1.png output/card_2.png
```

---

## 🎨 查看 Demo 示例

项目自带完整的渲染示例:

```bash
# 查看所有主题效果
open ~/.cursor/skills/Auto-Redbook-Skills/demos/Sketch/cover.png
open ~/.cursor/skills/Auto-Redbook-Skills/demos/terminal/cover.png
open ~/.cursor/skills/Auto-Redbook-Skills/demos/retro/cover.png
open ~/.cursor/skills/Auto-Redbook-Skills/demos/playful-geometric/cover.png
```

---

## 🔗 相关链接

- **项目仓库**: https://github.com/comeonzhj/Auto-Redbook-Skills
- **详细测试报告**: `docs/auto-redbook-skills-test-report.md`
- **Playwright 文档**: https://playwright.dev/

---

**最后更新**: 2026-02-07  
**快速支持**: 如遇问题请参考测试报告或提 Issue
