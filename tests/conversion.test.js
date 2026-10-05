'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
test('actual source references survive language lint -> conversion -> HTML validation', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-wiki-conversion-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const targetDir = path.join(dir, 'doc', 'tech-docs');
  fs.mkdirSync(targetDir, { recursive: true });
  const file = path.join(targetDir, 'QualityReport_Design.md');
  const text = [
    '# QualityReport 技术设计文档', '', '## 文档信息', '',
    '| 项目 | 内容 |', '|---|---|', '| 文档版本 | V2.7 |', '', '## 1. 概述', '',
    '> **Scope**：覆盖问题身份生成，其他行为不在本例范围。', '',
    '问题身份不包含行号。', '', '对应实现 {{scripts/lib/quality-report.js:22-28}}。', '',
    '```javascript', 'const example = "{{CODE_ONLY}}";', '```', '',
    '```cpp', 'std::shared_ptr<T> x; a && b;', '```', '',
    '## 术语表', '', '问题身份用于基线匹配。', '',
    '| 术语 | 定义 | 出处 |', '|---|---|---|',
    '| 问题身份 | 内容摘要 | {{scripts/lib/quality-report.js:22}} |', '',
  ].join('\n');
  fs.writeFileSync(file, text);
  const run = (script, args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
  const language = run('lint-doc-language.js', ['--json', file]);
  assert.equal(language.status, 0, language.stdout + language.stderr);
  assert.equal(JSON.parse(language.stdout).summary.errors, 0);
  const converted = run('md-to-html.js', ['--type', 'module', file]);
  assert.equal(converted.status, 0, converted.stdout + converted.stderr);
  const htmlFile = file.replace(/\.md$/, '.html');
  const html = fs.readFileSync(htmlFile, 'utf8');
  assert(html.includes('href="scripts/lib/quality-report.js#L22-L28"'));
  assert(html.includes('href="scripts/lib/quality-report.js#L22"'));
  assert(!html.includes('#L22-L-28'));
  assert(html.includes('{{CODE_ONLY}}'));
  assert(html.includes('<span class="doc-version">V2.7</span>'));
  assert(html.includes('std::shared_ptr&lt;T&gt; x; a &amp;&amp; b;'));
  assert(!html.includes('&amp;lt;T'));
  assert(fs.existsSync(path.join(dir, 'doc', 'assets', 'vendor', 'mermaid.min.js')));
  const checked = run('validate-doc.js', ['--json', '--new-doc', htmlFile]);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.equal(JSON.parse(checked.stdout).summary.errors, 0);
});
