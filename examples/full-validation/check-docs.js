'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const logs=path.join(root,'docs/validation/full-generation');
fs.mkdirSync(logs,{recursive:true});
const records=[];
function run(name,args) {
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:{...process.env,TEMP:path.join(logs,'test-tmp'),TMP:path.join(logs,'test-tmp')}});
  fs.writeFileSync(path.join(logs,name+'.txt'),r.stdout+'\n'+r.stderr);
  let summary; try {const report=JSON.parse(r.stdout);summary={summary:report.summary,issues:report.issues,fatal:report.fatal};}catch{}
  records.push({name,args,status:r.status,cwd:root,error:r.error?.message,...summary});
  fs.writeFileSync(path.join(logs,'commands.json'),JSON.stringify(records,null,2));
}
fs.mkdirSync(path.join(logs,'test-tmp'),{recursive:true});
const snapshot=['scripts/md-to-html.js','scripts/lint-doc-language.js','scripts/validate-doc.js','scripts/lib/prose.js','scripts/lib/quality-report.js','scripts/lib/source-reference.js'];
fs.writeFileSync(path.join(logs,'source-snapshot.json'),JSON.stringify({date:new Date().toISOString(),node:process.version,base:'eae95fe plus parent working-tree converter fixes',files:snapshot.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),lines:fs.readFileSync(path.join(root,file),'utf8').split('\n').length}))},null,2));
run('e2e',['examples/full-validation/run-e2e.js']);
run('module-api',['examples/full-validation/module-api.js']);
run('convert-modules',['scripts/md-to-html.js','--type','module','--all','--force']);
run('convert-system',['scripts/md-to-html.js','--type','system','--force','doc/Quality_Tooling_System.md']);
run('convert-guide',['scripts/md-to-html.js','--type','guide','--force','guide.md']);
run('module-index',['scripts/md-to-html.js','--type','module','--index','质量工具链','核心模块 API 与维护说明']);
run('system-index',['scripts/md-to-html.js','--type','system','--index','质量工具链','当前架构与历史文档导航']);
const md=['doc/Quality_Tooling_System.md','guide.md','doc/tech-docs/Prose_Design.md','doc/tech-docs/Quality_Report_Design.md','doc/tech-docs/Lint_Doc_Language_Design.md'];
for(const file of md){
  const name=path.basename(file,'.md');
  run('html-'+name,['scripts/validate-doc.js','--new-doc','--json',file.replace('.md','.html')]);
  run('language-'+name,['scripts/lint-doc-language.js','--mode','explain','--json',file]);
}
run('html-all',['scripts/validate-doc.js','--all','--json']);
run('tests',['--test','tests']);
const refs=[];
for(const file of md){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  for(const m of source.matchAll(/\{\{([^{}\n]+):([1-9]\d*)(?:-([1-9]\d*))?\}\}/g)) {
    const target=path.resolve(root,path.dirname(file),m[1]);
    const exists=fs.existsSync(target);
    const count=exists?fs.readFileSync(target,'utf8').split('\n').length:0;
    refs.push({document:file,path:m[1],start:Number(m[2]),end:Number(m[3]||m[2]),exists,inRange:exists&&Number(m[3]||m[2])<=count});
  }
}
fs.writeFileSync(path.join(logs,'source-reference-audit.json'),JSON.stringify({total:refs.length,bad:refs.filter(r=>!r.inRange),note:'存在及行范围不证明支持结论'},null,2));
console.log(JSON.stringify(records.map(({name,status,summary})=>({name,status,summary})),null,2));
if(records.some(r=>r.status!==0) || refs.some(r=>!r.inRange)) process.exitCode=1;
