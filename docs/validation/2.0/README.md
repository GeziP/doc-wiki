# 2.0 实际 skill 验收

2026-10-04，在本仓库真实源码上调用 SKILL.md 的 module 流程：独立生成 agent 阅读规则、模板及四个实现文件，执行 CLI/API 示例，生成 Markdown 和 HTML；另一独立 reviewer 核对最终接口、失败分支、源码引用和可复现命令。主 agent 修复试跑问题、迁移产物、执行浏览器验收与回归。不是仅对提示词或小样例做静态评估。

产物：[Markdown](../../../doc/tech-docs/Lint_Doc_Language_Design.md)、[HTML](../../../doc/tech-docs/Lint_Doc_Language_Design.html)、[独立复审](review.md)、[初始生成过程](generation-trial.md)、[源码散列](source-snapshot.json)。过程记录保留当时失败，最终结果以下表及当前测试为准。

| 验收 | 实际结果及证据 |
|---|---|
| 最终行为回归 | [tests.txt](tests.txt)：26/26 通过，包含真实文档示例、可重复转换、引用存在与行范围、注入新增错误后阻断并修复通过 |
| 新 HTML 严格门禁 | [html.json](html.json)：0 error / 0 warning，22 类检查 |
| 新 MD/HTML explain 严格门禁 | [language.json](language.json)：两文件均 0 error / 0 warning |
| 示例调用 | 四条正文 CLI 的退出码 0、2、0、1，问题数量与正文一致；CommonJS API 示例亲验通过 |
| PowerShell 保存及比较 | [退出码](powershell-exit-codes.txt)：保存 1、比较 0；[比较报告](powershell-baseline.json) 保留 1 个历史 error，新增 0、未变 1 |
| 独立事实复审 | 50 个源码引用文件与行数有效；核心 API/默认值/失败行为与源码一致；记录完整性收尾由主 agent补齐 |
| 存量扫描 | [all-html.json](all-html.json)：新产物通过；1.x 历史文档出现 1 个缺少实际源码引用的 warning，无 error |
| 浏览器 | Codex 内置浏览器实际打开本地 HTTP 产物；宽屏 1440×1000、窄屏 390×844，根页面无横向溢出；目录展开折叠章节、移动目录点击后关闭、明暗切换亲验通过 |
| 图表及高亮 | SVG 可见，50 个实际引用链接可见；JavaScript/JSON 代码已产生高亮 span。随仓库的 highlight 包不支持 PowerShell，高亮退回可读的纯文本；代码块仍有语言标签 |

宽屏暗色和窄屏截图是实际页面截图：[wide-dark.jpg](wide-dark.jpg)、[narrow.jpg](narrow.jpg)。浏览器控制台检查没有 error/warning。4 个本地 JS/CSS 引用文件存在，JavaScript 实际执行；没有 CDN 引用。未模拟断网，不把本地资产检查称为断网浏览器测试。

## 试跑发现并修复

1. 合法 `{{文件:起始行-结束行}}` 被语言 lint 误报为占位符。增加共用语法解析，仍阻断普通占位符、零行和倒序范围。
2. 转换器范围引用生成 `#L22-L-28`。修复为 `#L22-L28`，增加真实转换链路测试。
3. 行内 raw anchor 被转换成普通文字，校验器依据 class 字符串误报通过。文稿改为受支持的引用简写；校验器改为识别实际标签并排除代码/注释中的假引用。历史文档的同类漏检因此暴露，保留历史快照并明确 warning。
4. 窄屏正文被长代码/表格撑到 880px。module 模板增加正文 width/min-width 和换行约束，复测 390px 视口根 scrollWidth=375px（滚动条占用其余宽度），长代码/表格保留容器内滚动。

初稿的 11 个 marketing warning 来自规则词表本身；将这些匹配字符串按代码字面量排版，保留全部规则及条件，没有删除含义或禁用规则。Markdown 内直接保留 SVG，最终 HTML 由转换器直接生成，不再需要试跑阶段的手工替换图表。

## 复现

在仓库根目录，用 Node.js 20+：

```bash
node --test tests
node scripts/md-to-html.js --type module --force doc/tech-docs/Lint_Doc_Language_Design.md
node scripts/validate-doc.js --new-doc --strict doc/tech-docs/Lint_Doc_Language_Design.html
node scripts/lint-doc-language.js --strict doc/tech-docs/Lint_Doc_Language_Design.md doc/tech-docs/Lint_Doc_Language_Design.html
```

测试自动从真实 Markdown 提取四条 CLI 示例，对当前源码执行并断言报告；在临时目录转换真实文稿并与已交付 HTML 比较；对真实文稿留基线、注入占位符、验证阻断，再恢复验证通过。临时目录自动清理。源码引用存在性是本次文档测试的检查，语法解析器自身不验证事实。

PowerShell 管道保存示例已逐字重放。样例 `before.json` 需先生成，报告 targets 与工作目录有关；不要把历史报告移动后直接当新基线。该临时基线不作为版本化样例提交。

本次验收覆盖实际 module 生成及发现问题后的维护重验。没有验证 system/guide/batch/fullpower 的整套生成、并发压力、性能、代码覆盖率、全部非法嵌套或 Unicode 边界；不宣称所有场景都已通过。
