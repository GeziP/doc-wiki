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
