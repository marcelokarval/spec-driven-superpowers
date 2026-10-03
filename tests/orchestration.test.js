import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePlan, createJournal, replay, appendEvent, readyWave, renderDag, packetFor, assertCurrentPlan } from '../lib/orchestration.mjs';

const body = ['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h => `## ${h}\nConcrete outcome and checks.\n`).join('\n');
const profile = { version: 1, tiers: Object.fromEntries(['bounded','medium','high'].map(t => [t, {
  executor: { model: 'executor', effort: 'high' }, reviewer: { model: 'reviewer', effort: 'medium' },
}])) };
const caps = { spawn: true, isolatedWrites: true, maxAgents: 8, externalActive: 0,
  models: [{ model: 'executor', efforts: ['high'] }, { model: 'reviewer', efforts: ['medium'] }] };
const task = (id, dependsOn = [], extra = {}) => ({ id, dependsOn, write: [`src/${id}.js`], resources: [], scenarios: ['demo/works'], verification: ['test'], kind: 'implementation', openDecisions: [], body, contractRevision: `contract-${id}`, orchestration: { complexity: 'bounded', uncertainty: 'bounded', risk: 'bounded', rationale: 'Known local transformation with bounded consequences.', skills: ['test-driven-development'], references: ['specs/demo/spec.md'], claims: [] }, ...extra });
const plan = tasks => compilePlan(tasks, profile);
const journal = tasks => createJournal(plan(tasks), { coordinator: 'root', authorization: { source: 'user approved phase 1', scope: 'demo' }, readScope: ['project', 'required skills'] });
const event = (j,e) => appendEvent(j,e,j.events.length);
const dispatch = (j,id,role='executor',session=`${id}-${role}`) => event(j,{ type:'dispatch', taskId:id, role, session, capabilities:caps, context:{fresh:true, inheritedHistory:false, source:'host observation'} });
const receipt = (id, revision='D') => ({ status:'delivered', contractRevision:`contract-${id}`, baseRevision:'BASE', revision, changedFiles:[`src/${id}.js`], evidence:[{command:'test',exitCode:0,revision}] });
function delivered(j,id) { j=dispatch(j,id); return event(j,{type:'deliver',taskId:id,session:`${id}-executor`,receipt:receipt(id),stopped:true}); }
function reviewed(j,id) { j=delivered(j,id); j=dispatch(j,id,'reviewer'); return event(j,{type:'reviewResult',taskId:id,session:`${id}-reviewer`,revision:'D', verdict:'pass',findings:[],evidence:['review source'],stopped:true}); }
function accepted(j,id) {
 j=reviewed(j,id);
 j=event(j,{type:'beginIntegration',capabilities:caps,taskId:id});
 j=event(j,{type:'integrate',taskId:id,integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I'}]});
 j=dispatch(j,id,'reviewer',`${id}-integration`);
 j=event(j,{type:'reviewResult',taskId:id,session:`${id}-integration`,revision:'I',verdict:'pass',findings:[],evidence:['combined tree review'],stopped:true});
 return event(j,{type:'decide',taskId:id,disposition:'accepted',reason:'All acceptance assertions checked on combined tree.',checks:{scope:'diff observed',behavior:'negative and positive assertions',independence:'host sessions verified',integration:'combined tree tested',authority:'within grant'},limitations:[]});
}

test('ready waves retain full causal graph and release siblings only after root acceptance',()=>{
 let j=journal([task('01'),task('02',['01']),task('03',['01'])]);
 assert.deepEqual(readyWave(j,caps).selected,['01']);
 j=reviewed(j,'01'); assert.deepEqual(readyWave(j,caps).selected,[]);
 j=accepted(journal([task('01'),task('02',['01']),task('03',['01'])]),'01');
 assert.deepEqual(readyWave(j,caps).selected,['02','03']);
 assert.match(renderDag(replay(j).plan),/t0 --> t1/);
 assert.deepEqual(replay(j).plan.tasks[1].dependsOn,['01']);
});
test('invalid graph, unclassified work and unready tasks fail before dispatch',()=>{
 assert.throws(()=>plan([task('a',['missing'])]),/missing dependency/);
 assert.throws(()=>plan([task('a',['b']),task('b',['a'])]),/cycle/);
 assert.throws(()=>plan([task('a',[],{orchestration:undefined})]),/classification/);
 assert.throws(()=>plan([task('a',[],{openDecisions:['unknown API']})]),/readiness/);
});
test('classification uses highest dimension and unavailable profile never silently falls back',()=>{
 const t=task('a'); t.orchestration.risk='high';
 const p=plan([t]); assert.equal(p.tasks[0].tier,'high');
 const j=createJournal(p,{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']});
 assert.deepEqual(readyWave(j,{...caps,models:[]}).selected,[]);
 assert.throws(()=>event(j,{type:'dispatch',taskId:'a',role:'executor',session:'e',capabilities:{...caps,models:[]},context:{}}),/model/);
});
test('all active roles and coordinator consume budget; resources and paths serialize conflicting work',()=>{
 let j=journal([task('a',[],{resources:['db']}),task('b',[],{resources:['db']}),task('c')]);
 assert.deepEqual(readyWave(j,caps).selected,['a','c']);
 j=dispatch(j,'a'); assert.deepEqual(readyWave(j,{...caps,maxAgents:2}).selected,[]);
 j=event(j,{type:'stop',taskId:'a',session:'a-executor',reason:'cancelled',stopped:false});
 assert.equal(replay(j).tasks.a.active.session,'a-executor');
 assert.ok(!readyWave(j,caps).selected.includes('b'));
 j=event(j,{type:'stop',taskId:'a',session:'a-executor',reason:'host observed stopped',stopped:true});
 assert.ok(readyWave(j,caps).selected.includes('b'));
});
test('read/read claims coexist; read/write and path ancestors conflict',()=>{
 const a=task('a'),b=task('b');
 a.orchestration.claims=[{name:'db',mode:'read',roles:['executor','reviewer']}];
 b.orchestration.claims=[{name:'db',mode:'read',roles:['executor']}];
 assert.deepEqual(readyWave(journal([a,b]),caps).selected,['a','b']);
 b.orchestration.claims[0].mode='write'; assert.deepEqual(readyWave(journal([a,b]),caps).selected,['a']);
 assert.deepEqual(readyWave(journal([task('a',[],{write:['src']}),task('b')]),caps).selected,['a']);
});
test('review packet excludes executor narrative and requires fresh distinct session',()=>{
 let j=delivered(journal([task('a')]),'a');
 assert.throws(()=>dispatch(j,'a','reviewer','a-executor'),/independent/);
 assert.throws(()=>event(j,{type:'dispatch',taskId:'a',role:'reviewer',session:'r',capabilities:caps,context:{fresh:false,inheritedHistory:true,source:'fork'}}),/fresh/);
 j=dispatch(j,'a','reviewer'); const packet=packetFor(j,'a');
 assert.equal(packet.candidateRevision,'D'); assert.equal(packet.executorEvidence,undefined);
 assert.deepEqual(packet.readScope,['project','required skills']);
 assert.equal(packet.executionAuthorized,false);
});
test('stale review, contract, forged acceptance and sequence are rejected',()=>{
 let j=journal([task('a')]);
 assert.throws(()=>appendEvent(j,{type:'unblock',taskId:'a'},3),/sequence/);
 j=dispatch(j,'a'); assert.throws(()=>event(j,{type:'deliver',taskId:'a',session:'a-executor',stopped:true,receipt:{...receipt('a'),contractRevision:'old'}}),/contract/);
 j=event(j,{type:'deliver',taskId:'a',session:'a-executor',stopped:true,receipt:receipt('a')}); j=dispatch(j,'a','reviewer');
 assert.throws(()=>event(j,{type:'reviewResult',taskId:'a',session:'a-reviewer',revision:'OLD',verdict:'pass',findings:[],evidence:['x'],stopped:true}),/revision/);
 assert.throws(()=>event(j,{type:'decide',taskId:'a',disposition:'accepted'}),/integration/);
});
test('failed review requires rework and stale candidate cannot be integrated',()=>{
 let j=dispatch(delivered(journal([task('a')]),'a'),'a','reviewer');
 j=event(j,{type:'reviewResult',taskId:'a',session:'a-reviewer',revision:'D',verdict:'fail',findings:['wrong behavior'],evidence:['negative test'],stopped:true});
 assert.equal(replay(j).tasks.a.status,'blocked');
 j=event(j,{type:'decide',taskId:'a',disposition:'rework',reason:'correct behavior'});
 assert.equal(replay(j).tasks.a.receipt,null);
 assert.deepEqual(readyWave(j,caps).selected,['a']);
});
test('replay preserves ownership and rejects edits and stale replanning',()=>{
 let j=dispatch(journal([task('a'),task('b')]),'a');
 assert.deepEqual(replay(JSON.parse(JSON.stringify(j))),replay(j));
 const changed=plan([task('a',[],{contractRevision:'new'}),task('b')]);
 assert.throws(()=>event(j,{type:'replan',plan:changed,reason:'scope update',authorization:{source:'user',scope:'demo'}}),/active/);
 j=event(j,{type:'stop',taskId:'a',session:'a-executor',reason:'stopped',stopped:true});
 j=event(j,{type:'replan',plan:changed,reason:'scope update',authorization:{source:'user',scope:'demo'}});
 assert.equal(replay(j).plan.tasks[0].contractRevision,'new');
 const corrupt=structuredClone(j); corrupt.events[0].event.session='tampered'; assert.throws(()=>replay(corrupt),/digest/);
});
test('independent task acceptance survives local replan; affected descendants reopen',()=>{
 let j=accepted(journal([task('a'),task('b'),task('c',['b'])]),'a');
 const changed=plan([task('a'),task('b',[],{contractRevision:'new-b'}),task('c',['b'])]);
 j=event(j,{type:'replan',plan:changed,reason:'local change',authorization:{source:'user',scope:'demo'}});
 assert.equal(replay(j).tasks.a.status,'accepted'); assert.equal(replay(j).tasks.c.status,'pending');
});


test('integration must reserve before mutation and conflicts with worker resources',()=>{
 const a=task('a',[],{resources:['db']}),b=task('b',[],{resources:['db']});
 let j=reviewed(journal([a,b]),'a');
 const busy=dispatch(j,'b');
 assert.throws(()=>event(busy,{type:'beginIntegration',capabilities:caps,taskId:'a'}),/conflict/);
 j=event(j,{type:'beginIntegration',capabilities:caps,taskId:'a'});
 assert.ok(!readyWave(j,caps).selected.includes('b'));
 assert.equal(replay(j).tasks.a.active.role,'integrator');
 assert.throws(()=>event(j,{type:'integrate',taskId:'a',integrationRevision:'I',integrationEvidence:[]}),/integration evidence/);
 j=event(j,{type:'integrate',taskId:'a',integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I'}]});
 assert.equal(replay(j).tasks.a.receipt.integrationReviews,undefined);
 j=dispatch(j,'a','reviewer','integration-review');
 j=event(j,{type:'reviewResult',taskId:'a',session:'integration-review',revision:'I',verdict:'pass',findings:[],evidence:['review'],stopped:true});
 assert.equal(replay(j).tasks.a.receipt.status,'integrated');
 assert.equal(replay(j).tasks.a.receipt.integrationReviews.spec,'I');
});
test('fresh packets preserve intake refusals and constraints without executor evidence',()=>{
 const context={coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project'],constraints:['No installation'],authorizations:[{action:'publish',decision:'denied',scope:'demo',source:'user'}],decisions:['No remote mutations']};
 let j=createJournal(plan([task('a')]),context);j=dispatch(j,'a');
 assert.deepEqual(packetFor(j,'a').coordinationContext,context);
 assert.equal(packetFor(j,'a').executorEvidence,undefined);
});

test('current source drift is rejected and explicit reopen invalidates descendants safely',()=>{
 let j=accepted(journal([task('a'),task('b',['a']),task('c')]),'a');
 assert.throws(()=>assertCurrentPlan(j,[task('a',[],{contractRevision:'changed'}),task('b',['a']),task('c')]),/replan/);
 const busy=dispatch(j,'b');
 assert.throws(()=>event(busy,{type:'reopen',taskId:'a',reason:'new counterexample'}),/active/);
 j=event(j,{type:'reopen',taskId:'a',reason:'new counterexample'});
 assert.equal(replay(j).tasks.a.status,'pending');
 assert.deepEqual(readyWave(j,caps).selected,['a','c']);
 assert.equal(replay(j).tasks.b.status,'pending');
});

test('integration uses the same isolation rule and observed external reservations as dispatch',()=>{
 let j=reviewed(journal([task('a'),task('b')]),'a');
 j=event(j,{type:'dispatch',taskId:'b',role:'executor',session:'b-executor',capabilities:{...caps,isolatedWrites:false},context:{fresh:true,inheritedHistory:false,source:'host'}});
 assert.throws(()=>event(j,{type:'beginIntegration',taskId:'a',capabilities:{...caps,isolatedWrites:false}}),/isolation/);
 const external={...caps,externalActive:1};
 assert.deepEqual(readyWave(journal([task('a')]),external).selected,[]);
 external.externalReservations=[{claims:[{type:'path',name:'src/a.js',mode:'write'}]}];
 assert.deepEqual(readyWave(journal([task('a')]),external).selected,[]);
 assert.throws(()=>event(j,{type:'beginIntegration',taskId:'a',capabilities:external}),/conflict/);
 external.externalReservations=[{claims:[{type:'resource',name:'unrelated',mode:'read'}]}];
 assert.deepEqual(readyWave(journal([task('a')]),external).selected,['a']);
});

test('accepted A continues to B; all accepted still requires objective verification',async()=>{
 const { continuation }=await import('../lib/orchestration.mjs');
 let j=accepted(journal([task('a'),task('b',['a'])]),'a');
 assert.deepEqual(continuation(j,caps).actions,[{operation:'executor',taskId:'b'}]);
 j=accepted(j,'b');
 assert.equal(continuation(j,caps).disposition,'verify_objective');
 assert.equal(continuation(j,caps).objectiveComplete,false);
});
test('approved details cannot be accepted using old or missing evidence',()=>{
 const approved=task('a',[],{approvalCriteria:[{id:'pill',source:'approval-42',criterion:'pill radius',verification:'visual comparison'}]});
 let j=reviewed(journal([approved]),'a');
 j=event(j,{type:'beginIntegration',taskId:'a',capabilities:caps});
 j=event(j,{type:'integrate',taskId:'a',integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I'}]});
 j=dispatch(j,'a','reviewer','a-integration');
 j=event(j,{type:'reviewResult',taskId:'a',session:'a-integration',revision:'I',verdict:'pass',findings:[],evidence:['comparison'],stopped:true});
 const decision={type:'decide',taskId:'a',disposition:'accepted',reason:'compared',checks:{scope:'diff',behavior:'tests',independence:'session',integration:'tree',authority:'grant'},limitations:[]};
 assert.throws(()=>event(j,decision),/approval criterion/);
 const proof={id:'pill',source:'approval-42',contractRevision:'contract-a',revision:'OLD',verdict:'pass',evidence:'comparison image'};
 assert.throws(()=>event(j,{...decision,approvalEvidence:[proof]}),/approval criterion/);
 assert.equal(replay(event(j,{...decision,approvalEvidence:[{...proof,revision:'I'}]})).tasks.a.status,'accepted');
});
