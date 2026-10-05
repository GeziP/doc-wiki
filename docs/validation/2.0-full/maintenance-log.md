# 隔离维护验证记录

日期：2026-10-05。使用 `.tmp/full-validation/maintenance/SKILL.md` 的 maintain 路由及 `references/maintenance-workflow.md`（M0–M4），并读取 quality-tooling/html-components。此记录只描述受控 sandbox 维护，不表示生产代码已经改变。

## 范围与源码核验

目标仅为 sandbox 内 `doc/tech-docs/Lint_Doc_Language_Design.md` 与生成的 `.html`。基准 commit 为 `eae95fedda3578aca9858764a29ef6a116c37504`，变更线索来自 sandbox/source-change.json；随后亲读源码、调用点及 `tests/language.test.js`。

通过只读 `git show <base>:scripts/lint-doc-language.js` 得到旧源码，并与 sandbox 新源码逐字比较（仅统一 CRLF）。唯一差异为第 79 行 `mode === 'strict' ? 50 : 70` → `mode === 'strict' ? 55 : 70`。`prose.js`、`quality-report.js`、`source-reference.js` 三依赖与 base 逐字一致。生产文件、sandbox 源码、模板、规则和既有测试均未由本维护任务写入；没有 commit/push。

| 文档位置 | 当前事实与来源 | 最小修订 | 严重度/证据 |
|---|---|---|---|
| §3.2 long-sentence 规则表 | strict 的 CJK 阈值为 55，比较符为 `>`，英文仍为 20；scripts/lint-doc-language.js:74-80 | 将中文 >50 改为 >55 | P1 API 行为漂移，直接源码+执行 |
| §3.2 边界解释 | CJK 只统计 U+3400..U+9FFF，任一计数超阈值即 warning；:76-80 | 补 51–55/56、英文 OR、explain 和 --strict 条件，附 73-80 引用 | P1 条件/单位，直接源码+执行 |
| 文档信息/验收来源 | sandbox 是 base 上单项受控变化，旧验收记录不对应本次试验 | 标明隔离快照与本记录；保留版本 1.1 及历史内容 | P2 来源范围，直接证据 |

未重写未漂移章节。Markdown/HTML diff 已分别保存于 `maintenance/checks/document-md.diff`、`document-html.diff`；修订前完整文件保存为 `before.md`、`before.html`。

## 同工具、同目标、同配置的机械基线

所有命令在 `E:/gezi/doc-wiki/.tmp/full-validation/maintenance` 执行，Node v20.20.2。使用该 sandbox 的 vendored 工具副本，前后 SHA-256 校验一致；散列及完整参数见 checks/before-run.json、after-run.json。

修订前：

```powershell
node scripts/validate-doc.js --new-doc --json doc/tech-docs/Lint_Doc_Language_Design.html
node scripts/lint-doc-language.js --mode explain --json doc/tech-docs/Lint_Doc_Language_Design.md
```

按原目标生成：

```powershell
node scripts/md-to-html.js --type module --force doc/tech-docs/Lint_Doc_Language_Design.md
```

修订后：

```powershell
node scripts/validate-doc.js --new-doc --json --baseline checks/before-html.json doc/tech-docs/Lint_Doc_Language_Design.html
node scripts/lint-doc-language.js --mode explain --json --baseline checks/before-language.json doc/tech-docs/Lint_Doc_Language_Design.md
```

HTML 前后 profile engine=2/newDoc=true/strict=false/interactive=false；语言前后 engine=3/mode=explain/strict=false/disabled=[]/空术语配置。语言基线使用受控新工具检查修订前文稿和修订后文稿，没有拿旧工具的报告冒充同版本基线。engine 未随阈值改动自动变化，因此额外检查工具散列，不以 engine 单独证明版本相同。

| 门禁 | before | after | 新增/解决/保留 | 退出码 |
|---|---|---|---|---|
| HTML | 0 error / 0 warning | 0 error / 0 warning | 0 / 0 / 0 | 0 / 0 |
| explain language | 0 error / 0 warning | 0 error / 0 warning | 0 / 0 / 0 | 0 / 0 |

JSON 为 before-html.json、before-language.json、after-html.json、after-language.json。未启用 strict warning 阻断的整篇文稿门禁，不将默认门禁称为 strict 门禁。

## 新旧边界例子亲跑与语义核对

可重跑 `node checks/maintenance-check.js after`（项目根执行），脚本从真实 git base 加载旧 CommonJS 模块，沿同路径解析核验过的依赖；新模块直接 require sandbox 当前文件。旧源码副本未覆盖任何源码。结果与源码散列在 checks/boundary-results.json。

| 例子/单位 | 旧 strict | 新 strict | explain 新旧 |
|---|---|---|---|
| 50 个计入范围的 CJK 字符 | 无句长提示 | 无句长提示 | 无提示 |
| 51、54、55 个 CJK 字符 | warning | 无句长提示 | 无提示 |
| 56、70 个 CJK 字符 | warning | warning | 无提示 |
| 71 个 CJK 字符 | warning | warning | warning |
| 20 个英文词 | 无句长提示 | 无句长提示 | 无提示 |
| 21、25 个英文词 | warning | warning | 无提示 |
| 26 个英文词 | warning | warning | warning |

上表为 22 条实际新旧组合断言，不是静态检查。另亲跑并断言：55 CJK 加 21 英文词仍 warning（OR）；55 CJK 加数字/emoji/范围外汉字不增加 CJK 计数；禁用 long-sentence 不报告；两物理行各 30 CJK 不拼接；HTML 可见段落 55/56 边界与 Markdown 一致。CLI 文件 checks/boundary-55.md 与 boundary-56.md 已保存；新 CLI `--mode strict` 两例均退出 0，追加 `--strict` 后分别退出 0/2，JSON 在 cli-55/56-advisory/blocking.json。

语义审核没有靠 lint 作结论：逐条核对主体为 lint 的 long-sentence；模式条件为精确 strict；单位为限定 Unicode 范围的字符计数而非所有字符；否定边界保留“51–55 不再单独触发”；56 由严格大于条件产生；英文以独立 OR 条件触发；explain 70/25 保留；severity 仍为 warning；`--strict` 只影响门禁。API 导出 lint/validateTerms/parseArgs/main 完全一致，整个源码除单阈值外逐字一致，API 签名及参数未发生漂移。未删除条件、不确定性或改成“无违规/语义正确”等强结论。

同时执行 `node --test tests/language.test.js`：10 pass / 0 fail，exit 0；完整输出为 checks/language-tests.txt。没有改既有测试。

## 失败、修复与未知

首次生成未加 --force，转换器正确报告已有 HTML 并 SKIP；随后对同一目标加 --force 得到 1 converted / 0 skipped，并重跑最终 after 基线。没有把该 SKIP 当作已更新 HTML。

机械门禁与上述聚焦语义断言通过。没有在本子任务运行全部 tests、旧快照 CLI 的独立子进程、性能/并发测量或全部 Unicode/非法嵌套边界；旧 API 已实际加载执行，不能把新 CLI 的结果归到旧 CLI。文稿其他章节的历史验收声明没有作为本次执行证据。真实浏览器视觉/交互与独立复审由主 agent 另行执行，此处尚未确认，最终验收须合并其结果。lint 通过不证明整篇文稿事实或改写语义正确。
