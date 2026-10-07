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
function convertModuleDoc(t, name, markdown, docMeta) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-wiki-fidelity-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const targetDir = path.join(dir, 'doc', 'tech-docs');
  fs.mkdirSync(targetDir, { recursive: true });
  if (docMeta) fs.writeFileSync(path.join(targetDir, 'doc-meta.json'), JSON.stringify(docMeta));
  const file = path.join(targetDir, `${name}_Design.md`);
  fs.writeFileSync(file, markdown.join('\n'));
  const run = (script, args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd: dir, encoding: 'utf8' });
  const converted = run('md-to-html.js', ['--type', 'module', '--root', dir, file]);
  assert.equal(converted.status, 0, converted.stdout + converted.stderr);
  const htmlFile = file.replace(/\.md$/, '.html');
  return { html: fs.readFileSync(htmlFile, 'utf8'), htmlFile, run };
}

test('inline code is shielded from emphasis and a lone {{ref}} code span becomes one source link', t => {
  const { html, htmlFile, run } = convertModuleDoc(t, 'Pointer', [
    '# Pointer 技术设计文档', '', '## 1. 概述', '',
    '> **Scope**：覆盖指针签名的转换保真，其他行为不在范围。', '',
    '签名 `void f(const A*, const B*, const C*)` 与 `*this` 必须原样保留，2 * 3 * 4 不是斜体，*强调* 仍然有效。', '',
    '相关源码：`{{src/a.h:3-5}}`、{{src/b.c:7}}，示例 `{{NOT_A_REF}}` 保持字面量。', '',
  ]);
  // 旧顺序（先强调后代码）会吞掉指针星号并在 <code> 内插入 <em>
  assert(html.includes('<code>void f(const A*, const B*, const C*)</code>'), 'pointer signature corrupted');
  assert(html.includes('<code>*this</code>'));
  assert(html.includes('2 * 3 * 4') && !html.includes('<em> 3 </em>'));
  assert(html.includes('<em>强调</em>'));
  assert(html.includes('<a class="source-ref" href="src/a.h#L3-L5"><code>src/a.h:3-5</code></a>'));
  assert(html.includes('<a class="source-ref" href="src/b.c#L7"><code>src/b.c:7</code></a>'));
  assert(html.includes('<code>{{NOT_A_REF}}</code>'));
  assert(!html.includes('<code><a'), '{{ref}} must not be nested inside <code>');
  // 转换器产物必须满足校验器对"实际源码引用标签"的要求（二者契约一致）
  const report = JSON.parse(run('validate-doc.js', ['--json', htmlFile]).stdout);
  assert(!report.issues.some(i => /No source references found/.test(i.message)), JSON.stringify(report.issues));
});

test('repeated appendix headings keep unique ids', t => {
  const { html } = convertModuleDoc(t, 'Appendix', [
    '# Appendix 技术设计文档', '', '## 1. 概述', '', '正文。', '',
    '## 附录 A：快速命令', '', '甲。', '', '### 示例', '', '甲示例。', '',
    '## 附录 B：性能优化', '', '乙。', '', '### 示例', '', '乙示例。', '',
  ]);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dup, [], `duplicate ids: ${dup}`);
  assert(html.includes('id="sec-appendix"') && html.includes('id="sec-appendix-2"'));
});

test('doc-meta.json sets the top-bar brand and an auto source-link base', t => {
  const { html } = convertModuleDoc(t, 'Branded', [
    '# Branded 技术设计文档', '', '## 1. 概述', '', '实现见 {{src/a.h:3-5}}。', '',
  ], { brand: 'ACME', sourceBase: 'auto' });
  assert(html.includes('<span class="topbar-brand">ACME</span>'));
  assert(html.includes('href="../../src/a.h#L3-L5"'), 'doc/tech-docs/X.html -> project root is ../..');
});
