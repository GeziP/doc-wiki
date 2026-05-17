# HTML 组件规范

所有文档类型共享的 HTML 组件参考。每个组件只有一种统一写法。

## 设计 Token 硬约束

生成 HTML 时必须遵守以下可度量的视觉约束。这些值来自 `doc-shell.css`，禁止覆盖或偏离。

### 字号梯度

| 用途 | 字号 | CSS 属性 |
|------|------|---------|
| H1（文档标题） | 32px | `font-size: 32px` |
| H2（章节标题） | 22px | `font-size: 22px` |
| H3（子章节标题） | 17px | `font-size: 17px` |
| H4（段内标题） | 15px | `font-size: 15px; font-weight: 700` |
| 正文 | 15px | `font-size: 15px` |
| 表格/列表 | 0.9rem / 0.92rem | 正文的 90-92% |
| 代码（内联） | 0.88em | 相对于父容器字号 |
| 代码块 | 0.85rem | `font-size: 0.85rem` |
| Badge/标签 | 0.72rem | `font-size: 0.72rem; font-weight: 600` |

### 间距规则

所有间距基于 **4px 步进**（4/8/12/16/20/24/28/32/40）：

| 元素 | 间距 | 说明 |
|------|------|------|
| H2 上方 | 40px | 章节间距 |
| H2 下方 | 16px | 标题与内容间距 |
| H3 上方 | 28px | 子章节间距 |
| 段落间 | 12px | `margin-bottom: 12px` |
| Callout 内边距 | 14px 18px | 上下 14px、左右 18px |
| 代码块内边距 | 16px 18px | 上下 16px、左右 18px |
| 卡片内边距 | 20px | 四边均 20px |
| 组件间距 | 16px | 大部分组件 `margin: 16px 0` |
| 表格单元格 | 12px 16px | 上下 12px、左右 16px |

### 圆角

| 元素类型 | 圆角 |
|---------|------|
| 卡片/代码块/表格 | 8px（`--radius`） |
| 内联 code | 4px（`--radius-sm`） |
| Badge | 10-12px（药丸形） |
| 按钮 | 6px |
| 步骤编号圆点 | 50%（圆形） |

### 颜色对比度

- **正文文字**（`--text`）与背景（`--bg`）对比度 ≥ **7:1**（WCAG AAA）
- **次要文字**（`--text-secondary`）与背景对比度 ≥ **4.5:1**（WCAG AA）
- **链接**（`--link`）必须与周围正文有明显区分
- **SVG 图表**中所有颜色使用 CSS 变量 + fallback 值，确保亮/暗主题均可读
- **禁止使用纯黑 `#000000` 或纯白 `#ffffff`** 作为前景/背景

### 字体栈

```
正文：  "Microsoft YaHei", "Segoe UI", system-ui, sans-serif
代码：  Consolas, "Courier New", "Fira Code", monospace
```

CJK 字体优先，拉丁回退到 system-ui。禁止使用需要网络加载的字体（Google Fonts 等），确保离线可用。

### 行高

- 正文行高：`1.7`
- 代码块行高：`1.6`
- 标题行高：`1.3`

## 视觉黑名单（Anti-AI-Slop）

以下视觉模式**严格禁止**。AI 生成的 HTML 常出现这些模式，它们会让文档看起来"一眼 AI"：

### 禁止的样式

| 禁止 | 原因 | 正确做法 |
|------|------|---------|
| `linear-gradient` 背景 | 科技感渐变是 AI slop 第一标志 | 使用纯色 CSS 变量 |
| `box-shadow` 大阴影 | 浮夸、不专业 | hover 时只改 `border-color` |
| `blur` / `filter: blur()` | 毫无信息价值的装饰 | 不用 |
| `transform: translateY(-Npx)` 浮起效果 | 卡片/按钮 hover 浮起是 AI 最爱 | hover 改边框颜色即可 |
| `border-radius > 12px` | 过度圆角 = 玩具感 | 最大 `--radius-lg: 8px`（药丸形 badge 除外） |
| 纯黑 `#000` / 纯白 `#fff` | 对比过强刺眼 | 使用 CSS 变量中的暖灰 |
| `rgba()` 作为背景色 | 不可预测，打印/导出兼容差 | 使用 solid hex |
| 多色 accent 混用 | 彩虹般的语义色 = 没有设计系统 | 主 accent 只有 teal，语义色只用于 callout |
| 外链图片 `<img src="http...">` | 离线不可用，依赖外部 | 用 CSS/SVG 内联绘制 |
| `emoji` 作为 icon | 平台渲染不一致 | 用文字或 SVG |

