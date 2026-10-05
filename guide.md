# JavaScript 文档工具链上手教程

## 文档信息

| 项目 | 内容 |
|---|---|
| 文档版本 | 1.0 |
| 编写日期 | 2026-10-05 |
| 目标读者 | 第一次调用文档 CLI 的开发者 |
| 源码位置 | scripts/md-to-html.js、scripts/lint-doc-language.js、scripts/validate-doc.js |
| 生成方式 | 当前源码核对与端到端实际运行 |

## 1. 从输入文档到检查结果

> **Scope**：教程覆盖当前 JavaScript 文档转换、语言与 HTML 检查、基线门禁和模块索引；没有安装服务或账户操作。最小示例仅写 examples/full-validation。第 6 节批量与索引命令会重建 doc 下的 HTML 和 index.html。

你将创建一份小型模块文档，检查正文、生成 HTML、校验产物，保存基线后注入占位符并修复。三个 CLI 不自动串联，每步的输出和退出码都需要读取。

图示沿真实输入输出顺序。

> 图 1.1 — Markdown 在语言检查后转换；HTML 由独立校验器检查，报告交给基线门禁。来源三个 CLI 的 main/目标循环。

```mermaid
flowchart LR
  M[Markdown 字符串] -->|正文| L[语言 CLI]
  M -->|文件| C[转换 CLI]
  C -->|HTML 与本地资产| H[HTML CLI]
  L -->|issue JSON| B[基线报告与退出码]
  H -->|结构 issue JSON| B
```

Sources：{{scripts/lint-doc-language.js:106-141}}、{{scripts/md-to-html.js:892-929}}、{{scripts/validate-doc.js:1154-1190}}。

## 2. 准备项目根与输入

本轮环境为 Windows PowerShell、Node.js v20.20.2。质量 CLI 要求 Node.js 20+ 的项目约定；无需 npm install。命令在包含 scripts 的项目根执行。示例脚本随本教程保存，使用 Node.js 写 UTF-8，避开旧 PowerShell 重定向编码差异。

```powershell
node --version
node examples/full-validation/create-example.js
```

预期创建 examples/full-validation/doc/tech-docs/Example_Design.md 和 terms.json。生成脚本只创建本示例目录并写演示文件；重复运行会恢复示例初始状态，不改生产源码。

文件包括 Scope、术语表、实际源码引用和带 language 的代码围栏。引用路径为从 HTML 所在目录回到 scripts/lib/quality-report.js 的相对路径。`#L` 在本地浏览器不保证行号跳转，应按显示的文件与行号阅读。

Sources：{{scripts/md-to-html.js:419-441}}、{{scripts/lib/source-reference.js:5-15}}。

## 3. 检查正文与术语

先对未转换的 Markdown 执行严格门禁。示例配置 canonical 是“问题”，允许 alias issue 和 identifier issue_id，禁止演示名称“缺陷项”。这只用于演示，不能代表整个仓库禁止该名称。

```json
{
  "version": 1,
  "terms": [{
    "canonical": "问题",
    "aliases": ["issue"],
    "identifiers": ["issue_id"],
    "forbidden": ["缺陷项"]
  }]
}
```

version 必须为 1，terms 是数组，canonical 是唯一非空无首尾空格的名称。数组字段可省略；禁用名不能同时是合法名。工具不验证定义来源真实性。下面的初始文档没有禁用名，预期 0 error/0 warning，退出 0。

```powershell
node scripts/lint-doc-language.js --mode strict --strict --terms examples/full-validation/terms.json --json examples/full-validation/doc/tech-docs/Example_Design.md
```

--mode strict 选择提示范围；--strict 让 warning 阻断。语言工具默认不改输入，合法源码简写的路径被排除规则，但附近正文照常检查。API 标识放在代码中，不用删除正确条件来规避提示。

Sources：{{scripts/lint-doc-language.js:11-31}}、{{scripts/lint-doc-language.js:48-84}}、{{scripts/lint-doc-language.js:85-104}}。

## 4. 转换并检查 HTML

使用 module 类型强制重建同名 HTML。转换器读取本地模板，输出示例目录内 Example_Design.html，并把缺失 vendor 放到 examples/full-validation/doc/assets/vendor。它保留 Markdown 输入。

```powershell
node scripts/md-to-html.js --type module --force examples/full-validation/doc/tech-docs/Example_Design.md
node scripts/validate-doc.js --new-doc --strict --json examples/full-validation/doc/tech-docs/Example_Design.html
```

预期转换计数为 1，校验退出 0，0 error/0 warning。已有 HTML 时不加 --force 会合法 skip；缺失、非 Markdown 文件或错误选项失败。显式大写 .MD 后缀也输出 .html；批量扫描仍按类型的命名模式过滤，不代表扫描所有 Markdown。

HTML CLI 检查结构和本地资产，不判断文档事实。--test-interactive 做静态交互接线检查，不代替打开浏览器。--fix 会写回 HTML 的可修格式问题，本教程不使用它；语义错误必须回 Markdown 修订后转换。

Sources：{{scripts/md-to-html.js:269-280}}、{{scripts/md-to-html.js:892-929}}、{{scripts/validate-doc.js:1069-1124}}。

## 5. 保存同配置基线

Node 示例驱动会用 fs.writeFileSync 保存 CLI stdout，然后在相同文件、mode、strict、terms 配置下比较。这样不依赖 shell 的编码和管道退出码传播。

