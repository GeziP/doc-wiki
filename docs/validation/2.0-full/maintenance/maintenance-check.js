const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const production = path.resolve(root, '../../..');
const base = 'eae95fedda3578aca9858764a29ef6a116c37504';
const doc = 'doc/tech-docs/Lint_Doc_Language_Design.md';
const html = doc.replace(/md$/, 'html');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const readBase = file => {
  const r = cp.spawnSync('git', ['show', `${base}:${file}`], {cwd: production});
  assert.equal(r.status, 0, r.stderr.toString());
  return r.stdout;
};
const run = (name, args) => {
  const r = cp.spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8'});
  fs.writeFileSync(path.join(__dirname, name), r.stdout);
  return {args, exit: r.status, stderr:r.stderr};
};
if (process.argv[2] === 'before') {
  fs.copyFileSync(path.join(root, doc), path.join(__dirname, 'before.md'));
  fs.copyFileSync(path.join(root, html), path.join(__dirname, 'before.html'));
  const results = [
    run('before-html.json', ['scripts/validate-doc.js', '--new-doc', '--json', html]),
    run('before-language.json', ['scripts/lint-doc-language.js', '--mode', 'explain', '--json', doc]),
  ];
  const tools = ['scripts/validate-doc.js','scripts/lint-doc-language.js','scripts/md-to-html.js'].map(file => ({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
  fs.writeFileSync(path.join(__dirname, 'before-run.json'), JSON.stringify({node:process.version, results, tools}, null, 2));
  console.log(JSON.stringify(results));
} else {
  const oldSource = readBase('scripts/lint-doc-language.js').toString();
  const current = fs.readFileSync(path.join(root,'scripts/lint-doc-language.js'),'utf8');
  assert.equal(current.replace(/\r\n/g,'\n'), oldSource.replace(/\r\n/g,'\n').replace("mode === 'strict' ? 50 : 70", "mode === 'strict' ? 55 : 70"));
  for (const file of ['scripts/lib/prose.js','scripts/lib/quality-report.js','scripts/lib/source-reference.js']) assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),readBase(file).toString().replace(/\r\n/g,'\n'));
  const previous = new Module(path.join(root, 'scripts/lint-doc-language.js'), module);
  previous.filename = path.join(root, 'scripts/lint-doc-language.js');
  previous.paths = Module._nodeModulePaths(path.dirname(previous.filename));
  previous._compile(oldSource, previous.filename);
  const old = previous.exports;
  const now = require('../scripts/lint-doc-language');
  assert.deepEqual(Object.keys(now), Object.keys(old));
  const rows = [];
  const count = (api,text,mode,extra={}) => api.lint(text,{mode,...extra}).filter(i=>i.rule==='long-sentence').length;
  for (const n of [50,51,54,55,56,70,71]) for (const mode of ['strict','explain']) {
    const oldCount = count(old,'中'.repeat(n)+'。',mode), newCount = count(now,'中'.repeat(n)+'。',mode);
    assert.equal(oldCount, +(n>(mode==='strict'?50:70)));
    assert.equal(newCount, +(n>(mode==='strict'?55:70)));
    rows.push({unit:'U+3400..U+9FFF characters', n,mode,old:oldCount,new:newCount});
  }
  for(const n of [20,21,25,26]) for(const mode of ['strict','explain']) {
    const text=Array(n).fill('condition').join(' ');
    assert.equal(count(old,text,mode),count(now,text,mode));
    assert.equal(count(now,text,mode),+(n>(mode==='strict'?20:25)));
    rows.push({unit:'English words',n,mode,old:count(old,text,mode),new:count(now,text,mode)});
  }
  assert.equal(count(now,'中'.repeat(55)+' condition '.repeat(21),'strict'),1);
  assert.equal(count(now,'中'.repeat(55)+'1😀𠀀'.repeat(20),'strict'),0);
  assert.equal(count(now,'中'.repeat(56),'strict',{disabled:['long-sentence']}),0);
  assert.equal(count(now,'中'.repeat(30)+'\n'+'中'.repeat(30),'strict'),0);
  assert.equal(count(now,'<p>'+'中'.repeat(55)+'</p>','strict',{format:'html'}),0);
  assert.equal(count(now,'<p>'+'中'.repeat(56)+'</p>','strict',{format:'html'}),1);
  for(const n of [55,56]) {
    const file = `checks/boundary-${n}.md`;
    fs.writeFileSync(path.join(root,file),'中'.repeat(n)+'。');
    const without=run(`cli-${n}-advisory.json`,['scripts/lint-doc-language.js','--mode','strict','--json',file]);
    const strict=run(`cli-${n}-blocking.json`,['scripts/lint-doc-language.js','--mode','strict','--strict','--json',file]);
    assert.equal(without.exit,0); assert.equal(strict.exit,n===55?0:2);
  }
  const before = JSON.parse(fs.readFileSync(path.join(__dirname,'before-run.json')));
  for(const t of before.tools) assert.equal(hash(fs.readFileSync(path.join(root,t.file))),t.sha256);
  const results = [
    run('after-html.json',['scripts/validate-doc.js','--new-doc','--json','--baseline','checks/before-html.json',html]),
    run('after-language.json',['scripts/lint-doc-language.js','--mode','explain','--json','--baseline','checks/before-language.json',doc]),
  ];
  fs.writeFileSync(path.join(__dirname,'after-run.json'),JSON.stringify({results,tools:before.tools},null,2));
  fs.writeFileSync(path.join(__dirname,'boundary-results.json'),JSON.stringify({baseCommit:base,oldSourceSha256:hash(oldSource),currentSourceSha256:hash(current),rows,extraCases:'mixed English OR, excluded non-CJK, disabled rule, physical-line split, HTML 55/56, CLI --mode versus --strict all passed'},null,2));
  console.log(JSON.stringify({rows:rows.length,results}));
}
