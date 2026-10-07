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

阈值是项目启发式，不是中文受控语言标准。`--mode strict` 改变检查范围与句长提示；`--strict` 决定 warning 是否阻断，两者不同。
不检测或删减“可能/may/might/could”等置信度表达，不修改文件。通过不证明意义或事实正确。

转换器的 `{{路径:起始行-结束行}}` 和 `{{路径:行号}}` 是源码引用语法，不是待替换变量。行号从 1 开始，结束行不能小于起始行；语言 lint 与转换器共用语法解析器。通过语法检查不证明文件存在或引用支持结论。
语言引擎 profile 当前为 3。合法源码引用中的路径作为标识排除所有语言规则，附近正文照常检查；非法引用语法仍会报 placeholder。旧 JSON 基线必须用新版本工具在修订前后重跑，不跨引擎版本直接比较。

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

实际试跑后的 HTML 检查使用 profile engine=2：源码引用必须是实际标签，转义的代码示例不算引用。语言检查使用 engine=3，排除源码引用路径，并在原文字串上进行术语匹配以保持 Unicode 位置。两工具的旧基线均应在新工具下重跑修订前后。1.x 自文档因此显露一条缺少实际源码引用的历史 warning，不能沿用旧漏检结果称全过。

```bash
node --test
```

1.x 迁移无需重新生成所有文档。默认先按原命令检查，在改动目标上启用语言 lint 和术语映射；提示由人工确认后再考虑严格门禁。
自文档 `doc/Doc_Wiki_System_Architecture.*` 保留为 1.x 历史快照，源码位置和工具清单不代表 2.0；当前契约以 SKILL.md 和本文件为准。
