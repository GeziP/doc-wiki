# Fullpower Mode Upgrade — Multi-Round Deep Research Edition

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade doc-writer to force genuine multi-round generation, independent audit, subagent parallel analysis, and deep research — consuming real token budgets instead of single-pass generation.

**Problem:** Current SKILL.md describes subagent/multi-round/audit in fullpower mode but:
- Agent can skip or simplify all of them — no enforcement mechanism
- Subagent tasks are described abstractly, not as concrete `Task()` calls
- Deep research is optional ("派一个 subagent 搜索...") — agent will skip
- Audit is described but no prompt template — agent will self-review and pass
- Normal mode has zero multi-round — single-pass generation

**Solution:** Rewrite SKILL.md sections to make these **mandatory with concrete execution protocols**.

**Files:** `SKILL.md` only

---

## Task 1: Normal Mode — Add Mandatory Self-Review Loop

**File:** `SKILL.md` — "统一工作流程" section

- [ ] **Step 1: Insert Phase 3.5 (自审) and Phase 3.6 (修订) between Phase 2 and Phase 3**

The current normal mode is: Phase 0 → 1 → 2 → 3 (validate + ship).

Change to: Phase 0 → 1 → 2 → **2.5 (自审)** → **2.6 (修订)** → 3 (validate + ship).

Insert after the "Phase 2: 内容生成" section and before "Phase 3: 校验交付":

```markdown
### Phase 2.5: 自审（必须，不可跳过）

> 生成初稿后，**禁止直接进入校验交付**。必须先完成自审。
> 自审的目的是在程序化校验之前捕获内容质量问题——校验脚本只能检查格式，不能检查"写的对不对"。

**自审清单**（逐项过，每项给出 ✅/❌ + 具体证据）：

| # | 检查项 | 方法 | 不通过时的行动 |
|---|--------|------|--------------|
| R1 | 源码引用真实性 | 随机抽取 3 个 source-ref，确认文件存在且行号范围正确 | 修正引用 |
| R2 | API 签名一致性 | 抽取 2 个 API 表格条目，与源码对比签名/参数/返回值 | 修正表格 |
| R3 | 架构图准确性 | 检查图中每个节点/箭头是否对应真实模块/调用关系 | 修正图表 |
| R4 | 代码示例可运行性 | 检查示例代码是否有缺失 import、编造的 API、错误的参数 | 修正示例 |
| R5 | 设计决策 WHY | 检查每个 callout 是否解释了"为什么这样设计"而不是"用了什么" | 重写 callout |
| R6 | 错误路径覆盖 | 检查关键函数是否都有异常/错误路径说明 | 补充错误路径 |
| R7 | 空章节检测 | 检查是否有章节只有标题没有实质内容 | 填充或删除章节 |

**自审输出格式**（记录在文档末尾注释中，不输出给用户）：

```html
<!--
自审报告:
- R1: ✅ 3/3 引用正确
- R2: ❌ cancel() 签名缺少 CancellationToken 参数 → 已修正
- R3: ✅ 架构图节点与目录结构一致
- R4: ❌ 示例代码缺少 #include <memory> → 已修正
- R5: ✅ 4 个 callout 均解释了 WHY
- R6: ❌ parseConfig 缺少 YAML 格式错误路径 → 已补充
- R7: ✅ 无空章节
修订项: 3 个（R2, R4, R6）
-->
```

### Phase 2.6: 修订（必须，不可跳过）

按自审发现的问题逐项修改文档。每项修改后，在自审报告中标记 done。

**修订完成后，必须重新运行 Phase 2.5 自审**（只检查之前 ❌ 的项）。
如果仍有 ❌，继续修订。最多 3 轮。

**循环终止条件**（任一满足即停）：
- 所有检查项 ✅ → 进入 Phase 3
- 连续两轮结果相同（无提升）→ 进入 Phase 3，报告瓶颈
- 已达 3 轮 → 进入 Phase 3，报告当前状态
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: add mandatory self-review loop (Phase 2.5/2.6) to normal mode workflow"
```

---

## Task 2: Fullpower — Rewrite 阶段 1 (并行分析) with Concrete Subagent Protocol

**File:** `SKILL.md` — 全力模式 → 阶段 1/2

