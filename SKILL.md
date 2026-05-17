---
name: doc-writer
zh_name: "技术文档生成器"
en_name: "Technical Document Writer"
description: >
  统一文档生成器，支持四种文档类型：模块设计文档、系统架构文档、项目指导文档、分模块批量文档。
  当用户说"写文档"、"生成文档"、"技术设计文档"、"架构设计"、"项目指南"、"guide"、"上手指南"、
  "deepwiki"、"模块文档"、"系统设计"、"整体设计"、"架构图"、"给 X 写文档"时自动触发。
category: doc
tags: ["技术文档", "设计文档", "架构", "guide", "deepwiki", "API文档", "模块文档", "系统设计"]
---

# Doc Writer — 统一文档生成器

【意图】把真实源码转成可验证的、离线可用的技术文档。不是营销页、不是 PPT、不是 landing page——是"读完能上手干活"的工程文档。

## 文档类型路由

根据用户意图分类到四种文档类型。**意图不明确时必须用 AskQuestion 让用户选择。**

| 类型 | 意图 | 触发词 | 输出路径 | 详细流程 |
|------|------|--------|----------|----------|
| module | 单个模块/类的 API 参考手册 | "模块文档"、"技术设计文档"、"deepwiki X.h"、"给 X 写文档"、"API 文档" | `doc/tech-docs/<Name>_Design.md + .html` | [module-workflow.md](references/module-workflow.md) |
| system | 整个系统的架构全景图 | "系统设计"、"架构设计"、"整体设计"、"仓库结构分析"、"架构图"、"系统图" | `doc/<Name>_Design.md + .html` | [system-workflow.md](references/system-workflow.md) |
| guide | 新人端到端上手教程 | "项目指南"、"上手指南"、"guide"、"指导文档"、"项目文档" | `guide.html` | [guide-workflow.md](references/guide-workflow.md) |
| batch | 批量生成多个模块文档 | "分模块写文档"、"批量生成"、"全部模块文档" | 多个 `doc/tech-docs/*.md + .html` | 循环复用 module 流程 |

**确定类型后，立即读取对应 reference 文件 + [html-components.md](references/html-components.md)。**

---

## 先问后做原则

**遇到任何不确定的情况，必须先询问用户，禁止猜测后执行。**

需要询问的场景：语言偏好、目标文件/模块范围、模块边界、章节取舍、输出路径、用户意图有多种合理解读。

使用 AskQuestion 时，提供 2-4 个具体选项 + "Other"。示例：

```
AskQuestion([{
  id: "doc-type",
  prompt: "检测到多种可能的文档类型，请确认：",
  options: [
    { id: "module", label: "模块文档 — 针对 TaskScheduler 的 API 和实现细节" },
    { id: "guide",  label: "指导文档 — 面向新人的端到端上手教程" },
    { id: "system", label: "系统文档 — 整体架构和模块关系" },
    { id: "other",  label: "Other（请说明）" }
  ]
}])
```

---

## 铁律（违反任何一条 = 不合格文档）

1. **不读源码不动手** — 禁止不读代码就生成文档。没读过的函数/类/模块 = 不存在，不许出现在文档中。
2. **不许编造** — 所有代码、数字、架构图节点、配置参数必须来自项目真实源码。编造 = 立刻不合格。宁可 `<!-- TODO: 需确认 -->` 也不造假。
3. **颜色锁死** — 只用 `doc-shell.css` 的 CSS 变量。行内写 `color: #ff6b6b` = 不合格（SVG fallback `var(--x, #hex)` 除外）。
4. **零装饰** — `linear-gradient` / `box-shadow` 大阴影 / `blur` / `translateY` 浮起 / `border-radius > 8px` — 出现任何一个 = 不合格。
5. **零外链** — `<img src="http...">` = 不合格。图表用 SVG/CSS/Mermaid 内联。
6. **每图必说** — SVG 和 Mermaid 无 `<figcaption>` = 不合格。格式：`图 X.X — 描述`。
7. **引用溯源** — 代码引用无 `file:line` = 不合格。不允许只写函数名。

