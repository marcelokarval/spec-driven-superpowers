import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { compilePlan, createJournal } from '../lib/orchestration.mjs';
import { initializeStore, updateStore, readStore } from '../lib/orchestration-store.mjs';
test('CLI consumes original plan, preserves unresolved sibling, explains next/pause and refuses source drift',t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-continuity-cli-'))); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(name,value)=>{const p=path.join(root,name);fs.writeFileSync(p,typeof value==='string'?value:JSON.stringify(value));return p;};
 const index=put('TASKS.md','- [ ] T01 bounded\n- [ ] T02 future\n');
 const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nConcrete.\n`).join('');
 const tasks=['T01','T02'].map(id=>({id,source:{path:'TASKS.md',anchor:id},kind:'implementation',openDecisions:id==='T02'?['unknown']:[],dependsOn:[],write:[`${id}.js`],resources:[],scenarios:['ui/test'],verification:['test'],body,orchestration:{complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'known',skills:['tdd'],references:['TASKS.md'],claims:[]}}));
 const projection=put('projection.json',{version:1,root,canonicalIndex:'TASKS.md',sources:[{path:'TASKS.md',sha256:createHash('sha256').update(fs.readFileSync(index)).digest('hex')}],tasks});
 const profile=put('profile.json',{version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))});
 const context=put('context.json',{coordinator:'root',readScope:['project'],authorization:{source:'fixture user',scope:'fixture'}});
 const capabilities=put('caps.json',{spawn:true,isolatedWrites:true,maxAgents:3,externalActive:0,models:[{model:'e',efforts:['high']}]});
 const state=path.join(root,'state.json');
 const run=(cmd,args=[])=>spawnSync(process.execPath,['scripts/orchestrate.mjs',cmd,'--state',state,...args],{encoding:'utf8',env:{PATH:process.env.PATH}});
 let r=run('init',['--projection',projection,'--profile',profile,'--context',context]);assert.equal(r.status,0,r.stderr);
 r=run('next',['--projection',projection,'--capabilities',capabilities]);assert.equal(r.status,0,r.stderr);
 assert.deepEqual(JSON.parse(r.stdout).actions,[{operation:'executor',taskId:'T01'}]);
 r=run('event',['--event',put('pause.json',{type:'pause',source:'user',reason:'no execution'}),'--expected-sequence','0']);assert.equal(r.status,0,r.stderr);
 r=run('next',['--projection',projection,'--capabilities',capabilities]);assert.equal(JSON.parse(r.stdout).disposition,'paused');
 assert.equal(fs.readFileSync(index,'utf8'),'- [ ] T01 bounded\n- [ ] T02 future\n');assert.equal(fs.existsSync(path.join(root,'openspec')),false);
 fs.appendFileSync(index,'new requirement');r=run('next',['--projection',projection,'--capabilities',capabilities]);assert.notEqual(r.status,0);assert.match(r.stderr,/source changed/);
});

test('official consumer CLI fails closed without creating parent directories and status has explicit exit/output',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-consumer-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const absentParent=path.join(root,'absent'),state=path.join(absentParent,'journal.json');
 const invalid=path.join(root,'invalid.json');fs.writeFileSync(invalid,'{}\n');
 let result=spawnSync(process.execPath,['scripts/consume.mjs','init','--state',state,'--handoff',invalid,'--current',invalid,'--source',invalid,'--profile',invalid],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/ASDS_EXECUTION_CONSUMER_ERROR/);assert.match(result.stderr,/--workspace-binding is required/);assert.equal(fs.existsSync(absentParent),false);
 result=spawnSync(process.execPath,['scripts/consume.mjs','status','--state',state],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.notEqual(result.status,0);assert.equal(result.stdout,'');assert.match(result.stderr,/ASDS_EXECUTION_CONSUMER_ERROR/);
});

test('legacy CLI cannot mutate officially bound v3 journals and consumer status rejects post-cancel events',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-bound-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nConcrete.\n`).join('');
 const task={id:'A',dependsOn:[],write:['A.js'],resources:[],scenarios:['works'],verification:['test'],kind:'implementation',openDecisions:[],body,contractRevision:'c-A',owner:'worker',orchestration:{complexity:'bounded',uncertainty:'bounded',risk:'bounded',rationale:'bounded',skills:['tdd'],references:['task'],claims:[]}};
 const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(tier=>[tier,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
 const context={coordinator:'root',authorization:{source:'user',scope:'project'},readScope:['.'],executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]},consumerBinding:{schemaVersion:'asds.execution-consumer-binding/1'}};
 const state=path.join(root,'bound.json'),event=path.join(root,'event.json');initializeStore(state,createJournal(compilePlan([task],profile),context,{version:3}));fs.writeFileSync(event,JSON.stringify({type:'pause',source:'user',reason:'stop'}));
 let result=spawnSync(process.execPath,['scripts/orchestrate.mjs','event','--state',state,'--event',event,'--expected-sequence','0'],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).disposition,'manual_handoff_required');assert.equal(JSON.parse(result.stdout).persisted,false);assert.equal(readStore(state).events.length,0);
 const corrupt=path.join(root,'corrupt.json');initializeStore(corrupt,createJournal(compilePlan([task],profile),{...context,consumerBinding:undefined},{version:3}));
 updateStore(corrupt,{type:'pause',source:'asds.execution-consumer.cancelled',reason:'done'},0);updateStore(corrupt,{type:'resume',reason:'bypass',authorization:{source:'user',scope:'project'}},1);
 result=spawnSync(process.execPath,['scripts/consume.mjs','status','--state',corrupt],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.notEqual(result.status,0);assert.equal(result.stdout,'');assert.match(result.stderr,/terminal|cancel|final/i);assert.equal(readStore(corrupt).events.length,2);
});
