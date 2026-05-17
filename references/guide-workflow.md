# 项目指导文档工作流程

Phase 0（项目理解）已在 SKILL.md 中完成。本文件从 Phase 1 开始。

## 定位

**Guide 是教程，不是参考手册。** 读者需要理解"数据怎么流过系统"，不是"系统有哪些模块"。

| 维度 | guide | module |
|------|-------|--------|
| 目标读者 | 新接手项目的开发者 | 需要 API 细节的开发者 |
| 核心问题 | "怎么上手？出了问题怎么办？" | "这个类有哪些方法？" |
| 内容风格 | 指导型（上手 + 排障） | 参考型（API 手册） |
| 输出 | 单个 `guide.html` | `.md` + `.html`（12 章） |

## 输出

- 文件名：`guide.html`
- 位置：项目根目录
- 格式：单文件 HTML，CSS 全部内嵌
- CDN 依赖：highlight.js（离线时回退到手动 span）

## Phase 0 扩展：guide 专属分析

> 以下是 SKILL.md Phase 0 共同要求的扩展。**先完成共同要求（禁止不读代码就生成、记录源码位置、提取术语），再执行本节。**

guide 类型还需要：

1. **识别项目类型**（决定章节内容侧重）：
   - 嵌入式固件 → 硬件接口、外设、RTOS
   - Web 应用 → API 路由、数据库、部署
   - CLI 工具 → 命令行参数、配置文件
   - 库/SDK → 集成指南、API 概览
   - 桌面应用 → UI 架构、状态管理

2. **提取数据流（关键步骤）** — 追踪数据从输入到输出的完整路径，识别每阶段的具体数据结构（字段名、类型、示例值），找到端到端场景

3. **提取业务逻辑** — 理解设计原因，识别核心算法和常见故障点

## Phase 1: 结构设计（叙事式，非罗列式）

**核心原则：沿数据流组织章节，不是按组件分类罗列。**

推荐叙事结构（沿数据流组织，根据项目类型调整）：

```
1. 概述 — 项目解决什么问题 + 整体架构图（标注数据流方向）
2. 快速开始 — 最小可运行示例（安装 → 配置 → 运行）
3. 配置 — 输入/配置的结构（具体举例，逐项解释）
4. 核心流程 — 数据/请求如何流经系统（按实际数据路径拆分子章节）
5. 关键模块 — 核心模块的职责与交互
6. 横切关注点 — 错误处理、日志、安全、监控等
7. 完整示例 — 端到端场景（具体输入 → 处理流程 → 输出结果）
8. FAQ / 排障 — 常见问题与故障排除
```

项目类型适配示例：
- **Web 应用**：第 4 章 = 请求路由 → 中间件 → 控制器 → 数据库
- **CLI 工具**：第 2 章重点放"命令行参数"，第 4 章 = 参数解析 → 执行 → 输出
- **嵌入式固件**：第 4 章 = 外设初始化 → 调度循环 → 中断处理 → 任务执行
- **库/SDK**：第 2 章 = 集成指南，第 5 章 = API 概览

关键约束：
- 第 7 章"完整示例"**必须有**，不可省略
- 每个主要章节用**具体数据**举例
- 架构图展示**数据流方向**（箭头标注数据类型）
- section 用 badge 标注类型：`Config` / `Runtime` / `Example`
- **图表选择**：HTML 输出优先使用内联 SVG（简单架构图）或 Mermaid（复杂架构），ASCII 仅作为 Markdown 兼容备选

### 每章深度标准（Deep Enough Checklist）