## 内容驱动深度（最高优先级）

模板和章节框架只定义"可用的组件库和章节池"，**不硬编码输出的章节数量和深度**。

- module 的 12 章框架中，带 `*` 的章节（状态机、流程图、FAQ、测试等）**按源码实际情况取舍**。一个 30 行的工具函数不需要 12 章；一个 2000 行的状态机模块可能每章都要。
- system 文档的章节数 = 实际模块数 + 架构层级数。3 个模块的小项目和 30 个模块的大项目，产出的文档长度应该有 10 倍差异。
- guide 的章节深度 = 数据流路径的复杂度。简单 CLI 工具的 guide 可能 5 节完事，复杂分布式系统可能需要 15 节。
- **章节取舍的判据是源码复杂度，不是模板框架。** 宁可多章覆盖完整，也不要把多个独立概念硬塞进一章。

### 源码阅读深度要求

深度来自读码量。不够深 = 没读够。

| 文档类型 | 必须读什么 | 最低阅读量 |
|---------|-----------|-----------|
| module | 目标 `.h` + `.cpp`（或等效实现文件）全文 | 两个文件都读完，不允许只读头文件 |
| system | 每个核心模块的入口头文件 + 至少 1 个实现文件 | 核心模块数 × 2 个文件 |
| guide | 入口文件 + 配置 + 至少 5 个核心模块头文件 | ≥ 7 个文件 |

### 每章最低内容密度

每个 `## H2` 章节必须包含：**≥ 2 段叙述性文字 + ≥ 1 个结构化元素**（表格/代码块/列表/图表）。只有一句话的章节 = 不合格。

按文档类型的具体指标：

**module 文档**（单个模块/类）：

| 源码规模 | 最低章节数 | 最低代码块 | 最低源码引用 |
|---------|----------|----------|------------|
| < 200 行 | 5 章 | 3 | 2 |
| 200-1000 行 | 7 章 | 5 | 4 |
| > 1000 行 | 9+ 章 | 8 | 6 |

- 每个公开 API/方法：至少 1 行为什么这样设计的解释 + 参数/返回值/异常
- 核心算法：必须有代码片段 + 逐步解释，不允许"详见源码"
- 有状态类：状态转换表/图必须完整，不允许遗漏状态

**system 文档**（整个系统）：

| 模块数 | 最低章节数 | 最低 Mermaid 图 | 每模块最低内容 |
|-------|----------|----------------|--------------|
| 3-5 个 | 6 章 | 1 | 职责 + 依赖 + 故障模式 |
| 6-10 个 | 8 章 | 2 | 上述 + 公开 API 摘要 + 代码引用 |
| > 10 个 | 10+ 章 | 3 | 上述 + 线程安全说明 + 性能约束 |

- 每个核心模块的五维度摘要（路径/API/依赖/被依赖/故障）不可缺
- 跨模块交互必须有具体的调用链描述（A 调用 B 的哪个方法，传什么参数）
- 线程模型章节：有多线程的项目必须写，不可标"可选"跳过

**guide 文档**（端到端教程）：

| 项目复杂度 | 最低章节数 | 最低代码块 | 完整示例 |
|-----------|----------|----------|---------|
| 简单（CLI/小库） | 5 章 | 6 | 1 个场景 |
| 中等（框架/服务） | 7 章 | 10 | 1-2 个场景 |
| 复杂（分布式/多模块） | 9+ 章 | 15 | 2+ 个场景 |

- 每个代码块前后必须有叙事段落解释（不允许孤立代码块）
- 配置参数：每个参数必须说明取值含义 + 不当值的后果
- FAQ：至少 3 个基于真实代码逻辑推断的故障场景

### 深度自检清单（生成完毕后逐项确认）