### 禁止的布局模式

| 禁止 | 原因 | 正确做法 |
|------|------|---------|
| 满屏 hero 区域 + 大图 | 技术文档不需要"营销感" | 简洁文档元信息头 |
| 满屏宽度撑开的元素 | 阅读疲劳 | `max-width: 960px` |
| 过密的卡片网格（>3列） | 信息量过大 | 最多 `cols-3` |
| 装饰性几何图形 | 无信息价值的装饰 | 只用有数据意义的图表 |

### 颜色锁定

生成 HTML 时，**只允许使用 `doc-shell.css` 中定义的 CSS 变量**。禁止在行内样式中写任何 hex 颜色值（SVG 的 `var()` fallback 除外）。

```html
<!-- ✅ 正确 -->
<div style="color: var(--accent)">...</div>
<rect fill="var(--bg,#fafbfc)" stroke="var(--border,#d8dee4)"/>

<!-- ❌ 禁止 -->
<div style="color: #ff6b6b">...</div>
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">...</div>
```

## 图表类型选择

生成图表前，按以下决策逻辑选择格式：

| 需要表达的内容 | 推荐格式 | 适用场景 |
|--------------|---------|---------|
| 模块内部结构（类关系、组件交互） | 内联 SVG | module 文档，需要精细控制布局 |
| 系统级架构（多模块交互、全景数据流） | Mermaid flowchart | system 文档，节点多、关系复杂 |
| 线性流程（步骤序列、数据管道） | Flow 组件 | 所有文档类型，步骤 ≤ 7 |
| 分层架构（层级关系） | Layer Stack 组件 | system/guide 文档 |
| 状态转换 | 内联 SVG 或 Mermaid stateDiagram | module 用 SVG，system 用 Mermaid |
| 简单拓扑概览 | ASCII 图 | **仅 Markdown 输出**；HTML 优先用 SVG |

关键原则：

- **HTML 输出时，SVG 和 Mermaid 优先于 ASCII**。ASCII 仅在 Markdown 格式中使用
- Flow 组件只适合线性流程（无分支），有分支/合并时用 SVG 或 Mermaid
- 单图信息过载时，拆为多图 + 文字解释，不要把一张图画得过于复杂
- 所有图表必须有 `<figcaption>` 图说（见下方"图说规范"）

## 可折叠章节

三种结构，按以下规则选择：

| 结构 | 何时使用 | 说明 |
|------|---------|------|
| `<section>` | 核心内容章节（概述、架构、API 等） | 始终展开，不可折叠 |
| `<details open>` | 重要但较长的章节（实现细节、数据流） | 默认展开，用户可折叠 |
| `<details>` | 参考/附录/FAQ/辅助内容 | 默认折叠，按需展开 |

示例：

```html
<section class="section" id="sec-overview">
  <div class="section-header">
    <h2>1. 概述</h2>
  </div>
  <div class="section-body">内容...</div>
</section>

<details id="sec-faq">
  <summary><h2>10. 常见问题</h2></summary>
  <div class="section-body">内容...</div>
</details>

<details open id="sec-arch">
  <summary><h2>3. 架构设计</h2></summary>
  <div class="section-body">内容...</div>
</details>
```

guide 文档的 section 可加 badge：

```html
<section class="section" id="sec-config">
  <div class="section-header">
    <h2>2. 配置层</h2>
    <span class="section-badge badge-config">Config</span>
  </div>
  <div class="section-body">内容...</div>
</section>
```