- [ ] **Step 1: Replace abstract subagent descriptions with concrete execution protocol**

Replace the current "阶段 1：并行分析" and "阶段 2：深度研究" sections with a concrete protocol that agent **must follow exactly**.

The current description says "主 agent 同时启动所有 subagent" but doesn't tell the agent HOW. Replace with:

```markdown
### 阶段 1：并行分析

**执行者**：主 agent 通过 Task 工具启动多个 subagent

> **强制执行**：主 agent 必须实际调用 Task 工具启动 subagent，不得在主 agent 内自行完成所有分析。
> 每个 subagent 是独立的 agent 实例，有自己的上下文窗口，不会共享主 agent 的已读内容。

#### Subagent 任务模板

主 agent 按阶段 0 的任务规划表，为每个 subagent 填写以下模板并调用 Task 工具：

**Subagent 1：源码深度分析**

```
Task({
  description: "深度分析源码模块",
  prompt: """
你是一个源码分析专家。请深度分析以下文件，返回结构化发现。

## 分析范围
{从阶段 0 任务规划表填写具体文件列表}

## 必须完成的分析
1. **逐文件分析**：每个文件必须读完整，记录关键函数的 file:line
2. **公开 API 提取**：每个 public 方法/函数，记录：签名、参数类型、返回值、异常、线程安全性
3. **状态变量追踪**：所有成员变量/全局状态，记录：类型、初始值、修改点、读取点
4. **调用关系**：每个关键函数调用了谁、被谁调用（至少追踪 2 层）
5. **设计模式识别**：观察者、策略、工厂、状态机等
6. **错误路径**：每个 throw/return error/exception，记录触发条件和传播路径
7. **性能特征**：算法复杂度、锁竞争、内存分配模式

## 输出格式（必须严格遵循）

### 已读文件清单
- {file_path}:{line_range} — {一句话概括}

### 公开 API 表
| 方法 | 文件:行 | 签名 | 参数 | 返回值 | 异常 | 线程安全 |
|------|---------|------|------|--------|------|---------|

### 状态变量表
| 变量 | 文件:行 | 类型 | 初始值 | 修改点 | 读取点 |
|------|---------|------|--------|--------|--------|

### 调用关系
{function_a} ({file:line}) → {function_b} ({file:line}) → {function_c} ({file:line})

### 设计模式
- {模式名}: {哪些类/函数体现了这个模式}

### 错误路径
| 触发点 | 文件:行 | 条件 | 错误类型 | 传播路径 | 推荐处理 |
|--------|---------|------|---------|---------|---------|

### 性能瓶颈
- {瓶颈描述}: {file:line}, {复杂度分析}

### 代码片段（关键函数，带注释）
{从源码提取的核心函数代码，保留原始缩进，添加行内注释}
"""
})
```

**Subagent 2：测试与配置分析**

```
Task({
  description: "分析测试和配置",
  prompt: """
你是一个测试和配置分析专家。请分析项目的测试覆盖和配置系统。

## 分析范围
- 测试文件: {从阶段 0 任务规划表填写}
- 配置文件: {从阶段 0 任务规划表填写}
- CI/CD 文件: {从阶段 0 任务规划表填写}

## 必须完成的分析
1. **测试覆盖矩阵**：每个测试文件覆盖了哪些函数/模块
2. **边界条件**：测试中覆盖了哪些边界情况（空值、极大值、并发等）
3. **未覆盖路径**：源码中存在但测试未覆盖的路径
4. **配置参数表**：每个配置项的类型、默认值、取值范围、不当值后果
5. **配置加载顺序**：配置文件的优先级和合并逻辑
6. **Mock 策略**：测试中 mock 了哪些外部依赖，为什么

## 输出格式

### 测试覆盖矩阵
| 测试文件 | 覆盖的函数 | 覆盖的路径 | 边界条件 |
|---------|-----------|-----------|---------|

### 未覆盖路径
| 源码函数 | 文件:行 | 未覆盖的路径 | 风险等级 |
|---------|---------|------------|---------|

### 配置参数表
| 参数名 | 类型 | 默认值 | 取值范围 | 不当值后果 | 文件:行 |
|--------|------|--------|---------|-----------|---------|

### 配置加载顺序
1. {来源} → 2. {来源} → 3. {来源}（后者覆盖前者）

### Mock 策略
| 被 Mock 的依赖 | Mock 方式 | 原因 |
|---------------|----------|------|
"""
})
```

**Subagent 3：依赖与数据流分析**（中型以上项目）

```
Task({
  description: "分析依赖关系和数据流",
  prompt: """
你是一个架构分析专家。请分析项目的依赖关系和数据流。

## 分析范围
- 入口文件: {从阶段 0 任务规划表填写}
- 核心模块: {从阶段 0 任务规划表填写}

## 必须完成的分析
1. **模块依赖图**：每个模块依赖谁、被谁依赖（精确到文件级别）
2. **端到端数据流**：从输入到输出的完整数据路径，每阶段的数据类型/结构
3. **跨模块调用链**：至少追踪 3 层深的调用链，记录具体方法名和参数
4. **循环依赖检测**：是否存在循环依赖，如果有，在哪里
5. **外部依赖表**：所有第三方依赖，版本、用途、许可证
6. **线程模型**：哪些操作在哪个线程/协程，共享数据的保护方式

## 输出格式

### 模块依赖图
{module_a} → [{module_b}, {module_c}]
{module_b} → [{module_d}]

### 端到端数据流
输入: {type} @ {file:line}
  → {处理步骤1}: {method} @ {file:line}, 转换为 {type}
  → {处理步骤2}: {method} @ {file:line}, 转换为 {type}
  → 输出: {type} @ {file:line}

### 跨模块调用链（≥ 3 层）
{caller} ({file:line}) → {callee.method} ({file:line}) → {next.method} ({file:line})

### 外部依赖表
| 依赖 | 版本 | 用途 | 文件 |
|------|------|------|------|

### 线程模型
| 线程/协程 | 职责 | 共享数据 | 保护方式 |
|----------|------|---------|---------|
"""
})
```

#### 执行规则

1. **必须实际调用 Task 工具**，不得在 prompt 中说"我将启动 subagent"然后自己完成
2. **每个 subagent 必须返回上述格式的结构化输出**，不得返回散文式描述
3. **主 agent 汇总时必须逐项核对** subagent 返回的结果，发现矛盾时补派 subagent 验证
4. **汇总输出**：将所有 subagent 结果合并为一份知识图谱，包含：文件清单、API 表、状态变量表、调用关系、设计模式、错误路径、测试覆盖、配置参数、依赖图、数据流、线程模型
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: replace abstract subagent descriptions with concrete Task() call templates"
```