| # | 检查 | 不通过的常见原因 |
|---|------|----------------|
| D1 | 每章是否有 ≥ 2 段叙述？ | 只写了一句概述就跳到代码/表格 |
| D2 | 代码示例是否嵌入叙事？ | 孤立代码块，前后无解释 |
| D3 | 设计决策是否解释 WHY？ | 只描述 WHAT（"使用了 shared_ptr"）|
| D4 | 模块交互是否有具体调用链？ | 只说"A 依赖 B"，没说调用哪个方法 |
| D5 | 配置参数是否有后果说明？ | 只列字段名 + 类型，不说取值影响 |
| D6 | 故障场景是否具体？ | "检查日志"式泛泛回答 |
| D7 | 源码引用是否到行号？ | 只写函数名没有 file:line |
| D8 | 总内容量是否匹配源码复杂度？ | 2000 行的类只产出 200 行文档 |

---

## 统一工作流程（Phase 0 → 1 → 2 → 3）

### Phase 0: 分析（按类型不同，共同要求见下方）

| 类型 | 分析范围 | 关注点 | 输入优先级 |
|------|---------|--------|-----------|
| module | 单个文件/类 | 公开 API、状态变量、枚举、依赖关系 | 目标文件 > 测试文件 > 配置 |
| system | 整个仓库 | 入口点、模块边界、调用链、数据流 | 目录结构 > README > 入口文件 > 配置 |
| guide | 整个项目 | 数据流端到端路径、业务逻辑、故障点 | 入口文件 > 配置 > 核心模块(至少5个) |

**共同要求（铁律 §1 展开，所有类型必须完成）：**

1. **先读后写** — 必须读完目标源码再动手。没读过的文件中的内容 = 不存在。
2. **记录源码位置** — 每个关键函数/类/结构体记录 `file:line` 范围（铁律 §7）
3. **提取领域术语** — 从类名、枚举值、配置键、业务概念中收集，记录术语、定义、出处

### Phase 1: 结构设计（按类型不同）

| 类型 | 组织原则 | 章节结构 |
|------|---------|---------|
| module | 按模块内部结构（12 章框架） | 概述 > 设计目标* > 架构 > 核心概念 > 状态机* > 流程图* > 实现 > API > 使用 > FAQ* > 测试* > 附录* |
| system | 按分层架构 | 概述 > 技术栈 > 分层架构(Mermaid) > 核心模块职责 > 数据流 > 线程模型* > 配置系统* > 部署* > 已知限制* |
| guide | 沿数据流叙事 | 概述 > 快速开始 > 配置 > 核心流程 > 关键模块 > 横切关注点 > **完整示例(必须)** > FAQ/排障 |

### Phase 2: 内容生成（格式差异）

| 维度 | module | system | guide |
|------|--------|--------|-------|
| 输出格式 | MD + HTML 双格式 | MD + HTML 双格式 | 仅 HTML |
| 图表 | MD:ASCII / HTML:内联SVG | Mermaid flowchart | ASCII(MD) / SVG·Mermaid(HTML) + flow 组件 |
| 代码示例 | 分节标题 `=====`，含 Basic/Advanced | 按模块分组 | 嵌在叙事段落中 |
| 章节标记 | 可折叠 details | 模块面板可折叠 | badge(Config/Runtime/Example) |
| API 展示 | Tabs 组件分类 | 职责表格 | 不需要 |
| 完整示例 | 可选（第9章使用指南） | 不需要 | 必须（第7章，不可省略） |

各类型的详细生成规则见对应 reference 文件。

### Phase 3: 校验交付（统一）

生成 HTML 后，**必须**运行校验脚本：

```bash
node "$SKILL_ROOT/scripts/validate-doc.js" --new-doc --fix --type <module|system|guide> <file.html>
```

> `SKILL_ROOT` = 本文件（SKILL.md）所在目录，设置方式见下方"模板和脚本"节。

