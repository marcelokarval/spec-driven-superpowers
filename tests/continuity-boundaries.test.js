import test from 'node:test';
import assert from 'node:assert/strict';
import {hostDispatch} from '../lib/host-bridge.mjs';
import {compilePlan,createJournal,appendEvent,replay} from '../lib/orchestration.mjs';
const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nConcrete.\n`).join('');
const task={id:'a',kind:'implementation',openDecisions:[],body,dependsOn:[],write:['a'],resources:[],scenarios:['a/b'],verification:['test'],contractRevision:'original',orchestration:{complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'bounded',skills:['tdd'],references:['source'],claims:[]}};
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const caps={spawn:true,isolatedWrites:true,maxAgents:2,externalActive:0,models:[{model:'e',efforts:['high']}]};
test('host refuses source drift during awaited authorization before appending dispatch',async()=>{
 let tasks=[task],j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'}}),calls=0,started=false,cancelled=false;
 const store={read:()=>j,append:(e,n)=>{j=appendEvent(j,e,n);return j;}};
 await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host:{capabilities:async()=>caps,authorize:async()=>{if(++calls===2) tasks=[{...task,contractRevision:'changed'}];return {granted:true,source:'user'};},prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'standby'}}),cancelPrepared:async()=>{cancelled=true;},start:async()=>{started=true;return {session:'fresh',toolCall:'call'};}}}),/contracts/);
 assert.equal(started,false);assert.equal(cancelled,true);assert.equal(replay(j).tasks.a.active,null);
});
test('pause persisted after dispatch but before start retains reservation without starting',async()=>{
 let j=createJournal(compilePlan([task],profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'}}),started=false;
 const store={read:()=>j,append:(e,n)=>{j=appendEvent(j,e,n);j=appendEvent(j,{type:'pause',source:'user',reason:'stop execution'},j.events.length);return j;}};
 await assert.rejects(hostDispatch({store,loadTasks:()=>[task],taskId:'a',role:'executor',host:{capabilities:async()=>caps,authorize:async()=>({granted:true,source:'user'}),prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'standby'}}),start:async()=>{started=true;return {session:'fresh',toolCall:'call'};}}}),/paused/);
 assert.equal(started,false);assert.equal(replay(j).tasks.a.active.session,'fresh');
});
test('canonical checkbox progress preserves projected contracts; changed wording invalidates',async t=>{
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const {createHash}=await import('node:crypto');const {loadProjection}=await import('../lib/plan-projection.mjs');
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-progress-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source='- [ ] a deliver\n';const index=path.join(root,'TASKS.md');fs.writeFileSync(index,source);
 const file=path.join(root,'projection.json');fs.writeFileSync(file,JSON.stringify({version:1,root,canonicalIndex:'TASKS.md',sources:[{path:'TASKS.md',sha256:createHash('sha256').update(source).digest('hex')}],tasks:[{...task,source:{path:'TASKS.md',anchor:'a deliver'}}]}));
 const revision=loadProjection(file)[0].contractRevision;
 fs.writeFileSync(index,source.replace('[ ]','[x]'));
 assert.equal(loadProjection(file)[0].contractRevision,revision);
 fs.writeFileSync(index,source.replace('deliver','different outcome'));
 assert.throws(()=>loadProjection(file),/source changed/);
});
test('pending stop after reservation must not start its worker',async()=>{
 let j=createJournal(compilePlan([task],profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'}}),started=false;
 const store={read:()=>j,append:(e,n)=>{j=appendEvent(j,e,n);j=appendEvent(j,{type:'stop',taskId:'a',session:'fresh',stopped:false,reason:'cancel requested'},j.events.length);return j;}};
 await assert.rejects(hostDispatch({store,loadTasks:()=>[task],taskId:'a',role:'executor',host:{capabilities:async()=>caps,authorize:async()=>({granted:true,source:'user'}),prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'standby'}}),start:async()=>{started=true;return {session:'fresh',toolCall:'call'};}}}),/state/);
 assert.equal(started,false);assert.equal(replay(j).tasks.a.active.session,'fresh');
});
test('progress normalization preserves code literals and supports declared list markers',async()=>{
 const {projectionSourceDigest}=await import('../lib/plan-projection.mjs');
 for(const marker of ['-','*','+','1.','2)']) {
  assert.equal(projectionSourceDigest(`${marker} [ ] a\n`,true),projectionSourceDigest(`${marker} [x] a\n`,true));
 }
 for(const literal of ['```md\n- [ ] literal\n```\n','~~~md\n- [ ] literal\n~~~\n','    - [ ] literal\n','<pre>\n- [ ] literal\n</pre>\n']) {
  assert.notEqual(projectionSourceDigest(literal,true),projectionSourceDigest(literal.replace('[ ]','[x]'),true));
 }
});
