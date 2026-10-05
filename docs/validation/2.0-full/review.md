# 完整生成验收独立事实复审

2026-10-05；初轮审核 `.tmp/full-validation/project` 的真实生成产物，收到主 agent 最终冻结/同步通知后，追加对生产最终四稿、示例和快照的复核。本 reviewer 只写本报告，其他文件只读；无 commit/push。浏览器由主 agent 负责。

## 最终结论

最终 Prose、Quality Report 两模块稿、Quality Tooling 系统稿、guide 稿的关键 API、字段、模式默认、处理顺序、扫描规则、写入范围及示例与当前真实源码一致。本轮发现的示例源码路径 P2、扫描说明 P2、写入范围 P2 和三处引用定位均已修复并独立复核关闭。维护受控试验的条件、单位、否定、比较方向和同版本基线吻合。**没有尚未关闭的严重事实/API/关键条件阻断项。**

这是限定范围的源码/执行复审，不是所有场景、全部非法输入、性能或语义等价认证；lint/validator 通过不替代事实审核。本 reviewer 未操作浏览器，视觉/交互结果由主 agent 独立记录。下面保留过程中发现的问题，最终状态以末节的关闭记录为准。

## 首轮：prose / quality-report

亲读 sandbox 两份模块 Markdown、完整 `scripts/lib/prose.js` 和 `scripts/lib/quality-report.js`，对照 lint 调用路径、validator 结构证据、公开导出及 SKILL/workflow 契约。

核心 API、数据字段、默认 format、UTF-16/实体映射、掩码执行顺序、digest、身份选择、多重集合基线和 gate 分支与源码一致。没有发现严重事实/API阻断错误。亲验 source entity 不额外排除代理区，符合 prose 文稿边界。

在 sandbox cwd 提取并执行两份 Markdown 的 JavaScript 围栏：所有 assert 通过。另直接亲验三个 prose 导出和七个 quality-report 导出；`&#xD800;` 产生代理区代码单元；format 省略走 Markdown；即使 input/read 被手工指定为 warning，gate 仍返回 1。没有把这些执行结果扩展为所有非法输入、语义等价或线程保障。

### 已通知主 agent 的首轮问题

1. **P3 引用定位**：Prose 概述引用 `lint-doc-language.js:6` 证明 prose 依赖，实际该行是 quality-report import，prose import 是第 7 行；API 段扩展名选择引用第 119 行实际是 readFile，选择 format 在第 120 行。建议修改引用定位，不改变正文事实。
2. **P3 引用定位**：Quality Report 示例生产引擎引用 `lint-doc-language.js:125-128` 不含 engine（实际在 123-124）。建议引用实际 profile 构造。
3. **记录收尾**：两稿声称 `examples/full-validation/module-api.js` 已实际执行，但首轮阅读时文件和 `docs/validation/full-generation` 尚未建立。生成仍在进行，待最终冻结后确认文件/命令记录齐备；当前不将未完成记录称为已验证通过。

待继续：system/guide 文稿、冻结后的 converter、关键命令、所有引用和最终执行证据复审。

## 第二轮草稿：system / guide（仍待冻结）

已读 `doc/Quality_Tooling_System.md` 与根 `guide.md`；对照当前 sandbox converter 的 TYPE_CONFIG、入口参数、staging、批量/索引分支，及 validator CLI/new-doc/报告处理。下面是生成期间已通知主 agent 的问题，尚未作为最终状态：

1. **P2 范围与操作副作用**：guide Scope 声称示例只写 examples/full-validation，但第 6 节 module --all --force、module/system --index 会写 doc 下 HTML/index。应区分最小例子的写入范围和批量导航步骤的真实副作用。
2. **P2 converter 变更后扫描规则漂移**：当前 TYPE_CONFIG system.filePattern 已是 doc 中所有 `.md` 排除 Guide 后缀；guide.additionalScanDirs 包含 PROJECT_ROOT，匹配大小写不敏感。system 仍写 system 只发现 Design/Architecture/...、guide 只发现 doc；guide 排障仍说根 guide.md 不会被 --all 发现。须在最终 converter 冻结后更新，再亲验代表 dry-run。

上述仅草稿事实漂移，不以全篇 lint 或其他良好内容抵消。尚未执行写入式教程命令；最终代表命令将在不修改其他文件的限制下，结合只读/--dry-run 或记录与源码核验执行。

## 隔离维护试验独立复审

亲读 maintenance-log、maintenance/checks/document-md.diff、before/after-run JSON、边界记录与维护脚本及修改后的文稿。用 git show eae95fe 读取原稿/源码后独立断言：before.md 与 base 原稿一致；maintenance lint 仅 strict 的 CJK 条件数值 50→55，其他逐字相同（只统一 CRLF）；prose/quality-report/source-reference 与 base 相同；before/after 三工具散列相同且都与当前 sandbox 文件吻合。

