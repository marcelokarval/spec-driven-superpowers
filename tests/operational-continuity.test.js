import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../lib/orchestration.mjs';
const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(x=>`## ${x}\nConcrete criterion.\n`).join('\n');
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const caps={spawn:true,isolatedWrites:true,maxAgents:4,externalActive:0,models:[{model:'e',efforts:['high']},{model:'r',efforts:['medium']}]};
const task=(id,extra={})=>({id,dependsOn:[],write:[`${id}.js`],resources:[],scenarios:['x/y'],verification:['test'],kind:'implementation',openDecisions:[],body,contractRevision:id,orchestration:{complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'bounded',skills:['tdd'],references:['spec.md'],claims:[]},...extra});
const journal=tasks=>core.createJournal(core.compilePlan(tasks,profile,{allowUnready:true}),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'work'}});
const event=(j,e)=>core.appendEvent(j,e,j.events.length);
test('partial graph retains unresolved future work and admits only ready nodes',()=>{
 const j=journal([task('a'),task('b',{openDecisions:['API decision']}),task('c',{orchestration:undefined})]);
 assert.deepEqual(core.readyWave(j,caps).selected,['a']);
 assert.match(core.readyWave(j,caps).blocked.b,/readiness/);
 assert.match(core.readyWave(j,caps).blocked.c,/classification/);
 assert.equal(core.replay(j).plan.tasks.length,3);
 assert.throws(()=>core.compilePlan([task('b',{openDecisions:['API']})],profile),/readiness/);
});
test('continuation preserves objective across status and explicit pause blocks new work',()=>{
 let j=journal([task('a')]);
 assert.equal(core.continuation(j,caps).disposition,'continue');
 const before=JSON.stringify(j); core.continuation(j,caps); assert.equal(JSON.stringify(j),before);
 j=event(j,{type:'pause',source:'user said do not execute',reason:'explicit pause'});
 assert.equal(core.continuation(j,caps).disposition,'paused');
 assert.deepEqual(core.readyWave(j,caps).selected,[]);
 assert.throws(()=>event(j,{type:'resume',reason:'elapsed time'}),/authorization/);
 j=event(j,{type:'resume',reason:'user resumed',authorization:{source:'user',scope:'work'}});
 assert.equal(core.continuation(j,caps).disposition,'continue');
});
test('validation-only blocker does not stop executor or independent work; no false Done',()=>{
 let j=journal([task('a'),task('b',{openDecisions:['pending']})]);
 j=event(j,{type:'operationBlock',taskId:'a',operation:'acceptance',owner:'root',reason:'validator absent'});
 assert.deepEqual(core.readyWave(j,caps).selected,['a']);
 assert.equal(core.continuation(j,caps).disposition,'continue');
 j=event(j,{type:'operationBlock',taskId:'a',operation:'executor',owner:'root',reason:'requires decision'});
 assert.equal(core.continuation(j,caps).disposition,'blocked');
 assert.equal(core.continuation(j,caps).objectiveComplete,false);
});
test('approval criteria require revision-bound evidence at acceptance',()=>{
 const t=task('a',{approvalCriteria:[{id:'pill',source:'user-message-42',criterion:'Pill radius',verification:'visual comparison'}]});
 const j=journal([t]);
 assert.equal(core.replay(j).plan.tasks[0].approvalCriteria[0].source,'user-message-42');
 assert.throws(()=>journal([task('a',{approvalCriteria:[{id:'pill'}]})]),/approval/);
});