Badge 类型：`badge-config`（蓝）、`badge-runtime`（绿）、`badge-example`（琥珀）。

## 代码块

统一用 `<div class="code-block">`，配合 `language-xxx` class 触发 highlight.js：

```html
<div class="code-block"><pre><code class="language-cpp">
void setup() { pinMode(LED, OUTPUT); }
</code></pre></div>
```

highlight.js 不支持的语言用手动 span：

```html
<div class="code-block"><pre><code>
<span class="cmt">// 注释</span>
<span class="kw">auto</span> result = <span class="fn">compute</span>(<span class="num">42</span>);
</code></pre></div>
```

## Callout

统一用 `<div class="callout {type}">`，5 种语义变体：

```html
<div class="callout note">
  <strong>设计决策</strong> Task 使用 shared_ptr 而非 unique_ptr，
  因为队列和 CancellationToken 需要共享所有权。
</div>

<div class="callout warning">
  <strong>注意</strong> 修改此配置后需要重新编译。
</div>
```

类型：`info`、`success`、`warning`、`danger`、`note`。

## 表格

```html
<div class="table-wrapper">
  <table>
    <thead><tr><th>列1</th><th>列2</th></tr></thead>
    <tbody><tr><td>值1</td><td>值2</td></tr></tbody>
  </table>
</div>
```

## Tabs 组件

纯 CSS 实现，最多 5 个标签页（module 文档 API 参考常用）：

```html
<div class="tabs">
  <input type="radio" name="api-tabs" id="api-t1" checked>
  <input type="radio" name="api-tabs" id="api-t2">
  <div class="tab-bar">
    <label for="api-t1">Tab 1</label>
    <label for="api-t2">Tab 2</label>
  </div>
  <div class="tab-panel"><!-- 第一个标签内容 --></div>
  <div class="tab-panel"><!-- 第二个标签内容 --></div>
</div>
```

## 内联 SVG 图表

module 文档 HTML 中替代 ASCII，信息密度更高。guide 的 HTML 输出也推荐使用。

```html
<figure class="diagram">
  <svg viewBox="0 0 600 300" role="img" aria-label="描述">
    <rect x="50" y="50" width="140" height="40" rx="6"
          fill="var(--bg,#fafbfc)" stroke="var(--border,#d8dee4)"/>
    <text x="120" y="75" text-anchor="middle" font-size="12"
          fill="var(--text,#1a2332)">ComponentA</text>
  </svg>
  <figcaption>图 X.X — 描述<span class="fig-source">Source: file:line</span></figcaption>
</figure>
```

### SVG 基础规则

- 所有颜色用 CSS 变量 + fallback（适配主题）
- `viewBox` 宽 480-640，高度按内容比例
- `role="img"` + `aria-label`（无障碍）
- 节点 `<rect rx="6">` + `<text>`，连线 `<line>` + `marker-end`

### SVG 质量护栏

| 约束 | 限制 | 超出时的处理 |
|------|------|------------|
| 行数上限 | 单个 SVG ≤ 80 行 | 拆分为多图，或改用 Mermaid |
| 节点数量 | 4-12 个节点 | < 4 用文字描述即可；> 12 改用 Mermaid 或拆图 |
| 配色数量 | 1 主色（accent）+ 最多 2 语义色 | 禁止彩虹配色 |
| viewBox | 宽 480-640px | 保持 `preserveAspectRatio="xMidYMid meet"` |

### SVG 禁止模式

| 禁止 | 正确做法 |
|------|---------|
| 3D 立体效果（透视、阴影块） | 2D 平面矩形 + 连线 |
| 全屏 grid 铺线 | 空白留白，只画有数据意义的线 |
| 装饰性阴影 `filter: drop-shadow` | 不用阴影，用边框区分层级 |
| 渐变填充 `linearGradient` | 纯色 CSS 变量填充 |
| 硬编码颜色（无 fallback 的 var） | `fill="var(--bg,#fafbfc)"` 始终带 fallback |

### 图说规范（所有图表通用）

所有图表（SVG / Mermaid / ASCII）统一使用编号 + 描述 + 可选来源：