```powershell
node examples/full-validation/run-e2e.js
```

运行驱动包括前面实际 CLI，再保存 before-language.json。它向同一 Markdown 追加正文占位符，比较后看到 added error=1 与退出 1；最后恢复原文件并比较，added=0、退出 0。完整参数、stdout、stderr 和返回码保存在 examples/full-validation/results。

基线的 summary 仍显示全部当前问题。旧错误保留时基线门禁可能退出 0；任何当前 input/read 始终阻断。改变工具 profile 引擎、术语内容、目标集合、strict 或 mode 后必须重建同版本前后报告，不能直接跨配置比较。

Sources：{{scripts/lib/quality-report.js:55-83}}、{{scripts/lint-doc-language.js:125-128}}、{{scripts/validate-doc.js:1181-1188}}。

## 6. 批量转换与导航索引

实际模块位于 doc/tech-docs，--all 转换当前匹配的 `_Design.md`。本轮保留并重建语言模块，加入 Prose 与 Quality_Report 两模块。索引仅收集匹配的已存在 HTML。

```powershell
node scripts/md-to-html.js --type module --all --force
node scripts/md-to-html.js --type module --index "质量工具链" "核心模块 API 与维护说明"
node scripts/md-to-html.js --type system --index "质量工具链" "当前架构与历史文档导航"
```

输出分别是 doc/tech-docs/index.html 与 doc/index.html。可用对应目录 doc-meta.json 为 module 分组或 system 设置 categories，非法 JSON 回退默认。--root 控制批量根与索引输出，显式文件按 CWD 解析。根 guide.md 可以通过 --type guide --all 发现，本轮也亲跑显式 --type guide；guide 不支持 --index。

Sources：{{scripts/md-to-html.js:60-147}}、{{scripts/md-to-html.js:178-230}}、{{scripts/md-to-html.js:798-826}}、{{scripts/md-to-html.js:864-881}}。

## 7. 完整示例：发现新增问题并修复

本例先得到可用页面，再证明基线能阻断新占位符。配置、输入和驱动完整保存在 examples/full-validation；示例不是生产 API 的事实声明。

| 阶段 | 实际输入 | 预期输出/返回码 |
|---|---|---|
| 创建 | create-example.js | 写 UTF-8 Markdown 与 terms.json |
| 检查 | strict mode + strict gate + terms | 0 error/0 warning；0 |
| 转换 | module + force | 1 converted；0 |
| HTML 门禁 | new-doc + strict | 0 error/0 warning；0 |
| 保存 | 相同语言参数 stdout | before-language.json；0 |
| 注入 | 追加实际正文双花括号变量 | 占位符 issue |
| 基线比较 | 同目标同配置 | added error=1；1 |
| 修复 | 恢复原 Markdown | added=0；0 |

可重复运行 run-e2e.js；它在结束前恢复示例 Markdown。驱动直接检查返回码和 JSON，不因中间预期退出 1 而中断后续修复。本例所有 CLI 步骤已亲跑；浏览器显示、主题和复制按钮由主 agent 另行检查，本生成阶段没有宣称交互验收通过。

Sources：{{scripts/lib/quality-report.js:55-83}}、{{scripts/lint-doc-language.js:106-141}}。真实运行记录见 examples/full-validation/results/commands.json。

## 8. 排障与术语表

| 症状 | 可验证原因 | 修复动作 |
|---|---|---|
| 只输出 usage 且退出 0 | 没传文件 | 显式传目标；语言 CLI 不读 stdin |
| strict mode 仍退出 0 | 没加 strict gate，或只有历史 warning | 核对 --strict 和 baseline.added |
| configuration fatal | targets/profile 不一致 | 使用同一工具与配置重跑前后基线 |
| HTML 缺少本地资源 | staging 失败或引用位置不对 | 检查实际 src/href 和文件；重建对应输出 |
| 引用变成普通文字 | 不受支持的行内 raw anchor | 使用源码引用简写，确认生成真实 anchor |
| 转换已有产物没变化 | 缺少 --force | 修改 Markdown 后用 --force 重建 |
| --all 没找到 Guide | 不符合 Guide.md 后缀或 --root 不正确 | 核对扫描根和命名；也可显式 --type guide guide.md |

排障原因来自当前实现推导，不是历史事故统计。正文跨行和异常语法可能漏检，不能只用 0 退出码关闭事实或语义问题。

| 术语 | 本教程定义 |
|---|---|
| 转换 | Markdown 到同名 HTML，可能写资产 |
| 检查 | 只产出问题报告，除 HTML --fix 外不改目标 |
| 基线 | 同工具和配置下的旧报告 |
| 门禁 | 对当前或新增问题计算退出码 |

Sources：{{scripts/md-to-html.js:419-441}}、{{scripts/md-to-html.js:869-929}}、{{scripts/lib/quality-report.js:78-83}}。

## 9. 继续阅读与未运行项

体系入口：[系统架构](doc/Quality_Tooling_System.html)、[模块索引](doc/tech-docs/index.html)、[系统索引](doc/index.html)。完整运行与源散列在 docs/validation/full-generation。

未执行性能、覆盖率、跨线程压力或全部非法输入组合。当前检查不能证明标准合规、文件引用含义或语义等价。独立复审与浏览器宽窄屏、暗色、目录、折叠、图表交互是全力流程的另两项工作，结果由负责 agent 记录。

Sources：{{references/fullpower-workflow.md:45-67}}、{{references/writing-quality.md:64-78}}。
