'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function convert(t, name, markdown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-wiki-roundtrip-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const targetDir = path.join(dir, 'doc', 'tech-docs');
  fs.mkdirSync(targetDir, { recursive: true });
  const file = path.join(targetDir, `${name}_Design.md`);
  fs.writeFileSync(file, markdown.join('\n'));
  const run = (script, args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd: dir, encoding: 'utf8' });
  const converted = run('md-to-html.js', ['--type', 'module', '--root', dir, file]);
  assert.equal(converted.status, 0, converted.stdout + converted.stderr);
  const htmlFile = file.replace(/\.md$/, '.html');
  return { dir, file, htmlFile, html: fs.readFileSync(htmlFile, 'utf8'), converted, run };
}
const fidelity = (run, dir) => {
  const result = run('check-doc-fidelity.js', ['--json', '--root', dir, '--all']);
  return { status: result.status, report: JSON.parse(result.stdout) };
};
const kinds = (report) => report.files.flatMap(f => f.issues.map(i => i.kind));

test('document-info extra rows, prelude banners and multi-block blockquotes survive conversion', t => {
  const { html } = convert(t, 'Meta', [
    '# Meta 技术设计文档', '', '> ⚠️ OBSOLETE：本文已被取代，仅供追溯。', '',
    '## 文档信息', '', '| 项目 | 内容 |', '|---|---|', '| 文档版本 | V3.1 |', '| 目标读者 | 维护者与新人 |', '',
    '## 1. 概述', '', '> 第一段说明。', '>', '> 第二段说明，随后是表格：', '>', '> | 列A | 列B |', '> |---|---|', '> | x1 | y1 |', '',
  ]);
  assert(html.includes('OBSOLETE'), 'prelude banner before the first ## was dropped');
  assert(html.includes('目标读者') && html.includes('维护者与新人'), 'extra document-info row was dropped');
  assert(/<blockquote>[\s\S]*<table>[\s\S]*x1[\s\S]*<\/blockquote>/.test(html), 'table inside blockquote was flattened');
});

test('fenced lines that look like headings stay code; an unclosed fence is reported, not swallowed', t => {
  const { html } = convert(t, 'Fenced', [
    '# Fenced 技术设计文档', '', '## 1. 概述', '', '示例：', '',
    '```markdown', '## Cycle 1', '---', '正文行', '```', '', '## 2. 后续', '', '内容。', '',
  ]);
  assert(!/<h2[^>]*>[^<]*Cycle 1/.test(html), 'fenced "## Cycle 1" became a fake section');
  assert(html.includes('## Cycle 1') && html.includes('正文行'));
  assert(html.includes('2. 后续'));

  const broken = convert(t, 'Unclosed', [
    '# Unclosed 技术设计文档', '', '## 1. 概述', '', '```cpp', 'int x;', '', '## 2. 后续', '', '内容。', '',
  ]);
  assert(/WARN[\s\S]*unbalanced/i.test(broken.converted.stdout), broken.converted.stdout);
  assert(broken.html.includes('2. 后续'), 'unclosed fence must not swallow the remaining headings');
  assert(broken.html.includes('int x;'), 'code inside an unclosed fence must be kept, not dropped');
});

test('mermaid labels keep raw angle brackets as text', t => {
  const { html } = convert(t, 'Mermaid', [
    '# Mermaid 技术设计文档', '', '## 1. 概述', '',
    '```mermaid', 'flowchart LR', '    A["vector<int>"] --> B[done]', '```', '',
  ]);
  assert(html.includes('vector&lt;int&gt;'));
  assert(!html.includes('vector<int>'));
});

test('table cells honour \\| and multi-backtick code spans', t => {
  const { html } = convert(t, 'Cells', [
    '# Cells 技术设计文档', '', '## 1. 概述', '',
    '| 写法 | 说明 |', '|---|---|', '| `a\\|b` | 竖线在代码里 |', '| ``x`y`` | 双反引号 |', '',
  ]);
  assert(html.includes('<td><code>a|b</code></td>'), 'escaped pipe inside a code span');
  assert(html.includes('<code>x`y</code>'), 'double-backtick code span');
});

test('an orphan figure caption is kept as text, not dropped', t => {
  const { html } = convert(t, 'Caption', [
    '# Caption 技术设计文档', '', '## 1. 概述', '', '> 图 1.1 — 没有跟图的说明文字', '', '普通段落。', '',
  ]);
  assert(html.includes('图 1.1 — 没有跟图的说明文字'));
});

