# 全力模式设计文档 — v2: Multi-Round Deep Research

> **状态**：设计已批准
> **日期**：2026-06-16 (v1), 2026-06-17 (v2 升级)
> **作者**：Claude + 用户协作
> **关联 Skill**：doc-writer
> **关联计划**：`plans/2026-06-16-fullpower-mode-upgrade.md`

---

## 0. v2 升级动机

v1 的全力模式描述了 subagent、多轮审计、深度研究，但存在**执行落差**：

| 问题 | 根因 | v2 解决方案 |
|------|------|-----------|
| Agent 跳过 subagent | 描述太抽象，"启动 subagent"没有具体怎么做的 | 给出完整的 Task() prompt 模板，agent 照抄 |
| Agent 跳过深度研究 | "派一个 subagent 搜索"是可选的 | 变成强制步骤，有缺口检查表 |
| Agent 自审自过 | 没有审核 prompt 模板，agent 随便打个分就过了 | 给出完整的审核 prompt + 评分标准 |
| 普通模式零多轮 | 普通模式是纯单次生成 | 加入 Phase 2.5/2.6 自审循环 |
| Token 消耗不够 | 上述所有问题导致 agent 走捷径 | 强制多轮 + 强制 subagent + 强制 re-read |

**核心原则：如果 agent 可以跳过某步骤，它就会跳过。必须让跳过比执行更难。**

---

## 1. 背景与目标

### 1.1 问题

doc-writer 当前是"单 agent 单次跑完"的模式，存在以下局限：
- 源码阅读深度受限于单 agent 的 token 预算
- 无法并行分析多个模块，效率低
- 缺少外部参考，文档风格可能不符合业界最佳实践
- 没有迭代自审机制，质量依赖一次性生成的质量

### 1.2 目标

新增"全力模式"，在用户显式激活后：
- **并行分析**：用多 subagent 并行读源码，提升深度和效率
- **深度研究**：源码级深度 + 外部参考 + 迭代自审
- **质量保障**：多轮自审循环，直到达到质量标准
- **不计 token**：以文档质量为唯一目标，不考虑 token 消耗

---

## 2. 触发机制

### 2.1 触发时机

用户触发 doc-writer（如"写文档"、"给 X 写文档"）后，在判断文档类型之后、开始分析之前，先询问执行模式。全力模式需要知道文档类型才能规划 subagent 任务。

### 2.2 询问方式

```
AskQuestion([{
  id: "execution-mode",
  prompt: "检测到文档生成需求，选择执行模式：",
  options: [
    { id: "normal",   label: "⚡ 普通模式 — 快速生成，单 agent 单次完成" },
    { id: "fullpower", label: "🔥 全力模式 — 多 agent 并行 + 深度研究 + 多轮自审，不计 token 消耗" }
  ]
}])
```

### 2.3 激活提示

用户选择全力模式后，显示：

> 🔥 **全力模式已激活**
> - 将启动多个并行子任务深度分析源码
> - 生成后自动多轮自审，迭代至达标
> - 不限制 token 消耗，以文档质量为唯一目标

---

## 3. 工作流概览

```
阶段 0: 任务规划（主 agent）
  ↓
阶段 1: 并行分析（多 subagent）
  ↓
阶段 2: 深度研究（gap-driven subagent + 外部参考）
  ↓
阶段 3: 内容生成（主 agent）
  ↓
阶段 4: 自审（审核 subagent）
  ↓ 审核不通过？
阶段 5: 修订 ← 循环回到阶段 4（最多 5 轮）
  ↓ 审核通过
阶段 6: 交付（校验 + 报告）
```

---

## 4. 阶段详细设计

### 4.1 阶段 0：任务规划

**执行者**：主 agent

**职责**：
1. 分析源码规模（文件数、代码行数）
2. 规划 subagent 任务表
3. 定义每个 subagent 的输入输出协议

**任务规划表**：

| 源码规模 | subagent 数量 | 任务分工 |
|---------|-------------|---------|
| 小型（< 10 文件） | 2 | ① 源码分析 ② 测试/配置 |
| 中型（10-50 文件） | 3-4 | ① 核心模块 ② 外围模块 ③ 测试/CI ④ 依赖图 |
| 大型（> 50 文件） | 5-6 | ① 入口层 ② 核心业务 ③ 基础设施 ④ 测试 ⑤ 配置/部署 ⑥ 调用链 |

