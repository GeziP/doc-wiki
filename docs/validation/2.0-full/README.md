# 2.0 完整实际验收

2026-10-05，Windows PowerShell / Node.js v20.20.2。按用户要求完成 system、guide、module batch、fullpower 和 maintain 的代表性真实任务，再发布 main。此前两轮验收记录仍保留，不覆盖历史结果。

## 真实任务与结果

| 路由 | 实际产物与验证 | 结果 |
|---|---|---|
| system | [当前工具链架构](../../../doc/Quality_Tooling_System.md)，独立读源码、检查依赖箭头及 CLI/配置事实 | 无事实/API 阻断 |
| guide | [上手教程](../../../guide.md)，从创建输入到语言检查、转换、HTML 检查、保存基线、注入错误、阻断、恢复 | 实际退出码为 0 → 1 → 0；输入恢复 |
| module / batch | Prose 的三个导出、Quality_Report 的七个导出；保留 lint 模块并批量重建三页、生成两种索引 | API 断言、引用审计、生成及导航通过 |
| fullpower | 独立生成 agent、另一位 reviewer、主 agent 真实浏览器和运行门禁 | 发现的问题已修复；[独立报告](review.md) |
| maintain | 隔离副本 strict 中文阈值 50→55，最小修订文稿，再用同版本工具比较基线 | 22 条新旧边界断言通过，两基线 added/resolved=0；生产阈值仍是 50 |

生成过程见 [generation-log.md](generation-log.md)，维护过程见 [maintenance-log.md](maintenance-log.md)。两份子任务日志记录其交接时的状态；本页与最终生产运行记录补充后续修复和验证。维护正文快照、基线、边界输出及 diff 保存于 [maintenance](maintenance/source-change.json)；其中脚本是原隔离工作区的执行证据，不能直接在归档目录当作生产命令运行。

## 最终运行证据

- [commands.json](../full-generation/commands.json)：最终生产工作区各命令全部退出 0。
- [tests.txt](../full-generation/tests.txt)：32/32 通过，包括混合类型路由、两索引、批量/预演/跳过/强制、非法输入与大写 MD 输入保护，以及真实教程的阻断和恢复。
- [source-snapshot.json](../full-generation/source-snapshot.json)：实现文件散列；[release-snapshot.json](release-snapshot.json) 包括模板、测试及最终文稿，避免把旧 HEAD 当作未提交变化的证据。
- [source-reference-audit.json](../full-generation/source-reference-audit.json)：五份当前文稿的 141 条引用存在且行范围有效。独立审阅另核实四份新稿 91 条引用及教程示例 3 条引用的事实支持；存在性本身不证明含义正确。
- 五份当前 Markdown 的语言检查均 0 error / 0 warning。HTML 全量为 6 files / 0 error / 4 warning；三份新页各有一条代码密度提示，另有历史文档的一条来源提示。
- skill-creator `quick_validate.py` 通过（Windows 使用 Python UTF-8 模式）；主入口及共享/全力/维护流程的严格语言门禁 0/0。

三条代码密度提示已经人工审阅：API 表和解释正文承担主要信息，不为达到代码块比例填充无关代码。默认门禁通过；这些页加 `--strict` 仍会被该提示阻断，未声称严格 HTML 零 warning。1.x 历史来源提示保留，没有修改历史产物掩盖它。

## 实测发现与修复

1. 大写 `.MD` 曾把输出写回输入；现在保留输入并生成 `.html`。缺失文件、非 Markdown、空扫描及非法选项失败退出。
2. 显式 `--type system/guide --all` 和无标题索引曾误用 module；根 guide 与通用命名系统文档曾漏扫。现在类型路由与目录一致，system 索引包含当前架构和历史页。
3. guide 的章节 class 与模板目录选择器不匹配，且缺手机菜单按钮。已修复；三类模板从共享 CSS 同步最小宽度与标题截断，避免窄屏溢出及按钮挤出。
4. 实际示例引用多上跳一级；修正后端到端驱动断言源文件存在及行范围，并用 finally 保证异常时恢复输入。
5. 索引固定 C++ 演示与“12 章/零依赖”声明不符合实际产物。移除虚构预览，准确说明本地资产；通过元数据区分当前工具链、历史快照和模块职责。
6. 存量测试把全量 warning 总数硬编码为 1。改为核实历史来源提示、允许已审阅的密度提示，同时继续拒绝 error 和其他 warning；没有删除失败用例。

## 真实浏览器

通过 CUA 在本地 HTTP 页面亲验，未用 DOM 注入改变结果。1440×900 与 390×844 代表视口：system、guide、两个新模块及两种索引没有页面级横向溢出（390 视口的正文 client/scrollWidth 均 375）。guide 有 9 个目录链接；手机菜单打开、跳转后关闭。两模块和系统图均生成实际 Mermaid SVG；架构图放大从 95% 到 119%，关闭有效；章节折叠有效。

暗色主题实际切换；代码高亮存在，复制按钮点击显示成功勾号。CUA clipboard 读取没有返回页面所复制的内容，因此只记录按钮成功反馈，不宣称独立核对了系统剪贴板内容。模块索引搜索与空结果、两索引分类过滤均亲验。所检查脚本和样式来自本地 vendor，控制台未见页面 error/warning。隔离维护 HTML 亲验显示新阈值、显式隔离说明且窄屏无溢出。视口覆盖已恢复。

截图：[教程手机](guide-mobile.jpg)、[模块索引手机](module-index-mobile.jpg)、[架构桌面](system-desktop.jpg)、[架构放大](system-zoom.jpg)。

这轮是实际代表任务验收，不是性能、覆盖率、跨线程压力或全部非法语法测试；机器检查仍不能证明语义或 ASD-STE100 合规。借鉴的是受控术语、写作与检查分离、语义保留和可追溯审核方式。
