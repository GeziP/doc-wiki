# 模块设计文档工作流程

Phase 0（源码分析）已在 SKILL.md 中完成。本文件从 Phase 1 开始。

## 输出

- `doc/tech-docs/<ModuleName>_Design.md` (Markdown)
- `doc/tech-docs/<ModuleName>_Design.html` (HTML, 单文件零依赖)

## 语言选择

- 用户说中文 → 使用 `templates/module-design.md`
- 用户说英文 → 使用 `templates/module-design.en.md`
- 无法确定 → 先问

## Phase 1: 结构设计

模块文档采用 **12 章框架**，按模块内部结构组织（带 * 的章节可按模块类型省略）：

| 章节 | 必须 | 说明 |
|------|------|------|
| 文档信息 | Y | 版本、日期、关联文件 |
| 1. 概述 | Y | 背景、问题、解决方案 + 架构图 |
| 2. 设计目标 | 如适用 | 功能目标 + 非功能目标（简单工具模块可省略） |
| 3. 架构设计 | Y | 模块关系图、职责划分 |
| 4. 核心概念 | Y | 数据结构、枚举、常量 |
| 5. 状态机 | 如适用 | 状态定义、转换图、转换条件表 |
| 6. 流程图 | 如适用 | 核心流程、步骤说明、异常处理 |
| 7. 实现细节 | Y | 核心方法代码 + 注释 |
| 8. API 参考 | Y | 公开接口表、配置选项表（用 Tabs 组件） |
| 9. 使用指南 | Y | Basic + Advanced 示例 + 最佳实践 |
| 10. 常见问题 | 可选 | FAQ 表 + 常见陷阱 |
| 11. 测试覆盖 | 如适用 | 测试用例表 + 统计（无独立测试文件时可省略） |
| 附录 | 可选 | 文件清单、依赖树、变更历史 |

识别模块类型以决定可选章节：
- 有状态模块 → 第 5 章状态机必须
- 流程模块 → 第 6 章流程图必须
- 数据模块 → 侧重第 4 章核心概念
- 工具模块 → 侧重第 8 章 API 参考，第 2 章设计目标可省略
- 无独立测试文件的模块 → 第 11 章测试覆盖可省略，在概述中注明测试状态即可

### 每章深度标准（Deep Enough Checklist）

以下是各必选章节"写到什么程度才算够"的具体标准。生成后逐章对照。

| 章 | 最低包含 | 浅 (不合格) | 深 (合格) |
|----|---------|------------|----------|
| 1. 概述 | Scope 声明 + 背景段 + 架构图 + 源码引用 | "本模块负责任务管理" | 交代解决什么问题、为什么需要独立模块、与上下游的关系、设计约束 |
| 3. 架构 | 类图/模块图 + 每个组件职责描述(≥1段) + 依赖方向 | 一张图 + "如图所示" | 图 + 每个节点的职责段落 + 箭头含义(调用/数据/事件) + 设计决策 callout |
| 4. 核心概念 | 每个关键数据结构：字段表 + 取值说明 + 使用场景 | 只列枚举值名称 | 每个枚举值/字段：名称 + 含义 + 何时使用 + 取值范围/约束 |
| 7. 实现细节 | 核心方法的代码片段 + 逐步解释 + 边界处理 | 贴一段代码无解释 | 代码分段 + 每段前置解释"这一步做什么" + 异常路径说明 |
| 8. API 参考 | 每个公开方法：签名 + 参数表 + 返回值 + 行为描述 + 线程安全性 | `cancel(id)` — 取消任务 | `cancel(taskId: TaskId) → bool` — 取消指定任务并级联取消下游依赖。已完成的任务不受影响。线程安全。 |
| 9. 使用指南 | Basic + Advanced 示例各一 + 每个示例带叙事解释 | 只有一个 Basic 示例 | Basic(最小可用) + Advanced(真实场景) + 常见陷阱 warning |

## Phase 2: 内容生成

**同时生成 Markdown 和 HTML 两种格式。**

### Markdown

使用 `templates/module-design.md`（或 `.en.md`）的结构，替换占位符：
- `{{MODULE_NAME}}` — 模块名称
- `{{FILE_PATH}}` — 源文件路径
- `{{VERSION}}` — 文档版本
- `{{DATE}}` — 当前日期
- `{{RELATED_DOCS}}` — 关联文档列表
- `{{TEST_FILE}}` — 测试文件路径

图表使用 ASCII 风格。

### HTML

使用 `templates/module-design.html` 作为骨架（CSS + JS 已嵌入），替换占位符。

