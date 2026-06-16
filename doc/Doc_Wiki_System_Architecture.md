# Doc-Wiki 系统架构设计文档

## 文档信息
| 文档版本 | V2.0 |
| 编写日期 | 2026-06-16 |
| 更新日期 | 2026-06-16 |
| 目标读者 | Claude Code Skill 开发者、文档工具贡献者 |
| 源码规模 | 48 文件，~17,000 行代码，5 个子系统 |

## 1. 概述

> **Scope**：本文覆盖 Doc-Wiki 的整体架构、五层子系统设计、模板引擎机制、校验流水线、全力模式工作流和设计系统。不覆盖单个模板的 HTML 细节（见 `references/html-components.md`）和校验脚本的逐函数实现。

Doc-Wiki 是一个 **Claude Code Skill**，将真实源码转成可验证的、离线可用的技术文档。它解决的核心问题是：AI 生成的技术文档普遍存在编造代码引用、视觉风格不一致、缺乏可验证性三大问题。Doc-Wiki 通过 **8 条铁律**（先读后写、不许编造、颜色锁死、零装饰、零外链、每图必说、引用溯源、全力模式独立审核）和 **17 类自动化校验** 系统性地解决了这些问题。

### 1.1 项目定位

Doc-Wiki 诞生于实际工程需求——需要一个能自动从源码生成高质量技术文档的工具，且生成的文档必须可验证（每个代码引用都有 `file:line`）、离线可用（单文件 HTML，零外部依赖）、视觉一致（共享设计系统，6 套皮肤）。

与 DeepWiki（在线 SaaS，依赖 GitHub 集成）和 ZRead.ai（在线分析，不可离线）不同，Doc-Wiki 是一个纯本地运行的 Claude Code Skill——所有资源在 skill 目录内，无需网络（仅 highlight.js CDN 有离线回退），文档输出为自包含的单文件 HTML。这使得它适用于内网环境、离线场景和安全敏感项目。

### 1.2 核心能力

| 能力 | 详细说明 | 实现模块 | 成熟度 |
|------|---------|---------|--------|
| **三种文档类型** | Module（API 参考）、System（架构全景）、Guide（端到端教程），每种有独立工作流和模板 | `SKILL.md` + `references/` | Stable |
| **全力模式** | 不区分类型，自动分析项目生成完整文档体系：系统架构 + 核心模块 + Guide + 索引页 | `SKILL.md` §全力模式 | Beta |
| **17 类自动化校验** | Mermaid 语法、标题 ID、代码块、表格、内联 MD、折叠章节、TOC、HTML 骨架、源码引用、术语表、Scope、视觉约束、SVG 护栏、图说、空章节、重复内容、内容密度 | `scripts/validate-doc.js` | Stable |
| **6 套视觉皮肤** | Teal/Editorial/Vellum/Mono/Carto/Signal，支持暗色模式 + OS 偏好检测 | `scripts/skin-switcher.js` | Stable |
| **@sync 同步机制** | CSS/JS 修改后一条命令同步到所有模板，解决"改了 CSS 忘了同步"的一致性问题 | `scripts/inline-shared.js` | Stable |
| **渐进式披露** | 三层结构：Summary（始终可见）→ Details（默认展开）→ Deep Dive（默认折叠），对齐 DeepWiki/ZRead | `templates/sections/` + `templates/fullpower/` | Stable |
| **MD→HTML 转换** | 将 Markdown 文档转为带完整样式的单文件 HTML，支持 module/system/guide 三种类型 | `scripts/md-to-html.js` | Stable |

### 1.3 技术栈

| 组件 | 选型 | 版本 | 用途 | 选型理由 |
|------|------|------|------|---------|
| 运行时 | Node.js | LTS | 校验脚本、转换脚本、同步工具 | 零安装成本（Claude Code 环境自带），fs/path 模块够用 |
| 模板语言 | 原生 HTML | — | 文档骨架 | 单文件 HTML 零依赖，离线可用，浏览器直接打开 |
| 设计系统 | CSS 变量 | — | 颜色、字号、间距 | 暗色模式自动切换，皮肤系统通过覆盖变量实现 |
| 图表 | Mermaid + 内联 SVG | 10.9.0 | 架构图、状态图、流程图 | Mermaid 适合复杂图，SVG 适合精细控制 |
| 代码高亮 | highlight.js | 11.9.0 | 代码块语法高亮 | CDN 加载，离线回退到手动 span |
| 校验 | Node.js 脚本 | — | 17 类自动化检查 | 快速、可扩展、支持 --fix 自动修复 |

### 1.4 适用场景

**✅ 推荐使用：**
- **Claude Code 用户**需要为项目生成技术文档
- **内网/离线环境**无法使用 DeepWiki 等在线服务
- **多模块项目**需要系统性的文档体系（不是孤立的单个文档）
- **视觉一致性要求高**的团队（共享设计系统 + 皮肤切换）

**⚠️ 不推荐：**
- **纯文本 Markdown 项目**：Doc-Wiki 的核心价值在 HTML 交互特性（暗色模式、图表缩放、ScrollSpy），纯 Markdown 项目用 Jekyll/MkDocs 更合适
- **单文件脚本**：少于 100 行的脚本，inline 注释足够，不需要独立文档

### 1.5 项目规模

| 指标 | 数值 | 说明 |
|------|------|------|
| 源码文件数 | 48 | 不含 doc/ 输出 |
| 代码行数 | ~17,000 | 含注释，不含空行 |
| 子系统数 | 5 | 路由、工作流、模板、工具链、样本 |
| 校验项 | 17 类 | 含交互测试 7 项 |
| 皮肤数 | 6 | Teal/Editorial/Vellum/Mono/Carto/Signal |
| Git 提交 | 19 | 2026-05-16 ~ 2026-06-16 |
| 公开 API | 5 | validate-doc.js, md-to-html.js, inline-shared.js, doc-shell.js, skin-switcher.js |

> **设计决策：** 选择纯 Node.js + HTML 而非 React/Vue 等框架，因为文档必须**离线可用**——单文件 HTML，零外部依赖（仅 highlight.js CDN，离线时回退到手动 span）。这使得文档可以在任何浏览器中打开，无需构建步骤。代价是模板维护需要手动处理 @sync 标记同步。

