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
