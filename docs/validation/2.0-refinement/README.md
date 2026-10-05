# 2.0 细节复查

本记录对应 `d6f3a63` 后的细节修订；[上一轮实际生成验收](../2.0/README.md)及其源码散列保留为历史记录，不能当作当前源码的报告。

## 借鉴的取舍

参考 [asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill) 的 strict/解释模式、消歧、术语稳定、保留语义以及确定性语言检查的边界。项目适配了中文写作和源码技术文档：保留领域标识、条件、例外及要求强度；句长只作提示；没有引入官方词典或标准合规认证。

[规则落地边界](../../../references/writing-quality.md#验收边界)区分机器与人工责任：术语一致需要项目映射，机器只检查明确禁用词；流程可执行性与原文改写的语义保留需要对照复审。整篇 explain lint 通过不能证明其中步骤满足 strict。

不增加无实证的英文语态/时态规则，不将其套在中文或代码标识上。HTML 问题基线、源码证据及浏览器验收属于本仓库工具链的扩展。

## 实际问题与修复

| 复现输入/问题 | 修订前 | 修订后 |
|---|---|---|
| 正文 `İ task`，明确禁用 `task` | 整段转小写后字符索引变化，边界检查漏掉禁用词 | 在原始字符串上匹配，报告第 1 行第 3 列 |
| 合法引用 `{{scripts/seamless.js:1}}` | 文件名被当宣传词提示 | 合法引用整体掩码，附近正文仍检查；非法范围仍报占位符 |
| 术语含点等正则字符 | 原实现按字面量查找 | 新实现转义正则元字符，保持字面量匹配及标识边界，不将 `old.name` 当 `oldXname` |
| MD ASCII 与 HTML SVG 分别维护 | 模块流程仍要求分别编写，可能产生图文漂移 | 明确 MD 为来源，HTML 从转换器生成；图表可使用 Mermaid、内联 SVG 或可选 ASCII |
| Markdown 中提供文档版本 1.1 | 元数据解析误跳过中文“文档版本”行，页面仍显示默认 V1.0 | 解析真实版本行，转换集成案例验证 V2.7 正确显示 |

独立复审还澄清了转义责任：Markdown 围栏保留原始源码，只有 raw HTML 代码块需要作者转义。转换集成案例实际验证 `std::shared_ptr<T>` 和 `&&` 只转义一次。

语言 profile engine 升至 3，避免旧基线掩盖新行为。HTML engine 仍为 2。没有改变接口、退出码、规则级别或句长阈值。

## 实际验收

- [tests.txt](tests.txt)：28/28 通过，包含本仓库真实文档的 CLI、转换复现、源码引用文件/行范围及基线注入错误后的阻断与恢复。
- [language.json](language.json)：当前 Markdown/HTML explain 严格检查均 0 error / 0 warning。
- [html.json](html.json)：新 HTML 严格门禁，22 类检查全部通过。
- [源码快照](source-snapshot.json)：记录本轮输入文件 SHA-256、命令与退出码；字节散列以该 Windows 工作树为准，Git 行尾归一化可能改变字节而不改变文本内容。
- [独立复审](review.md)：对照当前实现确认事实及引用，复审结果以该文件为准。
- 当前 HTML 重新生成并在真实浏览器重验；[宽屏截图](wide-dark.jpg)、[窄屏截图](narrow.jpg)。实际版本显示 1.1，50 个 source-ref 链接；1440px 视口 scrollWidth=1425px、390px 视口 scrollWidth=375px，根页面没有横向溢出，控制台无 error/warning。代码高亮支持范围沿用上一轮记录；不扩大为全部模板已验收。

在根目录复现：

```bash
node --test tests
node scripts/md-to-html.js --type module --force doc/tech-docs/Lint_Doc_Language_Design.md
node scripts/validate-doc.js --new-doc --strict doc/tech-docs/Lint_Doc_Language_Design.html
node scripts/lint-doc-language.js --strict doc/tech-docs/Lint_Doc_Language_Design.md doc/tech-docs/Lint_Doc_Language_Design.html
```

依然只验收 module 生成与对应维护链路，未新增 system/guide/batch/fullpower 全流程、断网、性能或覆盖率测试。历史 1.x 文档仍有已知的源码引用 warning。新报告不会消除该历史问题。