### 1.6 相关源文件
- `SKILL.md:14-16` — Skill 主入口，路由 + 铁律 + 工作流
- `README.md:1-12` — 项目概述

## 2. 分层架构

Doc-Wiki 采用五层架构，每层职责单一，通过文件引用和占位符约定解耦。分层的核心优势是**独立演进**——新增文档类型只需添加 reference + template，不影响校验逻辑；新增校验规则只需修改 validate-doc.js，不影响模板结构。

### 2.1 五层架构

```text
┌─────────────────────────────────────────────────────────┐
│  L1: 路由层 — SKILL.md                                  │
│  文档类型路由、执行模式选择、铁律、工作流编排              │
├─────────────────────────────────────────────────────────┤
│  L2: 工作流层 — references/                              │
│  每种文档类型的详细 Phase 0→1→2→3 流程                    │
├─────────────────────────────────────────────────────────┤
│  L3: 模板层 — templates/                                 │
│  HTML 骨架（CSS/JS 内嵌）、章节模板、全 力模式深度模板    │
├─────────────────────────────────────────────────────────┤
│  L4: 工具链层 — scripts/                                 │
│  校验、转换、同步、皮肤切换、设计系统                      │
├─────────────────────────────────────────────────────────┤
│  L5: 样本层 — examples/                                  │
│  各文档类型的黄金样本，对照参考                            │
└─────────────────────────────────────────────────────────┘
```text

层间依赖方向：L1 → L2 → L3 ← L4 ← L5。L4 和 L3 之间通过 `@sync` 标记实现双向同步（开发时，非运行时）。

### 2.2 文件结构

```text
doc-writer/
├── SKILL.md                          # L1: Skill 主入口
├── references/                       # L2: 工作流定义
│   ├── module-workflow.md            #   Module 类型详细流程
│   ├── system-workflow.md            #   System 类型详细流程
│   ├── guide-workflow.md             #   Guide 类型详细流程
│   └── html-components.md            #   共享 HTML 组件规范
├── templates/                        # L3: HTML 骨架 + 章节模板
│   ├── module-design.html            #   Module HTML 骨架（1582 行）
│   ├── system-design.html            #   System HTML 骨架（1278 行）
│   ├── guide.html                    #   Guide HTML 骨架（1266 行）
│   ├── module-index.html             #   Module 索引页
│   ├── system-index.html             #   System 索引页
│   ├── module-design.md              #   Module MD 模板（中文）
│   ├── module-design.en.md           #   Module MD 模板（英文）
│   ├── module-summary.md             #   模块摘要模板
│   ├── sections/                     #   渐进式披露章节模板（7 个）
│   │   ├── overview.html
│   │   ├── architecture.html
│   │   ├── module-detail.html
│   │   ├── state-machine.html
│   │   ├── flowchart.html
│   │   ├── faq.html
│   │   └── glossary.html
│   └── fullpower/                    #   全力模式深度模板（15 个）
│       ├── 01-overview.html          #     项目概述
│       ├── 02-architecture.html      #     系统架构
│       ├── 03-module-detail.html     #     模块详情
│       ├── 04-data-flow.html         #     数据流
│       ├── 05-state-machine.html     #     状态机
│       ├── 06-api-reference.html     #     API 参考
│       ├── 07-configuration.html     #     配置系统
│       ├── 08-error-handling.html    #     错误处理
│       ├── 09-performance.html       #     性能分析
│       ├── 10-dependency.html        #     依赖关系
│       ├── 11-testing.html           #     测试覆盖
│       ├── 12-troubleshooting.html   #     故障排查
│       ├── 13-faq.html               #     FAQ
│       ├── 14-glossary.html          #     术语表
│       └── 15-flowchart.html         #     流程图
├── scripts/                          # L4: 工具链
│   ├── validate-doc.js               #   17 类校验 + 交互测试（1004 行）
│   ├── md-to-html.js                 #   MD→HTML 转换（849 行）
│   ├── inline-shared.js              #   CSS/JS 模板同步（301 行）
│   ├── doc-shell.css                 #   设计系统（692 行）
│   ├── doc-shell.js                  #   运行时功能（414 行）
│   └── skin-switcher.js              #   6 套皮肤切换（81 行）
└── examples/                         # L5: 黄金样本
    ├── module-content-example.html
    ├── system-content-example.html
    ├── guide-content-example.html
    └── fullpower-content-example.html
```text

### 2.3 层间耦合

| 依赖方向 | 机制 | 示例 |
|---------|------|------|
| L1 → L2 | Markdown 链接 | `SKILL.md` 中 `[module-workflow.md](references/module-workflow.md)` |
| L2 → L3 | 文件路径约定 | `references/module-workflow.md` 引用 `templates/module-design.html` |
| L3 → L4 | `@sync` 标记 | HTML 模板中 `/* @sync:doc-shell.css:start */` 占位符 |
| L4 → L3 | `inline-shared.js --sync` | 将 CSS/JS 内容注入模板的 `@sync` 区域 |
| L5 → L2 | 对照参考 | examples 展示 L2 规范的实际输出效果 |

> **设计决策：** 五层架构而非单一配置文件，是因为文档生成涉及**路由决策**（选类型）、**内容规范**（怎么写）、**视觉规范**（怎么排版）、**质量校验**（怎么检查）四个独立关注点。分层使得每层可以独立演进——新增文档类型只需添加 reference + template，不影响校验逻辑。代价是新贡献者需要理解分层约定。

### 2.4 相关源文件
- `SKILL.md:90-103` — 五层架构定义
- `SKILL.md:780-870` — 资源清单

## 3. Skill 核心（SKILL.md）

SKILL.md（1003 行）是整个系统的入口，包含文档类型路由、执行模式选择、8 条铁律、内容驱动深度规则、普通模式工作流（Phase 0→1→2→3）和全力模式工作流（8 阶段）。它是 L1 路由层的唯一文件，也是整个 skill 的"大脑"。

### 3.1 文档类型路由

用户触发后，SKILL.md 根据意图关键词自动路由到四种文档类型。路由规则基于触发词匹配——用户说"模块文档"或"给 X 写文档"时路由到 module，说"系统设计"时路由到 system，说"项目指南"或"guide"时路由到 guide。意图不明确时，必须用 AskQuestion 让用户选择。