**Subagent 任务协议**：

每个 subagent 任务包含：
- **目标**：具体要分析什么（如"分析 src/core/ 目录下所有模块的核心函数"）
- **输入**：文件列表/目录范围
- **输出协议**：必须返回结构化的发现

```yaml
files_read:
  - path: src/foo.js
    lines: 1-350
    key_functions:
      - name: parseConfig
        line: 45
        purpose: "解析 YAML 配置，带 3 层 fallback"
dependencies: ["bar.js", "utils.js"]
design_patterns: ["策略模式", "观察者模式"]
risks: ["未处理 null 边界"]
```

### 4.2 阶段 1：并行分析

**执行者**：多个 subagent（并行）

**职责**：
- 每个 subagent 独立完成分配的源码阅读任务
- 返回结构化的分析结果

**执行流程**：
1. 主 agent 同时启动所有 subagent
2. 每个 subagent 按任务协议分析源码
3. 所有 subagent 完成后，主 agent 汇总结果
4. 生成**知识图谱**：模块 → 函数 → 依赖 → 数据流

**输出**：知识图谱（内存中结构化数据，不输出到文件）

### 4.3 阶段 2：深度研究

**执行者**：主 agent + 补充 subagent + 外部参考 subagent

#### 4.3.1 Gap-Driven 补充分析

主 agent 检查知识图谱，识别薄弱环节：
- 某个模块只有入口文件，没有读实现 → 补派 subagent
- 调用链跨 3 个以上模块但只分析了两头 → 补派 subagent 追踪中间环节
- 有状态管理但没找到状态机定义 → 补派 subagent 搜索枚举/常量

#### 4.3.2 外部参考研究

派一个 subagent 搜索同类型知名项目的文档结构：
- 用 `WebSearch` 查询 "XXX project API documentation structure"
- 收集 2-3 个参考项目的文档目录结构和写法特点
- 提炼可借鉴的章节组织和表达方式

**输出**：
- 补充分析结果（合并到知识图谱）
- 外部参考摘要（2-3 个项目的文档特点）

### 4.4 阶段 3：内容生成

**执行者**：主 agent

**职责**：用全部收集的信息生成文档初稿

**与普通模式的差异**：

| 维度 | 普通模式 | 全力模式 |
|------|---------|---------|
| 源码引用密度 | 最低要求（见 SKILL.md 表格） | **翻倍**，核心函数必引用 |
| 设计决策 Callout | ≥ 4 个 | **≥ 8 个**，每个架构选择都解释 WHY |
| 跨模块调用链 | 描述到直接调用 | **追踪 3 层以上**，含参数传递 |
| 代码示例 | 按章节要求 | **每个公开 API 都有使用示例** |
| 错误处理 | 有就写 | **穷举所有错误路径 + 推荐处理方式** |
| 性能相关 | 有就写 | **主动标注算法复杂度和瓶颈点** |

**输出**：文档初稿（HTML 格式）

### 4.5 阶段 4：自审

**执行者**：独立审核 subagent（不参与之前的分析和生成）

**职责**：用"新鲜眼光"审查文档质量

**评分体系**（总分 60 分，≥ 50 分通过）：

| 维度 | 满分 | 评分标准 |
|------|------|---------|
| 准确性 | 10 | 代码引用是否真实、API 签名是否正确、架构描述是否与源码一致 |
| 完整性 | 10 | 是否覆盖所有核心模块、是否遗漏关键流程、错误处理是否穷举 |
| 深度 | 10 | 是否解释 WHY、是否有算法分析、是否有性能说明 |
| 可操作性 | 10 | 读者能否照着文档上手、代码示例是否可运行、FAQ 是否具体 |
| 结构 | 10 | 章节层次是否清晰、编号是否一致、术语表是否完整 |
| 视觉合规 | 10 | 是否符合全部铁律、CSS 变量、无硬编码色、figcaption 齐全 |

**输出**：

```yaml
score: 43/60
pass: false
breakdown:
  accuracy: 8
  completeness: 6  # "缺少 XXX 模块的错误处理路径分析"
  depth: 7
  actionability: 8
  structure: 7
  visual: 7
revision_list:
  - action: "补充"
    target: "3.2 节"
    detail: "添加 parseConfig 的错误处理路径：YAML 格式错误、文件不存在、字段类型不匹配"
  - action: "修正"
    target: "图 2.1"
    detail: "缺少 DataStore → CacheManager 的调用箭头"
  - action: "增加"
    target: "新增 5.4 节"
    detail: "添加 CacheManager 的并发安全分析"
```

