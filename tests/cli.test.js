'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
function run(script, args, cwd = root) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { encoding: 'utf8', cwd });
  assert.equal(r.error, undefined);
  return r;
}
function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-wiki-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function json(r) {
  assert(!r.stdout.includes('\x1b'));
  return JSON.parse(r.stdout);
}

test('language CLI exits 0 for warnings, 2 for strict warnings, 1 for errors', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.md');
  fs.writeFileSync(file, 'A seamless operation.');
  const normal = run('lint-doc-language.js', ['--json', file], dir);
  assert.equal(normal.status, 0);
  assert.equal(json(normal).summary.warnings, 1);
  assert.equal(run('lint-doc-language.js', ['--strict', '--json', file], dir).status, 2);
  fs.writeFileSync(file, '{{NAME}}');
  assert.equal(run('lint-doc-language.js', ['--json', file], dir).status, 1);
  for (const args of [['--mode', 'unknown', file], ['--disable', 'unknown', file], ['--terms'], ['--bad', file]]) {
    const r = run('lint-doc-language.js', ['--json', ...args], dir);
    assert.equal(r.status, 1);
    assert(json(r).fatal);
  }
});

test('language CLI baseline compares new findings, fixes, duplicates and configuration', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.md'), baseline = path.join(dir, 'baseline.json');
  fs.writeFileSync(file, '{{OLD}}');
  const before = run('lint-doc-language.js', ['--json', file], dir);
  fs.writeFileSync(baseline, before.stdout);
  const args = ['--json', '--baseline', baseline, file];
  assert.equal(run('lint-doc-language.js', args, dir).status, 0);
  fs.writeFileSync(file, '\n\n{{OLD}}');
  assert.equal(run('lint-doc-language.js', args, dir).status, 0);
  fs.writeFileSync(file, '{{NEW}}');
  const changed = run('lint-doc-language.js', args, dir);
  assert.equal(changed.status, 1);
  assert.equal(json(changed).baseline.resolved.length, 1);
  fs.writeFileSync(file, '{{OLD}}\n{{OLD}}');
  assert.equal(run('lint-doc-language.js', args, dir).status, 1);
  fs.writeFileSync(file, 'Clear text.');
  assert.equal(run('lint-doc-language.js', args, dir).status, 0);
  const mismatch = run('lint-doc-language.js', [...args, '--mode', 'strict'], dir);
  assert.equal(mismatch.status, 1);
  assert(json(mismatch).fatal.includes('configuration'));
});

test('HTML validator preserves legacy output and clean JSON; all deduplicates targets', () => {
  const file = path.join(root, 'doc', 'Doc_Wiki_System_Architecture.html');
  const legacy = run('validate-doc.js', [file]);
  assert.equal(legacy.status, 0);
  assert(legacy.stdout.includes('No source references found'));
  const structured = run('validate-doc.js', ['--all', '--json']);
  assert.equal(structured.status, 0);
  const report = json(structured);
  assert.equal(report.summary.files, report.targets.length);
  assert.equal(new Set(report.targets).size, report.targets.length);
  assert(report.targets.includes('doc/Doc_Wiki_System_Architecture.html'));
  assert.equal(report.summary.errors, 0);
  assert(report.issues.some(i => i.file === 'doc/Doc_Wiki_System_Architecture.html' && i.rule === 'html/源码引用'));
  assert(report.issues.every(i => i.severity === 'warning' &&
    (i.rule === 'html/Content Density' ||
     (i.file === 'doc/Doc_Wiki_System_Architecture.html' && i.rule === 'html/源码引用'))));
  assert(report.files[0].checks.length > 10);
});

test('source references require rendered tags and accept reordered attributes', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.html');
  for (const [body, expected] of [
    ['<p>&lt;a class="source-ref" href="file.js#L1"&gt;example&lt;/a&gt;</p>', false],
    ['<pre><code>&lt;a class="source-ref"&gt;</code></pre>', false],
    ['<!-- <a class="source-ref" href="file.js#L1"> -->', false],
    ["<a href='file.js#L1-L3' class='extra source-ref'>file</a>", true],
    ['<div class="sources-block">Sources</div>', true],
  ]) {
    fs.writeFileSync(file, `<html><head><title>Test</title></head><body>${body}</body></html>`);
    const r = json(run('validate-doc.js', ['--new-doc', '--json', file], dir));
    assert.equal(r.issues.some(i => i.rule === 'html/源码引用' && i.severity === 'error'), !expected);
  }
});

test('HTML --fix stays machine-readable and baseline detects new content regressions', t => {
  const dir = workspace(t), file = path.join(dir, 'legacy.html'), baseline = path.join(dir, 'baseline.json');
  fs.writeFileSync(file, '<!DOCTYPE html><html><head><title>Legacy</title></head><body><h2>Overview</h2><pre><code>x</code></pre></body></html>');
  const fixed = run('validate-doc.js', ['--fix', '--json', file], dir);
  assert(json(fixed).files[0].checks.some(c => c.status === 'fixed'));
  assert(fs.readFileSync(file, 'utf8').includes('id='));
  const before = run('validate-doc.js', ['--json', file], dir);
  fs.writeFileSync(baseline, before.stdout);
  assert.equal(run('validate-doc.js', ['--json', '--baseline', baseline, file], dir).status, 0);
  fs.appendFileSync(file, '<img src="https://example.com/image.png">');
  const after = run('validate-doc.js', ['--json', '--baseline', baseline, file], dir);
  assert.equal(after.status, 1);
  assert(json(after).baseline.added.some(i => i.severity === 'error'));
});