| 触发词 | 路由目标 | 详细流程 |
|--------|---------|---------|
| "模块文档"、"给 X 写文档"、"deepwiki X.h" | module | `references/module-workflow.md` |
| "系统设计"、"架构设计"、"整体设计" | system | `references/system-workflow.md` |
| "项目指南"、"guide"、"上手指南" | guide | `references/guide-workflow.md` |
| "分模块写文档"、"批量生成" | batch | 循环复用 module 流程 |

### 3.2 执行模式

确定文档类型后，SKILL.md 必须询问用户选择执行模式：

| 模式 | 特征 | 适用场景 |
|------|------|---------|
| ⚡ 普通模式 | 单 agent 单次完成，快速生成 | 日常文档需求 |
| 🔥 全力模式 | 多 subagent 并行 + 深度研究 + 多轮自审 | 高质量文档需求 |

全力模式的核心创新是**不区分文档类型**——自动探测项目结构，一次性生成完整文档体系（系统架构 + 核心模块 + Guide + 索引页），使用 15 个深度模板，每个章节三层渐进式披露。

### 3.3 铁律体系

8 条铁律解决 AI 生成文档的三个核心问题：**编造**、**不可验证**、**视觉不一致**。

| # | 铁律 | 含义 | 校验覆盖 |
|---|------|------|---------|
| 1 | 不读源码不动手 | 没读过的函数/类 = 不存在 | 人工审查 |
| 2 | 不许编造 | 宁可 `<!-- TODO -->` 也不造假 | `checkSourceRefs` |
| 3 | 颜色锁死 | 只用 CSS 变量，禁止 inline `color: #hex` | `checkVisualConstraints` |
| 4 | 零装饰 | 无渐变、大阴影、blur、浮起动画 | `checkVisualConstraints` |
| 5 | 零外链 | 图表用 SVG/CSS/Mermaid 内联 | `checkVisualConstraints` |
| 6 | 每图必说 | 所有图表必须有 `<figcaption>` | `checkFigCaptions` |
| 7 | 引用溯源 | 代码引用必须带 `file:line` | `checkSourceRefs` |
| 8 | 全力模式独立审核 | 审核必须由独立 subagent 执行 | 流程约束 |

### 3.4 内容驱动深度

模板只定义"可用的组件库和章节池"，**不硬编码输出的章节数量和深度**。章节取舍的判据是源码复杂度，不是模板框架。一个 30 行的工具函数不需要 12 章；一个 2000 行的状态机模块可能每章都要。

每章最低内容密度要求：每个 `## H2` 章节必须包含 **≥ 2 段叙述性文字 + ≥ 1 个结构化元素**（表格/代码块/列表/图表）。

| 文档类型 | 源码规模 | 最低章节数 | 最低代码块 | 最低源码引用 |
|---------|---------|----------|----------|------------|
| module | < 200 行 | 5 章 | 3 | 2 |
| module | 200-1000 行 | 7 章 | 5 | 4 |
| module | > 1000 行 | 9+ 章 | 8 | 6 |
| system | 3-5 模块 | 6 章 | — | 每模块 1+ |
| system | > 10 模块 | 10+ 章 | — | 每模块 1+ |
| guide | 简单 CLI | 5 章 | 6 | — |
| guide | 复杂系统 | 9+ 章 | 15 | — |

> **设计决策：** 内容驱动深度而非模板驱动，是因为一个 30 行的工具函数不需要 12 章，而一个 2000 行的状态机模块可能每章都要。**章节取舍的判据是源码复杂度，不是模板框架。** 宁可多章覆盖完整，也不要把多个独立概念硬塞进一章。

### 3.5 全力模式工作流

全力模式采用 8 阶段流程，不计 token 消耗，以文档质量为唯一目标：

| 阶段 | 执行者 | 动作 | 输出 |
|------|--------|------|------|
| 0. 项目探测 | 主 agent | 扫描目录、统计规模、识别技术栈 | 项目概况报告 |
| 1. 任务规划 | 主 agent | 规划 subagent 任务表 | 任务分配计划 |
| 2. 并行分析 | 多 subagent | 同时读取源码，返回结构化发现 | 知识图谱 |
| 3. 深度研究 | 主 agent + 补充 | gap-driven 补充 + 外部参考 | 补充分析 + 参考摘要 |
| 4. 内容生成 | 主 agent | 使用 15 个深度模板生成文档体系 | HTML 文档集 |
| 5. 自审 | 独立审核 subagent | 6 维度评分（总分 60） | 审核报告 + 修订清单 |
| 6. 修订循环 | 主 agent | 按修订清单逐项修改（最多 5 轮） | 修订后文档 |
| 7. 交付 | 主 agent | 校验 + 交互测试 + 自迭代循环 | 最终文档 + 质量报告 |

全力模式产出物：

| 产出物 | 内容 | 使用的模板 | 输出路径 |
|--------|------|-----------|---------|
| 系统架构文档 | 分层架构图、模块职责、数据流、线程模型 | 01+02+04+07+08+09+10+11+14 | `doc/<Project>_Architecture_Design.html` |
| 核心模块文档 | API 参考、使用示例、实现分析、状态机 | 03+05+06+08+09+11+14 | `doc/tech-docs/<Module>_Design.html` |
| 端到端 Guide | 沿数据流叙事、配置指南、故障排查 | 01+04+07+12+13+14+15 | `doc/<Project>_Guide.html` |
| 索引页 | 所有文档的导航入口 | — | `doc/index.html` |

### 3.6 自迭代循环

校验不是一次性检查，而是闭环迭代。agent 生成文档后，必须运行校验、修复问题、再校验，直到所有检查通过：

```text
生成文档
  ↓
运行 validate-doc.js --new-doc --fix
  ↓
有问题？
  ├─ 自动修复的问题（--fix）→ 已修复，继续
  └─ 需人工修复的问题 → agent 就地修复
  ↓
重新运行 validate-doc.js
  ↓
全部通过？ → 交付
  └─ 仍有问题 → 回到修复步骤（最多 3 轮）
```text

**终止条件：** 所有校验通过 / 连续两轮无提升 / 3 轮上限。

### 3.7 相关源文件
- `SKILL.md:1-12` — Skill 头部定义
- `SKILL.md:75-87` — 铁律
- `SKILL.md:107-155` — 全力模式工作流
- `SKILL.md:521-617` — 普通模式工作流