HTML 特有能力：
- 内联 SVG 图表（信息密度比 ASCII 高 3-5 倍）
- `<details open>` / `<details>` 可折叠章节（重要章节展开，FAQ/附录折叠）
- Tabs 组件用于 API 参考和使用指南

### ASCII 图表风格（MD 用）

**架构图：**
```
┌─────────────────────────────────────────┐
│           Module Architecture           │
├─────────────────────────────────────────┤
│  ┌───────────┐     ┌───────────┐       │
│  │ ComponentA│────▶│ ComponentB│       │
│  └───────────┘     └───────────┘       │
└─────────────────────────────────────────┘
```

**状态机：**
```
              ┌─────────┐
              │ Initial │
              └────┬────┘
                   │ start()
                   ▼
┌────────┐   ┌─────────┐
│ Failed │◀──│ Running │
└────────┘   └────┬────┘
                  │ succeed
                  ▼
             ┌──────────┐
             │ Completed│
             └──────────┘
```

**流程图：**
```
┌────────┐     ┌────────┐
│ Step 1 │────▶│ Step 2 │
└────────┘     └───┬────┘
                   │
              ┌────┴────┐
              ▼         ▼
         ┌────────┐ ┌────────┐
         │  Yes   │ │   No   │
         └────────┘ └────────┘
```

### 代码示例风格

```cpp
// ========== Basic Usage ==========

auto task = std::make_shared<Task>(Task::Config{
    .name = "SampleTask",
    .priority = 10
});
task->execute();

// ========== Advanced Usage ==========

task->setOnSuccess([](const TaskHookContext& ctx) {
    std::cout << "Task completed\n";
});
```

要求：`// ========== Title ==========` 分节标题，注释解释 WHY，包含必要 imports。

### Good vs Bad 对照

**设计决策 Callout：**

```html
<!-- ✅ GOOD — 解释 WHY，给出具体数据 -->
<div class="callout note">
  <strong>设计决策</strong>
  选择 shared_ptr 而非 unique_ptr，因为 Task 对象需要在调度队列和
  CancellationToken 之间共享所有权。unique_ptr 在 v0.3 中导致了
  use-after-free（issue #127）。
</div>

<!-- ❌ BAD — 只描述 WHAT，没有解释 WHY -->
<div class="callout note">
  <strong>设计决策</strong>
  这里使用了 shared_ptr。
</div>
```

**源码引用：**

```html
<!-- ✅ GOOD — 带文件路径和行号范围 -->
<p>调度算法的核心逻辑在
<a class="source-ref" href="src/scheduler.cpp#L85-L120"><code>src/scheduler.cpp:85-120</code></a>，
采用 MLFQ 多级反馈队列：</p>

<!-- ❌ BAD — 只写函数名，没有文件位置 -->
<p>调度算法在 schedule() 函数中实现。</p>
```

**API 参考表格：**

```html
<!-- ✅ GOOD — 参数类型、返回值、行为描述完整 -->
<tr>
  <td><code>cancel(taskId)</code></td>
  <td><code>TaskId</code></td>
  <td><code>bool</code></td>
  <td>取消指定任务。如果任务有下游依赖，级联取消。已完成的任务不受影响。</td>
</tr>

<!-- ❌ BAD — 敷衍描述 -->
<tr>
  <td><code>cancel(taskId)</code></td>
  <td>id</td>
  <td>bool</td>
  <td>取消任务</td>
</tr>
```

**SVG 图表颜色：**

```html
<!-- ✅ GOOD — 用 CSS 变量 + fallback，适配主题切换 -->
<rect fill="var(--bg,#fff)" stroke="var(--border,#dfe6e8)"/>
<text fill="var(--text,#1f2a30)">ModuleName</text>

<!-- ❌ BAD — 硬编码颜色，暗色模式下不可见 -->
<rect fill="#ffffff" stroke="#cccccc"/>
<text fill="#333333">ModuleName</text>
```

### HTML 实体转义

C++ 代码中 `<`、`>`、`&` 必须转义：
- `std::shared_ptr<T>` → `std::shared_ptr&lt;T&gt;`
- `a && b` → `a &amp;&amp; b`

## MD 转 HTML

```bash
node "$SKILL_ROOT/scripts/md-to-html.js" --type module doc/tech-docs/<Name>_Design.md
node "$SKILL_ROOT/scripts/md-to-html.js" --type module --all
node "$SKILL_ROOT/scripts/md-to-html.js" --type module --index "项目名" "描述"
```

## 批量模式（batch）

1. 扫描项目，列出所有可文档化的模块
2. 让用户确认/筛选模块列表
3. 按 module 流程逐个生成
4. 运行 `--index` 生成索引页
5. 运行 `--all` 批量校验
