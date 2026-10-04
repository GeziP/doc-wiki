# lint-doc-language 实际产物独立事实复审

复审日期：2026-10-04。最终对象：`doc/tech-docs/Lint_Doc_Language_Design.md/.html`，示例：`examples/validation/language/`。本 reviewer 仅写本报告，没有改生产源码、测试、文档或样例，没有 commit/push。浏览器复审由主 agent 负责。

## 结论

最终 Markdown 的关键 CLI 默认值、退出码、公开 API、问题身份、基线门禁及来源解析器契约与实际源码一致；未发现严重事实错误、错误 API 或可复现的错误使用命令。审核结论限于事实/接口/可运行性，不能代替浏览器及最终记录完备性验收。

## 已读证据

- `SKILL.md`、`references/writing-quality.md`、`references/tooling-notes.md`。
- 完整读取 `scripts/lint-doc-language.js`、`scripts/lib/prose.js`、`scripts/lib/quality-report.js`、`scripts/lib/source-reference.js`。
- 完整读取 `tests/language.test.js`、`tests/quality-report.test.js`、`tests/cli.test.js`、`tests/conversion.test.js`；另核对 `scripts/md-to-html.js:23,416` 确认转换器使用同一来源解析器。
- 最终 MD 中 50 个双花括号源码引用，均能相对文档解析到真实文件，起止行均在文件范围内。除存在性检查外，亲读代码核对规则、mask 顺序、偏移映射、基线分支和退出码结论。

## 实际执行

环境：Windows PowerShell，Node.js v20.20.2，仓库根 E:\gezi\doc-wiki。

| 命令/片段 | 实际结果 |
|---|---|
| `node --test tests`（最终迁移前、已含来源转换测试的工作树） | 23/23 通过，0 失败；language 8、quality-report 4、cli 10、conversion 1 |
| `--mode explain --json examples/validation/language/advisory.md` | 原生退出 0，marketing warning 1 |
| `--strict --json examples/validation/language/advisory.md` | 原生退出 2，同一个 marketing warning |
| `--mode strict --json examples/validation/language/procedure.md` | 原生退出 0，vague-reference 2、multi-action 1 |
| `--terms examples/validation/language/terms.json --json examples/validation/language/terms.md` | 原生退出 1，forbidden-term error 1 |
| `--json --help` / `--json` | 原生退出 0，usage JSON，没有普通报告 summary |
| `--mode=strict --json` | 原生退出 1，fatal 为 Unknown option |
| `--json --root examples examples/validation/language/advisory.md` | 原生退出 0，目标读取仍使用当前 cwd，符合 --root 仅影响报告路径 |
| 文档 CommonJS assert 示例 | 1 个 placeholder，line=1、column=4；行内代码不扫描 |
| `decodeEntities('a&#x1F600;b')` 和 CRLF location | text 为 a😀b，offsets=[0,1,1,10]；b 位于第二行第一列 |
| 初始隔离样例的已保存 baseline 比较 | summary.errors=1，added=[]，resolved=[]，unchanged=1，退出 0 |

四条最终示例命令通过 `spawnSync` 读取原生 status 验证，避免 PowerShell 工具外层把非零退出码统一呈现成 1。没有为了减少 warning 删除条件或不确定性。

## 问题与状态

### 已修复：测试计数过时（P2）

初始隔离 MD §8 写“共 22、cli 9”并保留旧运行结果；实际 CLI 已有 10 个顶层测试，合计 23。证据：`tests/cli.test.js:25,41,63,80,95,110,124,139,153,167` 及本次 23/23 实跑。主 agent 已将最终正文改为指向实际验收报告，移除旧计数和部分易漂移行号。建议最终验收报告采用最后一次真实运行结果，并注明时间/快照，勿把本次早先 23/23 当作之后所有改动的验证。

### 最终收尾项：验收记录与实际证据一致（P2，仅记录完整性）

复审时，MD:14 链接的 `docs/validation/2.0/README.md`、`source-snapshot.json` 以及 MD:12 列出的 `tests/skill-e2e.test.js` 尚未出现，主 agent 已说明正在创建。MD:323 称宽窄屏、暗色、目录、折叠、高亮均已做真实浏览器验证。建议交付前核对这些文件存在，且浏览器声明严格匹配最终证据；若有项目未运行，改为明确限制。该项不构成 lint 实现事实/API 错误，未完成前不能宣称全部交付验收通过。

