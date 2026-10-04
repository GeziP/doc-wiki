# 共享生成流程

由 SKILL.md 路由至本文件，再按 module/system/guide 工作流选内容组件；无需加载其他类型。

## Phase 0：先读后写

1. 确认源码快照、范围、读者任务和输出约定；语言默认跟随用户与目标项目。
2. 读实际实现及必要调用点、测试和配置，记录已读文件与 `file:line`。
3. 提取签名、类型/字段、配置默认值与加载顺序、正常/错误/边界路径；适用时核对状态转换和线程模型。
4. 提取术语、定义、别名和源码标识；记录未知。高风险结论亲验，不直接照抄分析报告。

简单函数不必研究整个仓库，也不能仅从名称和目录推断行为。

## Phase 1：结构设计

module 聚焦接口和实现；system 聚焦关系和数据流；guide 沿端到端操作叙事。
模板是章节池，不以数量验收。无状态不强填状态机，无测试不编造覆盖，无设计记录不补作者动机。
图节点及箭头必须有实际模块与关系依据。

## Phase 2：内容生成

读 [writing-quality.md](writing-quality.md)，按章节用途选 strict 或 explain。
module/system 以 Markdown 为维护来源，再转 HTML；guide 可按模板直接生成 HTML。用户指定单一格式时按要求交付。
HTML 内容填入模板 `{{SECTIONS}}`，保留共享设计系统。

### 引用与证据

关键行为/API 附 `file:line`，每章提供 Sources。跨接口同名字段分别核对，不能从 A 接口推断 B 接口。
Markdown 可用 `{{../../scripts/example.js:10-20}}` 源码引用标记，路径按生成 HTML 所在目录计算；转换器会生成 `source-ref` 链接。也可直接使用带 commit 的在线源码链接。标记中行号从 1 开始且范围有序，文件和结论仍需实际核对。
在线源码链接指向仓库和 commit；本地相对链接按输出目录计算。本地文件的 `#L45` 不保证浏览器支持行号导航，应说明阅读方式。
区分事实/推断/未知；数字记录统计命令、范围、快照或真实记录来源。

### HTML 与交互

规则以 [html-components.md](html-components.md) 为准。图表有图说、SVG 有可访问标签；代码转义且有 language class；TOC 与 id 可定位。
折叠降低阅读负担，不强制每个短章节都有三层内容。
模板使用本地 vendor 文件，离线交付需包含引用的资产，不能仅凭 CSS 内嵌称为零依赖。
不要把 HTML 图表文件当作 img；Mermaid 换行交给转换器实体化。

## Phase 2.5：语义自审

| 项目 | 方法 |
|---|---|
| 关键事实/引用 | 核对所有高风险分支方向、配置单位/默认值、错误路径、并发及安全结论；其余按范围抽查并说明覆盖 |
| API | 核对范围内公开签名、参数、结果、条件和副作用 |
| 改写 | 对照来源核对主体、否定、范围、例外、数字和可能性 |
| 术语 | 正文、表格、图及图说共用映射，不同概念不合并 |
| 示例 | 区分静态核对/实际运行；能安全运行且环境具备时运行代表性示例 |
| 图表 | 节点、箭头、条件与实现一致 |
| 完整性 | 覆盖范围内路径与配置约束；删除填充和不适用章节 |

审核记入工作笔记或交付报告，不要求 HTML 填固定评分。语义阻断项需修正或报告未通过。

## Phase 2.6：聚焦修订

逐项修正，复查相邻条件和关联复述；无问题则跳过。最多 3 轮，连续两轮无改善时报告限制；停止不代表通过。

## Phase 3：校验交付

```bash
node "$SKILL_ROOT/scripts/validate-doc.js" --new-doc <output.html>
node "$SKILL_ROOT/scripts/lint-doc-language.js" --mode explain <source.md>
```

步骤/API/排障按 strict 写作；需要 CLI 单独检查时选择对应文件或临时章节输入。提示需人工判断，不盲目删词。
机械校验失败则修复并重跑；`--fix` 只修格式。
生成 HTML 或修改模板/样式/交互时，浏览器检查代表页宽窄屏、暗色、图表、TOC 和折叠；静态检查不能代替视觉检查。
存量文档先留基线，以相同目标和配置比较，见 [quality-tooling.md](quality-tooling.md)。
交付文件、源码快照、覆盖范围、实际检查结果、未确认项和未运行示例。

## 工具与输出

Markdown 正文中的源码链接使用引用简写或 Markdown 链接。不要将带正文前缀的行内 raw anchor 当作转换器已支持的 HTML；生成后确认页面中存在可点击链接，而不只检查 HTML 文件里的 class 字符串。

- 转换：`node "$SKILL_ROOT/scripts/md-to-html.js" --type module|system|guide <input.md>`。
- 索引：`node "$SKILL_ROOT/scripts/md-to-html.js" --type module --index "项目名" "描述"`；可用 `doc-meta.json` 沿用项目品牌与链接。
- CSS/JS 同步：`node "$SKILL_ROOT/scripts/inline-shared.js" --sync`；重新生成受影响产物并验证。
- 修工具前读 tooling-notes，不顺手重刷无关文档或改无关 vendored 副本。
