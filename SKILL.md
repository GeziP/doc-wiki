---
name: doc-writer
description: >
  从真实源码生成或维护技术文档：模块 API 参考、系统架构、项目上手与排障指南，以及分模块批量文档。
  适用于“给 X 写文档”“架构文档”“deepwiki”“项目指南”“更新文档”“文档漂移”等请求。
  不用于没有源码依据的产品方案或营销文案。
metadata:
  version: "2.0"
---
# Doc Writer

把真实源码转成可验证、离线可用的工程文档。文档必须帮助读者理解行为、使用接口和处理失败。

## 路由与加载

根据已知意图、输入和既有约定选择类型。不要重复询问用户已经确定的语言、范围或类型。

| 类型 | 目标 | 默认输出 | 按需读取 |
|---|---|---|---|
| module | 单个模块/类的 API 与实现 | `doc/tech-docs/<Name>_Design.md` + `.html` | [module-workflow.md](references/module-workflow.md) |
| system | 系统分层、模块关系和数据流 | `doc/<Name>_Design.md` + `.html` | [system-workflow.md](references/system-workflow.md) |
| guide | 新人上手、端到端操作和排障 | `guide.html` | [guide-workflow.md](references/guide-workflow.md) |
| batch | 多模块文档 | module 输出 + 索引 | module 工作流；先列模块，范围未确定时请用户选择 |
| maintain | 源码变化后的文档更新 | 原地最小修订 | [maintenance-workflow.md](references/maintenance-workflow.md) |

生成时读取 [authoring-workflow.md](references/authoring-workflow.md) 和对应类型工作流；HTML 内容另读 [html-components.md](references/html-components.md)。
维护时先读 maintenance，涉及重写章节时再读 authoring。
语言润色或术语审核时读 [writing-quality.md](references/writing-quality.md)。
修改本 skill 的脚本或模板前读 [tooling-notes.md](references/tooling-notes.md)。

默认普通模式，完成用户指定的文档范围。用户要求完整文档体系、全力模式或并行深度分析时读 [fullpower-workflow.md](references/fullpower-workflow.md)。全力模式不扩大用户明确指定的范围。

## 澄清边界

先用源码、配置、测试和既有文档解决可查证的问题。仅当缺失信息影响目标、范围、不可逆操作或关键事实且无法查证时询问用户。
常规章节取舍、路径和语言可沿用既有约定或采用明确说明的合理默认值。
不确定事实可以记录待确认；不能把猜测写成结论。缺失范围内关键源码时，先指出具体缺口。

## 共享契约

1. **先读后写**：描述的函数、类型、配置和模块必须核对实际来源。仅看到名称不等于理解行为。
2. **证据分级**：区分直接事实、带依据的推断和未知。作者动机、历史故障、性能收益需设计记录、issue、测试或测量支持；实现只能支持实现层面的解释。
3. **保留语义**：改写保留主体、条件、否定、例外、数字、单位、范围、顺序及“必须/可以/可能”等强度。无法在短句内保留精度时保留长句。
4. **术语一致**：同一概念使用标准名称；不同概念不能因近义而合并。保持 API 名称、类型、配置键和代码标识原样。
5. **源码溯源**：行为、签名和关键结论附 `file:line`。引用存在、引用支持结论、示例实际运行是不同证据等级，不能混称为验证通过。
6. **内容驱动深度**：章节取舍按实际行为和读者任务决定，不以章节数、字数、token、图表数或调用层数判定质量。模板是组件库，简单模块不强填，复杂模块不压缩遗漏。
7. **视觉与离线**：使用共享 CSS 变量；不用渐变、大阴影、blur 或浮起动画；图表内联 SVG/CSS/Mermaid，图片及 JS/CSS 资产本地可用；图表配图说。细则在 html-components。
8. **审核门禁**：严重事实错误、错误 API、遗漏关键条件或未经证实的危险操作不能被其他评分抵消。轮数上限只表示停止，不能表示达标。

## 工作流程

| 阶段 | 必须获得的结果 |
|---|---|
| Phase 0 分析 | 已读来源、公开 API、配置、行为及错误路径；术语与未确认项 |
| Phase 1 结构 | 按读者任务组织章节，说明不适用项，无强制章节数量 |
| Phase 2 生成 | 模板承载内容；事实/推断/未知可区分；步骤和接口契约无歧义 |
| Phase 2.5 审核 | 核对高风险结论、签名、条件、例外、术语、示例和图表 |
| Phase 2.6 修订 | 按问题修改，并复查修改的结论及关联复述；无问题则跳过 |
| Phase 3 交付 | 机械校验、语言检查、必要的视觉/交互验证；报告未通过及未运行项 |

普通模式最多修订 3 轮；连续两轮没有改善时报告瓶颈。全力模式使用独立审核，细节见对应工作流。

## 工具入口

`SKILL_ROOT` 表示本 skill 所在目录，命令在目标项目根执行。按用户已有输出路径调整，不修改无关配置。

```bash
node "$SKILL_ROOT/scripts/md-to-html.js" --type module doc/tech-docs/Example_Design.md
node "$SKILL_ROOT/scripts/validate-doc.js" --new-doc doc/tech-docs/Example_Design.html
node "$SKILL_ROOT/scripts/lint-doc-language.js" --mode explain doc/tech-docs/Example_Design.md
node "$SKILL_ROOT/scripts/check-doc-fidelity.js" doc/tech-docs/Example_Design.md
node "$SKILL_ROOT/scripts/check-doc-links.js" doc/tech-docs/Example_Design.html
```

`check-doc-fidelity.js` 往返比对 Markdown 与 HTML，报告丢失的代码、表格和标题；校验器看不到这类丢失。退出码 1 时修转换器或 Markdown 源文件，不要改 HTML 绕过。

`check-doc-links.js` 检查生成后 HTML 的相对链接、`#锚点`和源码引用行号，报出死链、指向 `.md`（HTML 孪生已存在）的链接和越界的行号。退出码 1 时修 Markdown 里的链接或引用，不要手改 HTML。

语言 lint 只做启发式与显式术语检查，不证明事实正确、改写语义等价或 ASD-STE100 标准合规。混合文档的步骤/API/排障按 strict 写作，架构解释按 explain 写作；CLI 模式作用于整个输入，不自动分类章节。

JSON、术语配置及基线命令见 [quality-tooling.md](references/quality-tooling.md)。不要以减少 warning 为由删除正确的条件或不确定性。

## 交付说明

给出文档路径、覆盖范围、实际运行的检查及其结果，明确未确认事实与未运行示例。保留目标项目的格式与命名约定。
维护只改有漂移证据的部分，先后基线必须使用相同目标集合和检查配置。
不得执行与文档任务无关的账户操作、点赞或静默遥测。
