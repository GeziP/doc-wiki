'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function workspace(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'doc-wiki-pipeline-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function run(script,args,dir){const r=spawnSync(process.execPath,[path.join(root,'scripts',script),...args],{cwd:dir,encoding:'utf8'});assert.ifError(r.error);return r;}
function document(name){return [
 '# '+name,'','## 文档信息','','| 项目 | 内容 |','|---|---|','| 文档版本 | V3.2 |','',
 '## 1. 概述','','> **Scope**：仅验证文档转换、资源接线及引用，不代表业务机制。','',
 '质量报告由源码提供，机器结构检查不证明事实正确。','',
 '依据 {{scripts/lib/quality-report.js:22-28}}。','',
 '> 图 1.1 — 输入与报告的连接关系。','',
 '```mermaid','flowchart LR','  A["输入<br/>正文"] --> B["质量报告"]','```','',
 '```javascript','const code = "{{CODE_ONLY}}";','```','',
 '## 2. 术语表','','报告表示当前输入的检查结果。','',
 '| 术语 | 定义 |','|---|---|','| 报告 | 当前输入的问题集合 |','',
 ].join('\n');}
function populate(dir){
 const paths=['doc/tech-docs/Report_Design.md','doc/Quality_Tooling_System.md','guide.md'];
 for(const p of paths){const f=path.join(dir,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,document(p));}
 return paths;
}
test('mixed module/system/guide batch routes each template and resolves local assets', t=>{
 const dir=workspace(t),files=populate(dir);
 const converted=run('md-to-html.js',files,dir);
 assert.equal(converted.status,0,converted.stdout+converted.stderr);
 for(const [index,p] of files.entries()){
  const html=fs.readFileSync(path.join(dir,p.replace(/\.md$/,'.html')),'utf8');
  const vendor=['../assets/vendor/','assets/vendor/','assets/vendor/'][index];
  assert(html.includes(`src="${vendor}mermaid.min.js"`));
  assert(html.includes('&lt;br/&gt;'));
  assert(html.includes('class="mermaid"'));
  assert(!html.includes('data-lang="mermaid"'));
  assert(html.includes('<figcaption>'));
  assert(html.includes('class="section doc-section"')===(index===2));
  if(index===2){assert(html.includes('class="section-title"'));assert(html.includes('aria-label="Toggle sidebar"'));}
  const checked=run('validate-doc.js',['--new-doc','--json',p.replace(/\.md$/,'.html')],dir);
  assert.equal(checked.status,0,checked.stdout+checked.stderr);
 }
 const all=JSON.parse(run('validate-doc.js',['--all','--json'],dir).stdout);
 assert.equal(all.summary.files,3);
 assert.equal(all.summary.errors,0);
});
test('converter --all, skip, force, dry-run and both indexes work in an external project',t=>{
 const dir=workspace(t);populate(dir);
 for(const type of ['module','system','guide']){
  const result=run('md-to-html.js',['--type',type,'--all'],dir);
  assert.equal(result.status,0,result.stdout+result.stderr);
 }
 const file='doc/tech-docs/Report_Design.md',html=path.join(dir,file.replace('.md','.html'));
 const original=fs.readFileSync(html,'utf8');
 fs.appendFileSync(path.join(dir,file),'\n## 3. 新内容\n\n新版本。\n');
 assert.equal(run('md-to-html.js',[file],dir).status,0);
 assert.equal(fs.readFileSync(html,'utf8'),original);
 assert.equal(run('md-to-html.js',['--force','--dry-run',file],dir).status,0);
 assert.equal(fs.readFileSync(html,'utf8'),original);
 assert.equal(run('md-to-html.js',['--force',file],dir).status,0);
 assert(fs.readFileSync(html,'utf8').includes('新版本。'));
 for(const type of ['module','system']){
  assert.equal(run('md-to-html.js',['--type',type,'--index','实际文档集','测试索引'],dir).status,0);
  const index=path.join(dir,type==='module'?'doc/tech-docs/index.html':'doc/index.html');
  const text=fs.readFileSync(index,'utf8');
  assert(text.includes(type==='module'?'Report_Design.html':'Quality_Tooling_System.html'));
  assert(!text.includes('cdn.jsdelivr.net'));
  assert(!text.includes('CycleScheduler'));
  assert(!text.includes('零外部依赖'));
 }
 assert.equal(run('md-to-html.js',['--type','guide','--index'],dir).status,1);
});
test('converter never overwrites input and reports invalid or absent inputs',t=>{
 const dir=workspace(t),upper=path.join(dir,'doc/tech-docs/Input.MD'),other=path.join(dir,'input.txt');
 fs.mkdirSync(path.dirname(upper),{recursive:true});
 const source=document('Input');fs.writeFileSync(upper,source);fs.writeFileSync(other,source);
 assert.equal(run('md-to-html.js',['--type','module','--force',upper],dir).status,0);
 assert.equal(fs.readFileSync(upper,'utf8'),source);
 assert(fs.existsSync(path.join(path.dirname(upper),'Input.html')));
 assert.equal(run('md-to-html.js',['--force',other],dir).status,1);
 assert.equal(fs.readFileSync(other,'utf8'),source);
 for(const args of [['missing.md'],['--unknown'],['--root'],['--lang'],['--type'],['--type','bad',upper]])assert.equal(run('md-to-html.js',args,dir).status,1,args.join(' '));
 const empty=path.join(dir,'empty');fs.mkdirSync(path.join(empty,'doc','tech-docs'),{recursive:true});
 assert.equal(run('md-to-html.js',['--all','--root',empty],dir).status,1);
 assert.equal(run('md-to-html.js',['--help'],dir).status,0);
});
