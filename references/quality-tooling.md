# 质量工具与 1.x 迁移

两个 CLI 使用 Node.js 20+，无需安装额外包。默认不改输入；HTML 的 `--fix` 是已有的显式格式修复选项，语言工具没有自动改写。

## 语言检查

```bash
node scripts/lint-doc-language.js --mode explain doc/Architecture.md
node scripts/lint-doc-language.js --mode strict --terms doc/terms.json doc/API.md
node scripts/lint-doc-language.js --json --strict doc/API.md
node scripts/lint-doc-language.js --disable long-sentence,marketing doc/Architecture.md
```

| 规则 ID | 级别 | 能力 |
|---|---|---|
| placeholder | error | 可见正文中未替换的 `{{NAME}}`；有效的源码引用标记除外 |
| forbidden-term | error | 项目配置中明确禁用的名称，不推测近义词 |
| long-sentence | warning | strict：英文 >20 词/中文 >50 字；explain：>25 词/>70 字 |
| marketing | warning | 短词表中的质量宣传用语，应补证据或具体描述 |
| vague-reference | warning | strict 中“必要时/适当处理”等，需检查条件或动作 |
| multi-action | warning | strict 中“然后/接着/then”等顺序连接词，需检查是否拆步骤 |
| punctuation-collision | warning | 句末/分句标点紧挨另一个标点（`。。` `。，` `。；` `。、` `：。`）：句子被切断或拼接的痕迹，常见于自动改写在句中插入总结句；`？！` 并用不报 |

阈值是项目启发式，不是中文受控语言标准。`--mode strict` 改变检查范围与句长提示；`--strict` 决定 warning 是否阻断，两者不同。
不检测或删减“可能/may/might/could”等置信度表达，不修改文件。通过不证明意义或事实正确。

转换器的 `{{路径:起始行-结束行}}` 和 `{{路径:行号}}` 是源码引用语法，不是待替换变量。行号从 1 开始，结束行不能小于起始行；语言 lint 与转换器共用语法解析器。通过语法检查不证明文件存在或引用支持结论。
语言引擎 profile 当前为 4（4 新增 `punctuation-collision`）。合法源码引用中的路径作为标识排除所有语言规则，附近正文照常检查；非法引用语法仍会报 placeholder。旧 JSON 基线必须用新版本工具在修订前后重跑，不跨引擎版本直接比较。

### 扫描范围与位置

支持 Markdown 和 `.html/.htm`（按扩展名选择）。扫描可见文字，跳过围栏/行内/缩进代码、HTML pre/code/script/style/SVG、Mermaid 容器、注释、URL、图片及 Markdown frontmatter。
保留链接可见标签及表格单元格；HTML 常用实体及数字实体解码后检查，报告位置指向原文件。
行号/列号为 1 起始，列按 JavaScript UTF-16 代码单元计；CRLF 保持正确行号。
扫描器不是完整 Markdown/HTML 解析器；逐物理行检查，跨行长句可能漏检，深层嵌套和非法标记需人工复核。SVG/Mermaid 内的图文一致性由语义审核负责。

### 项目术语配置

```json
{
  "version": 1,
  "terms": [{
    "canonical": "任务",
    "definition": "目标项目中的真实定义",
    "aliases": ["Task"],
    "forbidden": ["作业"],
    "identifiers": ["task_id"],
    "source": "src/task.ts:10-30"
  }]
}
```

仅 canonical 和 terms/version 必需，其余可选。名称唯一，同一名称不能映射到不同概念；别名数组元素必须是非空字符串；禁用词不能同时是合法名称、别名或代码标识。
英文匹配不区分大小写，按标识边界匹配；中文禁用词按子串匹配，仅配置确实禁止在任何正文上下文使用的词。
aliases/identifiers/definition/source 支持写作映射；工具不验证定义、来源真实性，也不要求术语必须出现。
[terms.example.json](../examples/terms.example.json) 是假设示例，应按目标项目改写，不能直接套用其语义。

## HTML 校验与 JSON

原有默认格式、`--fix`、`--new-doc`、`--test-interactive` 和按类型扫描保留。

```bash
node scripts/validate-doc.js --all
node scripts/validate-doc.js --new-doc --json doc/Design.html
```