校验覆盖 16 类内容：

| 校验项 | 说明 | 自动修复 |
|--------|------|----------|
| Mermaid 块 | HTML 实体、箭头语法、花括号（匹配 `<div>` 和 `<pre>` 两种容器） | Y |
| 章节标题 ID | h2/h3 唯一 id、TOC 可定位 | Y |
| 代码块 | language tag、HTML 转义 | Y |
| 表格 | thead/tbody 结构 | 报告 |
| 内联 Markdown | 链接、粗体已解析 | 报告 |
| 可折叠章节 | details/summary 结构 | 报告 |
| TOC 完整性 | 非空、链接有效 | Y |
| HTML 骨架 | charset、viewport、lang | 报告 |
| 源码引用 | source-ref 存在 + href 含 `file#L<num>` 行号格式 | --new-doc 必填 |
| 术语表 | glossary 章节 | --new-doc 必填 |
| Scope 声明 | scope-block 存在 | --new-doc 必填 |
| 视觉约束 | 外链图片、渐变、大阴影、blur、硬编码色（含 inline `color:#hex`）、纯黑白、浮起效果、CSS url() 外链 | 报告 |
| SVG 护栏 | 行数（≤80）、节点数（4-12）、`role`/`aria-label` 无障碍 | 报告 |
| 图说完整性 | `<figcaption>` 存在性 + 编号格式 "图 X.X —"；orphan SVG 在 `--new-doc` 下为 fail | 报告 |
| 空章节检测 | `<div class="section-body">` 不得为空 | 报告 |
| 重复内容检测 | 重复 callout（相同文本）、重复段落（>50 字符） | 报告 |
| 内容密度 | 每节 ≥2 段 + ≥1 结构元素、代码块/节比 ≥0.5、段落/节比 ≥2 | warn |

**新文档必须所有校验通过（含 `--new-doc`）才能交付。**

### 视觉自审（生成 HTML 后，交付前）

程序化校验之外，agent 必须对生成的 HTML **逐项自检**：

| 检查项 | 通过标准 |
|--------|---------|
| 颜色 | 所有颜色来自 CSS 变量，无硬编码 hex（SVG fallback 除外） |
| 阴影 | 无 `box-shadow` 大阴影、无 `linear-gradient`、无 `blur` |
| 圆角 | 最大 8px（badge 药丸形除外） |
| Hover | 只改 `border-color`/`color`，无 `translateY` 浮起 |
| 图片 | 无 `<img src="http...">` 外链，图表用 SVG/CSS/Mermaid |
| SVG | 颜色用 `var(--xxx, fallback)`，有 `role="img"` + `aria-label`，≤ 80 行，4-12 节点 |
| 图说 | 所有图表有 `<figcaption>`（编号 + 描述），可选 `.fig-source` 来源标注 |
| 排印 | 标题有负 letter-spacing，表头 uppercase + letter-spacing ≥ 0.06em |
| 层级 | 字号层级清晰：H1 32 > H2 22 > H3 17 > body 15 > small 0.85rem |
| 密度 | H2 上方间距 ≥ 40px，段落间距 12px，代码块内边距 16px |

自检发现违规时，**就地修复后再交付**，不要报告给用户等待确认。

### 架构债务登记

以下是已知但暂未修复的架构问题，后续版本处理：

| ID | 问题 | 风险 | 影响范围 |
|----|------|------|---------|
| DEBT-1 | `md-to-html.js` 不读取模板 `{{SECTIONS}}`，而是硬编码 HTML 骨架 | 模板结构改动无法自动同步到 md-to-html 输出 | md-to-html 转换路径 |

### 防回归规则（Regression Guard）

下列问题曾发生过，修复后必须由 `validate-doc.js` 自动拦截。**任何未来的改动不得移除这些检查。**