独立以内存 CommonJS 模块加载旧源码，运行旧/新 CJK strict：50 为 0/0；51、55 为 1/0；56、70、71 为 1/1；新 55 CJK 加 21 个英文词仍 warning。再只读重跑两个 after baseline CLI：HTML 与 explain language 均 exit=0、summary=0 error/0 warning、added/resolved/unchanged=0。

维护 diff 只改隔离快照标识、阈值、边界解释及来源，未更改其他接口。条件是精确 strict，比较符仍严格大于，单位仍 U+3400..U+9FFF 计数，51–55 的否定限定为“不再单独触发”；56、英文独立 OR、explain 70/25、warning severity 和 --strict 门禁关系均与实现一致。源码变化只存在受控 sandbox，不表述为生产变化；同版本基线不是旧引擎冒用。没有发现维护语义阻断项。本 reviewer 未执行会重写检查产物的 maintenance-check.js，而是使用只读内存断言和只读 CLI 重验；维护浏览器仍由主 agent 负责。

## 最终冻结后补充：示例引用阻断项

**P2，待复核修复**：`examples/full-validation/create-example.js` 生成的 Example_Design.md 中三处 `../../../../../scripts/lib/quality-report.js` 多回退一级。从实际产物目录 `project/examples/full-validation/doc/tech-docs` 解析到 `.tmp/full-validation/scripts/lib/quality-report.js`，文件不存在；正确路径应为 `../../../../scripts/lib/quality-report.js`。该错误与 guide 的“实际源码引用”陈述不符。独立 `path.resolve/fs.existsSync` 三处都得到 false，已立即通知主 agent 修复生成脚本并重跑例子/HTML。HTML 门禁虽 0/0，只证明标签存在，不证明源码路径真实；不以其通过抵消本问题。

## 生产最终文件复核与关闭记录

1. Prose 最终导入引用为 `lint-doc-language.js:7`，格式选择为 `:120`；Quality Report 最终生产 profile 引用为 `:123-124`。逐处亲读实现，定位支持正文。
2. system 配置段现准确说明 module 的 `_Design.md` 忽略大小写、system 扫 doc 根 Markdown 排除 Guide、guide 扫 doc 和项目根 Guide 后缀；guide 排障及导航说明已同步。最终在生产 cwd 亲跑 `system --all --dry-run --force` 得 2 个系统目标，`guide --all --dry-run --force` 得根 guide 一个目标；混合三类型显式文件 dry-run 得三份，退出均 0。亲读 detectType 的 Guide→tech-docs→doc 根/系统名→Design 优先级，目录判定方向与实际资产类型一致。
3. guide Scope 已区分“最小示例仅写 examples/full-validation”和第 6 节会重建 doc HTML/index，写入副作用说明关闭；源码及命令对应，不隐瞒全项目 force 重建。
4. 示例生成脚本三处路径已改四级上跳，最终生成 MD 的三处引用全部解析到真实生产 quality-report.js 且行范围有效。run-e2e 增实际引用存在/范围断言，并在注入比较的 finally 中恢复 Markdown。独立亲读完整驱动；记录为 create/language/conversion/html/injected/repaired 退出 0/0/0/0/1/0。该项 P2 关闭。
5. 最后独立复核生产四稿 14+17+35+25=91 个引用，以及例子三处，共 **94 个引用均有文件且行范围有效**。这项存在性检查与此前亲读方向/API/规则的语义支持分开陈述。
6. 最终亲跑生产 `module-api.js` 返回 0；示例 strict mode+strict gate+terms 的检查以及新 HTML 严格门禁均 0 error/0 warning；恢复后的同配置语言 baseline 亲跑 exit 0、added/resolved/unchanged=0。另亲跑 guide index 拒绝为 1、已有 module HTML 未 force 为 skip/0、非法 language mode 为 fatal/1，均吻合文稿。
7. 最终 `docs/validation/full-generation/source-snapshot.json` 所列文件 SHA-256 全部与当前生产文件吻合。亲读最终 tests.txt 记录为 **32/32 通过**，这是主 agent 的完整测试执行证据；本 reviewer 没有把之前 sandbox 27/28 或自己的代表命令称作独立全量 32/32。早期硬编码 warning 总数失败由主 agent 处理并重新全量验证，历史失败记录保留。
8. 生产 strict 中文阈值仍为 50；只有 maintenance 隔离源为 55。生产发布与维护受控实验未混写。维护的前后工具散列及基线已经独立重验，不能将 engine 数字单独当作版本相同证据。

未解决事项：本事实/接口/可运行性复审范围内无阻断项。没有由本 reviewer 运行写入式 create/run-e2e（遵守其他文件只读限制），这些写入与注入/恢复结果依据已亲读源码和主 agent 的实际记录；只读 baseline、检查、API和dry-run由本 reviewer 实际执行。未对全部非法 HTML/Markdown、Unicode、跨线程、性能、全部模板交互和断网进行验证。浏览器最终结果需使用主 agent 的实际证据，不由本报告推断。
