import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournal, compilePlan } from '../lib/orchestration.mjs';
import { initializeStore, readStore, updateStore } from '../lib/orchestration-store.mjs';
const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nConcrete check.\n`).join('\n');
const task={id:'01',dependsOn:[],write:['a'],resources:[],scenarios:['x/y'],verification:['test'],openDecisions:[],body,contractRevision:'c',orchestration:{complexity:'bounded',uncertainty:'bounded',risk:'bounded',rationale:'local',skills:['review'],references:['spec.md'],claims:[]}};
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const journal=()=>createJournal(compilePlan([task],profile),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']});
function fixture(t){const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'asds-store-test-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'run.json');}
test('store uses exclusive creation, sequence checks and leaves no lock/temp after normal operation',t=>{
 const file=fixture(t);initializeStore(file,journal());assert.throws(()=>initializeStore(file,journal()),/exist/i);
 updateStore(file,{type:'block',taskId:'01',owner:'root',reason:'missing input'},0);
 assert.equal(readStore(file).events.length,1);
 assert.throws(()=>updateStore(file,{type:'unblock',taskId:'01',reason:'resolved'},0),/sequence/);
 assert.deepEqual(fs.readdirSync(path.dirname(file)),['run.json']);
});
test('existing lock and symlink paths refuse mutation',t=>{
 const file=fixture(t);initializeStore(file,journal());fs.writeFileSync(`${file}.lock`,'another writer');
 assert.throws(()=>updateStore(file,{type:'block',taskId:'01',owner:'root',reason:'x'},0),/lock/i);
 fs.unlinkSync(`${file}.lock`);
 if(process.platform!=='win32') {const link=path.join(path.dirname(file),'link.json');fs.symlinkSync(file,link);assert.throws(()=>readStore(link),/symlink/);}
});
test('CLI restores state and renders DAG without executing contract commands',t=>{
 const file=fixture(t);initializeStore(file,journal());
 const run=spawnSync(process.execPath,['scripts/orchestrate.mjs','status','--state',file],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).tasks['01'].status,'pending');
 const dag=spawnSync(process.execPath,['scripts/orchestrate.mjs','dag','--state',file],{encoding:'utf8'});
 assert.equal(dag.status,0,dag.stderr);assert.match(dag.stdout,/flowchart TD/);
 const bad=spawnSync(process.execPath,['scripts/orchestrate.mjs','event','--state',file],{encoding:'utf8'});
 assert.notEqual(bad.status,0);assert.equal(readStore(file).events.length,0);
});

test('real CLI init, dispatch, review, integration, acceptance and stale-source refusal',t=>{
 const file=fixture(t),dir=path.dirname(file),change=path.join(dir,'change');
 fs.cpSync('examples/basic-change',change,{recursive:true});
 const contract=path.join(change,'tasks/task-0001.md');
 fs.writeFileSync(contract,fs.readFileSync(contract,'utf8').replace(/^---\n/,'---\norchestration: '+JSON.stringify(task.orchestration)+'\n'));
 const write=(name,value)=>{const target=path.join(dir,`${name}.json`);fs.writeFileSync(target,JSON.stringify(value));return target;};
 const context={coordinator:'root',authorization:{source:'fixture user',scope:'fixture'},readScope:['fixture']};
 const run=(command,args=[])=>spawnSync(process.execPath,['scripts/orchestrate.mjs',command,'--state',file,...args],{encoding:'utf8'});
 const initialized=run('init',['--change',change,'--profile',write('profile',profile),'--context',write('context',context)]);
 assert.equal(initialized.status,0,initialized.stderr);
 const compiled=JSON.parse(initialized.stdout).plan.tasks[0];
 const caps={spawn:true,isolatedWrites:true,maxAgents:3,externalActive:0,models:[{model:'e',efforts:['high']},{model:'r',efforts:['medium']}]};
 const input=write('event',{});
 function apply(e){fs.writeFileSync(input,JSON.stringify({taskId:'0001',...e}));const result=run('event',['--change',change,'--event',input,'--expected-sequence',String(readStore(file).events.length)]);assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
 const ctx={fresh:true,inheritedHistory:false,source:'simulated host fixture'};
 apply({type:'dispatch',role:'executor',session:'e',capabilities:caps,context:ctx});
 const packet=run('packet',['--change',change,'--task','0001']);assert.equal(packet.status,0,packet.stderr);assert.equal(JSON.parse(packet.stdout).assignment.session,'e');
 const evidence=revision=>compiled.verification.map(command=>({command,exitCode:0,revision}));
 apply({type:'deliver',session:'e',stopped:true,receipt:{status:'delivered',contractRevision:compiled.contractRevision,baseRevision:'fixture-base',revision:'D',changedFiles:compiled.write,evidence:evidence('D')}});
 apply({type:'dispatch',role:'reviewer',session:'r',capabilities:caps,context:ctx});
 apply({type:'reviewResult',session:'r',stopped:true,revision:'D',verdict:'pass',findings:[],evidence:['fixture candidate review']});
 apply({type:'beginIntegration',capabilities:caps});
 apply({type:'integrate',integrationRevision:'I',integrationEvidence:evidence('I')});
 apply({type:'dispatch',role:'reviewer',session:'ir',capabilities:caps,context:ctx});
 apply({type:'reviewResult',session:'ir',stopped:true,revision:'I',verdict:'pass',findings:[],evidence:['fixture integrated review']});
 const final=apply({type:'decide',disposition:'accepted',reason:'fixture protocol exercised',checks:{scope:'fixture',behavior:'fixture',independence:'fixture',integration:'fixture',authority:'fixture'},limitations:['Simulated host; no agent or command execution']});
 assert.equal(final.tasks['0001'].status,'accepted');
 fs.appendFileSync(contract,'\nA changed source invalidates the plan.\n');
 const stale=run('wave',['--change',change,'--capabilities',write('caps',caps)]);
 assert.notEqual(stale.status,0);assert.match(stale.stderr,/replan/);
});