test('indented fences inside list items and longer outer fences render as code blocks', t => {
  const { html } = convert(t, 'Nested', [
    '# Nested 技术设计文档', '', '## 1. 概述', '',
    '- 步骤一：', '', '    ```bash', '    echo indented', '    ```', '',
    '````markdown', '```js', 'inner();', '```', '````', '',
  ]);
  assert(html.includes('<code class="language-bash">echo indented</code>'), 'indented fence content must be de-indented code');
  assert(html.includes('```js') && html.includes('inner();'), 'inner fence lines must stay inside the 4-backtick block');
  assert(!/<p>\s*`{3}/.test(html), 'a fence line leaked into a paragraph');
});

test('a table whose header is glued to the previous paragraph never swallows its first data row', t => {
  const { html } = convert(t, 'Glued', [
    '# Glued 技术设计文档', '', '## 1. 概述', '',
    '**核心 API**：| 方法 | 语义 |', '|---|---|', '| `first()` | 首行 |', '| `second()` | 次行 |', '',
  ]);
  assert(html.includes('first()') && html.includes('second()'), 'data row lost');
});

const richDoc = [
  '# Rich 技术设计文档', '', '> ⚠️ OBSOLETE：旧文。', '',
  '## 文档信息', '', '| 项目 | 内容 |', '|---|---|', '| 目标读者 | 新人 |', '',
  '## 1. 概述', '', '调用 `run()` 即可，指针 `const A*` 保持原样。', '',
  '| 方法 | 说明 |', '|---|---|', '| `a\\|b` | 含竖线 |', '',
  '```mermaid', 'flowchart LR', '    A["vector<int>"] --> B[done]', '```', '',
  '- 步骤：', '', '    ```bash', '    echo hi', '    ```', '',
];

test('check-doc-fidelity passes on a faithful conversion', t => {
  const { run, dir } = convert(t, 'Rich', richDoc);
  const { status, report } = fidelity(run, dir);
  assert.equal(status, 0, JSON.stringify(report.files));
  assert.equal(report.summary.issues, 0);
});

test('check-doc-fidelity flags dropped code spans, fences, tables and altered headings (negative controls)', t => {
  const { run, dir, htmlFile, html } = convert(t, 'Rich', richDoc);
  const mutate = (fn) => { fs.writeFileSync(htmlFile, fn(html)); return fidelity(run, dir); };

  let result = mutate(h => h.replace('<code>run()</code>', 'run()'));
  assert.equal(result.status, 1);
  assert(kinds(result.report).includes('code-missing'));

  result = mutate(h => h.replace(/<div class="code-block"[^>]*>[\s\S]*?<\/div>/, ''));
  assert.equal(result.status, 1);
  assert(kinds(result.report).includes('fence-missing'));

  result = mutate(h => h.replace(/<div class="table-wrapper">[\s\S]*?<\/div>/, ''));
  assert.equal(result.status, 1);
  assert(kinds(result.report).includes('table-missing'));

  result = mutate(h => h.replace('vector&lt;int&gt;', 'vector&lt;long&gt;'));
  assert.equal(result.status, 1);
  assert(kinds(result.report).includes('fence-missing'), 'a rewritten mermaid block must be reported');
});

test('check-doc-fidelity reports an unclosed fence in the Markdown source and a missing twin', t => {
  const { run, dir, file, htmlFile } = convert(t, 'Open', [
    '# Open 技术设计文档', '', '## 1. 概述', '', '```cpp', 'int x;', '',
  ]);
  const unclosed = fidelity(run, dir);
  assert.equal(unclosed.status, 1);
  assert(kinds(unclosed.report).includes('fence-unbalanced'));

  fs.rmSync(htmlFile);
  const missing = run('check-doc-fidelity.js', ['--json', '--root', dir, file]);
  assert.equal(missing.status, 2);
  assert.equal(JSON.parse(missing.stdout).summary.missingTwin, 1);
});

test('a **bold** span hard-wrapped over lines renders as bold; a stray ** stays put', t => {
  const { html } = convert(t, 'WrapBold', [
    '# WrapBold 技术设计文档', '', '## 1. 概述', '',
    '普通段落里**在换行处断开的', '加粗短语**，后面还有字。', '',
    '1. **列表项里断开的', '   加粗续行**（带括号）。', '',
    '孤立星号 src/**/*.h 不闭合，', '下一行必须仍是独立段落。', '',
  ]);
  assert(html.includes('<strong>在换行处断开的 加粗短语</strong>'), 'wrapped bold in a paragraph');
  assert(/<li>\s*<strong>列表项里断开的 加粗续行<\/strong>/.test(html), 'wrapped bold in a list item');
  assert(html.includes('<p>下一行必须仍是独立段落。</p>'), 'a ** that cannot close must not swallow the next line');
});