## 4. 模板引擎

模板引擎采用**骨架+内容分离**模式：HTML 模板提供骨架（CSS/JS 内嵌），agent 生成内容填入 `{{SECTIONS}}` 占位符。支持渐进式披露三层结构（Summary → Details → Deep Dive）。

### 4.1 骨架+内容分离

模板引擎的核心设计是**骨架+内容分离**——HTML 模板提供完整的骨架（CSS/JS/sidebar/TOC），agent 只负责生成内容片段填入 `{{SECTIONS}}` 占位符。这确保了所有文档的视觉一致性，无论由哪个 agent 生成。

```text
HTML 模板（templates/*.html）
  ├── CSS（@sync:doc-shell.css:start/end 内嵌，~692 行）
  ├── JS（@sync:doc-shell.js/start/end 内嵌，~414 行）
  ├── JS（@sync:skin-switcher.js:start/end 内嵌，~81 行）
  ├── HTML 骨架（head, body, sidebar, main）
  └── {{SECTIONS}} 占位符 ← agent 生成的内容填入这里
```text

### 4.2 @sync 同步机制

三个共享运行时文件（CSS/JS/Skin）通过 `@sync` 标记嵌入模板。当 CSS 或 JS 修改后，运行 `inline-shared.js --sync` 自动替换所有模板中的对应区域。

```javascript
// inline-shared.js 同步逻辑
const SHARED_FILES = {
  'doc-shell.css': path.join(SCRIPTS_DIR, 'doc-shell.css'),
  'doc-shell.js': path.join(SCRIPTS_DIR, 'doc-shell.js'),
  'skin-switcher.js': path.join(SCRIPTS_DIR, 'skin-switcher.js'),
};

// 替换模板中 @sync:xxx:start ... @sync:xxx:end 区域
function syncTemplate(templatePath, sharedContent) {
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [name, content] of Object.entries(sharedContent)) {
    const startMark = `/* @sync:${name}:start */`;
    const endMark = `/* @sync:${name}:end */`;
    // 验证 end marker 存在（防止数据丢失）
    if (!html.includes(endMark)) {
      errors.push(`${name}: start marker found but end marker missing`);
      continue;
    }
    const re = new RegExp(`${startMark}[\\s\\S]*?${endMark}`, 'g');
    html = html.replace(re, `${startMark}\n${content}\n${endMark}`);
  }
  fs.writeFileSync(templatePath, html, 'utf8');
}
```text

模板专属的 CSS 覆盖（如 module 的 `--max-width: 880px`）位于标记区域之外，不受同步影响。

| 文件 | 职责 | 大小 | 同步命令 |
|------|------|------|---------|
| `doc-shell.css` | 设计系统 + 全部组件样式 | 692 行 | `node inline-shared.js --sync` |
| `doc-shell.js` | TOC/ScrollSpy/高亮/缩放/Mermaid | 414 行 | 同上 |
| `skin-switcher.js` | 6 套皮肤切换 | 81 行 | 同上 |

### 4.3 HTML 模板

三个 HTML 模板分别对应三种文档类型：

| 模板 | 行数 | 布局 | 特有组件 |
|------|------|------|---------|
| `module-design.html` | 1582 | details 折叠 | Tabs API 展示、SVG 图表 |
| `system-design.html` | 1278 | details 折叠 | module-panel 模块面板 |
| `guide.html` | 1266 | section 平面 | Hero 头部、badge 标注 |

每个模板都包含完整的 CSS（692 行设计系统 + 模板专属覆盖）、JS（414 行交互功能 + 81 行皮肤切换）、Mermaid CDN 引用和 highlight.js CDN 引用。

### 4.4 章节模板

**普通模式**：`templates/sections/` 目录下 7 个基础模板：

| 模板 | 适用场景 | 三层结构 |
|------|---------|---------|
| `overview.html` | 概述 | Summary → 背景/解决方案 → 深入分析 |
| `architecture.html` | 架构 | Summary → 架构图/分层 → 依赖/性能 |
| `module-detail.html` | 模块详情 | Summary → API/示例 → 实现/边界 |
| `state-machine.html` | 状态机 | Summary → 转换表/图 → 详细行为 |
| `flowchart.html` | 流程图 | Summary → 流程图/步骤 → 异常/性能 |
| `faq.html` | FAQ | Summary → 5+ Q&A 折叠 |
| `glossary.html` | 术语表 | Summary → 术语/说明/出处 |

**全力模式**：`templates/fullpower/` 目录下 15 个深度模板（总计 2587 行），每个模板包含完整的三层渐进式披露结构和示例内容，展示 DeepWiki/ZRead 级别的文档深度。

### 4.5 MD→HTML 转换

`md-to-html.js`（849 行）将 Markdown 文档转为带完整样式的单文件 HTML。支持三种文档类型，每种类型有独立的模板和转换策略。

```bash
node scripts/md-to-html.js --type module doc/tech-docs/Task_Design.md
node scripts/md-to-html.js --type system doc/Architecture_Design.md
node scripts/md-to-html.js --type guide  doc/Guide.md
node scripts/md-to-html.js --type module --all
node scripts/md-to-html.js --type module --index "ProjectName" "description"
```text

转换流程：读取 MD → 解析元信息（frontmatter）→ 拆分章节 → 内联 Markdown（表格/代码/链接/粗体）→ 注入模板 `{{SECTIONS}}` → 输出 HTML。

### 4.6 相关源文件
- `scripts/inline-shared.js:1-17` — @sync 同步机制
- `scripts/md-to-html.js:1-19` — MD→HTML 转换器
- `templates/module-design.html:1-10` — Module 模板入口
- `templates/system-design.html:1-10` — System 模板入口
- `templates/guide.html:1-10` — Guide 模板入口

## 5. 校验流水线

`validate-doc.js`（1004 行）实现 17 类自动化校验，覆盖内容质量、视觉约束、交互功能三个维度。`--fix` 可自动修复部分问题，`--test-interactive` 启用全力模式交互测试。

### 5.1 校验架构

校验脚本采用插件式架构，每类检查是一个独立函数，通过 Report 对象收集结果。`--fix` 模式下，Mermaid 块、heading ID、代码块等可自动修复；其他问题报告后由 agent 就地修复。