| 章 | 最低包含 | 浅 (不合格) | 深 (合格) |
|----|---------|------------|----------|
| 1. 概述 | Scope + 项目定位(≥2段) + 核心价值(列表) + 架构鸟瞰图 | "本项目是一个 XX 框架" | 解决什么问题 + 核心价值3-5点 + 架构图(标注数据流) + 技术栈摘要 |
| 2. 快速开始 | 环境表格 + 构建命令 + 运行命令 + 预期输出 | 只有构建命令 | 环境依赖表(版本+说明) + 完整构建步骤 + 运行命令 + 预期输出截图/文本 |
| 3. 配置 | 完整配置示例(带实际值) + 每个参数逐字段解释 | 贴一段 JSON 说"配置如下" | JSON 示例(带真实值) + 每个字段：类型 + 默认值 + 取值范围 + 不当值后果 |
| 4. 核心流程 | 每阶段：做什么 + 代码引用 + 数据变化 + 错误处理 | 只列步骤名 | 每步：叙事段落 + 代码片段 + 输入输出数据结构 + 异常路径 |
| 5. 关键模块 | 每模块：职责 + 核心 API + 交互方式 + 代码示例 | 只列模块名和一句话 | 每模块详细段落 + 与其他模块的具体交互(调用链/信号/事件) |
| 7. 完整示例 | 场景设定 + 完整配置 + 运行流程 + 输出结果 | 只有配置文件 | 具体场景描述 + 完整可运行配置 + 执行时序图/flow + 每阶段输出 |
| 8. FAQ | ≥3 条基于真实代码逻辑的故障 + 症状+原因+修复步骤 | "检查日志" | 具体症状描述 + 根因分析(指向代码) + 分步修复命令 |

## Phase 2: 内容生成

使用 `templates/guide.html` 作为 HTML 骨架。

### 模板占位符

- `{{PROJECT_NAME}}` — 项目名称（Hero、Topbar、Footer）
- `{{PROJECT_DESC}}` — 一句话描述
- `{{PROJECT_META}}` — 技术栈元信息
- `{{SECTIONS}}` — 所有章节内容

侧边栏 TOC 由 JS 从 H2/H3 自动生成，无需手动维护。

### 章节结构

**平面章节**（大多数）：

```html
<section class="section" id="xxx">
  <div class="section-header">
    <h2>章节标题</h2>
    <span class="section-badge badge-config">Config</span>
  </div>
  <div class="section-body"><!-- 内容 --></div>
</section>
```

Badge 类型：`badge-config`（蓝）、`badge-runtime`（绿）、`badge-example`（琥珀）

**可折叠章节**（FAQ、附录）：

```html
<details class="section-block" id="xxx">
  <summary><h2>章节标题</h2></summary>
  <div class="section-body"><!-- 内容 --></div>
</details>
```

**完整示例章节**（必须，不可省略）：

```html
<section class="section" id="sec-example">
  <div class="section-header">
    <h2>7. 完整示例：具体场景名</h2>
    <span class="section-badge badge-example">Example</span>
  </div>
  <div class="section-body">
    <h3>场景设定</h3><!-- 描述具体场景 -->
    <h3>配置文件</h3><!-- 完整配置，可运行 -->
    <h3>运行时流程</h3><!-- flow-diagram -->
    <h3>输出结果</h3><!-- 时序表 / 执行结果 -->
  </div>
</section>
```

### 写作原则

- 每章从"这个阶段做什么"开始，然后用具体数据展示
- 代码嵌在解释段落中（"下面是 X 的定义，注意 Y 字段..."），不是孤立 code block
- callout 解释**具体机制**（"冲突判定：共享资源 → 同周期 → 时间重叠"），不是泛泛而谈
- 结构体/数据定义用**具体示例值**（`"module": "tongs", "defaultStart": 4000`）

## 内容质量要求

**必须：**
- 引用具体的文件路径、函数名、变量名
- 用具体数据举例（JSON 片段带实际值）
- 代码嵌在叙事段落中
- 架构图展示数据流方向
- callout 解释具体判定条件/机制
- 必须有"完整示例"章节（端到端）
- FAQ 基于真实故障场景（至少 3 个）

**禁止：**
- 不读源码就猜测功能
- 使用"详见代码"敷衍
- 跳过架构图
- 生成空章节或占位内容
- 照搬 README 内容
- 纯罗列式内容（只有字段名表格，没有具体数据和解释）
- 孤立 code block（代码与文字脱节）