### 4.6 阶段 5：修订

**执行者**：主 agent

**职责**：按 revision_list 逐项修改文档

**执行流程**：
1. 遍历 revision_list，每项完成后标记 done
2. 修订完成后，回到阶段 4 重新审核

**循环终止条件**（任一满足即停）：
1. 审核得分 ≥ 50/60 → 通过，进入交付
2. 连续两轮得分相同（无提升）→ 停止，报告瓶颈
3. 已达 5 轮上限 → 停止，报告当前状态

### 4.7 阶段 6：交付

**执行者**：主 agent

**职责**：
1. 运行校验脚本（和普通模式相同）
2. 视觉自审（和普通模式相同）
3. 输出质量报告

**质量报告格式**：

> 🔥 **全力模式完成**
> - 迭代轮数：3 轮
> - 最终得分：54/60
> - 分析文件：23 个
> - subagent 调用：9 次
> - 修订项：12 个（全部完成）

---

## 5. SKILL.md 修改方案

### 5.1 文档类型路由表新增"全力模式"列

在路由表中新增一列，说明全力模式下的差异。

### 5.2 新增"全力模式"章节

在 SKILL.md 中新增独立章节，包含：
- 触发机制（AskQuestion）
- 工作流（7 个阶段）
- 任务规划表
- Subagent 任务协议
- 自审评分体系
- 循环终止条件

### 5.3 铁律补充

在铁律章节新增第 8 条：
> **全力模式铁律**：审核必须由独立 subagent 执行，不得由生成者自审。

---

## 6. 实现计划

### 6.1 修改文件

- `SKILL.md`：新增全力模式章节

### 6.2 不需要修改的文件

- 模板文件（`templates/*.html`）：全力模式产出物格式与普通模式相同
- 校验脚本（`scripts/validate-doc.js`）：校验规则不变
- CSS/JS 文件：视觉规范不变

### 6.3 测试方案

1. 用一个小型项目（< 10 文件）测试全力模式
2. 验证 subagent 并行分析是否正常工作
3. 验证自审循环是否正常终止
4. 验证质量报告是否准确

---

## 7. 设计决策

### 7.1 为什么用内建方案而不是独立 skill？

全力模式和普通模式共享相同的铁律、模板、校验、视觉规范，差异仅在"怎么做"（工作流），不在"做什么"（产出物）。独立 skill 会导致大量重复定义，维护成本高。

### 7.2 为什么自审用独立 subagent？

生成者自审容易"自我感觉良好"，独立 subagent 用"新鲜眼光"审查，更容易发现问题。

### 7.3 为什么限制最多 5 轮循环？

防止无限消耗 token。5 轮后如果仍未达标，说明文档本身可能需要重新规划（如源码太复杂、需求不清晰），应该停下来和用户沟通。

### 7.4 为什么用 50/60 作为通过线？

83% 的通过线是"高质量但不追求完美"的平衡点。如果设得太高（如 55/60），可能会导致过多轮循环；设得太低（如 40/60），则质量提升不明显。

---

## 8. 附录

### 8.1 Subagent 任务示例

**任务 1：核心模块分析**

```yaml
task_id: core-analysis
agent_role: "源码分析师"
input:
  target_files: ["src/core/*.js", "src/core/*.ts"]
  focus: "核心业务逻辑、数据流、状态管理"
output_protocol:
  format: YAML
  required_fields:
    - files_read
    - key_functions
    - dependencies
    - design_patterns
    - risks
```

**任务 2：测试分析**

```yaml
task_id: test-analysis
agent_role: "测试分析师"
input:
  target_files: ["tests/**/*.test.js", "tests/**/*.spec.js"]
  focus: "测试覆盖率、边界条件、异常处理"
output_protocol:
  format: YAML
  required_fields:
    - test_files
    - covered_functions
    - edge_cases
    - missing_coverage
```

### 8.2 自审评分示例

**通过示例**：

```yaml
score: 52/60
pass: true
breakdown:
  accuracy: 9
  completeness: 9
  depth: 8
  actionability: 9
  structure: 9
  visual: 8
revision_list: []
```

**不通过示例**：

