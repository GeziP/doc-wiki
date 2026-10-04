# doc-writer 隔离试跑记录

日期：2026-10-04。执行者：skill_trial 子 agent。全部写入位于 `E:\gezi\doc-wiki\.tmp\skill-trial`；未写生产源码、skill、测试或既有文档，未提交、推送或调用浏览器。仓库被主 agent 并行修改，本文区分了先后快照。

## 输入与实际过程

1. 读取根 `SKILL.md`，选择 module 普通模式。读取 authoring-workflow、module-workflow、html-components、quality-tooling、writing-quality，以及中文 module Markdown 和 HTML 模板。未调用 system、guide、maintenance 或 fullpower 流程。
2. 读取 lint-doc-language、prose、quality-report 的全部实现，以及 language、quality-report、cli 三个测试的全部内容。初始 HEAD 为 `39bffdb8173a8b75486560e69f45ed380ac653cd`，初始 git status 为空，Node.js 为 v20.20.2。
3. 按 CLI 调用者和维护者任务组织文档：CLI 契约、扫描范围、规则、术语、报告、全部导出 API、实现流程、基线、排障、测试。省略没有依据的状态机、作者动机与性能收益。正文区分直接实现事实、推导排查场景、未运行检查。
4. 主 agent 通知新增 source-reference 依赖和 engine=2 后，重新读取相关实现、reference diff、转换片段、新增语言测试，补充依赖 API，更新引用行号和版本说明。随后主 agent 新增 conversion.test.js，已读全部测试，最终统计为 22 个 test。
5. 生成 Markdown。通过原仓库 md-to-html 转换；转换器自动将 vendor 放到输出 doc/assets/vendor。HTML 共享 shell 未手改。为符合 HTML 图表规则，`run-trial.js` 将生成的 ASCII 代码块替换为对应调用关系的内联 SVG，Markdown 保留 ASCII。SVG 的颜色使用共享 CSS 变量和 fallback，有 aria-label 及图说。图中包含 CLI、lint、prose、source-reference、quality-report 五个节点。
6. 用 `run-trial.js` 执行 CLI 示例和代表性 API 断言，保存 stdout/stderr、返回码和 SHA-256 来源清单。TEMP/TMP 指向本输出 test-tmp，测试创建和清理的临时工作区均在此处。
7. 第一轮 HTML --new-doc 校验为 3 error：源码引用、术语表和 Scope 的指定结构缺失。保存 round1 报告后，添加 Scope 组件、术语表标题和源码引用结构。语言 explain 为 0 error / 11 warning，全部是规则表中列出的宣传词字面内容，人工确认这些是规则描述，保留。
8. 主 agent 的浏览器检查发现：Sources 行的行内 raw anchor 被转换器转义为正文，而旧校验器通过 class 字符串误判引用存在。此发现来自主 agent，不是本子 agent 的视觉检查。我将所有 source anchor 改为转换器支持的 `{{相对路径:行号}}` 后重新生成；静态审计确认 50 个实际 anchor，0 个转义 source anchor。
9. 最新重跑发现全测试失败 1 项：validator 的并行修改改变了旧输出，tests/cli.test.js:67 的 ALL PASSED 断言失败。先前较早工作树确实曾 22/22 通过；不把该结果用于最终工作树。保留独立失败报告并继续完成文档转换和机械校验，未擅自修改测试。

## 产物

| 路径（相对本输出根） | 用途 |
|---|---|
| `doc/tech-docs/Lint_Doc_Language_Design.md` | 中文维护来源 |
| `doc/tech-docs/Lint_Doc_Language_Design.html` | HTML 文档 |
| `doc/assets/vendor/` | 转换器复制的本地 CSS/JS，包括许可证及本地 Mermaid/highlight 资产 |
| `run-trial.js` | 可复现示例、测试、转换、SVG 生成及机械检查流程 |
| `audit-static.js` | 源引用存在性/行号范围与资产存在性审计 |
| `examples/` | 实际 CLI 输入、术语配置、基线报告；baseline.md 最终恢复最初状态 |
| `execution-results.json` | 最终 22 次子进程的参数、cwd、状态；passed=null 表示收集结果而非自动断言通过 |
| `source-snapshot.json` | 最终测试运行前 HEAD、git status、Node 版本、实际读取文件散列 |
| `checks/` | 每条命令完整 stdout/stderr；包含首次失败和后续失败证据 |