| 问题 | 根因 | 检查函数 | 加入日期 |
|------|------|---------|---------|
| Mermaid 用 `<div>` 但 CDN 期望 `<pre>` | 选择器不统一 | `checkMermaid` 同时匹配 div/pre | 2026-05 |
| inline `color:#hex` 逃过视觉检查 | 只查了 gradient/shadow | `checkVisualConstraints` 增加 hex 检查 | 2026-05 |
| 空 section-body 被生成 | AI slop 惰性 | `checkEmptySections` | 2026-05 |
| 重复段落/callout | AI slop 重复 | `checkDuplicateContent` | 2026-05 |
| orphan SVG 只 warn 不 fail | --new-doc 应严格 | `checkFigCaptions` 按 isNewDoc 升级 | 2026-05 |
| source-ref href 为空 | 占位没填 | `checkSourceRefs` href 格式校验 | 2026-05 |
| figcaption 无编号 | 缺格式要求 | `checkFigCaptions` 编号格式验证 | 2026-05 |
| sync 丢失 end marker 静默 | 缺防护 | `inline-shared.js` 显式报错 | 2026-05 |
| Mermaid rerender 丢源码 | 用 innerHTML 恢复 | `doc-shell.js` 改用 textContent | 2026-05 |
| JS 单点故障级联 | 无 try-catch | `doc-shell.js` features[] 包裹 | 2026-05 |
| DiagramZoom 不匹配 mermaid-wrap | 选择器只有 `.diagram` | `setupDiagramZoom` 加 `.mermaid-wrap` | 2026-05 |
| CRLF 导致 list-meta 解析失败 | Windows `\r` 残留 | `parseMarkdownSections` 先 normalize | 2026-05 |
| sectionId 中文标题为空 | `\w` 不匹配 CJK | 加 `\u4e00-\u9fff` + 术语表特判 | 2026-05 |
| figure.diagram 无放大提示 | CSS 缺 `::after` + JS 选择器含冗余 `.diagram` | CSS 加 `figure.diagram::after`；JS 选择器收紧为 `figure.diagram, .mermaid-wrap` | 2026-05 |

---

## 共享文档规范

### 视觉纪律（Anti-AI-Slop）

铁律 §3-§6 是最低门槛。以下是精确的设计 Token 和黑名单展开。完整规则见 [html-components.md](references/html-components.md)。

**禁止清单（出现 = 不合格）：**

| 禁止 | 为什么 | 正确做法 |
|------|--------|---------|
| `linear-gradient` / `radial-gradient` | AI slop 第一标志 | 纯色 CSS 变量 |
| `box-shadow` 大阴影 | 浮夸 | hover 改 `border-color` |
| `blur` / `filter: blur()` | 零信息价值 | 不用 |
| `translateY(-Npx)` hover 浮起 | AI 最爱的卡片动画 | hover 改边框色 |
| `border-radius > 8px` | 玩具感（药丸 badge 除外） | `--radius: 8px` |
| `#000` / `#fff` 纯黑纯白 | 对比刺眼 | CSS 变量暖灰 |
| `<img src="http...">` | 离线不可用 | SVG/CSS/Mermaid |
| 3D 立体 / 装饰阴影 / 全屏 grid 线 | 图表噪音 | 2D 平面 + 边框 |
| 满屏 hero + 大图 | 技术文档不需要营销感 | 简洁文档元信息头 |

### 数据真实性（铁律 §2 展开）

每一类内容都有对应的真实来源要求：

| 内容类型 | 必须来自 | 编造 = |
|---------|---------|--------|
| 代码片段 | 项目实际源文件 + `file:line` | 不合格 |
| 数字/指标 | 源码注释 / commit / issue / 用户数据 | 不合格 |
| 架构图节点 | 仓库中实际存在的模块/服务/文件 | 不合格 |
| 配置参数 | 项目实际配置文件 | 不合格 |
| FAQ/故障 | 真实代码逻辑推断或用户提供的场景 | 不合格 |

