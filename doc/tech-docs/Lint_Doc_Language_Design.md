# lint-doc-language 技术设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档版本 | 1.0，源码快照文档 |
| 编写日期 | 2026-10-04 |
| 源码快照 | 基于 `39bffdb` 的实际试跑及引用修复；文件版本以验收记录的 SHA-256 为准 |
| 目标读者 | 调用 CLI 或维护模块的开发者 |
| 实现文件 | `scripts/lint-doc-language.js`、`scripts/lib/prose.js`、`scripts/lib/quality-report.js`、`scripts/lib/source-reference.js` |
| 测试文件 | `tests/language.test.js`、`tests/quality-report.test.js`、`tests/cli.test.js`、`tests/conversion.test.js`、`tests/skill-e2e.test.js` |
| 运行环境 | Windows PowerShell；Node.js `v20.20.2`；项目根 `E:\gezi\doc-wiki` |
| 验证记录 | [实际验收报告](../../docs/validation/2.0/README.md)、[源码散列](../../docs/validation/2.0/source-snapshot.json) |

文档按模块模板选择接口、流程、实现、使用与测试章节。模块没有持久生命周期状态，故不提供状态机。下文事实来自该快照；作者历史动机和性能数据未确认。

源码链接相对本文件回到仓库；`#L数字` 只标示阅读起点，本地浏览器不保证行号跳转。HTML 连同本地 vendor 资产交付；源码引用仍需原仓库。机械通过不能证明事实或改写语义正确。

## 1. 概述与模块关系

> **Scope**：覆盖 lint-doc-language 的 CLI、全部导出 API、实际依赖和当前测试。输入扫描是启发式；不提供事实校验、自动改写或标准合规认证。

本模块对 Markdown 和 HTML 的可见正文做启发式语言检查，返回显式术语违规、未替换占位符和写作提示。它不改写输入、不校验源码事实，也不宣称符合 ASD-STE100。CLI 读取文件并输出人类文本或 JSON；维护者可直接导入 CommonJS API。