test('missing inputs, empty scans and unknown options cannot silently pass', t => {
  const dir = workspace(t);
  for (const script of ['validate-doc.js', 'lint-doc-language.js']) {
    const r = run(script, ['--json', 'missing.html'], dir);
    assert.equal(r.status, 1);
    assert.equal(json(r).issues[0].rule, 'input/read');
  }
  for (const args of [['--all'], ['--type', 'bad', 'doc.html'], ['--root'], ['--unknown']]) {
    const r = run('validate-doc.js', ['--json', ...args], dir);
    assert.equal(r.status, 1);
    assert(json(r).fatal);
  }
});

test('term CLI validates actual files, accepts BOM, and does not modify input', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.md'), terms = path.join(dir, 'terms.json');
  const source = '任务 Task。作业可能失败。';
  fs.writeFileSync(file, source);
  fs.writeFileSync(terms, '\uFEFF' + JSON.stringify({ version: 1, terms: [{ canonical: '任务', aliases: ['Task'], forbidden: ['作业'] }] }));
  const r = run('lint-doc-language.js', ['--json', '--terms', terms, file], dir);
  assert.equal(r.status, 1);
  assert.equal(json(r).issues[0].rule, 'forbidden-term');
  assert.equal(fs.readFileSync(file, 'utf8'), source);
  fs.writeFileSync(terms, '{bad');
  const invalid = run('lint-doc-language.js', ['--json', '--terms', terms, file], dir);
  assert.equal(invalid.status, 1);
  assert(json(invalid).fatal);
});

test('strict warning baselines, schema BOM and rule configuration remain coherent', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.md'), baseline = path.join(dir, 'baseline.json');
  fs.writeFileSync(file, 'A seamless operation.');
  const before = run('lint-doc-language.js', ['--strict', '--json', file], dir);
  fs.writeFileSync(baseline, '\uFEFF' + before.stdout);
  const args = ['--strict', '--json', '--baseline', baseline, file];
  assert.equal(run('lint-doc-language.js', args, dir).status, 0);
  fs.appendFileSync(file, '\nA world-class operation.');
  assert.equal(run('lint-doc-language.js', args, dir).status, 2);
  const changed = run('lint-doc-language.js', [...args, '--disable', 'marketing'], dir);
  assert.equal(changed.status, 1);
  assert(json(changed).fatal);
});

test('same-count HTML defects cannot hide a replacement structure', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.html'), baseline = path.join(dir, 'baseline.json');
  const source = name => `<html><head><title>Test</title></head><body><div class="table-wrapper"><table><tr><td>${name}</td></tr></table></div></body></html>`;
  fs.writeFileSync(file, source('OLD'));
  fs.writeFileSync(baseline, run('validate-doc.js', ['--json', file], dir).stdout);
  fs.writeFileSync(file, source('NEW'));
  const r = run('validate-doc.js', ['--strict', '--json', '--baseline', baseline, file], dir);
  // Strict itself changes the profile, so a caller cannot switch gates during comparison.
  assert.equal(r.status, 1);
  assert(json(r).fatal);
  const compared = run('validate-doc.js', ['--json', '--baseline', baseline, file], dir);
  assert(json(compared).baseline.added.some(i => i.rule === 'html/表格'));
});

test('mermaid validator accepts single-level entities and rejects double escaping', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.html');
  for (const [body, shouldFail] of [
    ['<pre class="mermaid">flowchart LR\n  A["a&lt;br/&gt;b"] --&gt; B["vector&lt;T&gt;"]</pre>', false],
    ['<pre class="mermaid">flowchart LR\n  A --&amp;gt; B</pre>', true],
  ]) {
    fs.writeFileSync(file, `<html><head><title>Test</title></head><body>${body}</body></html>`);
    const r = json(run('validate-doc.js', ['--json', file], dir));
    assert.equal(r.issues.some(i => i.rule === 'html/Mermaid 块' && i.severity === 'error'), shouldFail);
  }
});

test('legacy validator handles escaped code, real escaped markup and legal exceptions', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.html');
  for (const [body, shouldFail] of [
    ['<pre><code class="language-cpp">std::shared_ptr&lt;T&gt; x; a &amp;&amp; b;</code></pre>', false],
    ['<p>&lt;div id="bad"&gt;</p>', true],
    ['<p><code>&lt;section&gt;</code></p>', false],
    ['<figure><svg role="img" aria-label="Legacy"></svg><figcaption>Legacy figure</figcaption></figure>', false],
  ]) {
    fs.writeFileSync(file, `<html><head><title>Test</title></head><body>${body}</body></html>`);
    const r = json(run('validate-doc.js', ['--json', file], dir));
    assert.equal(r.issues.some(i => i.rule === 'html/HTML 转义回归' && i.severity === 'error'), shouldFail);
  }
});

test('mermaid caption check inspects every diagram, whether the caption is in the wrap or in an enclosing figure', t => {
  const dir = workspace(t), file = path.join(dir, 'doc.html');
  const wrap = (cap = '') => `<div class="mermaid-wrap"><pre class="mermaid">\nflowchart LR\n  A --&gt; B\n</pre>${cap}</div>`;
  const body = [
    wrap('<figcaption>图 1.1 — 有图注</figcaption>'),
    wrap(),                                                          // 第 2 张没有图注：旧的贪婪窗口会把它吞进第 1 张的窗口而漏报
    `<figure>${wrap()}<figcaption>图 2：手写 figure 里的图注</figcaption></figure>`,
    wrap('<figcaption>没有编号的图注</figcaption>'),
  ].join('\n');
  fs.writeFileSync(file, `<html><head><title>Test</title></head><body>${body}</body></html>`);
  const messages = json(run('validate-doc.js', ['--json', file], dir)).issues.filter(i => i.rule === 'html/Figure Captions').map(i => i.message);
  assert.deepEqual(messages.map(m => m.match(/#(\d+)/)[1]), ['2', '4'], messages.join(' | '));
});