---

## Task 3: Fullpower — Rewrite 阶段 2 (深度研究) with Forced WebSearch

**File:** `SKILL.md` — 全力模式 → 阶段 2

- [ ] **Step 1: Replace "深度研究" section with forced research protocol**

The current "阶段 2" says "派一个 subagent 搜索同类型知名项目的文档结构" — agent will skip this.

Replace with a mandatory protocol:

```markdown
### 阶段 2：深度研究

**执行者**：主 agent + 补充 subagent

> **强制执行**：本阶段不可跳过。即使阶段 1 的分析看起来已经"够用"，也必须完成以下两个子阶段。

#### 2a. Gap-Driven 补充分析

主 agent 检查阶段 1 的知识图谱，逐项检查以下缺口表。**每项必须明确标记"已覆盖"或"存在缺口"**：

| # | 缺口类型 | 检查方法 | 存在缺口时的行动 |
|---|---------|---------|----------------|
| G1 | 模块只读了头文件 | 检查文件清单中是否同时有 .h 和 .cpp（或等效） | 补派 Task 读实现文件 |
| G2 | 调用链断裂 | 检查调用关系是否跨 3+ 模块且中间有缺失 | 补派 Task 追踪中间环节 |
| G3 | 状态机不完整 | 检查状态变量表是否有完整的状态枚举和转换 | 补派 Task 搜索枚举/常量定义 |
| G4 | 错误路径缺失 | 检查关键函数是否有 throw/error 但未分析 catch | 补派 Task 追踪异常传播 |
| G5 | 配置参数未解释 | 检查配置表是否有"不当值后果"列 | 补派 Task 读配置验证逻辑 |
| G6 | 线程安全未分析 | 检查共享数据是否有保护方式说明 | 补派 Task 搜索锁/原子量 |
| G7 | 测试覆盖不明 | 检查测试矩阵是否覆盖核心函数 | 补派 Task 分析测试文件 |

**缺口检查报告**（记录，不输出给用户）：

```
缺口检查:
- G1: ✅ 所有核心模块 .h + .cpp 均已读
- G2: ❌ RecipeManager → TaskScheduler 的中间调用缺失 → 补派 subagent
- G3: ✅ TaskState 枚举已完整分析
- G4: ✅ 所有 throw 路径已追踪
- G5: ❌ starvation_guard_ms 缺少不当值后果 → 补派 subagent
- G6: ✅ 所有共享数据已标注保护方式
- G7: ✅ 测试矩阵已覆盖核心函数
补派 subagent: 2 个（G2, G5）
```

补派的 subagent 使用与阶段 1 相同的 Task 工具，prompt 中明确说明"验证/补充 {具体缺口}"。

#### 2b. 外部参考研究（必须，不可跳过）

**必须调用 Task 工具启动一个研究 subagent**：

```
Task({
  description: "搜索同类项目文档最佳实践",
  prompt: """
你是一个技术文档研究员。请搜索与 {项目类型} 同类型的知名项目的文档结构和写法。

## 搜索任务

1. 搜索 "{项目类型} project documentation structure" 和 "{项目类型} API reference best practices"
2. 找到 2-3 个同类型知名项目的文档（如 React/Vue/Django/Spring/Kubernetes 等）
3. 分析每个项目的：
   - 文档目录结构（有哪些章节）
   - API 参考的写法（参数表格式、示例代码风格）
   - 架构图的表达方式
   - 故障排查的组织方式
   - 代码示例的详细程度

## 输出格式

### 参考项目 1: {项目名}
- URL: {文档 URL}
- 目录结构: {章节列表}
- API 参考写法: {特点}
- 架构图风格: {特点}
- 可借鉴点: {具体可以借鉴什么}

### 参考项目 2: {项目名}
...

### 可借鉴的文档模式
1. {模式名}: {描述} — 适用于本文档的 {哪个章节}
2. {模式名}: {描述} — 适用于本文档的 {哪个章节}

### 建议的章节调整
基于参考项目的分析，建议对当前文档做以下调整：
- {调整建议 1}
- {调整建议 2}
"""
})
```

**研究结果的应用**：主 agent 阅读研究 subagent 的输出，在阶段 3 内容生成时：
- 至少采纳 2 个"可借鉴的文档模式"
- 至少应用 1 个"建议的章节调整"
- 在文档末尾注释中记录采纳了哪些外部参考
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: force gap-driven analysis and WebSearch research in fullpower phase 2"
```

