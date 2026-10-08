# 工具维护笔记（skill 自身开发/维护实战）

> 来源：2026-08-24/25 在 Windows + Git Bash + Claude Code headless 环境维护本 skill 的实录。
> 这些坑与文档生成无关，但改 skill 脚本/SKILL.md 时必然遇到。

## 1. heredoc 写文件：CRLF 与转义双坑

本仓库文件多为 **CRLF** 行尾，heredoc 内容是 **LF**——用 `cat > file << 'EOF'` 覆盖写入后：
- 字符串锚点替换全部失配（`s.includes('...\r\n')` 永远 false）
- 表格/围栏解析出怪异结果

**正确做法**：node 脚本内先探测行尾（`s.includes('\r\n') ? '\r\n' : '\n'`），
锚点与替换串都按探测结果拼接；或行级处理（`split(/\r?\n/)` + join）。

另一个坑：向 JS 文件写正则源码时的转义层级极易出错（`\s` 落盘成 `\s` 或裸 `s`）。
**绕开方案**：用 `String.fromCharCode(92)` 拼 backslash；且正则字面量内的 `/`
必须 `\/` 转义（未转义的 `/` 是正则字面量终结符，报 "Unexpected token"）。

## 2. set -o pipefail + grep 无匹配 = 静默杀脚本

`set -euo pipefail` 下，`x=$(grep pattern file | wc -l)` 在 grep 无匹配时管道整体返回 1，
**整个脚本以 exit 1 静默退出**（无错误输出）。统计类脚本必踩。

**修法**：统计管道统一加 `|| true`：

```bash
n=$(grep -hoE "^[[:space:]]*TEST\(" tests/*.cpp 2>/dev/null | wc -l || true)
```

## 3. headless Edge 截图：details 折叠与锚点滚动

`msedge --headless --screenshot` 采文档效果图时：
- **details 默认折叠** → 锚点定位的章节内容是空白。先做全展开副本：`html.replace(/<details>/g,'<details open>')`
- **URL 中文锚点不可靠** → 注入 `scrollIntoView` 脚本后截图
- 加 `--virtual-time-budget=10000` 让 JS（TOC/mermaid/highlight）跑完

```bash
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless --disable-gpu --window-size=1440,1000 \
  --screenshot="out.png" "file:///path.html" --virtual-time-budget=10000
```

## 4. 修改转换器/校验器后的自测协议

改 `md-to-html.js` / `validate-doc.js` 后，最小自测集（缺一不可）：

| # | 场景构造 | 验什么 |
|---|----------|--------|
| S1 | 修复针对的正例（如 classed code 内模板参数） | 不再误报 |
| S2 | 修复针对的反例（真实错误样本） | 仍能抓到 |
| S3 | 合法例外（如行内 code 内的转义标签） | 不误伤 |
| S4 | legacy 产物（旧模板 figure wrapper） | 兼容不崩 |
| S5 | 审计/分析报告的断言（尤其方向性：谁走哪条路径） | 回源码验证 if/else 结构后才能执行修订——报告自身会错（见 §7） |
| S6 | 存量文档重生成后跑 `check-doc-fidelity.js --all` | 内容零丢失；见 §13 |
| S7 | 存量文档重生成后跑 `check-doc-links.js --all` | 无死链、无指向 `.md` 的链接；见 §14 |

再跑一遍存量文档校验，错误集合 diff 为空（基线法，见 maintenance-workflow.md M3）。

## 5. 端到端验证优先于静态推断

HTML/渲染问题必须用真实浏览器验证（headless dump-dom / screenshot），不要靠读源码推断
"应该没问题"。实例：mermaid `<br/>` 丢失问题在 HTML 源码层面完全正常（br 就在那里），
只有渲染后检查 SVG foreignObject 里的实际 label 才能发现换行消失。

## 6. 统计源码必须排除注释行

正则统计（binding 数/调用点数/任何"数行"）对注释掉的代码毫无防御。实例：
统计绑定表 `,\s*\d+,\s*\w+Handler` 得 79/40——其中 1 条是 `// {"进样配件_...",
 2000, sampleInputFeedHandler}` **注释行**（待固件保留），活跃行实际 78/39。
刚写进文档的"权威单点数字"立即可疑。修法：

```js
const active = lines.filter(l => !l.trim().startsWith('//')).join('\n');
```

或统计前 `grep -v '^\s*//'`。对多行注释语言（/* */）还需处理块注释状态机。

## 7. 审计报告的断言不能直接照抄执行

Analyzer subagent 报告本身会有错。实例：报告断言"0x4001 在正式路径仅剩 Location
一处"——实码恰好相反（正式路径 Location 返回 kInvalidParam，0x4001 全在 demo 路径）。
照抄执行会把方向写反进文档。执行修订前的最低验证：

- **方向性结论**（谁走哪条路径/谁先谁后）→ 必须回源码看 if/else 分支结构
- **file:line 引用** → 打开看该行内容是否支持断言（抽查即可，但方向性结论 100% 验）
- 修订完成后 **grep 旧措辞残留**——改了权威定义处，散布的复述处容易漏（"修复
  不一致"的提交自己制造新的不一致是最讽刺的失败模式）

