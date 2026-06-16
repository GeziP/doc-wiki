# Doc Writer

> Claude Code skill，从真实源码生成可验证的、离线可用的技术文档。

`技术文档` `设计文档` `架构` `guide` `deepwiki` `API文档` `模块文档` `系统设计` `HTML生成` `校验`

## About

把真实源码转成可验证的、离线可用的工程文档。不是营销页、不是 PPT——是"读完能上手干活"的技术文档。

支持三种文档类型：**module**（单模块 API 参考）、**system**（系统架构全景）、**guide**（端到端上手教程）。每种类型有独立的工作流、HTML 模板和校验规则，共享一套设计系统（6 套皮肤、暗色模式、响应式布局）。

核心原则：先读后写、不许编造、颜色锁死、零装饰、零外链、每图必说、引用溯源。

## Guide — 上手指南

### 安装

```bash
# 复制到 Claude Code skills 目录
cp -r doc-wiki ~/.claude/skills/doc-writer
```

### 使用

在 Claude Code 中对任意项目说：

| 你说 | 生成什么 |
|------|---------|
| "给 TaskScheduler 写文档" | `doc/tech-docs/TaskScheduler_Design.md + .html` |
| "写系统设计文档" | `doc/<Name>_Design.md + .html` |
| "写项目指南 / guide" | `guide.html` |
| "分模块写文档" | 批量生成所有模块文档 + 索引页 |

不明确时会先问你选哪种类型。

### 三种文档类型

| 类型 | 定位 | 输出 | 适用场景 |
|------|------|------|---------|
| **module** | API 参考手册 | `.md` + `.html`，12 章框架 | 单个模块/类的详细设计 |
| **system** | 架构全景图 | `.md` + `.html`，Mermaid 架构图 | 整个系统的分层架构 |
| **guide** | 端到端教程 | 单文件 `.html`，沿数据流叙事 | 新人上手、排障 |

### 前置条件

- Node.js（运行校验和 MD→HTML 转换脚本）
- Claude Code（作为 skill 运行）

## System — 架构概览

```
doc-writer/
├── SKILL.md                      # Skill 主入口，路由 + 铁律 + 工作流
├── references/
│   ├── guide-workflow.md         # Guide 类型详细流程
│   ├── system-workflow.md        # System 类型详细流程
│   ├── module-workflow.md        # Module 类型详细流程
│   └── html-components.md        # 共享 HTML 组件规范 + 设计 Token
├── templates/
│   ├── guide.html                # Guide HTML 骨架
│   ├── system-design.html        # System HTML 骨架
│   ├── module-design.html        # Module HTML 骨架
│   ├── module-design.md          # Module MD 模板（中文）
│   ├── module-design.en.md       # Module MD 模板（英文）
│   ├── module-summary.md         # 模块摘要模板
│   ├── module-index.html         # 模块索引页模板
│   └── system-index.html         # 系统索引页模板
├── scripts/
│   ├── doc-shell.css             # 共享设计系统（~30KB）
│   ├── doc-shell.js              # 运行时功能（TOC/ScrollSpy/高亮/缩放）
│   ├── skin-switcher.js          # 6 套皮肤切换
│   ├── md-to-html.js             # MD → HTML 转换
│   ├── validate-doc.js           # 文档校验（16 类检查）
│   └── inline-shared.js          # CSS/JS → 模板同步
└── examples/
    ├── guide-content-example.html
    ├── system-content-example.html
    └── module-content-example.html
```

### 工作流程

```
Phase 0: 分析源码（先读后写，记录 file:line）
    ↓
Phase 1: 结构设计（按类型选章节框架）
    ↓
Phase 2: 内容生成（MD + HTML 双格式 / 仅 HTML）
    ↓
Phase 3: 校验交付（validate-doc.js 16 类检查 + 视觉自审）
```

### 共享运行时

三个文件被所有文档类型共享，通过 `@sync` 标记嵌入模板：

| 文件 | 职责 |
|------|------|
| `doc-shell.css` | 设计系统：字号梯度、间距规则、颜色变量、组件样式 |
| `doc-shell.js` | TOC 自动生成、ScrollSpy、代码高亮、图表缩放、Mermaid 暗色 |
| `skin-switcher.js` | Teal / Editorial / Vellum / Mono / Carto / Signal 6 套皮肤 |

修改后运行同步：

```bash
node scripts/inline-shared.js --sync
```

## Module — 核心模块

### md-to-html.js — 转换器

将 Markdown 文档转为带完整样式的单文件 HTML。

```bash
# 单文件转换
node scripts/md-to-html.js --type module doc/tech-docs/Task_Design.md
node scripts/md-to-html.js --type system doc/Architecture_Design.md
node scripts/md-to-html.js --type guide  doc/Guide.md

# 批量转换
node scripts/md-to-html.js --type module --all

# 生成索引页
node scripts/md-to-html.js --type module --index "ProjectName" "description"
```

### validate-doc.js — 校验器

16 类自动化检查，`--fix` 可自动修复部分问题：

```bash
node scripts/validate-doc.js --type module --new-doc doc/tech-docs/Task_Design.html
```

校验项：Mermaid 语法、章节 ID 唯一性、代码块标签、表格结构、TOC 完整性、源码引用格式、术语表、Scope 声明、视觉约束（无渐变/大阴影/外链图片/硬编码色）、SVG 护栏、图说完整性、空章节、重复内容、内容密度。

### SKILL.md — 路由与规则

Skill 主入口，包含：

- **文档类型路由**：根据触发词分发到 guide / system / module / batch
- **7 条铁律**：先读后写、不许编造、颜色锁死、零装饰、零外链、每图必说、引用溯源
- **内容驱动深度**：章节取舍判据是源码复杂度，不是模板框架
- **先问后做原则**：不确定时必须用 AskQuestion 询问

### templates/ — HTML 骨架

每个模板提供完整的 HTML 骨架（CSS/JS 已内嵌），内容填入 `{{SECTIONS}}` 占位符：

- **guide.html** — 侧边栏 TOC、badge 标注、步骤指示器、暗色模式
- **system-design.html** — Mermaid 渲染、模块折叠面板、交互式图表缩放
- **module-design.html** — Tabs API 展示、SVG 图表、可折叠章节

### html-components.md — 设计规范

共享的 HTML 组件规范和设计 Token 硬约束：

- 字号梯度（H1 32px → H2 22px → H3 17px → body 15px）
- 间距规则（4px 步进）
- 圆角上限 8px（药丸 badge 除外）
- 颜色全部来自 CSS 变量，禁止硬编码 hex

### inline-shared.js — 模板同步

CSS/JS 修改后，将变更同步到所有 HTML 模板的 `@sync` 标记区域：

```bash
node scripts/inline-shared.js --sync
```

## 铁律

1. **不读源码不动手** — 没读过的函数/类/模块 = 不存在
2. **不许编造** — 宁可 `<!-- TODO -->` 也不造假
3. **颜色锁死** — 只用 CSS 变量，禁止 inline `color: #hex`
4. **零装饰** — 无渐变、大阴影、blur、浮起动画
5. **零外链** — 图表用 SVG/CSS/Mermaid 内联
6. **每图必说** — 所有图表必须有 `<figcaption>`
7. **引用溯源** — 代码引用必须带 `file:line`