## Good vs Bad 对照

**代码嵌入叙事：**

```html
<!-- ✅ GOOD — 代码嵌在解释段落中，上下文连贯 -->
<p>SequenceEngine 的 <code>compile()</code> 方法将配方步骤转换为 Task。
例如，下面的步骤定义了一个依赖 <code>home_position</code> 的移动指令：</p>
<div class="code-block"><pre><code class="language-json">{
  "step": "move_arm",
  "params": { "axis": "X", "position": 150.0 },
  "depends_on": ["home_position"]
}</code></pre></div>
<p>编译后，DependencyGraph 会建立 <code>home_position → move_arm</code> 的依赖边。
只有当 home_position 完成，move_arm 才进入 Ready 队列。</p>

<!-- ❌ BAD — 孤立代码块，无解释 -->
<h3>配方格式</h3>
<div class="code-block"><pre><code class="language-json">{
  "step": "move_arm",
  "params": { "axis": "X", "position": 150.0 },
  "depends_on": ["home_position"]
}</code></pre></div>
```

**配置解释：**

```html
<!-- ✅ GOOD — 具体值 + 具体后果 + 调参建议 -->
<p><code>starvation_guard_ms: 500</code> 确保每个优先级层每 500ms 至少被调度一次。
如果产线有大量实时任务，可增大到 1000ms，但不建议超过 2000ms——
超过后清理任务积压会导致内存增长约 50MB/小时。</p>

<!-- ❌ BAD — 只列字段名，不解释后果 -->
<p><code>starvation_guard_ms</code>: 防止饥饿的时间间隔。</p>
```

**FAQ 条目：**

```html
<!-- ✅ GOOD — 具体症状 + 原因分析 + 修复步骤 -->
<details class="faq">
  <summary>任务一直卡在 Pending 状态</summary>
  <div>
    <p>通常是依赖的上游任务失败或被取消。
    运行 <code>smartfactory --status</code> 查看所有任务状态，
    找到状态为 Failed 的上游任务。</p>
    <p>修复方法：<code>smartfactory --cancel-stale</code> 清理无法满足依赖的 Pending 任务。</p>
  </div>
</details>

<!-- ❌ BAD — 泛泛回答 -->
<details class="faq">
  <summary>任务不执行怎么办？</summary>
  <div><p>检查配置文件和日志。</p></div>
</details>
```

**架构图标注：**

```
✅ GOOD — 标注数据流方向和数据类型

MES 工单 ──→ RecipeManager ──→ SequenceEngine
   (JSON)      (校验+加载)      (编译为任务序列)

❌ BAD — 只有模块名，无数据类型和动作

MES → RecipeManager → SequenceEngine
```

## 图表选择

guide 的 HTML 输出推荐以下优先级：

| 优先级 | 格式 | 适用场景 |
|--------|------|---------|
| 1 | 内联 SVG | 简单架构图（≤ 12 节点）、模块关系图 |
| 2 | Mermaid | 复杂架构（节点多、关系复杂）、状态机、序列图 |
| 3 | Flow 组件 | 线性流程（≤ 7 步） |
| 4 | ASCII 图 | **仅 Markdown 兼容备选**，HTML 中不推荐 |

所有图表必须带 `<figcaption>`（编号 + 描述），详见 html-components.md 的图说规范。

## HTML 特性

- 侧边栏 TOC（H2/H3 自动生成）+ ScrollSpy
- 顶部 Topbar（主题切换、移动端菜单）
- 暗色/浅色主题切换（localStorage + OS 偏好）
- 代码块自动高亮 + 复制按钮
- 内联 SVG 点击放大 + Mermaid 暗色模式适配
- 响应式布局（900px 断点，移动端侧边栏抽屉）
- 打印优化（隐藏导航、展开折叠、显示链接 URL）
- ASCII 图表复制按钮（降级方案）