```javascript
function validateFile(filePath, fix) {
  let html = fs.readFileSync(filePath, 'utf-8');
  const report = new Report(path.basename(filePath));

  // 17 类校验
  html = checkMermaid(html, report, fix);        // 1. Mermaid 语法
  html = checkHeadingIds(html, report, fix);      // 2. 标题 ID
  html = checkCodeBlocks(html, report, fix);      // 3. 代码块
  checkTables(html, report);                       // 4. 表格结构
  checkInlineMarkdown(html, report);               // 5. 内联 MD
  checkCollapsibleSections(html, report);          // 6. 折叠章节
  html = checkTOC(html, report, fix);             // 7. TOC 完整性
  checkHtmlSkeleton(html, report);                 // 8. HTML 骨架
  checkSourceRefs(html, report);                   // 9. 源码引用
  checkGlossary(html, report);                     // 10. 术语表
  checkScopeBlock(html, report);                   // 11. Scope 声明
  checkVisualConstraints(html, report);            // 12. 视觉约束
  checkSvgGuardrails(html, report);                // 13. SVG 护栏
  checkFigCaptions(html, report, isNewDoc);        // 14. 图说完整性
  checkEmptySections(html, report);                // 15. 空章节
  checkDuplicateContent(html, report);             // 16. 重复内容
  checkContentDensity(html, report);               // 17. 内容密度

  // 交互测试（全力模式）
  if (testInteractive) {
    checkProgressiveDisclosure(html, report);      // I1. 渐进式披露
    checkInteractionFeatures(html, report);        // I2-I7. 交互功能
  }
}
```text

### 5.2 校验项详情

| # | 类别 | 检查内容 | 自动修复 |
|---|------|---------|---------|
| 1 | Mermaid 块 | HTML 实体、箭头语法、花括号、空块 | ✓ |
| 2 | 章节标题 ID | h2/h3 唯一 id、TOC 可定位 | ✓ |
| 3 | 代码块 | language tag、HTML 转义、bare `<pre><code>` | ✓ |
| 4 | 表格 | thead/tbody 结构 | 报告 |
| 5 | 内联 Markdown | 链接、粗体已解析 | 报告 |
| 6 | 可折叠章节 | details/summary 配对、open/collapsed 计数 | 报告 |
| 7 | TOC 完整性 | 非空、链接有效、JS buildTOC 兼容 | ✓ |
| 8 | HTML 骨架 | charset、viewport、lang、title、doctype | 报告 |
| 9 | 源码引用 | source-ref 存在 + href 含行号（非代码文件豁免） | --new-doc 必填 |
| 10 | 术语表 | glossary 章节存在 | --new-doc 必填 |
| 11 | Scope 声明 | scope-block 存在 | --new-doc 必填 |
| 12 | 视觉约束 | 外链图片、渐变、大阴影、硬编码色、纯黑白、浮起效果、CSS url() 外链 | 报告 |
| 13 | SVG 护栏 | 行数（≤80）、节点数（4-12）、role/aria-label | 报告 |
| 14 | 图说完整性 | figcaption 存在 + 编号格式 "图 X.X —" | 报告 |
| 15 | 空章节检测 | section-body 不为空 | 报告 |
| 16 | 重复内容 | 重复 callout、重复段落（>50 字符） | 报告 |
| 17 | 内容密度 | 每节 ≥2 段 + ≥1 结构元素、代码块/节比 ≥0.5、段落/节比 ≥2 | warn |

### 5.3 交互测试（--test-interactive）

交互测试是全力模式的专属功能，验证文档的交互特性是否正常工作：

| # | 测试项 | 通过标准 |
|---|--------|---------|
| I1 | 渐进式披露 | 每个 H2 章节有 section-summary |
| I2 | 折叠/展开 | details + summary 结构正确 |
| I3 | 代码高亮 | 所有代码块有 language class |
| I4 | 暗色模式 | [data-theme="dark"] CSS 存在 |
| I5 | 响应式布局 | @media 查询存在 |
| I6 | 搜索友好 | id 唯一、TOC 链接有效 |
| I7 | 图表交互 | SVG role="img" + aria-label |

### 5.4 防回归规则

以下问题曾发生过，修复后由 `validate-doc.js` 自动拦截。任何未来的改动不得移除这些检查：

| 问题 | 根因 | 检查函数 |
|------|------|---------|
| Mermaid 用 `<div>` 但 CDN 期望 `<pre>` | 选择器不统一 | `checkMermaid` 同时匹配 div/pre |
| inline `color:#hex` 逃过视觉检查 | 只查了 gradient/shadow | `checkVisualConstraints` 增加 hex 检查 |
| 空 section-body 被生成 | AI slop 惰性 | `checkEmptySections` |
| 重复段落/callout | AI slop 重复 | `checkDuplicateContent` |
| source-ref href 为空 | 占位没填 | `checkSourceRefs` href 格式校验 |
| figcaption 无编号 | 缺格式要求 | `checkFigCaptions` 编号格式验证 |
| source-ref 非代码文件误报行号缺失 | .md/.html 不需要行号 | `NO_LINE_REQUIRED` 正则豁免 |

### 5.5 相关源文件
- `scripts/validate-doc.js:0-54` — CLI 参数解析
- `scripts/validate-doc.js:116-167` — checkMermaid
- `scripts/validate-doc.js:423-455` — checkSourceRefs
- `scripts/validate-doc.js:479-559` — checkVisualConstraints
- `scripts/validate-doc.js:736-791` — checkContentDensity
- `scripts/validate-doc.js:796-833` — checkProgressiveDisclosure
- `scripts/validate-doc.js:838-896` — checkInteractionFeatures

## 6. 运行时系统

运行时由三个共享文件组成：CSS 设计系统（6 套皮肤 + 暗色模式）、JS 交互功能（TOC/ScrollSpy/代码高亮/图表缩放）、皮肤切换器。所有文档类型共享同一套运行时。

### 6.1 设计系统（doc-shell.css）

CSS 设计系统（692 行）定义了完整的视觉规范，所有文档类型共享同一套 CSS 变量。核心理念是**约束即自由**——通过严格的变量约束（禁止硬编码颜色、禁止渐变、禁止大阴影），确保所有生成的文档具有一致的视觉风格。