---

## Task 4: Fullpower — Rewrite 阶段 4 (自审) as Independent Subagent with Prompt Template

**File:** `SKILL.md` — 全力模式 → 阶段 4/5

- [ ] **Step 1: Replace audit description with concrete subagent prompt template**

The current "阶段 4：自审" says "独立审核 subagent" but doesn't give the agent a concrete prompt to use. Replace with:

```markdown
### 阶段 4：独立审核

**执行者**：独立审核 subagent（铁律 §8：不参与之前的分析和生成）

> **强制执行**：主 agent 必须调用 Task 工具启动审核 subagent。禁止主 agent 自行审核自己生成的文档。
> 审核 subagent 的 prompt 中必须包含完整的文档内容，以便独立验证。

#### 审核 Subagent Prompt 模板

主 agent 将生成的 HTML 文档内容填入以下模板，调用 Task 工具：

```
Task({
  description: "独立审核文档质量",
  prompt: """
你是一个严格的技术文档审核专家。你没有参与这篇文档的源码分析和内容生成。
你的任务是用"新鲜眼光"审查文档质量，找出所有问题。

## 审核文档

{将生成的完整 HTML 文档内容粘贴在这里}

## 项目源码上下文

{将阶段 1 知识图谱中的关键信息粘贴在这里：文件清单、API 表、调用关系等}

## 审核维度（逐项评分，每项 0-10 分）

### 1. 准确性（10 分）
- 随机抽取 5 个 source-ref，验证文件路径和行号是否真实存在
- 抽取 3 个 API 签名，与源码上下文对比是否一致
- 检查架构图节点是否对应真实模块
- 检查代码示例中的 API 调用是否正确

### 2. 完整性（10 分）
- 检查是否覆盖了源码上下文中所有核心模块
- 检查关键流程是否有端到端描述
- 检查错误处理是否穷举了源码中的 throw/error 路径
- 检查配置参数是否都有解释

### 3. 深度（10 分）
- 检查每个主要章节是否有设计决策解释（WHY 不是 WHAT）
- 检查是否有算法复杂度分析
- 检查是否有性能说明
- 检查跨模块调用链是否追踪到 3 层以上

### 4. 可操作性（10 分）
- 检查代码示例是否可运行（import 完整、API 正确）
- 检查 FAQ 是否基于真实故障场景
- 检查配置参数是否有不当值后果说明
- 检查故障排查是否有具体症状→原因→修复步骤

### 5. 结构（10 分）
- 检查章节层次是否清晰
- 检查编号是否一致
- 检查术语表是否完整
- 检查是否有空章节

### 6. 视觉合规（10 分）
- 检查是否有硬编码颜色（inline color:#hex）
- 检查是否有渐变/大阴影/blur
- 检查所有图表是否有 figcaption
- 检查 SVG 是否有 role="img" + aria-label

## 输出格式（必须严格遵循）

### 总分: {score}/60
### 是否通过: {true/false, ≥ 50 分通过}

### 分项评分
| 维度 | 得分 | 扣分原因 |
|------|------|---------|
| 准确性 | {score}/10 | {具体扣分原因} |
| 完整性 | {score}/10 | {具体扣分原因} |
| 深度 | {score}/10 | {具体扣分原因} |
| 可操作性 | {score}/10 | {具体扣分原因} |
| 结构 | {score}/10 | {具体扣分原因} |
| 视觉合规 | {score}/10 | {具体扣分原因} |

### 修订清单（每项必须可执行）
| # | 行动 | 目标位置 | 具体修改内容 |
|---|------|---------|------------|
| 1 | {补充/修正/删除/重写} | {具体章节/图/表} | {详细说明要改成什么样} |
| 2 | ... | ... | ... |
"""
})
```

#### 审核结果处理

1. 主 agent 收到审核结果后，**必须向用户显示审核得分和修订清单**（不像自审那样静默）
2. 如果得分 ≥ 50/60，进入阶段 7 交付
3. 如果得分 < 50/60，进入阶段 5 修订

### 阶段 5：修订

**执行者**：主 agent

1. 按修订清单逐项修改文档
2. 每项修改后在清单中标记 done
3. 修订完成后，**必须重新调用审核 subagent**（使用相同 prompt 模板，更新文档内容）
4. 循环回到阶段 4

**循环终止条件**（任一满足即停）：

| 条件 | 结果 |
|------|------|
| 审核得分 ≥ 50/60 | ✅ 通过，进入交付 |
| 连续两轮得分相同（无提升） | ⚠️ 停止，报告瓶颈原因 |
| 已达 5 轮上限 | ⚠️ 停止，报告当前状态 |
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: add concrete audit subagent prompt template to fullpower phase 4"
```