## 8. 并行会话扫仓：git add 与 commit 之间会被别的提交扫走

多会话共享同一 git index 时，`git add` 后若延迟提交，暂存内容会被并行走掉的
提交整体带走（三次实录）。**对策：路径式提交**——`git commit -m ... -- doc/ <入口文件>`
只提交指定路径、绕过 index 状态；或在 add 与 commit 之间零间隔，且提交前重验
`git log -1` 确认基线没动。

## 9. 锚点替换必须 throw-on-miss（静默空操作会丢整段补丁）

`s.replace(不存在锚点, ...)` 是合法的 no-op——一段补丁曾被这样无声吞掉，直到
reviewer 验收才发现。所有锚点替换前必须：

```js
if (!str.includes(anchor)) throw new Error('anchor missing: ' + anchor.slice(0, 60));
str = str.replace(anchor, replacement);
```

常见失配根因：CRLF 行尾（见 §1）、report 引用的是"定位描述"而非文件原文
（见 §7 的表亲坑：analyzer 报告的"文档位置"是它自己的话，先 grep 实际文本）。

## 10. node -e 内联脚本是转义雷区——非平凡修改一律写临时文件

`node -e "..."` 在 bash 双引号语境下，内容里的反引号/`$`/单引号会被 shell 先吃，
且 JS 字符串里的 `\` 双层坍缩难以推理（正则/Windows 路径必炸）。**对策：把修改
脚本写到 `.tmp/fix-*.js` 临时文件再 `node` 执行**——heredoc 引用定界符可保内容
原样落盘；正则源码用 `String.fromCharCode(92)` 拼 backslash（§1 的绕开方案同源）。

## 11. 转录 analyzer 表格的引入错率：高风险事实写入前亲验源码

主 agent 把 analyzer 的结构化表格转写成文档时，示例值错位/计数抄错/字段序颠倒
都真实发生过（两次被独立 reviewer 抓回）。规则：

- **算法/计数/枚举值**三类高风险事实，写入前打开源码对应行亲验；
- **新建或重写的文档必派 reviewer**——没派 reviewer 的轮次等于带险合入；
- reviewer 报告里的 old/new 引的是真实原文，可直接落地（比 analyzer 定位短语可靠）。

## 12. HTML 产物离线可移植契约（四查入校验门禁）

实战翻车三连：模板 JS/CSS 走 CDN——离线/内网打开图全灭；某类型 needsMermaid=false
——图块静默退化成代码文本（联网也不渲染）；巨幅参考图（3000+px/1MB+ jpg）无高度
上限直灌版心。另有隐藏雷：文档名恰好命中另一类型的后缀规则（如 Architecture_Design.md
以 _Design.md 结尾）会让类型检测误判 → 相对前缀算错 → 本地资产 404。

**修复模式**：JS/CSS vendor 到仓库内本地路径（按输出目录算相对前缀）；needsMermaid
全类型开启；screenshot 图加 `max-width:100%; max-height:640px` 双上限；位图 >900KB
降采样；类型检测**先目录后名字**。

**防守四查**（进校验器，门禁强制）：
1. `内网可移植`——HTML 禁 http(s):// 资产引用（FAIL）；
2. `mermaid 接线`——有图容器 ⇒ 本地渲染器脚本存在；出现 data-lang="mermaid" 的
   代码块即 FAIL（needsMermaid 回归）；
3. `图片尺寸约束`——每个 `<img>` 必须在受约束的 figure 内；
4. `资产存在性`——本地 src 全解析；>900KB 位图 WARN。

**校验集要全量**：按文件名模式过滤的校验集会放过不匹配名的文档——放宽为目录
全量扫描当天即抓出三处漏网坏引用。**校验器自身也要校准**：`->>` 是 sequenceDiagram
标配箭头、冒号后自由文本不检、`<password>` 占位符不是结构标签——修误报而不是绕过。

**流程铁律**：改模板/样式 → 同步 → 全量强制再生成 → 校验门禁全绿 → **浏览器打开
至少一份代表页目检**（静态查不了视觉，最后一道人眼关）。

## 13. 校验器看不到“缺了什么”：转换保真度要单独往返比对

`validate-doc.js` 全绿，不代表 HTML 保住了 Markdown 的内容。对 75 篇真实文档（65 篇模块文档
加 10 篇指南/系统文档）做往返比对，暴露过一批静默丢失，校验器一条都没报：

- 文档信息表的非标准行（目标读者/关联文件）、首个 `##` 之前的横幅被丢；
- 围栏内的 `## ` 被切成假章节；围栏不配对时，漏写的关闭围栏会吞掉其后全部标题；
- 表格单元格里的 `\|`、双反引号代码、引用块里的表格/多段落被压扁或改写；
- mermaid 标签里的裸 `<`（`vector<T>`）被浏览器当标签吞掉；
- 表头粘在上一段末尾时，首个数据行被当成分隔行吞掉；
- 缩进围栏（列表项里的代码块）和更长的外层围栏不被识别。

