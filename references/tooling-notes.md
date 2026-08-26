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