## 实际命令与最终结果

在项目根执行 `node .tmp/skill-trial/run-trial.js`；以下命令由其调用，完整参数与结果保存在 execution-results.json。API 示例由程序直接导入模块运行，结果在 checks/api.json。

| 命令/案例 | 最终结果 |
|---|---|
| lint --json advisory.md | 退出 0，1 warning |
| lint --strict --json advisory.md | 退出 2，1 warning |
| lint --mode strict --json procedure.md | 退出 0，3 warning |
| lint --disable marketing --json advisory.md | 退出 0，0 issue |
| lint --terms terms.json --json terms.md | 退出 1，1 forbidden-term error |
| lint --json placeholder.md | 退出 1，1 placeholder error |
| lint --json shorthand.md | 退出 1，仅倒序范围产生 placeholder；合法引用排除 |
| 缺失目标 / --bad | 退出 1，分别 input/read / fatal |
| --help / 无文件 | 退出 0，usage JSON |
| 基线保存 / 未变 / 移行 / 替换 / 重复 / 配置改变 | 退出 1 / 0 / 0 / 1 / 1 / 1，最后项为 fatal |
| API 占位符及代码排除 | 断言通过，1 issue，line=1,column=4 |
| decodeEntities / CRLF location | 断言通过，原始 UTF-16 位置映射正确 |
| `node --test tests` | 最新 21 pass / 1 fail；失败为旧 validator 输出断言 |
| `node scripts/md-to-html.js --type module --force .tmp/skill-trial/doc/tech-docs/Lint_Doc_Language_Design.md` | 退出 0；随后隔离脚本替换 HTML 图表 |
| `node scripts/validate-doc.js --new-doc --json .tmp/skill-trial/doc/tech-docs/Lint_Doc_Language_Design.html` | 退出 0，0 error / 0 warning |
| lint --mode explain --json 文档 Markdown / HTML | 两者退出 0，0 error / 11 warning |
| `node .tmp/skill-trial/audit-static.js` | 50 个真实 source-ref，全部文件存在且行号在范围；4 个引用本地 JS/CSS 全部存在；没有转义 source anchor；SVG 存在 |

语言检查未禁用任何规则。11 warning 只描述规则触发词，不是文档的质量宣传，故保留并说明。strict 模式代表性示例已执行；没有把整份混合说明文档的 strict lint 当作语义验收。

## 实际问题、缺口与未运行项

- 新文档机械门禁对结构标记有要求，普通 Sources Markdown 链接不能满足该分类。首轮失败属于文档结构问题，已修订。
- 行内 raw anchor 的转换与校验问题由主 agent 实际浏览器检查发现。本试跑通过换为受支持引用简写解决输出问题；不能把先前机械“通过”称为当时页面正确。
- 模板文件自带 CDN 链接，但本次使用转换器会替换为本地 vendor；最终资产存在性及无 CDN 检查均通过。未修改模板。
- Markdown 表格中的选项值竖线会被简单转换器分列；文档已把该单元格改成两个完整模式选项，避免歧义。
- 最新全测试失败与主 agent 修改 validator 的旧输出有关。该工作树测试未达全通过，不做评分抵消；最终迁移与修复由主 agent 继续处理。
- 浏览器、宽窄屏、暗色、目录、折叠、高亮及 SVG 可读性未由本子 agent 检查；主 agent 明确安排自己完成。此限制不是用户禁止浏览器。
- 文档的 PowerShell Set-Content 管道片段没有逐字执行；实际基线 JSON 用 Node.js fs 保存等价 CLI stdout。没有跨线程压力、性能或覆盖率测量。
- 语义自审核对了全部导出接口、模式/strict 区别、术语约束、源位置、失败分支和基线门禁。文件存在与行范围审计不能证明每个引用支持结论；独立最终语义审核由主 agent 处理。
- 源码在试验期间并行变化，因此最终文档以 source-snapshot.json 的实际工作树散列为准，不仅以 HEAD 为准。本试跑不提供未来变更后的文档正确性保证。

交接时主 agent 通知：已将历史文档的实际 warning 纳入测试断言，validator profile 升为 engine=2，最新 23 tests 通过。这是父 agent 的后续运行结果，本试跑未再次执行；本记录保留自己的 22 tests / 1 fail 现场。按主 agent 要求已冻结 Markdown/HTML，不再追踪其后续生产修改；最终迁移、浏览器和复审由父 agent 继续。