**对策**：转换器按 CommonMark 围栏状态机处理，宁可把内容原样输出也不丢弃；再用
`check-doc-fidelity.js --all` 做往返比对，并配负控测试（人为删掉 HTML 里的代码/表格，必须报出来）。
先区分是转换器缺陷还是 Markdown 自身缺陷：围栏不配对、表头粘连、表格里的裸 `|` 都是源文件问题，应修源文件。

## 14. 两个检查都全绿，读者仍可能点到死路、读到乱码

在同一批 75 篇文档上继续核对，又暴露一批校验器和往返比对都看不见的问题：

- 一段 `**加粗**` 被硬换行切在两行：逐行转换后 `**` 原样漏进页面。对策：仅当“并入后确实闭合”才合并，最多续 3 行，不碰标题、表格、引用和围栏。
- 多行原始 HTML（`<figcaption>…` 换行 `…</figcaption>`）：续行被当成普通段落转义，闭合标签和 `<a>` 以文本漏出。对策：开标签所在行没有闭合，就原样输出到闭合标签；空行也算结束。
- 近 200 条链接写成 `x.md`：点进去是裸 Markdown，不是同名 HTML 孪生。对策：转换时若孪生已存在就改写成 `.html`；`check-doc-links.js` 兜底。
- 作者在 Markdown 里写 GitHub 锚点 `#ui-参数--mc-字段映射表`，HTML 的章节 id 却是 `sec-…`。对策：每个标题再放一个 GitHub 规则的空锚点，两边同一条链接都可达。
- 围栏的“关闭行”写成 `` ```text ``：按 CommonMark 它不会关闭围栏，其后 217 行（含多个章节）被吞进代码块。Markdown 与 HTML 两边一致，往返比对看不出。对策：`check-doc-fidelity.js` 的 `fence-suspect` 启发式。
- 校验器的 mermaid 图说检查用贪婪窗口，一篇有 36 张图的文档里只检查了 2 张。对策：按每个 `mermaid-wrap` 单独取作用域，并加负控测试。
- 链接检查器自己的行号：剥掉 `<script>`/`<style>` 后在原文上数行，行号全部漂移。对策：用空格抹掉而不是删除，保持偏移一一对应，并补回归测试。新写的检查器也要在真实语料上自测，不能只信单元测试。
- 把术语表之类的正文写进 `## 目录` 段：转换器把该段（到第一条 `---`）整段换成生成的侧栏，条目之外的内容无声丢失；往返比对又跳过这个区间，Markdown 与 HTML 两边“一致”，校验器只会觉得文档没写术语表。3 篇真实文档因此在 HTML 里缺了术语表。对策：`check-doc-fidelity.js` 的 `toc-swallowed`——目录段里不是 `- [标题](#锚点)` 的非空行都报；作者把内容挪进正式章节（如 `## 术语表`）。
- 转换器的图注正则比校验器的 `figNumRe` 窄：只认 `图 N —` / `图 N.N —`（数字后必须直接是破折号），`图 4.2a —`、`图 3.29a-1 —`、`图 5：` 这类图注被当成普通引用块，图说静默丢失；校验器随后只报“缺图说”，而作者明明写了。对策：两处同口径（转换器的 `FIG_CAPTION_RE`），并用“每种编号形式都必须变成 `<figcaption>` 且通过校验”的回归测试锁住。
- 源码引用的目标恰好是 `.html` 源文件（如 `{{config_parse/index.html:1}}`）：链接检查器对所有 `.html` 目标按页面锚点校验，`#L1` 被报成 `missing-anchor`，门禁变红，而引用本身没有错。对策：`class="source-ref"` 的链接不做锚点校验，只做行数校验；普通页面链接照旧。负控测试同时覆盖越界告警和普通链接。
- 链接目标在作者机器上存在、仓库里却没有：`debug-ui/screenshots/`（`.gitignore` 排除）里的 6 张截图、`config_parse/`（本机 `.git/info/exclude` 排除）里的 4 个源码引用。`missing-target` / 资产存在性检查都按工作区解析路径，所以在作者机器上一直全绿，别人克隆（或 CI）后才变红；本地“干净检出”复验才发现。对策：`check-doc-links.js` 读 git 索引，目标存在但没被跟踪就报 `untracked-target`（`--require-tracked` 下为 error）；同一检查顺带抓“路径大小写与 git 里不一致”（Windows/macOS 能点开、Linux 是死链）。子模块内部的文件 git 不列出，一律放行，否则含子模块的仓库全是误报。回归测试覆盖：被忽略、从没 `git add`、非 HTML 目标、目录目标、仅暂存未提交、非 ASCII 路径、gitlink、大小写、非 git 目录；其中 gitlink 用例用“去掉放行逻辑后变红”做过变异检验，并用修复前的两份真实 HTML 复现出这 6 + 4 条。