---

## Task 5: Fullpower — Add Token Budget Expectations and Progress Reporting

**File:** `SKILL.md` — 全力模式 → 激活提示后

- [ ] **Step 1: Add token budget section after the activation prompt**

```markdown
### Token 预算与进度报告

全力模式的目标是**不计 token 消耗**，但需要让用户知道进展。每个阶段完成后，主 agent 必须输出进度报告：

```
📊 全力模式进度 — 阶段 {N}/7
- 已分析文件: {数量}
- 已启动 subagent: {数量} 次
- 当前阶段耗时: {描述}
- 知识图谱: {模块数} 个模块, {函数数} 个函数, {依赖数} 条依赖
```

**预期 Token 消耗量级**（仅供参考，不是限制）：

| 项目规模 | 预期 subagent 调用 | 预期文件读取 | 预期总轮数（含审核） |
|---------|------------------|------------|-------------------|
| 小型（< 10 文件） | 3-4 次 | 10-15 次 | 2-3 轮 |
| 中型（10-50 文件） | 5-8 次 | 20-40 次 | 3-4 轮 |
| 大型（> 50 文件） | 8-12 次 | 40-80 次 | 4-5 轮 |

如果实际消耗明显低于预期，说明分析深度不够——返回上一阶段补充。
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: add token budget expectations and progress reporting to fullpower mode"
```