```html
<figcaption>图 X.X — 描述性标题<span class="fig-source">Source: file:line</span></figcaption>
```

- **编号**：章节号 + 序号，如"图 3.1"
- **描述**：一句话说明图表展示的是什么
- **来源**（可选）：`<span class="fig-source">` 标注数据或结构来自哪个源文件
- Mermaid 的 `<figcaption>` 放在 `.mermaid-wrap` 内部，SVG 的放在 `<figure class="diagram">` 内部

## ASCII 架构图

**定位**：Markdown 输出的首选；HTML 输出的降级备选（优先使用内联 SVG 或 Mermaid）。

guide 文档用 `<div class="diagram">`：

```html
<div class="diagram">┌─────────────────────────┐
│      Layer Name         │
├─────────────────────────┤
│  ┌─────┐    ┌─────┐    │
│  │ Mod │───▶│ Mod │    │
│  └─────┘    └─────┘    │
└─────────────────────────┘</div>
```

## 卡片网格

```html
<div class="card-grid cols-2">
  <div class="card accent-green">
    <h4>标题</h4><p>内容</p>
  </div>
  <div class="card accent-amber">
    <h4>标题</h4><p>内容</p>
  </div>
</div>
```

颜色：`accent-green`、`accent-amber`、`accent-red`、`accent-violet`、`accent-cyan`、`accent-blue`。
列数：`cols-2`、`cols-3`。

## 流程步骤

适用于线性流程，**最多 7 个步骤**。超过 7 步改用 Mermaid。有分支/合并时用 SVG 或 Mermaid。

### 横向 Flow（默认）

```html
<div class="flow">
  <div class="flow-step"><b>Step 1</b><span>描述</span></div>
  <span class="flow-arrow">→</span>
  <div class="flow-step"><b>Step 2</b><span>描述</span></div>
</div>
```

### 竖向 Flow

步骤多或描述文字长时使用竖向排列：

```html
<div class="flow flow-vertical">
  <div class="flow-step"><b>Step 1</b><span>描述</span></div>
  <span class="flow-arrow">↓</span>
  <div class="flow-step"><b>Step 2</b><span>描述</span></div>
  <span class="flow-arrow">↓</span>
  <div class="flow-step"><b>Step 3</b><span>描述</span></div>
</div>
```

### 分支节点

简单的是/否条件分支：

```html
<div class="flow">
  <div class="flow-step"><b>检查</b><span>条件判断</span></div>
  <span class="flow-arrow">→</span>
  <div class="flow-step flow-branch"><b>条件?</b>
    <span class="branch-yes">✓ 是 → 路径A</span>
    <span class="branch-no">✗ 否 → 路径B</span>
  </div>
</div>
```

## 分层架构图 Layer Stack

```html
<div class="layer-stack">
  <div class="layer app">应用层 <span class="layer-label">描述</span></div>
  <div class="layer core">核心层 <span class="layer-label">描述</span></div>
  <div class="layer infra">基础设施 <span class="layer-label">描述</span></div>
  <div class="layer hw">硬件层 <span class="layer-label">描述</span></div>
</div>
```

## 步骤指示器

```html
<div class="steps">
  <div class="step" data-step="1"><h4>步骤名</h4><p>描述</p></div>
  <div class="step" data-step="2"><h4>步骤名</h4><p>描述</p></div>
</div>
```

## 前置条件框

```html
<div class="prereq">
  <h4>前置条件</h4>
  <ul><li>条件 1</li><li>条件 2</li></ul>
</div>
```

## 依赖树

```html
<div class="dep-tree">ModuleName
 ├── Dep1
 ├── Dep2
 └── Dep3</div>
```

## FAQ 折叠面板

```html
<details class="faq">
  <summary>问题标题</summary>
  <div>回答内容</div>
</details>
```

## 特性列表

```html
<div class="feature-list">
  <div class="feature-item"><span class="check">✓</span> 特性描述</div>
</div>
```

## 变更日志

```html
<ol class="changelog">
  <li><time>Date</time><span class="tag">Version</span> 描述</li>
</ol>
```