CSS 变量分为语义层和组件层：

| 层级 | 变量 | 说明 |
|------|------|------|
| 语义层 | `--bg`, `--text`, `--accent` | 暗色模式自动切换 |
| 组件层 | `--callout-info`, `--code-bg` | 通过 `var(--xxx, fallback)` 确保离线可用 |
| 布局层 | `--max-width`, `--toc-width`, `--header-height` | 模板可覆盖 |

设计规范：

| 维度 | 规范 | CSS 变量 |
|------|------|---------|
| 字号梯度 | H1 32 > H2 22 > H3 17 > body 15 > small 0.85rem | `--font-sans`, `--font-mono` |
| 间距 | 4px 步进（4/8/12/16/20/24/28/32/40） | `--radius`, `--radius-sm` |
| 颜色 | 暖灰系，非纯黑白 | `--bg`, `--text`, `--accent` 等 |
| 圆角 | 最大 8px（药丸 badge 除外） | `--radius: 6px` |
| 暗色模式 | 3 层回退：data-theme > prefers-color-scheme > 默认 light | `[data-theme="dark"]` |

### 6.2 交互功能（doc-shell.js）

doc-shell.js（414 行）实现了 6 项核心交互功能，所有功能采用 try-catch 包裹的 features[] 数组模式，单个功能失败不影响其他功能：

| 功能 | 实现方式 | 关键设计 |
|------|---------|---------|
| 主题切换 | localStorage + OS preference + 默认 light | 3 层回退，Mermaid 自动重渲染 |
| TOC 自动生成 | 扫描 h2/h3 生成侧边栏 | 支持 guide（nav）和 module/system（ul）两种容器 |
| ScrollSpy | IntersectionObserver 高亮当前章节 | rootMargin 调整偏移量 |
| 代码高亮 | highlight.js CDN + 复制按钮 + 语言标签 | 离线回退到手动 span |
| 图表缩放 | 点击全屏 + 滚轮缩放 + 拖拽平移 + Esc 关闭 | 支持触屏双指缩放 |
| Mermaid 暗色 | 主题切换时自动重渲染 | 保留源码（data-mermaid-src），防止 innerHTML 丢失 |

```javascript
// features[] 数组模式：单个功能失败不影响其他
var features = [
  ['TOC', buildTOC],
  ['ScrollSpy', setupScrollSpy],
  ['CodeBlocks', setupCodeBlocks],
  ['DiagramCopy', setupDiagramCopy],
  ['DiagramZoom', setupDiagramZoom],
  ['Mermaid', setupMermaid]
];
features.forEach(function(f) {
  try { f[1](); }
  catch (e) { console.warn('doc-shell: ' + f[0] + ' init failed:', e.message); }
});
```text

### 6.3 皮肤系统（skin-switcher.js）

皮肤系统（81 行）提供 6 套预设视觉风格，通过覆盖 CSS 变量实现。每套皮肤定义了完整的颜色方案（light + dark），切换时只需更新 `data-skin` 属性。

| 皮肤 | 色调 | 适用场景 |
|------|------|---------|
| Teal | 青绿色（默认） | 通用技术文档 |
| Soft Editorial | 暖纸墨字 | 长文阅读 |
| Vellum | 深蓝纸张 | 学术风格 |
| Monochrome | 极简墨白 | 打印友好 |
| Cartography | 古典制图 | 演示展示 |
| Signal | 深蓝金线 | 嵌入式/硬件文档 |

所有皮肤共享相同的字号梯度、间距规则和圆角限制，只在颜色方案上做差异化。皮肤选择保存在 localStorage 中，下次打开时自动恢复。

### 6.4 相关源文件
- `scripts/doc-shell.css:1-59` — CSS 变量定义
- `scripts/doc-shell.css:128-170` — Reset + Topbar
- `scripts/doc-shell.css:238-258` — Details 折叠样式
- `scripts/doc-shell.css:326-339` — Callout 样式
- `scripts/doc-shell.js:0-30` — 主题切换
- `scripts/doc-shell.js:40-125` — TOC 自动生成
- `scripts/doc-shell.js:231-347` — 图表缩放
- `scripts/doc-shell.js:349-382` — Mermaid 暗色模式
- `scripts/skin-switcher.js:1-80` — 皮肤系统

## 7. 全力模式

全力模式是 Doc-Wiki 的高级工作流，**不区分文档类型**，自动分析项目并生成完整文档体系。采用 8 阶段流程：项目探测→任务规划→并行分析→深度研究→内容生成→自审→修订循环→交付。

### 7.1 项目探测（阶段 0）

全力模式不询问文档类型，自动探测项目结构：

1. **扫描目录结构** — 识别 src/ 下的模块目录
2. **统计源码规模** — 文件数、代码行数、模块数
3. **读取入口文件** — README、CMakeLists、package.json、main 函数等
4. **识别项目类型** — CLI 工具 / 库 / 服务 / 框架 / 嵌入式 / 桌面应用
5. **识别技术栈** — 语言、构建系统、依赖管理、测试框架
6. **规划文档体系** — 根据探测结果，决定生成哪些文档

### 7.2 任务规划（阶段 1）

根据探测结果规划 subagent 任务表：

| 源码规模 | subagent 数量 | 任务分工 |
|---------|-------------|---------|
| 小型（< 10 文件） | 2 | ① 源码分析 ② 测试/配置 |
| 中型（10-50 文件） | 3-4 | ① 核心模块 ② 外围模块 ③ 测试/CI ④ 依赖图 |
| 大型（> 50 文件） | 5-6 | ① 入口层 ② 核心业务 ③ 基础设施 ④ 测试 ⑤ 配置/部署 ⑥ 调用链 |

每个 subagent 任务必须定义：**目标**（具体要分析什么）、**输入**（文件列表/目录范围）、**输出协议**（必须返回结构化的发现）。

### 7.3 并行分析（阶段 2）

主 agent 同时启动所有 subagent，每个 subagent 按任务协议独立分析源码。所有 subagent 完成后，主 agent 汇总结果，生成**知识图谱**：模块 → 函数 → 依赖 → 数据流。

### 7.4 深度研究（阶段 3）

主 agent 检查知识图谱，识别薄弱环节并补派 subagent：

