import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadTasks, validateChange } from '../lib/validation.mjs';
import { loadProjection, projectionSourceDigest } from '../lib/plan-projection.mjs';
import { compilePlan } from '../lib/orchestration.mjs';
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const metadata={complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'one change',skills:['review'],references:['spec'],claims:[]};
const boundary={change:'Change button color',target:'Button X',exclusions:['other states'],review:{verdict:'ready',source:'coordinator'}};
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'asds-decomposition-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.cpSync('examples/basic-change',dir,{recursive:true});return dir;}
function writeTask(root,id,extra={}){const original=fs.readFileSync(path.join(root,'tasks/task-0001.md'),'utf8');const body=original.replace(/^---\r?\n[\s\S]*?\r?\n---/,'').trimStart();const sample=loadTasks(root).find(t=>t.id==='0001');const {contractRevision,body:ignored,...data}=sample;fs.writeFileSync(path.join(root,`tasks/task-${id}.md`),`---\n${JSON.stringify({...data,id,...extra})}\n---\n${body}`);}
test('package and transitive contract identities bind child content; independent leaf identity survives',t=>{
 const root=fixture(t);writeTask(root,'P',{nodeType:'package'});writeTask(root,'A',{nodeType:'task',parentId:'P',boundary});writeTask(root,'B',{dependsOn:['P']});
 const before=Object.fromEntries(loadTasks(root).map(t=>[t.id,t.contractRevision]));
 fs.appendFileSync(path.join(root,'tasks/task-A.md'),'\nChanged behavior.\n');
 const after=Object.fromEntries(loadTasks(root).map(t=>[t.id,t.contractRevision]));
 for(const id of ['A','P','B'])assert.notEqual(after[id],before[id]);assert.equal(after['0001'],before['0001']);
});
test('CLI compiles same-scope decomposition from real contracts and rejects stale proposed plan',t=>{
 const root=fixture(t),state=path.join(root,'journal.json');
 writeTask(root,'0001',{orchestration:metadata});
 const save=(name,value)=>{const f=path.join(root,name);fs.writeFileSync(f,JSON.stringify(value));return f;};
 const run=(command,args=[])=>spawnSync(process.execPath,['scripts/orchestrate.mjs',command,'--state',state,'--change',root,...args],{encoding:'utf8'});
 const init=run('init',['--profile',save('profile.json',profile),'--context',save('context.json',{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'approved example'}})]);assert.equal(init.status,0,init.stderr);
 writeTask(root,'0001',{orchestration:metadata,nodeType:'package'});writeTask(root,'A',{nodeType:'task',parentId:'0001',boundary,orchestration:metadata});
 fs.appendFileSync(path.join(root,'tasks.md'),'\n- [ ] [Task A](tasks/task-A.md): Delimited child\n');
 const proposed=compilePlan(loadTasks(root),profile,{allowUnready:true});
 const event={type:'decompose',taskId:'0001',plan:proposed,reason:'split broad work',authorization:{source:'existing user grant',scope:'approved example'}};
 const f=save('event.json',event);let result=run('event',['--event',f,'--expected-sequence','0']);assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).plan.version,3);
 fs.appendFileSync(path.join(root,'tasks/task-A.md'),'\nSource drift.\n');
 result=run('event',['--event',f,'--expected-sequence','1']);assert.notEqual(result.status,0);assert.match(result.stderr,/current sources/);
});
test('existing-plan projections carry reviewed packages without a second plan; checked parent needs checked child',t=>{
 const root=fixture(t);writeTask(root,'P',{nodeType:'package'});writeTask(root,'A',{nodeType:'task',parentId:'P',boundary,orchestration:metadata});
 fs.appendFileSync(path.join(root,'tasks.md'),'\n- [x] [Task P](tasks/task-P.md): Package\n- [ ] [Task A](tasks/task-A.md): Child\n');
 assert.ok(validateChange(root).some(e=>e.includes('incomplete dependency A')));
 const index=fs.readFileSync(path.join(root,'tasks.md'),'utf8');
 const tasks=loadTasks(root).filter(t=>t.id!=='0001').map(t=>({...t,source:{path:'tasks.md',anchor:`Task ${t.id}]`}}));
 const f=path.join(root,'projection.json');fs.writeFileSync(f,JSON.stringify({version:1,root,canonicalIndex:'tasks.md',sources:[{path:'tasks.md',sha256:projectionSourceDigest(index,true)}],tasks}));
 assert.equal(compilePlan(loadProjection(f),profile,{allowUnready:true}).version,3);
 assert.ok(!fs.existsSync(path.join(root,'openspec')));
});
test('deep leaf binds every ancestor and inherited transitive sources, not sibling content',t=>{
 const root=fixture(t);
 for(const [id,extra] of [['P',{nodeType:'package',dependsOn:['D']}],['Q',{nodeType:'package',parentId:'P'}],['R',{nodeType:'package',parentId:'Q'}],['A',{nodeType:'task',parentId:'R',boundary}],['sibling',{nodeType:'task',parentId:'Q',boundary}],['D',{dependsOn:['E']}],['E',{}]]) writeTask(root,id,extra);
 const revisions=()=>Object.fromEntries(loadTasks(root).map(task=>[task.id,task.contractRevision]));
 for(const id of ['P','Q','R','D','E']) {
  const before=revisions();fs.appendFileSync(path.join(root,`tasks/task-${id}.md`),`\nChange ${id}.\n`);const after=revisions();
  assert.notEqual(after.A,before.A,`${id} must bind A`);assert.equal(after['0001'],before['0001']);
 }
 const before=revisions();fs.appendFileSync(path.join(root,'tasks/task-sibling.md'),'\nSibling-only change.\n');assert.equal(revisions().A,before.A);
});
