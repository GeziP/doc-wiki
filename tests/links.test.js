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
  // GIT_CEILING_DIRECTORIES：临时目录若恰好落在某个 git 仓库里，别让 git 往上找到它——“不是 git 工作区”的用例才可复现
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(dir) };
  const r = spawnSync(process.execPath, [script, '--json', '--root', dir, ...args], { cwd: dir, encoding: 'utf8', env });
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

test('a source reference to an .html source file is a line reference, not a page anchor', t => {
  const dir = project(t, {
    'doc/a.html': page([
      '<a class="source-ref" href="../web/index.html#L2">in range</a>',
      '<a class="source-ref" href="../web/index.html#L5-L99">drifted</a>',
      '<a href="../web/index.html#L2">ordinary page link</a>',
    ].join('\n')),
    'web/index.html': '<html>\n<body>\n</body>\n</html>\n',
  });
  const found = check(dir, '--all');
  // source-ref 只按行数校验（#L2 通过，#L5-L99 越界告警）；没有 class="source-ref" 的普通页面链接仍按 id/name 校验
  assert.deepEqual(kinds(found.report), ['line-out-of-range', 'missing-anchor'], JSON.stringify(found.report));
  assert.equal(found.status, 1);
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

// ---- 目标是否被 git 跟踪：工作区里“存在”不等于“别人克隆下来也有” ----
const hasGit = spawnSync('git', ['--version']).status === 0;
const caseInsensitiveFs = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-wiki-case-'));
  try { fs.writeFileSync(path.join(d, 'a'), ''); return fs.existsSync(path.join(d, 'A')); } finally { fs.rmSync(d, { recursive: true, force: true }); }
})();

// 建一个真的 git 工程：stage 里的文件进索引（只暂存、不提交，索引里有就算“已跟踪”），ignore 写进 .gitignore
function gitProject(t, files, { stage = [], ignore = '', gitlinks = [] } = {}) {
  const dir = project(t, ignore ? { ...files, '.gitignore': ignore } : files);
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  };
  git('init', '-q');
  if (stage.length) git('add', '--', ...stage);
  for (const p of gitlinks) git('update-index', '--add', '--cacheinfo', `160000,${'a'.repeat(40)},${p}`);   // 子模块：索引里只有目录这一条
  return dir;
}
const messages = report => (report.files || []).flatMap(f => f.issues.map(i => i.message));
const severities = report => (report.files || []).flatMap(f => f.issues.map(i => i.severity));

test('a target that exists on disk but git does not track: warning by default, error under --require-tracked', { skip: !hasGit && 'git is not installed' }, t => {
  const dir = gitProject(t, {
    'doc/a.html': page([
      '<a href="../src/tracked.cpp">tracked</a>',
      '<img src="../shots/05-run.png">',                              // 被 .gitignore 排除：作者机器上有，别人克隆没有
      '<a class="source-ref" href="../src/fresh.cpp#L1">fresh</a>',    // 存在但从没 git add
      '<a href="../notes/local.md">markdown without a twin</a>',       // 非 HTML 目标也要查，不能被 .md 分支提前 continue 掉
    ].join('\n')),
    'src/tracked.cpp': 'x\n', 'src/fresh.cpp': 'x\n', 'shots/05-run.png': 'png', 'notes/local.md': '# n',
  }, { stage: ['doc/a.html', 'src/tracked.cpp'], ignore: 'shots/\nnotes/\n' });

  const plain = check(dir, '--all');
  assert.deepEqual(kinds(plain.report), ['untracked-target', 'untracked-target', 'untracked-target'], JSON.stringify(plain.report));
  assert.deepEqual(severities(plain.report), ['warning', 'warning', 'warning']);
  assert.equal(plain.status, 0, 'a warning alone must not change the exit code of existing users');
  assert.equal(plain.report.summary.tracking, 'checked');
  const text = messages(plain.report).join('\n');
  assert.match(text, /shots\/05-run\.png[^\n]*\.gitignore:1[^\n]*shots\//, '被忽略的目标要说出是哪条规则');
  assert.match(text, /src\/fresh\.cpp[^\n]*never added to git/, '没被忽略的要说“从没 git add”');

  const strictFlag = check(dir, '--all', '--require-tracked');
  assert.deepEqual(severities(strictFlag.report), ['error', 'error', 'error']);
  assert.equal(strictFlag.report.summary.tracking, 'required');
  assert.equal(strictFlag.status, 1);
  assert.equal(check(dir, '--all', '--strict').status, 1, '--strict 照旧把 warning 当失败');
});

test('tracked targets pass: files, directories, staged-but-uncommitted files, non-ASCII paths and files under a gitlink', { skip: !hasGit && 'git is not installed' }, t => {
  const dir = gitProject(t, {
    'doc/a.html': page([
      '<a href="../src/">directory</a>', '<a href="../src/x.cpp#L1">file</a>', '<a href="%E4%B8%AD%E6%96%87/%E9%A1%B5.html">non-ASCII</a>',
      '<a class="source-ref" href="../vendor/lib/x.c#L1">inside a submodule</a>',
    ].join('\n')),
    'doc/中文/页.html': page(''), 'src/x.cpp': 'x\n', 'vendor/lib/x.c': 'x\n',   // vendor/lib 只有 gitlink 一条，里面的文件 git 不列出
  }, { stage: ['doc/a.html', 'doc/中文/页.html', 'src/x.cpp'], gitlinks: ['vendor/lib'] });
  const { status, report } = check(dir, '--all', '--require-tracked');
  assert.equal(status, 0, JSON.stringify(report));
  assert.deepEqual(kinds(report), []);
});

test('outside a git work tree the tracking check is skipped by default and is exit 2 under --require-tracked, never a silent pass', t => {
  const dir = project(t, { 'doc/a.html': page('<a href="../src/x.cpp">x</a>'), 'src/x.cpp': 'x\n' });
  const plain = check(dir, '--all');
  assert.equal(plain.status, 0);
  assert.deepEqual(kinds(plain.report), []);
  assert.equal(plain.report.summary.tracking, 'skipped', '调用方要能看出入库检查没有执行');
  const required = check(dir, '--all', '--require-tracked');
  assert.equal(required.status, 2);
  assert.match(required.report.fatal, /require-tracked/);
});

test('a path whose case differs from the tracked one is flagged: it opens on Windows/macOS and is a dead link on Linux', { skip: !(hasGit && caseInsensitiveFs) && 'needs git and a case-insensitive file system' }, t => {
  const dir = gitProject(t, { 'doc/a.html': page('<a href="../Src/X.cpp">x</a>'), 'src/x.cpp': 'x\n' }, { stage: ['doc/a.html', 'src/x.cpp'] });
  const { status, report } = check(dir, '--all', '--require-tracked');
  assert.equal(status, 1);
  assert.deepEqual(kinds(report), ['untracked-target']);
  assert.match(messages(report)[0], /case differs[^\n]*src\/x\.cpp/);
});
