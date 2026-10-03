import test from 'node:test';
import assert from 'node:assert/strict';
import { hostDispatch } from '../lib/host-bridge.mjs';
import { compilePlan, createJournal, appendEvent, replay } from '../lib/orchestration.mjs';
const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nConcrete.\n`).join('');
const tasks=[{id:'a',kind:'implementation',openDecisions:[],body,dependsOn:[],write:['a.js'],resources:[],scenarios:['a/b'],verification:['test'],contractRevision:'a',orchestration:{complexity:'bounded',risk:'bounded',uncertainty:'bounded',rationale:'known',skills:['tdd'],references:['source'],claims:[]}}];
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(t=>[t,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const caps={spawn:true,isolatedWrites:true,maxAgents:2,externalActive:0,models:[{model:'e',efforts:['high']}]};
function setup(){let j=createJournal(compilePlan(tasks,profile),{coordinator:'root',readScope:['project'],authorization:{source:'user',scope:'test'}});return {read:()=>j,append:(e,n)=>j=appendEvent(j,e,n)};}
test('host verifies source and authorization and persists reservation before starting worker',async()=>{
 const store=setup();const calls=[];
 const result=await hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host:{
 capabilities:async()=>caps,authorize:async()=>({granted:true,source:'actual grant'}),
 prepare:async()=>({session:'fresh',context:{fresh:true,inheritedHistory:false,source:'host'}}),
 start:async packet=>{assert.equal(replay(store.read()).tasks.a.active.session,'fresh');assert.equal(packet.executionAuthorized,false);calls.push('start');return {session:'fresh',toolCall:'call-1'};}
 }});
 assert.equal(result.started,true);assert.deepEqual(calls,['start']);
});
test('denied permission and source drift do not start host; start failure retains reservation',async()=>{
 const store=setup();let prepared=false;
 const host={capabilities:async()=>caps,authorize:async()=>({granted:false}),prepare:async()=>{prepared=true;return {session:'s',context:{fresh:true,inheritedHistory:false,source:'host'}}},start:async()=>{throw new Error('transport uncertain');}};
 await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/authorization/);assert.equal(prepared,false);
 host.authorize=async()=>({granted:true,source:'user'});
 await assert.rejects(hostDispatch({store,loadTasks:()=>[{...tasks[0],contractRevision:'changed'}],taskId:'a',role:'executor',host}),/contracts/);
 await assert.rejects(hostDispatch({store,loadTasks:()=>tasks,taskId:'a',role:'executor',host}),/transport/);
 assert.equal(replay(store.read()).tasks.a.active.session,'s');
});