<figure class="diagram">
<svg viewBox="0 0 640 280" role="img" aria-label="lint、正文扫描、源码引用及质量报告之间的调用关系" preserveAspectRatio="xMidYMid meet">
<defs><marker id="dep-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="var(--text,#1a2332)"/></marker></defs>
<rect x="20" y="25" width="150" height="45" rx="6" fill="var(--bg,#fafbfc)" stroke="var(--border,#d8dee4)"/>
<text x="95" y="53" text-anchor="middle" fill="var(--text,#1a2332)" font-size="15">main / CLI</text>
<rect x="230" y="25" width="150" height="45" rx="6" fill="var(--bg,#fafbfc)" stroke="var(--border,#d8dee4)"/>
<text x="305" y="53" text-anchor="middle" fill="var(--text,#1a2332)" font-size="15">lint</text>
<rect x="440" y="25" width="180" height="45" rx="6" fill="var(--bg,#fafbfc)" stroke="var(--border,#d8dee4)"/>
<text x="530" y="53" text-anchor="middle" fill="var(--text,#1a2332)" font-size="15">proseSegments</text>
<rect x="230" y="155" width="190" height="45" rx="6" fill="var(--bg,#fafbfc)" stroke="var(--border,#d8dee4)"/>
<text x="325" y="183" text-anchor="middle" fill="var(--text,#1a2332)" font-size="15">parseSourceReference</text>
<rect x="20" y="155" width="170" height="45" rx="6" fill="var(--bg,#fafbfc)" stroke="var(--border,#d8dee4)"/>
<text x="105" y="183" text-anchor="middle" fill="var(--text,#1a2332)" font-size="15">quality-report</text>
<line x1="170" y1="47" x2="230" y2="47" stroke="var(--text,#1a2332)" marker-end="url(#dep-arrow)"/>
<line x1="380" y1="47" x2="440" y2="47" stroke="var(--text,#1a2332)" marker-end="url(#dep-arrow)"/>
<line x1="305" y1="70" x2="305" y2="155" stroke="var(--text,#1a2332)" marker-end="url(#dep-arrow)"/>
<line x1="95" y1="70" x2="95" y2="155" stroke="var(--text,#1a2332)" marker-end="url(#dep-arrow)"/>
<path d="M230 62 L205 62 L205 135 L155 135 L155 155" fill="none" stroke="var(--text,#1a2332)" marker-end="url(#dep-arrow)"/>
<text x="320" y="245" text-anchor="middle" fill="var(--text-secondary,#475569)" font-size="14">箭头表示调用；main 使用报告门禁，lint 使用问题构造</text>
</svg>
<figcaption>图 1.1 — CLI 与三个本地依赖的调用关系。来源：scripts/lint-doc-language.js:5-7,47-82,103-138。</figcaption>
</figure>

`prose.js` 将不检查的语法替换成空格，保留原始 UTF-16 偏移。`quality-report.js` 生成稳定问题身份，比较基线并计算门禁。`source-reference.js` 被 lint 与转换器共用，识别源码引用语法，供 placeholder 规则排除合法引用。外部依赖只有 Node.js 内建模块：`fs`、`path`、`crypto`；检查器没有第三方解析库。

Sources：{{../../scripts/lint-doc-language.js:5}}、{{../../scripts/lib/prose.js:3}}、{{../../scripts/lib/quality-report.js:3}}。

## 2. CLI 调用与失败处理

在项目根执行，推荐 Node.js 20+。文件位置按当前工作目录解析；`--root` 只决定报告中的相对文件路径，并不改变文件参数、术语文件和基线文件的解析位置。

```powershell
# ========== 基本调用 ==========
node scripts/lint-doc-language.js --mode explain --json examples/validation/language/advisory.md
# 有 1 个 marketing warning，退出 0。

# ========== warning 阻断 ==========
node scripts/lint-doc-language.js --strict --json examples/validation/language/advisory.md
# 相同检查结果，退出 2。

# ========== strict 写作模式 ==========
node scripts/lint-doc-language.js --mode strict --json examples/validation/language/procedure.md
# vague-reference 2 个、multi-action 1 个；未启用 --strict，退出 0。

# ========== 明确术语映射 ==========
node scripts/lint-doc-language.js --terms examples/validation/language/terms.json --json examples/validation/language/terms.md
# 正文中的禁用别名产生 forbidden-term error，退出 1。
```

上述文件随交付保存；`advisory.md` 为宣传词样例，`procedure.md` 为模糊条件和顺序连接词样例。所有四条命令已运行。

| 参数 | 默认值 | 契约 |
|------|------|------|
| 文件参数，可多个 | 空 | 绝对化后去重；按 `.html` 或 `.htm` 扩展名选择 HTML，其余按 Markdown |
| `--mode strict` 或 `--mode explain` | `explain` | 控制句长阈值及 strict 专属规则 |
| `--strict` | false | warning 是否阻断；不改变规则内容 |
| `--terms 文件` | 空术语配置 | 读取 JSON 并先做配置校验，支持 UTF-8 BOM |
| `--disable rule,...` | 空数组 | 必须全部为已知规则；重复项可出现；逗号后空格不会自动去除 |
| `--json` | false | 普通报告为一个 JSON 对象，无 ANSI；fatal 也为 JSON |
| `--baseline 文件` | 无 | 同工具、目标集合、profile 才可比较 |
| `--root 目录` | 当前工作目录 | 绝对化；允许报告路径包含 `../` |
| `--help` | false | 输出 usage 并返回 0；仍先校验参数 |
| `--` | 无 | 剩余参数全部当文件，支持以 `--` 开始的文件名 |

只识别分离参数，如 `--mode strict`；不支持 `--mode=strict`。没有文件时输出 usage 并返回 0，而不是检查 stdin。没有 `--all`、`--fix` 或递归目录扫描。未知长选项和缺少值返回 1；以单个短横线开头的参数当文件处理。重复值选项以最后值为准。

| 情况 | 退出码与报告 |
|------|------|
| 无 error，默认 warning | 0，warning 保留 |
| 启用 `--strict` 且有阻断 warning | 2 |
| 阻断 error，或任意 `input/` 问题 | 1 |
| 参数、术语配置、基线读取/校验失败 | 1，`{schemaVersion:1, tool:'doc-language', fatal:消息}` |
| 单个目标读失败 | `input/read` error；继续汇总其他目标 |

目标文件读取和该文件内 `lint` 异常共用同一个 catch，因此都会包装成 `input/read`。正常 JSON 与 fatal JSON 的结构不同。人类格式给没有位置的输入错误显示 `1:1`，不意味着找到了正文第一行的问题。

Sources：{{../../scripts/lint-doc-language.js:84}}、{{../../scripts/lint-doc-language.js:103}}、{{../../scripts/lib/quality-report.js:78}}、[quality-tooling.md](../../references/quality-tooling.md)。

## 3. 检查范围与规则

### 3.1 正文抽取

Markdown 跳过起始 frontmatter、反引号/波浪号围栏、行内代码、4 空格或 tab 缩进代码、链接定义和图片；保留链接标签。frontmatter 首行必须 trim 后等于三个短横线，直到三个短横线或三个点的结束行。未闭合 frontmatter、围栏或 HTML 排除块可能遮蔽后续内容。

HTML 跳过注释以及 `pre/code/script/style/svg/textarea` 的整块内容；跳过 class 含 mermaid 的 `div/pre` 容器，并按同名标签深度寻找结束位置；其他标签只掩去标签自身。两种格式都会再经过 HTML 掩码和 URL 掩码。

掩码后逐物理行处理，按每个竖线拆分单元格。空白和只含冒号/短横线的单元格被跳过。不是完整语法树，因此正文里的竖线也会拆段；异常嵌套、脚本内伪标签和跨行句子需要人工复核。

实体解码支持 `amp/lt/gt/quot/apos/nbsp` 和数字实体。范围为 1 到 `0x10ffff` 的数字转为代码点；范围外实体保留。映射数组使解码结果定位回实体开始位置。行号、列号从 1 开始，列按 JavaScript UTF-16 代码单元计；CRLF 不增加额外行号。

扫描器通过标签排除和正则掩码近似可见正文，没有执行 CSS。例如 CSS 隐藏段落仍可能被扫描。SVG/Mermaid 的标签被跳过，不代表图文语义经过验证。

Sources：{{../../scripts/lib/prose.js:7}}、{{../../scripts/lib/prose.js:26}}、{{../../scripts/lib/prose.js:46}}、{{../../scripts/lib/prose.js:75}}、{{../../scripts/lib/prose.js:96}}。

### 3.2 六条规则

| ID | 级别 | 实际匹配范围 |
|------|------|------|
| `placeholder` | error | 双花括号之间至少一个字符，不含花括号或换行；合法源码引用语法除外；每次匹配一项 |
| `forbidden-term` | error | 只检查 `terms[].forbidden`，每个别名每次匹配一项 |
| `long-sentence` | warning | strict：中文计数 >50 或英文词数 >20；explain：>70 或 >25 |
| `marketing` | warning | 英文 `seamless/seamlessly`、`effortless/effortlessly`、`blazing-fast`、`world-class`、`cutting-edge`；中文 `无缝`、`极致`、`业界领先`、`完美无缺` |
| `vague-reference` | warning | 只在 strict：必要时、适当处理、相关操作、视情况而定、as needed/as appropriate |
| `multi-action` | warning | 只在 strict：然后、接着、随后、and then/then；每个段最多一项 |

长句按中文句号/问叹号及英文 `. ! ?` 分隔，不跨行拼接。中文计数仅含 `U+3400..U+9FFF`；英文词使用字母及内部撇号/连字符，不是分词器。两种计数任一超阈值就提示；中文字符数不是全部字符长度。

禁用词匹配统一转小写。词首或词尾为 ASCII `\w` 时，对应边界旁不能也是 `\w`。例如 `erase` 匹配 `Erase`，不匹配 `eraser` 或 `erase_id`；中文别名按子串匹配。每次搜索从本次匹配末尾继续，不匹配重叠副本。

规则不提示“可能”、may、might、could。提示应保留条件、否定和不确定性。英文宣传词的词边界与禁用词标识边界并非同一个实现，维护时不能假定二者完全一致。

Sources：{{../../scripts/lint-doc-language.js:10}}、{{../../scripts/lint-doc-language.js:34}}、{{../../scripts/lint-doc-language.js:47}}。

## 4. 术语、问题与报告的数据契约

### 4.1 术语配置与术语表

```json
{
  "version": 1,
  "terms": [{
    "canonical": "任务",
    "aliases": ["Task"],
    "identifiers": ["task_id"],
    "forbidden": ["作业"],
    "definition": "仅为演示的任务名称",
    "source": "演示配置，不是项目定义"
  }]
}
```

这份演示配置不定义仓库真实领域概念。本文术语映射：问题为 `issue`，报告为 `report`，基线为 `baseline`，正文片段为 `segment`；合法英文名称在代码引用中保留。没有额外禁止别名的证据，故文档自身不编造禁用词清单。

`version` 必须为数字 1，`terms` 必须是数组。每项 `canonical` 为非空字符串且没有首尾空白，忽略大小写后不能重名。`aliases/forbidden/identifiers` 若提供，必须是数组，各元素是没有首尾空白的非空字符串；空数组合法。

同一合法名称不能映射到不同 canonical 概念。重复禁用名称会失败；禁用词与任意 canonical、alias 或 identifier 冲突也失败。同一概念内的 alias 重复不单独拒绝。`definition/source` 和其他附加字段不校验；工具不验证定义或来源真实性，也不要求合法术语出现。

Sources：{{../../scripts/lint-doc-language.js:11}}、{{../../scripts/lint-doc-language.js:55}}。

### 4.2 问题与普通报告

| 对象 | 字段 | 含义 |
|------|------|------|
| issue | `id` | 64 位十六进制 SHA-256 身份 |
| issue | `file/rule/severity/message` | 相对文件、规则、error 或 warning、消息 |
| issue | `line/column/context` | 可选；lint 正文问题带位置与压缩空白后的上下文 |
| report | `schemaVersion/tool` | 1 / `doc-language` |
| report | `targets` | 去重并排序的相对文件集合 |
| report | `profile` | `engine:2`、mode、术语 digest、去重排序的 disabled、strict 布尔值 |
| report | `issues` | 按目标处理顺序及规则追加顺序保存，未额外排序 |
| report | `summary` | 文件数、当前全部 error 数、当前全部 warning 数 |
| report | `baseline` | 仅比较后存在；`added/resolved` 为问题数组，`unchanged` 为数量 |

身份散列输入是 `{file,rule,severity,key}`。`key` 优先取显式 key，缺少时依次取 context、message；不是输出字段。行列和 message 不直接进入身份；message 仅在前两项都缺少时参与。多数 lint key 包含该正文片段及触发内容，移动行不变，但修改同段其他文字可能产生新身份。`multi-action` 使用 context；长句 key 使用规范化句子。

`digest` 递归排序对象键，保留数组顺序。术语数组重排会改变 profile 散列；目标 CLI 输入重排不会改变排序后的 targets。报告 summary 表示当前全部问题，与最终基线门禁是否通过是两件事。

Sources：{{../../scripts/lib/quality-report.js:8}}、{{../../scripts/lib/quality-report.js:22}}、{{../../scripts/lint-doc-language.js:51}}、{{../../scripts/lint-doc-language.js:122}}。

## 5. CommonJS API 参考

### 5.1 主模块的全部导出

| 签名 | 参数与返回值 | 副作用、失败条件 |
|------|------|------|
| `lint(source, options = {})` | source 字符串；返回 issue 数组 | 不读写文件；要求调用者提供有效结构；不调用 parseArgs 或 validateTerms |
| `validateTerms(config)` | 配置对象；原对象返回 | 不修改配置；无效结构、重名、冲突抛 Error |
| `parseArgs(args)` | 字符串数组；返回 opts | 默认 root 来自 process.cwd；绝对化 root；参数错误抛 Error |
| `main(args)` | 字符串数组；返回 0/1/2 | 同步读取目标、配置和基线；向 console 输出；捕获错误并返回 1 |

`lint` 选项及默认值：`file='<stdin>'`、`format='markdown'`、`mode='explain'`、`terms={version:1,terms:[]}`、`disabled=[]`。format 只有精确 `'html'` 使用 HTML 入口；其他值走 Markdown。mode 只有精确 `'strict'` 启用 strict 行为。直接调用不会拒绝非法模式或未知 disabled，因此集成代码应自行校验或通过 CLI。

`parseArgs` 返回 `{mode,root,disabled,files}` 加已出现的 `json/strict/help/terms/baseline`。没有出现的布尔标志不是显式 false。它只解析配置路径，不读取文件。`main` 的 `args.includes('--json')` 还决定异常输出形式；CLI 入口才把返回值赋给 `process.exitCode`。直接调用 main 不替调用者退出进程。

```javascript
// ========== 程序调用 ==========
// 在项目根运行，先校验术语，避免绕过 CLI 的输入契约。
const assert = require('node:assert/strict');
const { lint, validateTerms } = require('./scripts/lint-doc-language');
const terms = validateTerms({ version: 1, terms: [] });
const findings = lint('实际 {{NAME}}\n`{{CODE}}`', { file: 'sample.md', terms });
assert.equal(findings.length, 1);
assert.equal(findings[0].rule, 'placeholder');
assert.equal(findings[0].line, 1);
assert.equal(findings[0].column, 4);
```

该片段已运行；行内代码占位符被排除。同步函数没有共享可变检查器状态；线程安全及并发调用压力测试未进行，不能据此给出跨线程保障。

Sources：{{../../scripts/lint-doc-language.js:47}}、{{../../scripts/lint-doc-language.js:84}}、{{../../scripts/lint-doc-language.js:103}}、{{../../scripts/lint-doc-language.js:137}}。

### 5.2 prose.js 的全部导出

| 签名 | 返回值 | 边界与失败 |
|------|------|------|
| `proseSegments(source, format)` | `{text,offsets,offset}[]` | source 字符串；format 精确 html 才跳过 Markdown 掩码；按物理行与竖线分段 |
| `decodeEntities(text)` | `{text,offsets}` | offsets[i] 是解码后的第 i 个 UTF-16 单元对应输入偏移；实体映射到实体开始 |
| `location(source, offset)` | `{line,column}` | offset 是原始 UTF-16 偏移；未做范围校验 |

这些函数不做文件 I/O；错误输入类型可能抛运行时异常。`blank/mask/maskHtml/maskMarkdown` 是内部辅助函数，不导出。`offsets` 相对片段，`offset` 相对整个文件；两者相加后交给 location。

Sources：{{../../scripts/lib/prose.js:7}}、{{../../scripts/lib/prose.js:75}}、{{../../scripts/lib/prose.js:96}}、{{../../scripts/lib/prose.js:101}}。

### 5.3 quality-report.js 的全部导出

| 签名 | 返回值 | 副作用与约束 |
|------|------|------|
| `digest(value)` | SHA-256 十六进制字符串 | value 应可 JSON 序列化；循环引用等会失败 |
| `relativeFile(file, root)` | 使用 `/` 的相对路径字符串 | file 先 path.resolve；不检查存在性 |
| `issue({file,rule,severity,message,line,column,context,key})` | issue 对象 | 不校验参数；只附上已提供的可选字段 |
| `makeReport(tool,targets,profile,issues,extra={})` | report 对象 | 不校验输入；extra 最后展开，可覆盖普通字段 |
| `compareBaseline(current,previous)` | `{added,resolved,unchanged}` | 校验两份 schema、问题及配置；不读取文件；不修改输入 |
| `gate(report,{baseline,strict=false}={})` | 0/1/2 | baseline 是路径；有基线时同步读 JSON 并写 report.baseline；读取/比较失败抛 Error |
| `readJson(file)` | JSON 解析值 | 同步读 UTF-8、去掉开头一个 BOM；文件或 JSON 错误抛出 |

`stable/validateReport/SCHEMA_VERSION` 不导出。基线校验只验证实现中列出的字段，不重新计算 issue.id，也不校验 summary、位置、context 或 profile 内部字段。因此“基线被接受”并不证明它的事实或来源可靠。

Sources：{{../../scripts/lib/quality-report.js:8}}、{{../../scripts/lib/quality-report.js:18}}、{{../../scripts/lib/quality-report.js:29}}、{{../../scripts/lib/quality-report.js:42}}、{{../../scripts/lib/quality-report.js:55}}、{{../../scripts/lib/quality-report.js:78}}。

### 5.4 source-reference.js 的全部导出

`parseSourceReference(value)` 接受不含外层双花括号的字符串。合法语法为文件名、冒号、从 1 开始的起始行以及可选的结束行；结束行不能小于起始行。返回 `{file,start,end,label,href}`；start/end 是匹配得到的字符串，单行引用的 end 为 undefined。非法语法返回 null；非字符串输入不在契约内，可能抛 TypeError。

例如 `scripts/lib/prose.js:75-95` 返回 label 同原字符串、href 为 `scripts/lib/prose.js#L75-L95`。文件部分不允许花括号或换行，但没有路径存在性、权限、扩展名或源码内容校验。解析成功只说明语法合法，不能证明引用支持结论。lint 仅排除该引用的 placeholder 提示，其他规则仍扫描片段。

本工作树将语言 profile engine 从 1 升为 2。旧 engine=1 的基线不能直接比较；应在同一新工具下重跑修订前后。新增测试在 `tests/language.test.js:25-30` 验证合法单行/范围引用、倒序范围、零行和未完成变量。

Sources：{{../../scripts/lib/source-reference.js:5}}、{{../../scripts/lint-doc-language.js:55}}、{{../../scripts/lint-doc-language.js:123}}、{{../../tests/language.test.js:25}}。

## 6. 实现流程与基线操作

正常 CLI 流程为：解析参数 → 校验术语 → 绝对化并去重目标 → 读取并扫描 → 构造报告 → 基线与门禁 → 输出报告。参数/术语/基线失败转 fatal；目标失败记 input/read。没有持久状态或后台任务。

定位使用下面的实际核心表达式。先用偏移映射把实体解码后的匹配位置还原为片段输入位置，再加片段起点：

```javascript
// 来源：scripts/lint-doc-language.js:51-53
...location(source, segment.offset + (segment.offsets[index] ?? index))
```

基线要求 `schemaVersion=1`、tool 为字符串、targets 为字符串数组、profile 存在、issues 为数组。每个 issue 必须有合法 64 位小写散列、file 属于 targets、字符串 rule/message、合法 severity。比较 tool、targets 和 profile 的 digest 都要相同，否则拒绝。

身份以多重集合比较。同身份出现次数增加产生 added；删除副本产生 resolved。门禁默认只阻断 added 的 error；strict 还阻断 added 的 warning。任何当前 `input/` 问题始终返回 1，即使基线记录了同类问题。

```powershell
# ========== 同目标、同配置保存与比较 ==========
node scripts/lint-doc-language.js --json examples/validation/language/baseline.md |
  Set-Content -Encoding UTF8 examples/validation/language/before.json
# 保存时存在 1 个 placeholder error，退出 1；不要用 && 才允许后续比较。

node scripts/lint-doc-language.js --json --baseline examples/validation/language/before.json examples/validation/language/baseline.md
# 未修改内容：error 数仍为 1，但 added=0、unchanged=1，退出 0。
```

该语义已实际执行，PowerShell 管道保存片段也已逐字重放。移动行、替换内容、追加同身份副本和切换模式分别得到 0、1、1、fatal/1。请先执行保存命令生成 `before.json`，该文件不是预置基线。

Sources：{{../../scripts/lint-doc-language.js:103}}、{{../../scripts/lib/quality-report.js:42}}、{{../../scripts/lib/quality-report.js:55}}、{{../../scripts/lib/quality-report.js:78}}。

## 7. 排障与维护边界

| 症状 | 验证方法 | 处理动作 |
|------|------|------|
| `--mode strict` 仍返回 0 | 检查报告是否只有 warning | 需要 warning 阻断时加 `--strict` |
| 没有文件却返回 0 | 查看 stdout 是否 usage | 显式传文件；不要把它当 stdin 工具 |
| 基线 configuration fatal | 对照 tool、targets、profile | 以前后同工具及配置重跑基线；不要仅更改报告配置字段 |
| 基线返回 0 但 summary 有 error | 检查 added 与 unchanged | 这是保留历史问题；按需要修正旧问题 |
| 术语没匹配 | 查看 identifier 边界、代码掩码、配置 forbidden | 对照正文和配置；aliases 不会主动触发违规 |
| 问题行列与渲染字符不一致 | 对照 UTF-16、实体映射和原文件 | 按原文件位置阅读；不要按视觉字符宽度解释列号 |
| 一段正文没被扫描 | 检查未闭合围栏/frontmatter/HTML 排除块 | 修正语法；对跨行长句人工复核 |
| `.HTML` 与未知扩展名行为不同 | 查看 target 后缀 | HTML/HTM 大小写均支持，其他后缀按 Markdown |

这些是由实现推导的排查场景，不是已确认历史事故。维护规则要同步更新 RULES、CLI 校验、profile engine 策略和测试；改变问题 key 或规则算法时重新生成同版本下的前后基线。engine 当前固定 2，没有自动依据代码版本失效基线的机制。

Sources：{{../../scripts/lint-doc-language.js:10}}、{{../../scripts/lint-doc-language.js:84}}、{{../../scripts/lint-doc-language.js:118}}、{{../../scripts/lint-doc-language.js:122}}、{{../../scripts/lib/quality-report.js:78}}。

## 8. 当前测试与验证记录

查看[实际验收报告](../../docs/validation/2.0/README.md)、[源码散列](../../docs/validation/2.0/source-snapshot.json)及[独立复审](../../docs/validation/2.0/review.md)。这些记录对应本次实际运行，不能替代未来改动后的复验。

测试覆盖及最终运行结果见实际验收报告。测试数量不是覆盖率测量，HTML 专属检查不算作语言规则覆盖。

| 测试来源 | 已覆盖行为 |
|------|------|
| `tests/language.test.js:6-16` | 中英文提示、strict 模式规则、保留 hedges/条件 |
| `tests/language.test.js:18-46` | 正文/表格占位符、代码与 frontmatter 排除、CRLF 位置 |
| `tests/language.test.js:25-30` | 源码引用合法语法、倒序范围、零行和变量错误 |
| `tests/language.test.js:48-69` | 链接标签、HTML 实体、SVG/Mermaid 排除、未闭合 pre |
| `tests/language.test.js:71-94` | 术语边界与配置错误、模式句长和禁用规则 |
| `tests/quality-report.test.js:9-39` | 文件路径身份、移动行、替换新问题、重复副本、配置/schema 拒绝 |
| `tests/cli.test.js` | 退出码、错误参数、基线新增/修复/移动/重复/模式变化 |
| `tests/cli.test.js` | 缺失文件、未知参数；空扫描是 HTML CLI 场景 |
| `tests/cli.test.js` | 术语 BOM、输入不修改、非法 JSON、strict warning 基线、规则配置变化 |
| `tests/cli.test.js` | HTML validator 旧输出、JSON、fix、结构基线、转义例外 |
| `tests/conversion.test.js:10-41` | 语言 lint → Markdown 转换 → HTML 校验，引用单行/范围、代码字面量和本地 vendor |

实际运行 `node --test tests`，最终通过情况以验收报告为准。完整输出保存在验收目录的 `tests.txt`。

已运行代表性 CLI：默认 warning、strict warning 门禁、strict 模式、禁用规则、术语错误、占位符错误、缺失目标、unknown option、help/无文件、基线保存/移动/替换/重复/配置不一致。程序调用示例已运行，并核验实体、CRLF 位置映射。

主 agent 已补做宽窄屏、暗色、目录、折叠和代码高亮的真实浏览器验证，详情及截图见验收报告。未做跨线程压力测试、性能测量、代码覆盖率统计及全部非法嵌套或 Unicode 边界测试。

HTML 生成、语言检查和独立事实复审的最终结果见实际验收报告。测试内容由下列引用支持，运行结果以执行记录为据。

Sources：{{../../tests/language.test.js:6}}、{{../../tests/quality-report.test.js:9}}、{{../../tests/cli.test.js:25}}。