| 缺口类型 | 触发条件 | 补充动作 |
|---------|---------|---------|
| 模块只有入口文件 | 某模块只读了头文件没读实现 | 补派 subagent 读实现文件 |
| 调用链断裂 | 跨 3+ 模块的调用只分析了两头 | 补派 subagent 追踪中间环节 |
| 状态机缺失 | 有状态管理但没找到状态定义 | 补派 subagent 搜索枚举/常量 |
| 错误路径不全 | 某函数有 throw 但没分析 catch | 补派 subagent 追踪异常传播 |

同时派一个 subagent 搜索同类型知名项目的文档结构，收集可借鉴的章节组织和表达方式。

### 7.5 内容生成（阶段 4）

用全部收集的信息生成文档。使用 `templates/fullpower/` 下的 15 个深度模板，每个 H2 章节对应一个模板文件。

相比普通模式的质量提升：

| 维度 | 普通模式 | 全力模式 |
|------|---------|---------|
| 模板 | 7 个基础骨架 | 15 个深度模板，含完整示例内容 |
| 源码引用密度 | 最低要求 | 翻倍，核心函数必引用 |
| 设计决策 Callout | ≥ 4 个 | ≥ 8 个，每个架构选择都解释 WHY |
| 跨模块调用链 | 描述到直接调用 | 追踪 3 层以上，含参数传递 |
| 代码示例 | 按章节要求 | 每个公开 API 都有使用示例 |
| 错误处理 | 有就写 | 穷举所有错误路径 + 推荐处理方式 |
| 性能相关 | 有就写 | 主动标注算法复杂度和瓶颈点 |
| 状态机 | 有就写 | 完整转换表，含前置条件+副作用+并发安全 |
| 配置 | 列参数 | 每个参数含不当值后果，含加载优先级+验证规则 |

### 7.6 自审评分体系（阶段 5）

自审采用 6 维度评分体系，每个维度 0-10 分，总分 60 分。通过线设为 50/60（83%）：

| 维度 | 满分 | 评分标准 |
|------|------|---------|
| 准确性 | 10 | 代码引用真实、API 签名正确 |
| 完整性 | 10 | 覆盖所有核心模块、不遗漏关键流程 |
| 深度 | 10 | 解释 WHY、算法分析、性能说明 |
| 可操作性 | 10 | 读者能照着上手、代码示例可运行 |
| 结构 | 10 | 章节层次清晰、编号一致、术语表完整 |
| 视觉合规 | 10 | 符合全部铁律、CSS 变量、无硬编码色 |

审核 subagent 必须返回结构化结果：总分、各维度分数、修订清单。修订清单包含具体的操作（补充/修正/增加）、目标位置（章节编号）和详细说明。

### 7.7 修订循环（阶段 6）

主 agent 按修订清单逐项修改文档，每项完成后标记 done。修订完成后，回到阶段 5 重新审核。

**循环终止条件：**

| 条件 | 结果 |
|------|------|
| 审核得分 ≥ 50/60 | ✅ 通过，进入交付 |
| 连续两轮得分相同（无提升） | ⚠️ 停止，报告瓶颈原因 |
| 已达 5 轮上限 | ⚠️ 停止，报告当前状态 |

### 7.8 交付（阶段 7）

1. 运行校验脚本（同普通模式 Phase 3 的自迭代循环）
2. 运行交互测试（`--test-interactive`）
3. 输出质量报告

### 7.9 相关源文件
- `SKILL.md:107-155` — 全力模式总览
- `SKILL.md:157-179` — 阶段 0：项目探测
- `SKILL.md:181-205` — 阶段 1：任务规划
- `SKILL.md:237-250` — 阶段 4：内容生成
- `SKILL.md:347-398` — 阶段 5-6：自审+修订

## 8. 数据流

Doc-Wiki 的数据流沿两个方向流动：正向（源码→文档）和反向（校验→修复）。正向流经 SKILL.md 路由→reference 指导→template 骨架→agent 内容填充→校验交付。

### 8.1 正向流：源码→文档

```text
用户触发（"写文档"）
  → SKILL.md 路由（判断类型 + 选择模式）
  → references/*-workflow.md（指导 Phase 0→1→2→3）
  → Phase 0: 读源码（记录 file:line）
  → Phase 1: 结构设计（选章节框架）
  → Phase 2: 内容生成（填入模板 {{SECTIONS}}）
  → Phase 3: 校验交付（validate-doc.js 17 类检查）
```text

关键设计：agent 生成的内容是**HTML 片段**（填入 `{{SECTIONS}}`），而非完整 HTML 文件。骨架（CSS/JS/sidebar/TOC）由模板提供，确保视觉一致性。

### 8.2 反向流：校验→修复

```text
validate-doc.js 发现问题
  → report.fail() / report.warn()
  → --fix 自动修复（Mermaid、heading ID、代码块）
  → agent 就地修复（视觉违规、空章节）
  → 重新校验直到通过
```text

修复后重新校验，形成"生成→校验→修复→再校验"的闭环。新文档必须所有校验通过才能交付。

### 8.3 同步流：CSS/JS→模板

```text
修改 doc-shell.css / doc-shell.js / skin-switcher.js
  → node inline-shared.js --sync
  → 替换 templates/*.html 中 @sync 标记区域
  → 所有模板自动更新
```text

每个模板通过 `@sync` 标记区域嵌入共享内容，模板专属的 CSS 覆盖位于标记区域之外，不受同步影响。

### 8.4 转换流：MD→HTML

```text
Markdown 文件
  → md-to-html.js 解析元信息 + 拆分章节
  → 内联 Markdown（表格/代码/链接/粗体）
  → 注入 HTML 模板 {{SECTIONS}} 占位符
  → 输出单文件 HTML（CSS/JS 已内嵌）
```text

### 8.5 相关源文件
- `SKILL.md:521-560` — 普通模式工作流
- `scripts/validate-doc.js:900-947` — validateFile 主函数
- `scripts/inline-shared.js:106-164` — syncFile 同步函数
- `scripts/md-to-html.js:606-739` — buildHtml 构建函数

## 9. 索引系统

索引页是文档体系的导航入口，支持模块分组、筛选和搜索。

### 9.1 模块索引（doc-meta.json）

