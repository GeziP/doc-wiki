# 2.0 细节修订独立事实复审

2026-10-04，复审最终 `doc/tech-docs/Lint_Doc_Language_Design.md/.html`（1.1）、语言检查 engine 3，以及写作质量和模块生成流程。本 reviewer 只写本文件，没有修改其他文件或 commit/push；浏览器操作由主 agent 执行。

## 结论

最终模块文档的接口、模式、报告、基线和本轮规则修正与真实源码一致。初审发现的旧术语描述及代码转义指导歧义已修复；重新运行全部测试 **28/28 通过**。没有发现尚未修复的严重事实错误、错误 API 或关键操作条件遗漏。生成流程已明确 Markdown 单一维护来源，HTML 直接转换，真实文档转换复现测试通过。

这个结论来自亲读源码、文档及实际执行，不以 lint 或测试通过证明所有改写语义等价。浏览器验收、Unicode 全边界、性能、并发和其他生成模式不在本 reviewer 的执行范围内。

## 已读与亲验依据

- 完整阅读当前 `scripts/lint-doc-language.js`、`scripts/lib/prose.js`、`scripts/lib/quality-report.js`、`scripts/lib/source-reference.js`，核对全部公开函数签名、默认参数、异常路径及门禁分支。
- 阅读当前 `tests/language.test.js`、`tests/conversion.test.js`、`tests/skill-e2e.test.js`，对照此前已亲读的 CLI/报告测试；没有把仅检测提示的 hedges 测试当作语义改写证明。
- 阅读 `references/writing-quality.md`、`references/module-workflow.md` 和共享 authoring 流程：前后对照或源码对照负责语义，CLI 全输入模式不自动分类章节，已有正文不必为产生修改而重写，许可/能力/不确定性不应自动互换。
- 最终 MD 50 个双花括号引用均指向真实文件及范围内行号。亲验 `lint-doc-language.js:34-44`（原串字面量匹配）、`:47-55`（引用整体掩码与位置）、`:69-80`（strict 专属规则及长度阈值）、`:86-140`（CLI 默认、输出和 engine 3）；报告身份/基线/门禁核对 `quality-report.js:22-83`。

## 实际执行结果

环境：Windows PowerShell，Node.js v20.20.2，仓库根 E:\gezi\doc-wiki。CLI 通过 spawnSync 读取原生退出码。

| 操作 | 结果 |
|---|---|
| 全部测试，在最终转义指导/测试修订后重跑 | 28/28，0 失败 |
| 正文 advisory explain CLI | 退出 0，1 个 marketing warning，engine=3 |
| 同样例 `--strict` | 退出 2，同一个 warning，mode 仍为 explain |
| procedure `--mode strict` | 退出 0，2 个 vague-reference、1 个 multi-action |
| terms CLI | 退出 1，1 个 forbidden-term error |
| 文档 CommonJS placeholder 示例 | 1 个问题，column=4，代码内标记被排除 |
| `İ TASK old.name oldXname task_id`，禁用 task/old.name | 仅两项 forbidden-term，column=3、8；oldXname/task_id 不匹配 |
| 合法 `{{scripts/seamless-then-task.js:1}}`，strict 且禁用 task | 无语言问题；文件不存在也不由语法解析器检查 |
| engine 3 当前报告与 engine 2 旧基线比较 | 拒绝，configuration 错误 |
| parseArgs 空参数默认 | explain、cwd root、disabled/files 为空；未出现布尔属性不强行设 false |

完整测试实际验证：合法引用后的正文仍保留原列号、非法倒序引用仍产生 placeholder；真实 MD 四条 CLI 可复现；真实 MD 转换与交付 HTML 内容相同（只统一 CRLF/LF）；新增占位符被基线阻断、恢复后通过。

## 发现、修复及复核

1. **P2，已关闭：术语实现描述残留。** 初审 MD:133 仍写“禁用词匹配统一转小写”，与新 `termMatches` 的原串 RegExp gi 及 MD:161 自相矛盾。主 agent 改为“原始文字串上的不区分大小写字面量匹配，不改变原文字串”；复读最终正文和源码，描述吻合。原串 offset 修复和正则字符转义各有实际断言，不能仅凭 Unicode 的小写等价推断所有 Unicode 匹配语义。

2. **P3，已关闭：Markdown 单来源后的转义指导歧义。** module-workflow:213 原先将“C++ 代码必须转义”无条件写在新 Markdown 流程下，易使围栏源码预先变实体。最终明确 Markdown 围栏保留原始源码，只有手写 raw HTML 代码块需要转义。转换器 `md-to-html.js:539-543` 对围栏内容调用 escapeHtml；更新 conversion 测试实际断言 `std::shared_ptr&lt;T&gt; x; a &amp;&amp; b;` 且没有双重转义，最终实跑通过。

3. **生成流程复核通过。** module-workflow:63,75,79 与 authoring-workflow:23 都以 Markdown 作为维护来源，图表可存 raw SVG/Mermaid/ASCII，再转换 HTML；没有再要求独立维护 ASCII 和 SVG 两份图。本轮最终文稿直接保存 SVG，e2e 的真实文稿转换相等断言支持此结论。

## 验收记录边界与快照收尾

已读 refinement README 及四份 JSON 报告：language 为两个目标、engine 3、0 error/0 warning；HTML 为一个目标、engine 2、0 error/0 warning；core-language 四文件 0/0；存量 HTML 两文件 0 error/1 个历史源码引用 warning。README 明确 explain 全文通过不证明步骤满足 strict，未把本轮扩展为其他模式、断网、性能或覆盖率验收。

首次核验 source-snapshot 时，module-workflow 和 conversion.test 两个散列尚未覆盖最终收尾修改，已通知主 agent 刷新。最终重新独立计算快照所列 **25 个文件 SHA-256，全部吻合**，该收尾项关闭。浏览器当前页重验及截图由主 agent 的实际记录证明，本 reviewer 没有冒称再次操作浏览器。

## 最后新增修订复查：文档版本解析

主 agent 的浏览器验收发现，真实 Markdown 写 1.1，HTML 元数据却回落为 V1.0。亲读最终 `md-to-html.js:304-324`：parseMdMeta 仅跳过“项目”表头及分隔线，再处理 `文档版本/Version`；不再把包含“文档”的正常元数据行整体跳过。亲验最终 HTML 有 `<span class="doc-version">1.1</span>`，与 MD 一致。

新增 conversion case 在 metadata 写 `V2.7` 并断言实际 HTML 的版本 span 是 V2.7；本 reviewer 在这次修改后独立运行 conversion 与真实文档 e2e 共 **4/4 通过**，包含版本、C++ 一次转义、真实文稿转换复现、示例及基线注入/恢复。该复查未扩大到其他元数据或所有模板。最终没有未关闭的事实/API阻断项。