`--json` 的 stdout 只有一个 JSON 对象，无 ANSI；fatal 配置/基线错误输出 `{schemaVersion,tool,fatal}` 且退出 1。
普通报告包含 schemaVersion、tool、targets（相对 --root，默认 CWD）、profile、issues、summary。
issue 包含 id、file、rule、severity、message；语言 issue 另有 line/column/context。HTML 的 files 保留每项 pass/warn/fail/fixed 结果。
id 不包含行号；语言身份使用原段文字/句子及规则，移动行不改变身份，修改内容可能变为新问题。
HTML 继承部分聚合检查；相关类别额外绑定结构片段指纹，避免相同计数掩盖不同结构。改变该类别内合法结构也可能触发新增，需要审核，不保证精确对应每个底层缺陷。

退出码：0 表示机械门禁通过；1 表示 error 或输入/配置/基线失败；2 表示 `--strict` 下有阻断 warning。默认 warning 不阻断。缺失文件和空的 --all 扫描现在失败，避免未检查却报告通过。

## 转换保真度检查

`validate-doc.js` 只检查 HTML 自身，发现不了“Markdown 里有、HTML 里没有”的内容。
`check-doc-fidelity.js` 把 `.md` 与同名 `.html` 往返比对，只读不改：

```bash
node scripts/check-doc-fidelity.js doc/tech-docs/Task_Design.md
node scripts/check-doc-fidelity.js --root . --all --json
```

比对四类可计数的事实：行内代码、围栏代码块、h2–h4 标题和表头。`{{路径:行}}` 按展开后的标签计；文档信息表由转换器消费，不计入。另有一项结构性检查：停在 `## 目录` 段里的内容（`toc-swallowed`）。

| 问题类型 | 含义 |
|---|---|
| code-missing | Markdown 的行内代码在 HTML 中找不到 |
| fence-missing | 围栏代码块缺失或被改写；详情指出第一处不同的行 |
| heading-altered | 标题文字被改写 |
| table-missing | 表格缺失，或表头被改写 |
| fence-unbalanced | Markdown 的围栏没有闭合，其后内容都会被当成代码 |
| fence-suspect | 围栏内出现带信息串、且足以关闭它的反引号行（如 `text`）：作者多半想关闭围栏，但带信息串的行不会关闭，其后章节被吞进代码 |
| toc-swallowed | `## 目录` 段（到第一条 `---`）里出现了目录条目以外的内容：转换器把该段整段换成生成的侧栏，这些内容随之无声丢失；往返比对也跳过该区间，所以只有这条能发现 |

退出码：0 保真；1 发现丢失；2 参数错误或缺少 HTML 孪生。`--all` 扫描 `<root>/doc/*.md` 与 `<root>/doc/tech-docs/*.md` 中已有孪生的文档。

围栏按 CommonMark 解析：开启行是缩进加至少 3 个反引号，信息串不含反引号；列表项里缩进的围栏同样有效。关闭行必须是不短于开启行的纯反引号，带信息串的行（如 `text`）不会关闭围栏。转换器遇到不配对的围栏会打印 WARN，并保留其后的代码，不会丢弃。

`fence-suspect` 是启发式：Markdown 与 HTML 在这种情况下完全一致，往返比对本身看不出问题。外层围栏是 `markdown`/`md` 时，内部的示例围栏是正常写法，不报。报出后按上下文判断，把那一行改成纯反引号。

`toc-swallowed` 的判定口径与转换器一致：目录条目是 `- [标题](#锚点)`（可嵌套，也可用有序列表），段内其他非空行、表格、围栏都算“会被丢弃的内容”，每篇文档只报一条（含条数与第一处）。报出后把内容挪进正式章节，例如 `## 术语表`。

检查器只比对可计数的内容，不判断语义。mermaid 的 `{…}`→`【…】`、`-.>`→`-.->` 是转换器的有意修复，不算改写。

## 链接与源码引用检查

`validate-doc.js` 只检查单个 HTML，不知道 `href` 指向的文件或锚点是否存在。`check-doc-links.js` 检查生成后 HTML 里的相对链接，只读不改：

```bash
node scripts/check-doc-links.js doc/tech-docs/Task_Design.html
node scripts/check-doc-links.js --root . --all --json
node scripts/check-doc-links.js --all --strict
node scripts/check-doc-links.js --all --require-tracked   # git 仓库里：目标必须已入库
```

| 问题类型 | 级别 | 含义 |
|---|---|---|
| missing-target | error | 链接指向的文件不存在 |
| missing-anchor | error | 目标 HTML 存在，但没有对应的 `id`/`name`；同页 `#锚点` 同理。`class="source-ref"` 的源码引用除外：目标即使是 `.html` 源文件，`#L10` 也是行号，只按行数校验 |
| md-link-with-twin | error | 链接指向 `.md`，而同名 `.html` 孪生已存在，读者会落在裸 Markdown 上 |
| line-out-of-range | warning | 源码引用 `#L10-L20` 超出目标文件的行数，引用已漂移；`--strict` 下阻断 |
| untracked-target | warning | 目标在磁盘上存在，但 git 不跟踪它：被 `.gitignore` / `.git/info/exclude` 排除或从没 `git add`，或路径大小写与 git 里的不一致（Windows/macOS 能点开，Linux 是死链）。作者机器上一切正常，别人克隆下来就是死链。`--require-tracked` 下为 error |