---

## Task 6: Fullpower — Add Forced Source Reading Depth for Content Generation

**File:** `SKILL.md` — 全力模式 → 阶段 3 (内容生成)

- [ ] **Step 1: Add mandatory re-read protocol to content generation**

The current "阶段 3：内容生成" just says "用全部收集的信息生成文档". Agent will try to generate from memory without re-reading source. Add:

```markdown
### 阶段 3：内容生成

**执行者**：主 agent

> **强制执行**：生成每个章节时，主 agent 必须重新读取对应的源码文件。
> 不允许仅凭阶段 1 知识图谱中的摘要生成——摘要会丢失细节，必须回到源码。

#### 逐章节生成协议

对每个 H2 章节：

1. **先读源码**：重新读取该章节涉及的源码文件（至少读相关的函数/类，不是全文）
2. **再读模板**：读取 `templates/fullpower/` 下对应的深度模板
3. **生成内容**：用源码实际内容填充模板，确保：
   - 每个代码引用有 `file:line`
   - 每个 API 有完整签名
   - 每个设计决策有 WHY 解释
4. **写入文档**：将生成的 HTML 片段写入文档

**禁止行为**：
- ❌ 从阶段 1 的摘要中"回忆"代码，不重新读源码
- ❌ 复制模板中的示例内容，不替换为实际内容
- ❌ 用"详见源码"替代具体的代码片段
- ❌ 生成空的 Layer 3（Deep Dive）

#### 章节生成顺序

按以下顺序生成（后面的章节可以引用前面的章节）：

1. 概述（01-overview.html）
2. 架构（02-architecture.html）— 依赖概述中的技术栈信息
3. 核心模块详情（03-module-detail.html × N）— 依赖架构中的模块划分
4. 数据流（04-data-flow.html）— 依赖模块详情中的 API 信息
5. 状态机（05-state-machine.html）— 依赖模块详情中的状态变量
6. API 参考（06-api-reference.html）— 依赖模块详情中的函数签名
7. 配置系统（07-configuration.html）
8. 错误处理（08-error-handling.html）— 依赖模块详情中的错误路径
9. 性能分析（09-performance.html）
10. 依赖关系（10-dependency.html）
11. 测试覆盖（11-testing.html）
12. 故障排查（12-troubleshooting.html）— 依赖错误处理中的错误码
13. FAQ（13-faq.html）
14. 术语表（14-glossary.html）
15. 流程图（15-flowchart.html）
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: force per-chapter source re-reading in fullpower content generation"
```

---

## Task 7: Verify SKILL.md Consistency

**File:** `SKILL.md`

- [ ] **Step 1: Read through the modified SKILL.md and verify**

- All cross-references are correct (阶段编号、Phase 编号)
- Normal mode workflow (Phase 0→1→2→2.5→2.6→3) is complete
- Fullpower mode workflow (阶段 0→1→2→3→4→5→7) is complete
- No contradictory instructions
- Token budget table is reasonable

- [ ] **Step 2: Commit final version**

```bash
git add SKILL.md
git commit -m "docs: verify SKILL.md consistency after multi-round/audit/subagent/deepresearch upgrade"
```

---

## Summary

| Task | Description | Section Modified |
|------|-------------|-----------------|
| 1 | Normal mode: mandatory self-review loop (Phase 2.5/2.6) | 统一工作流程 |
| 2 | Fullpower: concrete subagent Task() call templates | 阶段 1 + 阶段 2 |
| 3 | Fullpower: forced WebSearch deep research protocol | 阶段 2 |
| 4 | Fullpower: independent audit subagent with prompt template | 阶段 4 + 阶段 5 |
| 5 | Fullpower: token budget expectations + progress reporting | 激活提示后 |
| 6 | Fullpower: forced per-chapter source re-reading | 阶段 3 |
| 7 | Consistency verification | 全文 |