```yaml
score: 43/60
pass: false
breakdown:
  accuracy: 8
  completeness: 6
  depth: 7
  actionability: 8
  structure: 7
  visual: 7
revision_list:
  - action: "补充"
    target: "3.2 节"
    detail: "添加 parseConfig 的错误处理路径：YAML 格式错误、文件不存在、字段类型不匹配"
  - action: "修正"
    target: "图 2.1"
    detail: "缺少 DataStore → CacheManager 的调用箭头"
  - action: "增加"
    target: "新增 5.4 节"
    detail: "添加 CacheManager 的并发安全分析"
```

---

## 9. 深度研究：竞品文档平台分析

> 研究对象：DeepWiki、ZRead.ai、CodeWiki (Google)
> 研究目标：提取文档结构最佳实践，用于优化全力模式的产出质量

### 9.1 DeepWiki (deepwiki.com)

**来源**：meta 数据 + URL 结构分析（`deepwiki.com/anthropics/claude-code`）

**文档结构**（以 Claude Code 为例，7 章 30+ 子节）：

| 章节 | 内容 | 子节数 |
|------|------|--------|
| 1. Overview | 项目概述、系统架构、特性演进、许可证 | 3 |
| 2. User Guide | 安装、配置、CLI 命令、会话管理、反馈 | 5 |
| 3. Core Systems | Agent 系统、工具系统、上下文窗口、Hook、MCP、插件、Skill、沙箱、UI/UX | 9 |
| 4. Official Plugins | 插件市场、代码审查、特性开发、输出样式、插件开发套件 | 8 |
| 5. GitHub Automation | Issue 分流、去重、生命周期、@claude 提及、跨仓库通知、事件日志 | 6 |
| 6. Development Environment | DevContainer、网络安全、基础镜像、容器编排、企业 MDM | 5 |
| 7. Glossary | 术语表 | 1 |

**关键特征**：
- **层级编号**：`1`, `1.1`, `1.2`, `2`, `2.1` ... 严格两级结构
- **URL 语义化**：`/org/repo/3.1-agent-system-and-subagents`
- **每个页面独立**：有独立的 meta description、OG 图片、标签
- **标签系统**：`anthropics,claude-code,documentation,wiki,codebase,AI documentation,Devin`
- **章节粒度**：每个子节聚焦一个主题（如 3.1 只讲 Agent 系统，3.2 只讲工具系统）

### 9.2 ZRead.ai

**来源**：meta 数据 + URL 结构分析（`zread.ai/anthropics/claude-code`）

**文档结构**（同样以 Claude Code 为例，11+ 章节）：

| 章节 | 内容 |
|------|------|
| 2. Quick Start | 快速开始 |
| 3. Installation and Setup | 安装与设置 |
| 7. Architecture Overview | 架构概览 |
| 8. Plugin System Design | 插件系统设计 |
| 9. Slash Commands | 斜杠命令 |
| 10. Specialized Agents | 专业 Agent |
| 11. Agent Skills | Agent 技能 |
| 12. Hook System and Events | Hook 系统与事件 |
| 14. Hookify Rule Engine | Hookify 规则引擎 |
| 15. Feature Development Workflow | 特性开发工作流 |
| 16. PR Review Toolkit | PR 审查工具包 |
| 17. Security Guidance Plugin | 安全指导插件 |
| 19. Plugin Structure and Manifest | 插件结构与清单 |
| 20. Create Plugin Workflow | 创建插件工作流 |
| 23. Settings Hierarchy | 设置层级 |
| 24. Security Settings Reference | 安全设置参考 |
| 25. MDM Deployment Templates | MDM 部署模板 |

**关键特征**：
- **直接源码引用**：链接到具体文件和行号（`README.md#L1-L12`, `examples/hooks/bash_command_validator_example.py#L1-L84`）
- **章节编号不连续**：允许跳号（如 12 → 14, 17 → 19, 20 → 23），说明是按需生成
- **更细粒度**：每个功能/工具独立成章（如 Slash Commands、Hook System 各自独立）
- **代码文件直接链接**：不只链接到文档页，还链接到实际源码文件

### 9.3 CodeWiki (Google)

**来源**：无法获取有效数据（页面需要认证或 URL 格式不同）

### 9.4 三者共性分析

