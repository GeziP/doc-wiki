'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const mdPath = path.join(root,'doc/tech-docs/Lint_Doc_Language_Design.md');
const md = fs.readFileSync(mdPath,'utf8');
function run(args) {
  const result = spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
  assert.ifError(result.error);
  return result;
}
function sandbox(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'doc-wiki-skill-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
}

test('actual guide example resolves source references and blocks then repairs a regression', t => {
  const dir=sandbox(t);
  for(const folder of ['scripts','templates','examples/full-validation'])
    fs.cpSync(path.join(root,folder),path.join(dir,folder),{recursive:true,filter:p=>!p.includes(path.sep+'results')&&!p.includes(path.sep+'doc'+path.sep)});
  const result=spawnSync(process.execPath,['examples/full-validation/run-e2e.js'],{cwd:dir,encoding:'utf8'});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const commands=JSON.parse(fs.readFileSync(path.join(dir,'examples/full-validation/results/commands.json'),'utf8'));
  assert.equal(commands.find(c=>c.name==='injected').status,1);
  assert.equal(commands.find(c=>c.name==='repaired').status,0);
  assert(!fs.readFileSync(path.join(dir,'examples/full-validation/doc/tech-docs/Example_Design.md'),'utf8').includes('UNRESOLVED'));
});
test('actual skill document CLI examples reproduce described findings', () => {
  const commands = [...md.matchAll(/^node scripts\/lint-doc-language\.js[^\r\n]*$/gm)]
    .map(m=>m[0]).filter(s=>!s.includes('baseline') && !s.endsWith('|'));
  assert.equal(commands.length,4);
  for (const [index, command] of commands.entries()) {
    const result = run(command.split(/\s+/).slice(1));
    assert.equal(result.status,[0,2,0,1][index]);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.errors,[0,0,0,1][index]);
    assert.equal(report.summary.warnings,[1,1,3,0][index]);
  }
});
test('actual skill Markdown converts reproducibly with real references and local assets', t => {
  const dir=sandbox(t), file=path.join(dir,'doc/tech-docs/Lint_Doc_Language_Design.md');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.copyFileSync(mdPath,file);
  assert.equal(run(['scripts/md-to-html.js','--type','module',file]).status,0);
  const html=fs.readFileSync(file.replace(/\.md$/,'.html'),'utf8');
  // Git checkout may normalize CRLF on Windows and LF on Linux.
  assert.equal(html.replace(/\r\n/g,'\n'),fs.readFileSync(mdPath.replace(/\.md$/,'.html'),'utf8').replace(/\r\n/g,'\n'));
  const checked=run(['scripts/validate-doc.js','--new-doc','--strict','--json',file.replace(/\.md$/,'.html')]);
  assert.equal(checked.status,0);
  assert.equal(JSON.parse(checked.stdout).summary.errors,0);
  assert(html.includes('<svg '));
  assert(!html.includes('&lt;a class="source-ref"'));
  const references=[...md.matchAll(/\{\{([^{}\n]+):([1-9]\d*)(?:-([1-9]\d*))?\}\}/g)];
  assert(references.length>30);
  for(const [,ref,start,end] of references) {
    const target=path.resolve(path.dirname(mdPath),ref);
    assert(target.startsWith(root+path.sep));
    const count=fs.readFileSync(target,'utf8').split(/\r?\n/).length;
    assert(Number(start)<=count && (!end || Number(end)<=count),ref);
  }
});
test('actual skill document baseline blocks injected regression and accepts repair', t => {
  const dir=sandbox(t), file=path.join(dir,'document.md'), base=path.join(dir,'before.json');
  fs.writeFileSync(file,md);
  const args=['scripts/lint-doc-language.js','--mode','explain','--strict','--json',file];
  const before=run(args);
  assert.equal(before.status,0);
  fs.writeFileSync(base,before.stdout);
  fs.appendFileSync(file,'\n实际新增占位符 {{UNRESOLVED_REAL_DOCUMENT}}。\n');
  const after=run([...args,'--baseline',base]);
  assert.equal(after.status,1);
  assert.equal(JSON.parse(after.stdout).baseline.added.filter(i=>i.severity==='error').length,1);
  fs.writeFileSync(file,md);
  const repaired=run([...args,'--baseline',base]);
  assert.equal(repaired.status,0);
  assert.equal(JSON.parse(repaired.stdout).baseline.added.length,0);
});