`--index` 生成索引页时，脚本会在扫描目录查找 `doc-meta.json`。此文件可选——不存在时回退到按文件名平铺。

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
```text

### 9.2 系统索引

系统索引支持按类别（Architecture/Design/Requirements）分组展示文档：

```json
{
  "categories": {
    "Architecture": { "label": "架构设计", "desc": "系统整体架构" },
    "Design":       { "label": "详细设计", "desc": "核心概念与配置" },
    "Requirements": { "label": "需求文档", "desc": "功能与非功能需求" }
  }
}
```text

### 9.3 相关源文件
- `scripts/md-to-html.js:83-129` — module index 生成
- `scripts/md-to-html.js:165-213` — system index 生成
- `templates/module-index.html` — 模块索引模板
- `templates/system-index.html` — 系统索引模板

## 10. 设计决策记录

以下是项目中做出的关键设计决策，每个决策都记录了背景、选择、代价和替代方案。

### 10.1 单文件 HTML vs 静态站点

**决策：** 选择单文件 HTML（CSS/JS 内嵌）而非 Jekyll/Hugo 等静态站点。

**原因：** 文档必须离线可用、零依赖、浏览器直接打开。静态站点需要构建步骤和服务器。

**代价：** 每个 HTML 文件都包含完整的 CSS/JS（~70KB），文件体积较大；修改 CSS 需要通过 @sync 机制同步到所有模板。

### 10.2 @sync 标记 vs 模板引擎

**决策：** 选择 @sync 标记（正则替换）而非 Handlebars/EJS 等模板引擎。

**原因：** 模板引擎增加依赖，@sync 是纯 Node.js 正则替换，零依赖。

**代价：** 只能同步整块内容，不能做条件渲染或循环；模板专属覆盖需要放在标记区域之外。

### 10.3 内联 Markdown vs 纯 HTML

**决策：** agent 生成内容时使用 Markdown 语法（由 md-to-html.js 转换），而非直接写 HTML。

**原因：** Markdown 更易写、更易读、更不容易出 HTML 语法错误。

**代价：** md-to-html.js 需要维护一套 Markdown 解析器（849 行），且不支持所有 Markdown 扩展语法。

### 10.4 独立审核 subagent vs 自审

**决策：** 全力模式下，审核必须由独立 subagent 执行（铁律 §8），不得由生成者自审。

**原因：** 生成者自审容易"自我感觉良好"，独立审核者用"新鲜眼光"审查更容易发现问题。

**代价：** 额外消耗一个 subagent 的 token，增加交付时间。

### 10.5 6 套皮肤 vs 单一主题

**决策：** 提供 6 套可切换的视觉皮肤，而非单一固定主题。

**原因：** 不同场景（通用、学术、打印、演示）需要不同的视觉风格；皮肤系统通过覆盖 CSS 变量实现，增量成本很低。

**代价：** skin-switcher.js 需要维护 6 套完整的颜色方案（light + dark），增加 ~80 行代码。

### 10.6 相关源文件
- `SKILL.md:780-870` — 资源清单和模板说明
- `scripts/inline-shared.js:37-80` — CSS_OVERRIDES 和 CSS_EXTRAS

## 11. 已知限制与未来演进

### 11.1 已知限制

| 限制 | 说明 | 影响 |
|------|------|------|
| DEBT-1 | md-to-html.js 不读取模板 `{{SECTIONS}}`，而是硬编码 HTML 骨架 | 模板结构改动无法自动同步到 md-to-html 输出 |
| 无增量更新 | 每次生成都是全量重写，不能只更新变化的部分 | 大项目生成时间较长 |
| 无 diff 预览 | 不能对比新旧文档的差异 | 修订时需要人工检查变化 |
| Mermaid 版本锁定 | CDN 引用 10.9.0，不能自动升级 | 新语法可能不支持 |

### 11.2 未来演进方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 增量更新 | 只重新生成变化的章节 | High |
| diff 预览 | 生成前展示将要变更的内容 | Medium |
| 自定义皮肤 | 用户自定义颜色方案 | Low |
| 多语言支持 | 中英文双语文档 | Medium |
| 插件系统 | 允许第三方添加校验规则和模板 | Low |

## 术语表

| 术语 | 说明 | 出处 |
|------|------|------|
| Skill | Claude Code 的能力扩展单元，通过 SKILL.md 定义 | Claude Code 文档 |
| @sync | HTML 模板中的标记，用于同步共享 CSS/JS 内容 | `scripts/inline-shared.js` |
| {{SECTIONS}} | HTML 模板中的占位符，agent 生成的内容填入此处 | `templates/*.html` |
| doc-shell | 共享设计系统（CSS + JS + Skin），所有文档类型共用 | `scripts/doc-shell.*` |
| 渐进式披露 | 三层内容结构：Summary（始终可见）→ Details（默认展开）→ Deep Dive（默认折叠） | `templates/sections/` |
| 铁律 | 8 条不可违反的文档质量规则，违反 = 不合格 | `SKILL.md` |
| 全力模式 | 高级工作流：多 subagent 并行 + 深度研究 + 多轮自审 | `SKILL.md` |
| validate-doc | 17 类自动化校验脚本，支持 --fix 和 --test-interactive | `scripts/validate-doc.js` |
| md-to-html | Markdown→HTML 转换器，支持 module/system/guide 三种类型 | `scripts/md-to-html.js` |
| skin | 视觉皮肤，6 套可切换（Teal/Editorial/Vellum/Mono/Carto/Signal） | `scripts/skin-switcher.js` |
| MLFQ | 多级反馈队列——这是 Doc-Wiki 示例中常用的调度算法，非 Doc-Wiki 本身使用 | 示例文档 |
| @sync 标记 | `/* @sync:filename:start */` 和 `/* @sync:filename:end */` 包围的区域 | `scripts/inline-shared.js` |
| layer-stack | 分层架构图组件，用不同颜色表示不同层级 | `references/html-components.md` |
| source-ref | 源码引用链接组件，格式 `<a class="source-ref" href="file#Lline">` | `references/html-components.md` |
| scope-block | Scope 声明组件，标注文档覆盖范围 | `references/html-components.md` |
| section-summary | 渐进式披露 Layer 1，始终可见的 1-2 句话概述 | `templates/sections/` |
| doc-meta.json | 索引页自定义配置文件，定义模块分组和描述 | `scripts/md-to-html.js` |