信息不足时：`<!-- TODO: 需要确认 XXX -->`，或询问用户。**宁可留空也不编造。**

### 源码引用（铁律 §7 展开）

每个代码引用必须带 `file:line`，不允许只写函数名。

```html
<a class="source-ref" href="src/parser.js#L500-L556"><code>src/parser.js:500-556</code></a>
```

文档顶部添加"关联源文件"块，每章结尾添加"Sources"块。

### Scope 声明

文档开头声明覆盖范围：

```html
<div class="scope-block">
  <strong>Scope:</strong> 本文覆盖 XXX 的 YYY。不覆盖 ZZZ。
</div>
```

### 设计决策 Callout

每个主要章节至少一个 callout 解释 **WHY**（不是 WHAT）。全文至少 4 个。

### 层级编号

H2: `## 1. 概述`，H3: `### 1.1 背景`。

### 术语表

文档末尾（附录前）添加术语表（术语 | 说明 | 出处）。

### 共享 CSS/JS/Skin

所有文档类型共享三个运行时文件，模板通过 `@sync` 标记嵌入：

| 文件 | 职责 | 大小 |
|------|------|------|
| `scripts/doc-shell.css` | 设计系统 + 全部组件样式 | ~30KB |
| `scripts/doc-shell.js` | TOC/ScrollSpy/代码高亮/图表缩放/Mermaid 暗色 | ~15KB |
| `scripts/skin-switcher.js` | 6 套皮肤切换（Teal/Editorial/Vellum/Mono/Carto/Signal） | ~22KB |

**修改 CSS/JS 后必须同步模板：**

```bash
node "$SKILL_ROOT/scripts/inline-shared.js" --sync
```

此命令自动替换三个 HTML 模板中 `/* @sync:xxx:start */` 和 `/* @sync:xxx:end */` 之间的内容。模板专属的 CSS 覆盖（如 module 的 `--max-width: 880px`）位于标记区域之外，不受影响。

---

## 模板和脚本（自包含）

所有资源在本 skill 目录内。执行脚本前，先设置 `SKILL_ROOT`：

```bash
SKILL_ROOT="<本文件所在目录的绝对路径>"
```

> Agent 可直接从读取 SKILL.md 的路径推导。默认安装位置：`~/.claude/skills/doc-writer`。

资源清单（相对于 SKILL_ROOT）：

| 资源 | 路径 |
|------|------|
| 模块 MD 模板（中文） | `templates/module-design.md` |
| 模块 MD 模板（英文） | `templates/module-design.en.md` |
| 模块 HTML 模板 | `templates/module-design.html` |
| 系统 HTML 模板 | `templates/system-design.html` |
| 指导 HTML 模板 | `templates/guide.html` |
| 模块索引模板 | `templates/module-index.html` |
| 系统索引模板 | `templates/system-index.html` |
| 模块摘要模板 | `templates/module-summary.md` |
| MD 转 HTML | `scripts/md-to-html.js` |
| 校验脚本 | `scripts/validate-doc.js` |
| 共享 CSS | `scripts/doc-shell.css` |
| 共享 JS | `scripts/doc-shell.js` |
| 皮肤切换 | `scripts/skin-switcher.js` |
| 模板同步 | `scripts/inline-shared.js` |
| 模块内容样本 | `examples/module-content-example.html` |
| 系统内容样本 | `examples/system-content-example.html` |
| 指导内容样本 | `examples/guide-content-example.html` |

### 内容样本（Content Examples）

`examples/` 目录下的 3 个 HTML 文件是各文档类型的**纯内容写法参考**。它们只包含填入模板 `{{SECTIONS}}` 占位符的 HTML 片段，不含 CSS/JS/骨架——那些由模板提供。

生成文档前建议读取对应样本，对照关键模式：

