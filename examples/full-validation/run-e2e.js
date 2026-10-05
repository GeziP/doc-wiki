'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'../..');
const results = path.join(__dirname,'results');
fs.mkdirSync(results,{recursive:true});
const records=[];
function run(name,args,expected) {
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
  fs.writeFileSync(path.join(results,name+'.txt'),r.stdout+'\n'+r.stderr);
  records.push({name,args,cwd:root,status:r.status,expected});
  fs.writeFileSync(path.join(results,'commands.json'),JSON.stringify(records,null,2));
  assert.ifError(r.error); assert.equal(r.status,expected,name+': '+r.stdout+r.stderr);
  return r;
}
run('create',['examples/full-validation/create-example.js'],0);
const md='examples/full-validation/doc/tech-docs/Example_Design.md';
const created=fs.readFileSync(path.join(root,md),'utf8');
for(const [,file,start,end] of created.matchAll(/\{\{([^{}\n]+):([1-9]\d*)(?:-([1-9]\d*))?\}\}/g)) {
  const target=path.resolve(root,path.dirname(md),file);
  assert(fs.existsSync(target),'Missing source reference: '+target);
  assert(Number(end||start)<=fs.readFileSync(target,'utf8').split('\n').length,'Source reference out of range');
}
const language=['scripts/lint-doc-language.js','--mode','strict','--strict','--terms','examples/full-validation/terms.json','--json',md];
const clean=run('language',language,0);
assert.deepEqual(JSON.parse(clean.stdout).summary,{files:1,errors:0,warnings:0});
run('conversion',['scripts/md-to-html.js','--type','module','--force',md],0);
run('html',['scripts/validate-doc.js','--new-doc','--strict','--json',md.replace('.md','.html')],0);
const before='examples/full-validation/results/before-language.json';
fs.writeFileSync(path.join(root,before),clean.stdout);
const original=fs.readFileSync(path.join(root,md),'utf8');
fs.appendFileSync(path.join(root,md),'\n新增正文 {{UNRESOLVED}}。\n');
const compared=[...language,'--baseline',before];
try {
const blocked=run('injected',compared,1);
assert.equal(JSON.parse(blocked.stdout).baseline.added.filter(i=>i.severity==='error').length,1);
} finally {
fs.writeFileSync(path.join(root,md),original);
}
const repaired=run('repaired',compared,0);
assert.equal(JSON.parse(repaired.stdout).baseline.added.length,0);
console.log('End-to-end example passed; Markdown restored.');