| 特征 | DeepWiki | ZRead | doc-writer 现状 | 差距 |
|------|----------|-------|----------------|------|
| **层级编号** | ✅ 严格两级 | ✅ 数字编号 | ✅ 已有 | 无 |
| **源码引用** | ⚠️ 页面级 | ✅ 行级链接 | ✅ file:line | 无 |
| **架构图** | ✅ Mermaid | ✅ 有 | ✅ 有 | 无 |
| **术语表** | ✅ 独立章节 | ⚠️ 不明确 | ✅ 已有 | 无 |
| **侧边栏导航** | ✅ 自动生成 | ✅ 自动生成 | ✅ TOC | 无 |
| **章节独立性** | ✅ 每节聚焦 | ✅ 每节聚焦 | ⚠️ 部分合并 | 需改进 |
| **代码导航** | ✅ 可点击 | ✅ 行级链接 | ⚠️ 静态链接 | 需改进 |
| **搜索功能** | ✅ 全文搜索 | ✅ AI 搜索 | ❌ 无 | 需新增 |
| **交互性** | ✅ SPA | ✅ SPA | ⚠️ 静态 HTML | 需改进 |

### 9.5 关键发现：全力模式应借鉴的设计原则

**原则 1：章节粒度 — 每个主题独立成章**

DeepWiki 和 ZRead 都将每个独立主题（如 Agent 系统、Hook 系统、插件系统）拆成独立章节，而不是合并到一个大章节中。这使得：
- 读者可以精确定位到感兴趣的主题
- 每个章节可以独立阅读，不依赖上下文
- 侧边栏导航更清晰

**doc-writer 全力模式应改进**：
- system 文档：每个核心模块独立成章（不合并到"核心模块"一个大章节）
- module 文档：API 按功能分组，每组独立章节（不合并到一个大 API 章节）
- guide 文档：每个功能/工作流独立成章

**原则 2：源码引用可导航 — 从文档直接跳转到源码**

ZRead 的链接格式：`/examples/hooks/bash_command_validator_example.py#L1-L84`
DeepWiki 的链接格式：`/anthropics/claude-code/3.1-agent-system-and-subagents`

两者都支持从文档直接跳转到源码位置。

**doc-writer 全力模式应改进**：
- 所有源码引用必须是可点击的链接（`<a href="src/foo.js#L45-L60">`）
- 全力模式下，引用密度翻倍，每个核心函数都有可导航链接

**原则 3：章节编号允许跳号 — 按需生成，不强制连续**

ZRead 的编号：2, 3, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 23, 24, 25
DeepWiki 的编号：1, 1.1, 1.2, 1.3, 2, 2.1, 2.2, ...（严格连续）

ZRead 的方式更灵活，说明章节是按需生成的，而不是预设框架。

**doc-writer 全力模式应改进**：
- 允许章节编号跳号（如 1, 2, 5, 7），反映实际内容而非模板框架
- 这与现有"内容驱动深度"原则一致

**原则 4：标签系统 — 文档元数据**

DeepWiki 有标签：`anthropics,claude-code,documentation,wiki,codebase,AI documentation,Devin`

**doc-writer 全力模式应改进**：
- 在文档头部添加标签/关键词 meta 信息
- 便于搜索和分类

**原则 5：交互式功能 — 代码高亮、搜索、暗色模式**

两者都是 SPA 应用，支持：
- 全文搜索
- 代码高亮 + 行号
- 暗色模式
- 响应式布局

**doc-writer 现状**：已有代码高亮、暗色模式、响应式布局。缺少全文搜索。

**全力模式应改进**：
- 在 Phase 3（交付）中，确保文档支持浏览器内搜索（Ctrl+F）
- 考虑添加简单的搜索索引（如 `data-search` 属性）

### 9.6 全力模式改进建议

基于以上分析，全力模式应增加以下改进：

| 改进项 | 影响阶段 | 优先级 |
|--------|---------|--------|
| 每个核心模块独立成章 | 阶段 3（内容生成） | 高 |
| 源码引用全部可导航 | 阶段 3（内容生成） | 高 |
| 章节编号允许跳号 | 阶段 3（内容生成） | 中 |
| 文档头部添加标签/关键词 | 阶段 3（内容生成） | 中 |
| 确保 Ctrl+F 可搜索 | 阶段 6（交付） | 低 |

---

**设计文档结束**

> 本文档由 brainstorming skill 生成，已通过用户批准。
> 下一步：调用 writing-plans skill 生成实现计划。