`untracked-target` 只读 git 索引（一次 `git ls-files -s -z`）：已 `git add` 未提交的算已跟踪；子模块内部的文件 git 不列出，一律放行；被标记的目标再用 `git check-ignore -v` 给出是哪条规则排除的。不在 git 工作区（或没有 git）时默认静默跳过；显式传了 `--require-tracked` 却不在 git 工作区，则退出码 2，不会静默通过。JSON 摘要里的 `summary.tracking` 回报实际模式（`required` / `checked` / `skipped`）：旧版工具会静默忽略不认识的 `--require-tracked`，门禁应据此确认这项检查确实执行了。

`<script>`、`<style>` 和注释里的文本不算链接；`http(s):`、`mailto:` 和以 `/` 开头的地址无法静态判定，不检查。报告里的行号是 HTML 文件的真实行号。

退出码：0 通过；1 有 error（`--strict` 下含 warning）；2 用法错误，包括没有可检查的目标、`--require-tracked` 但不在 git 工作区。`--all` 扫描 `<root>/doc/*.html` 与 `<root>/doc/tech-docs/*.html`。

转换器配合做了两件事：指向已有 HTML 孪生的 `x.md` 链接改写成 `x.html`（保留 `#锚点`）；每个 h2–h4 标题额外放一个 GitHub 规则的空锚点，重复标题按 `-1`、`-2` 顺延，所以 Markdown 里写的 `[x](#ui-参数--mc-字段映射表)` 在 GitHub 和 HTML 里都可达。

## 问题集合基线

先保存修订前报告（即使退出 1/2，JSON 仍是有效基线），再修订并运行同一工具、目标集合、检查配置：

```bash
node scripts/validate-doc.js --json doc/Design.html > before-html.json
node scripts/lint-doc-language.js --mode explain --json doc/Design.md > before-language.json
# 修改后
node scripts/validate-doc.js --json --baseline before-html.json doc/Design.html > after-html.json
node scripts/lint-doc-language.js --mode explain --json --baseline before-language.json doc/Design.md > after-language.json
```

严格门禁需要前后都添加 `--strict`。可用 `--root <项目根>` 保持相对路径一致。目标参数仍按当前工作目录解析，--root 仅控制报告路径和 --all 扫描。
PowerShell 5 保存 JSON 请使用 UTF-8（如管道 `Set-Content -Encoding UTF8`）；工具接受 UTF-8 BOM。PowerShell 7 与 Bash 可直接重定向。
不要依赖 `&&` 执行“留基线后修改”，旧问题可能使留基线命令非零退出。

比较是问题身份的多重集合：同身份新增副本仍算新增；修掉旧问题不能抵消新问题。JSON baseline 字段含 added/resolved/unchanged。
默认只阻断 added 中的 error；strict 同时阻断 added warning。input/read 永远阻断，即使基线有同类问题。
报告 summary 始终显示全部当前问题；基线通过不表示历史问题清零。人类输出有基线增减说明，退出码以基线门禁为准。
目标、工具、模式、术语内容、禁用规则、strict/new-doc/interaction/fix 等配置不一致时拒绝比较；不是默默重建基线。
工具版本变化需在同一新版本上重跑修订前后。基线不替代事实与语义审核。

## 测试与升级

实际试跑后的 HTML 检查使用 profile engine=2：源码引用必须是实际标签，转义的代码示例不算引用。语言检查使用 engine=4（3 排除源码引用路径并在原文字串上做术语匹配以保持 Unicode 位置；4 新增 `punctuation-collision`）。两工具的旧基线均应在新工具下重跑修订前后。1.x 自文档因此显露一条缺少实际源码引用的历史 warning，不能沿用旧漏检结果称全过。

```bash
node --test
```

1.x 迁移无需重新生成所有文档。默认先按原命令检查，在改动目标上启用语言 lint 和术语映射；提示由人工确认后再考虑严格门禁。
自文档 `doc/Doc_Wiki_System_Architecture.*` 保留为 1.x 历史快照，源码位置和工具清单不代表 2.0；当前契约以 SKILL.md 和本文件为准。
