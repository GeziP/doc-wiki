'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '..', 'scripts', 'check-doc-links.js');

function project(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-wiki-links-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return dir;
}
const page = body => `<html><head><title>t</title></head><body>${body}</body></html>`;
function check(dir, ...args) {
  const r = spawnSync(process.execPath, [script, '--json', '--root', dir, ...args], { cwd: dir, encoding: 'utf8' });
  return { status: r.status, report: r.stdout ? JSON.parse(r.stdout) : null, stderr: r.stderr };
}
const kinds = report => (report.files || []).flatMap(f => f.issues.map(i => i.kind)).sort();

test('good links pass; dead targets, dead anchors and Markdown-with-twin links fail', t => {
  const dir = project(t, {
    'doc/a.html': page([
      '<a href="b.html#ok">ok</a>', '<a href="b.html#nope">dead anchor</a>', '<a href="missing.html">dead target</a>',
      '<a href="c.md">to md with twin</a>', '<a href="d.md">md only</a>', '<a href="https://example.com/x.md">external</a>',
      '<a href="#here">same page ok</a>', '<a href="#gone">same page dead</a>', '<h2 id="here">h</h2>',
      '<a href="b.html?x=1#ok">query ok</a>', '<a href="%E4%B8%AD.html">encoded ok</a>',
    ].join('\n')),
    'doc/b.html': page('<h2 id="ok">x</h2>'),
    'doc/c.md': '# c', 'doc/c.html': page(''),
    'doc/d.md': '# d',
    'doc/中.html': page(''),
  });
  const { status, report } = check(dir, '--all');
  assert.equal(status, 1);
  assert.deepEqual(kinds(report), ['md-link-with-twin', 'missing-anchor', 'missing-anchor', 'missing-target']);
  assert.equal(report.summary.errors, 4);
});

test('source references: a missing file is an error, a drifted line range only fails under --strict', t => {
  const dir = project(t, {
    'doc/a.html': page('<a class="source-ref" href="../src/x.cpp#L1-L2">ok</a><a class="source-ref" href="../src/x.cpp#L5-L99">drifted</a><a class="source-ref" href="../src/gone.cpp#L1">gone</a>'),
    'src/x.cpp': 'a\nb\nc\n',
  });
  const mixed = check(dir, '--all');
  assert.deepEqual(kinds(mixed.report), ['line-out-of-range', 'missing-target']);
  assert.equal(mixed.status, 1);

  const onlyDrift = project(t, { 'doc/a.html': page('<a href="../src/x.cpp#L5-L99">drifted</a>'), 'src/x.cpp': 'a\nb\nc\n' });
  assert.equal(check(onlyDrift, '--all').status, 0);
  assert.equal(check(onlyDrift, '--all', '--strict').status, 1);
});

test('links inside script/style/comments are ignored; no targets or a missing file is exit 2, never a silent pass', t => {
  const dir = project(t, {
    'doc/a.html': page('<script>var s = \'<a href="ghost.html">x</a>\';</script><!-- <a href="ghost2.html">x</a> --><p>ok</p>'),
  });
  const quiet = check(dir, '--all');
  assert.equal(quiet.status, 0, JSON.stringify(quiet.report));
  assert.equal(quiet.report.summary.links, 0);

  const empty = project(t, { 'readme.txt': 'x' });
  assert.equal(check(empty, '--all').status, 2);
  assert.equal(check(empty, 'nope.html').status, 2);
});

test('reported line numbers are real file lines even after multi-line script, style and comment blocks', t => {
  const body = ['', '<style>', 'a { color: red; }', '</style>', '<script>', 'var x = 1;', '</script>', '<!--', 'note', '-->', '<a href="gone.html">dead</a>'].join('\n');
  const dir = project(t, { 'doc/a.html': page(body) });
  const { status, report } = check(dir, '--all');
  assert.equal(status, 1);
  assert.equal(report.files[0].issues[0].line, 11);
});