test('a multi-line raw <figcaption> keeps its inline tags; .md links follow the HTML twin only when it exists', t => {
  const first = convert(t, 'RawHtml', [
    '# RawHtml 技术设计文档', '', '## 1. 概述', '',
    '参见 [Other](Other_Design.md#sec)、[外链](https://example.com/a.md)、[无孪生](Lonely_Design.md)。', '',
    '<figure>', '',
    '```mermaid', 'flowchart LR', '    A --> B', '```', '',
    '<figcaption>图 1.1 — 跨行图注，', '含 <a href="Other_Design.md">链接</a> 与 <b>粗体</b></figcaption>', '',
    '</figure>', '',
  ]);
  assert(first.html.includes('<b>粗体</b>') && first.html.includes('<a href="Other_Design.md">链接</a>'), 'raw tags on the continuation line must pass through');
  assert(!first.html.includes('&lt;/figcaption&gt;') && !first.html.includes('&lt;a href'), 'escaped markup leaked into visible text');
  // 目标孪生出现后再转一次：.md → .html；外链与无孪生链接保持原样（不制造死链）
  fs.writeFileSync(path.join(path.dirname(first.htmlFile), 'Other_Design.html'), '<html></html>');
  const again = first.run('md-to-html.js', ['--type', 'module', '--root', first.dir, '--force', first.file]);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  const second = fs.readFileSync(first.htmlFile, 'utf8');
  assert(second.includes('<a href="Other_Design.html#sec">Other</a>'), 'markdown link was not pointed at the HTML twin');
  assert(second.includes('<a href="Other_Design.html">链接</a>'), 'raw anchor was not pointed at the HTML twin');
  assert(second.includes('href="https://example.com/a.md"') && second.includes('href="Lonely_Design.md"'), 'external / twin-less links must stay untouched');
});

test('check-doc-fidelity flags a fence "closed" with an info string (it never closes and swallows what follows)', t => {
  const swallowed = convert(t, 'Swallow', [
    '# Swallow 技术设计文档', '', '## 1. 概述', '',
    '```text', 'main()', '  └─ app.run()', '```text', '',
    '### 1.1 被吞进代码块的小节', '', '| A | B |', '|---|---|', '| 1 | 2 |', '',
    '```text', '后一个示例', '```', '',
  ]);
  const found = fidelity(swallowed.run, swallowed.dir);
  assert.equal(found.status, 1, JSON.stringify(found.report));
  assert(kinds(found.report).includes('fence-suspect'), JSON.stringify(found.report));

  // 负对照：更长的外层围栏里嵌套示例是合法写法；``` markdown 外层同样放行
  const nested = convert(t, 'Nested', [
    '# Nested 技术设计文档', '', '## 1. 概述', '',
    '````text', '```text', '内层示例', '```', '````', '',
    '```markdown', '```text', 'x', '```', '```', '',
  ]);
  const clean = fidelity(nested.run, nested.dir);
  assert(!kinds(clean.report).includes('fence-suspect'), JSON.stringify(clean.report));
});

test('headings also carry GitHub-style anchors, so a Markdown #slug link resolves in the HTML twin', t => {
  const { html, dir } = convert(t, 'Anchors', [
    '# Anchors 技术设计文档', '', '## 1. 概述', '',
    '见 [映射表](#ui-参数--mc-字段映射表)，另见 [第二个重复](#重复-1)。', '',
    '### UI 参数 → MC 字段映射表', '', '内容。', '',
    '### 重复', '', 'a', '', '### 重复', '', 'b', '',
    '#### 四级 标题', '', 'c', '',
  ]);
  assert(html.includes('<a id="ui-参数--mc-字段映射表"></a>'), 'GitHub slug of a heading with an arrow');
  assert(html.includes('<a id="重复"></a>') && html.includes('<a id="重复-1"></a>'), 'repeated headings follow the GitHub -1 suffix');
  assert(html.includes('<a id="四级-标题"></a>'), 'h4 headings get anchors too');
  const links = spawnSync(process.execPath, [path.join(root, 'scripts', 'check-doc-links.js'), '--root', dir, '--all'], { encoding: 'utf8' });
  assert.equal(links.status, 0, links.stdout + links.stderr);
});

test('check-doc-fidelity flags real content parked under the 目录 heading: the converter drops it with the generated sidebar', t => {
  const parked = convert(t, 'Parked', [
    '# Parked 技术设计文档', '', '## 目录', '', '- [1. 概述](#1-概述)', '',
    '**术语表**', '', '| 术语 | 含义 |', '|---|---|', '| 反应杯 | 一次性杯 |', '', '---', '',
    '## 1. 概述', '', '正文。', '',
  ]);
  assert(!parked.html.includes('一次性杯'), 'precondition: the converter drops what sits under 目录');
  const found = fidelity(parked.run, parked.dir);
  assert.equal(found.status, 1, JSON.stringify(found.report));
  assert(kinds(found.report).includes('toc-swallowed'), JSON.stringify(found.report));

  // 负对照：只有目录条目（含嵌套与有序）的目录不报；`---` 之后的正文照常按保真规则比对
  const plain = convert(t, 'PlainToc', [
    '# PlainToc 技术设计文档', '', '## 目录', '', '- [1. 概述](#1-概述)', '  - [1.1 子节](#11-子节)', '2. [2. 细节](#2-细节)', '', '---', '',
    '## 1. 概述', '', '正文。', '', '### 1.1 子节', '', '子节。', '', '## 2. 细节', '', '更多。', '',
  ]);
  const clean = fidelity(plain.run, plain.dir);
  assert.equal(clean.status, 0, JSON.stringify(clean.report));
});