### 基线迁移注意事项（已正确处理，无错误）

旧报告 targets/file/id 均含 `.tmp/skill-trial/examples/baseline.md`，直接复制到最终样例目录会触发配置不一致，或失去问题身份一致性。证据：`scripts/lib/quality-report.js:22-24,55-61`。最终文档已明确 before.json 需要先用最终目标保存，未把旧报告预置成可比较基线，契约正确。由于本 reviewer 仅获准写 review 文件，没有逐字执行会生成最终 before.json 的 PowerShell 保存片段；该片段的实际重放证据由主 agent 交付，本报告不冒称已运行。

## 关键契约亲验

- `--mode strict` 决定规则/阈值，`--strict` 决定 warning 门禁，二者独立；实现依据 `lint-doc-language.js:67-78,84-101`、`quality-report.js:78-83`。
- 正常、fatal、usage JSON 是三类不同形状；main 捕获目标 lint 异常为 input/read，CLI 入口设置 process.exitCode；依据 `lint-doc-language.js:103-138`。
- baseline 比较 schema/tool/targets/profile 后使用 id 多重集合；默认只拦新增 error、strict 拦新增 warning，任意当前 input/ 问题始终退出 1；依据 `quality-report.js:42-83`。
- 来源解析只验证语法，不查路径存在性或支持事实；合法引用免除 placeholder，不免除其他规则；依据 `source-reference.js:5-13`、`lint-doc-language.js:55-78`。
- 掩码和实体定位是启发式，不执行 CSS、不保证完整 Markdown/HTML 嵌套处理；正文明确说明边界，符合 `prose.js:26-100`。

未进行：浏览器目检、并发/线程压力、性能测量、覆盖率、所有 Unicode/非法嵌套测试。无机械分数替代事实审核。

## 最终记录完整性收尾复查（2026-10-04）

此前“验收记录与实际证据一致”的收尾项已满足。README、source-snapshot、tests.txt、五份 JSON 检查/比较记录、PowerShell 退出码记录、最终 MD/HTML、`tests/skill-e2e.test.js` 和两张浏览器截图均已存在。独立计算源码快照所列 25 个文件的 SHA-256，全部与 source-snapshot.json 一致。本轮只追加此复审文件，没有修改生产文件或产物。

本 reviewer 重新运行 `node --test tests`，实际 **26/26 通过、0 失败**。亲读新增 e2e 三项：从真实 MD 抽取并执行四条 CLI，逐项断言 0/2/0/1 及问题数量；在临时目录转换真实文稿并逐字比较交付 HTML，校验真实引用路径和行范围；对真实文稿保存基线，注入新增占位符后退出 1，恢复后退出 0。README 对这些测试覆盖范围的说明准确，没有扩展成所有生成模式、完整语义或覆盖率验收。

保存的 html.json 为 1 文件、0 error/0 warning；language.json 为 2 文件、0 error/0 warning；all-html.json 为 2 文件、0 error/1 个历史源码引用 warning；core-language.json 为 4 文件、0 error/0 warning。PowerShell 记录为 save=1、compare=0，比较 JSON 保留 1 error、added=0、unchanged=1，与 README 一致。最终 HTML 有 50 个实际 source-ref anchor，4 个本地 JS/CSS 引用均存在。

已打开并目检 `narrow.jpg`、`wide-dark.jpg`：分别呈现窄屏浅色、宽屏暗色实际产物，图表、引用和代码可见，窄屏长内容限制在内部滚动容器。本 reviewer 没有重新操作浏览器，目录/主题交互及 scrollWidth 数字采用主 agent 的实际操作记录；截图目检不冒称完成交互复测。README 明确 PowerShell 使用纯文本 fallback，只将 JavaScript/JSON 称为已生成高亮 span；同时明确没有模拟断网，不把本地资产存在性称为断网测试，边界陈述准确。

收尾结论：**此前记录完整性问题关闭；未发现新增阻断事实/API/范围夸大问题。** 更早的 23/23 和缺失文件说明保留为过程历史，以本节最终 26/26 及完整快照为准。