| 文档类型 | 重点观察 |
|---------|---------|
| module | Scope 声明、源码引用格式、SVG 图表（var() + fallback）、Tabs API 展示、折叠层级选择、设计决策 Callout |
| system | Layer Stack 组件、Mermaid 架构图、模块职责五维表（路径/API/依赖/被依赖/故障）、跨模块约束 Callout |
| guide | Badge 标注、步骤指示器、flow 组件、代码嵌入叙事段落、完整示例章节（不可省略）、FAQ 基于真实故障 |

### MD 转 HTML 命令

```bash
node "$SKILL_ROOT/scripts/md-to-html.js" --type module doc/tech-docs/<Name>_Design.md
node "$SKILL_ROOT/scripts/md-to-html.js" --type system doc/<Name>_Design.md
node "$SKILL_ROOT/scripts/md-to-html.js" --type guide  doc/<Name>_Guide.md
node "$SKILL_ROOT/scripts/md-to-html.js" --type <module|system|guide> --all
node "$SKILL_ROOT/scripts/md-to-html.js" --type <module|system> --index "项目名" "描述"
```

### 索引页自定义（doc-meta.json）

`--index` 生成索引页时，脚本会在扫描目录查找 `doc-meta.json`。**此文件可选**——不存在时回退到按文件名平铺。

**module 索引**（放在 `doc/tech-docs/doc-meta.json`）：

```json
{
  "modules": {
    "ModuleName": { "group": "groupId", "desc": "模块描述" }
  },
  "groups": {
    "groupId": "分组显示名"
  },
  "groupOrder": ["groupId"]
}
```

**system 索引**（放在 `doc/doc-meta.json`）：

```json
{
  "categories": {
    "Architecture": { "label": "架构设计", "desc": "系统整体架构" },
    "Design":       { "label": "详细设计", "desc": "核心概念与配置" },
    "Requirements": { "label": "需求文档", "desc": "功能与非功能需求" }
  }
}
```

`categories` 的键名用于文件名正则匹配（不区分大小写），按声明顺序优先匹配。

---

## 交互功能验证（手动确认）

| 功能 | 验证方式 |
|------|---------|
| SVG/Mermaid 点击放大 | 点击图表 → 全屏 → 滚轮缩放 → Esc 关闭 |
| 代码复制按钮 | hover 代码块 → Copy 按钮 → 点击复制 |
| 暗色模式 | 主题切换 → 所有颜色正确 → 图表可读 → Mermaid 暗色主题自动切换 |
| 侧边栏 TOC | 点击 H2/H3 → 滚动定位 → ScrollSpy 高亮 |

---

## 输出格式规则

HTML 输出必须满足：

- 生成内容填入模板的 `{{SECTIONS}}` 占位符，不要输出完整 HTML 骨架（骨架由模板提供）
- 内容中不要使用 markdown 代码围栏包裹 HTML；直接输出 HTML 标签
- 所有 `<h2>` / `<h3>` 必须带唯一 `id`，格式 `id="sec-xxx"`
- 所有 `<section>` 和 `<details>` 必须带 `id`
- 代码块必须有 language class：`<code class="language-cpp">`

---

## Red Flags

| 信号 | 行动 |
|------|------|
| 找不到源文件 | 询问路径，不猜 |
| 单文件多类/多职责 | 询问目标范围 |
| 无测试文件 | 文档中标注测试状态，不编造测试用例 |
| 复杂依赖网 | 侧重直接依赖，深层依赖用 dep-tree 展示 |
| 源码 < 50 行 | 考虑是否真需要独立文档，可能 inline 注释足够 |
| 用户给的是产品需求而非代码 | 切换到 system 类型或询问确认 |

**绝对禁止（出现 = 立刻不合格）：**
不读源码猜测功能、不理解就画图、跳过必须章节、使用"详见代码"敷衍、生成空章节或占位内容、编造不存在的数据/指标/模块/配置、在 HTML 中使用渐变/大阴影/外链图片/硬编码颜色。
