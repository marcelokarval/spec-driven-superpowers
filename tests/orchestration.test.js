import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePlan, createJournal, createSuccessorJournal, replay, appendEvent, readyWave, renderDag, packetFor, assertCurrentPlan, objectiveSnapshot, continuation, digest } from '../lib/orchestration.mjs';

const body = ['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h => `## ${h}\nConcrete outcome and checks.\n`).join('\n');
const profile = { version: 1, tiers: Object.fromEntries(['bounded','medium','high'].map(t => [t, {
  executor: { model: 'executor', effort: 'high' }, reviewer: { model: 'reviewer', effort: 'medium' },
}])) };
const caps = { spawn: true, isolatedWrites: true, maxAgents: 8, externalActive: 0,
  models: [{ model: 'executor', efforts: ['high'] }, { model: 'reviewer', efforts: ['medium'] }] };
const task = (id, dependsOn = [], extra = {}) => ({ id, dependsOn, write: [`src/${id}.js`], resources: [], scenarios: ['demo/works'], verification: ['test'], kind: 'implementation', openDecisions: [], body, contractRevision: `contract-${id}`, orchestration: { complexity: 'bounded', uncertainty: 'bounded', risk: 'bounded', rationale: 'Known local transformation with bounded consequences.', skills: ['test-driven-development'], references: ['specs/demo/spec.md'], claims: [] }, ...extra });
const plan = tasks => compilePlan(tasks, profile);
const journal = tasks => createJournal(plan(tasks), { coordinator: 'root', authorization: { source: 'user approved phase 1', scope: 'demo' }, readScope: ['project', 'required skills'] }, {version:2});
const event = (j,e) => appendEvent(j,e,j.events.length);
const verifierDispatch=(j,session,objectiveRevision)=>event(j,{type:'dispatch',role:'verifier',session,capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host',reservedActor:`actor:${session}`},objectiveRevision});
const snapshot = (id,revision) => ({revision,changedFiles:[`src/${id}.js`],scopeFingerprint:`${revision}-scope`});
const dispatch = (j,id,role='executor',session=`${id}-${role}`) => {
 const current=replay(j).tasks[id], revision=role==='reviewer'?(current.status==='delivered'?current.receipt.revision:current.receipt.integrationRevision):null;
 const capabilities=role==='reviewer'?{...caps,reviewIsolation:{enforced:true,mode:'read-only',provider:'test-host',projectScope:'fixture',targetRevision:revision}}:caps;
 const context={fresh:true,inheritedHistory:false,source:'host observation',...(role==='reviewer'?{reviewSnapshot:snapshot(id,revision)}:{})};
 return event(j,{ type:'dispatch', taskId:id, role, session, capabilities, context });
};
const observed = command => ({invocation:command,scope:'declared',targets:['fixture'],source:'test-host'});
const receipt = (id, revision='D') => ({ status:'delivered', contractRevision:`contract-${id}`, baseRevision:'BASE', revision, changedFiles:[`src/${id}.js`], evidence:[{command:'test',exitCode:0,revision,observed:observed('test')}] });
function delivered(j,id) { j=dispatch(j,id); return event(j,{type:'deliver',taskId:id,session:`${id}-executor`,receipt:receipt(id),stopped:true}); }
function reviewed(j,id) { j=delivered(j,id); j=dispatch(j,id,'reviewer'); return event(j,{type:'reviewResult',taskId:id,session:`${id}-reviewer`,revision:'D', verdict:'pass',findings:[],evidence:['review source'],snapshotAfter:snapshot(id,'D'),stopped:true}); }
function accepted(j,id) {
 j=reviewed(j,id);
 if(j.version===3) {
  j=event(j,{type:'dispatch',taskId:id,role:'integrator',session:`${id}-integrator`,capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host observation'}});
  j=event(j,{type:'integrate',taskId:id,session:`${id}-integrator`,stopped:true,integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I',observed:observed('test')}]});
 } else {
  j=event(j,{type:'beginIntegration',capabilities:caps,taskId:id});
  j=event(j,{type:'integrate',taskId:id,integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I',observed:observed('test')}]});
 }
 j=dispatch(j,id,'reviewer',`${id}-integration`);
 j=event(j,{type:'reviewResult',taskId:id,session:`${id}-integration`,revision:'I',verdict:'pass',findings:[],evidence:['combined tree review'],snapshotAfter:snapshot(id,'I'),stopped:true});
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
  assert.deepEqual(packet.candidateScope.changedFiles,['src/a.js']);
 assert.deepEqual(packet.readScope,['project','required skills']);
 assert.equal(packet.executionAuthorized,false);
});
test('stale review, contract, forged acceptance and sequence are rejected',()=>{
 let j=journal([task('a')]);
 assert.throws(()=>appendEvent(j,{type:'unblock',taskId:'a'},3),/sequence/);
 j=dispatch(j,'a'); assert.throws(()=>event(j,{type:'deliver',taskId:'a',session:'a-executor',stopped:true,receipt:{...receipt('a'),contractRevision:'old'}}),/contract/);
 j=event(j,{type:'deliver',taskId:'a',session:'a-executor',stopped:true,receipt:receipt('a')}); j=dispatch(j,'a','reviewer');
 assert.throws(()=>event(j,{type:'reviewResult',taskId:'a',session:'a-reviewer',revision:'OLD',verdict:'pass',findings:[],evidence:['x'],snapshotAfter:snapshot('a','OLD'),stopped:true}),/revision/);
 assert.throws(()=>event(j,{type:'decide',taskId:'a',disposition:'accepted'}),/integration/);
});
test('hardened review rejects prompt-only isolation and post-review drift',()=>{
 let j=delivered(journal([task('a')]),'a');
 assert.throws(()=>event(j,{type:'dispatch',taskId:'a',role:'reviewer',session:'prompt-only',capabilities:caps,
   context:{fresh:true,inheritedHistory:false,source:'prompt says read-only'}}),/host-enforced/);
 j=dispatch(j,'a','reviewer');
 assert.throws(()=>event(j,{type:'reviewResult',taskId:'a',session:'a-reviewer',revision:'D',verdict:'pass',
   findings:[],evidence:['review'],snapshotAfter:{...snapshot('a','D'),scopeFingerprint:'drifted'},stopped:true}),/drifted/);
});
test('failed review requires rework and stale candidate cannot be integrated',()=>{
 let j=dispatch(delivered(journal([task('a')]),'a'),'a','reviewer');
 j=event(j,{type:'reviewResult',taskId:'a',session:'a-reviewer',revision:'D',verdict:'fail',findings:['wrong behavior'],evidence:['negative test'],snapshotAfter:snapshot('a','D'),stopped:true});
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
 j=event(j,{type:'integrate',taskId:'a',integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I',observed:observed('test')}]});
 assert.equal(replay(j).tasks.a.receipt.integrationReviews,undefined);
 j=dispatch(j,'a','reviewer','integration-review');
 j=event(j,{type:'reviewResult',taskId:'a',session:'integration-review',revision:'I',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot('a','I'),stopped:true});
 assert.equal(replay(j).tasks.a.receipt.status,'integrated');
 assert.equal(replay(j).tasks.a.receipt.integrationReviews.spec,'I');
});
test('fresh packets preserve intake refusals and constraints without executor evidence',()=>{
 const context={coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project'],constraints:['No installation'],authorizations:[{action:'publish',decision:'denied',scope:'demo',source:'user'}],decisions:['No remote mutations']};
 let j=createJournal(plan([task('a')]),context,{version:2});j=dispatch(j,'a');
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

test('accepted A continues to B; all accepted requires and accepts explicit objective verification',()=>{
 let j=accepted(journal([task('a'),task('b',['a'])]),'a');
 assert.deepEqual(continuation(j,caps).actions,[{operation:'executor',taskId:'b'}]);
 j=accepted(j,'b');
 assert.equal(continuation(j,caps).disposition,'verify_objective');
 assert.equal(continuation(j,caps).objectiveComplete,false);
 const objective=objectiveSnapshot(j);
 assert.throws(()=>event(j,{type:'verifyObjective',objectiveRevision:'stale'}),/stale objective/);
 j=event(j,{type:'verifyObjective',objectiveRevision:objective.objectiveRevision,verdict:'pass',outcome:'Original login objective is satisfied.',
   checks:{originalRequest:'matched',taskCoverage:'all accepted',integratedBehavior:'verified',authority:'within grant'},
   evidence:['accepted receipts and integrated revisions'],limitations:[],remainingWork:[]});
 assert.equal(continuation(j,caps).disposition,'await_host_reobservation');
 assert.equal(continuation(j,caps).objectiveComplete,false);
});
test('approved details cannot be accepted using old or missing evidence',()=>{
 const approved=task('a',[],{approvalCriteria:[{id:'pill',source:'approval-42',criterion:'pill radius',verification:'visual comparison'}]});
 let j=reviewed(journal([approved]),'a');
 j=event(j,{type:'beginIntegration',taskId:'a',capabilities:caps});
 j=event(j,{type:'integrate',taskId:'a',integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I',observed:observed('test')}]});
 j=dispatch(j,'a','reviewer','a-integration');
 j=event(j,{type:'reviewResult',taskId:'a',session:'a-integration',revision:'I',verdict:'pass',findings:[],evidence:['comparison'],snapshotAfter:snapshot('a','I'),stopped:true});
 const decision={type:'decide',taskId:'a',disposition:'accepted',reason:'compared',checks:{scope:'diff',behavior:'tests',independence:'session',integration:'tree',authority:'grant'},limitations:[]};
 assert.throws(()=>event(j,decision),/approval criterion/);
 const proof={id:'pill',source:'approval-42',contractRevision:'contract-a',revision:'OLD',verdict:'pass',evidence:'comparison image'};
 assert.throws(()=>event(j,{...decision,approvalEvidence:[proof]}),/approval criterion/);
 assert.equal(replay(event(j,{...decision,approvalEvidence:[{...proof,revision:'I'}]})).tasks.a.status,'accepted');
});

test('journal v3 keeps coordinator out of every worker role and reserves integration for a fresh session',()=>{
 let j=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']},{version:3});
 assert.equal(j.version,3);
 assert.throws(()=>event(j,{type:'dispatch',taskId:'a',role:'executor',session:'root',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}}),/coordinator|root/i);
 j=delivered(j,'a');j=dispatch(j,'a','reviewer');
 j=event(j,{type:'reviewResult',taskId:'a',session:'a-reviewer',revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snapshot('a','D'),stopped:true});
 assert.throws(()=>event(j,{type:'beginIntegration',taskId:'a',capabilities:caps}),/integrator.*dispatch/i);
 assert.throws(()=>event(j,{type:'dispatch',taskId:'a',role:'integrator',session:'a-reviewer',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}}),/unique|reuse/i);
 j=event(j,{type:'dispatch',taskId:'a',role:'integrator',session:'a-integrator',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}});
 assert.equal(replay(j).tasks.a.active.role,'integrator');
 assert.throws(()=>event(j,{type:'integrate',taskId:'a',session:'root',stopped:true,integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I',observed:observed('test')}]}),/role\/session/);
});

test('journal v3 progress is a dependency gate and objective proof comes from a dispatched verifier',()=>{
 let j=createJournal(plan([task('a'),task('b',['a'])]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']},{version:3});
 j=accepted(j,'a');
 assert.deepEqual(readyWave(j,caps).selected,[]);
 const acceptedState=replay(j).tasks.a;
 const receiptDigest=digest(acceptedState.receipt);
 const request={type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'contract-a',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}};
 j=event(j,request);assert.equal(replay(j).tasks.a.status,'progress_pending');assert.deepEqual(readyWave(j,caps).selected,[]);
 assert.throws(()=>event(j,{type:'progressCommitted',taskId:'a',receiptDigest:'other',indexBeforeHash:'before',indexAfterHash:'after'}),/matching|receipt/i);
 j=event(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
 assert.deepEqual(readyWave(j,caps).selected,['b']);
 j=accepted(j,'b');
 const bDigest=digest(replay(j).tasks.b.receipt);
 j=event(j,{type:'progressRequested',taskId:'b',planningRevision:replay(j).plan.revision,contractRevision:'contract-b',integrationRevision:'I',receiptDigest:bDigest,indexBeforeHash:'after',expectedChange:{from:'[ ]',to:'[x]'}});
 j=event(j,{type:'progressCommitted',taskId:'b',receiptDigest:bDigest,indexBeforeHash:'after',indexAfterHash:'done'});
 const objective=objectiveSnapshot(j);
 assert.throws(()=>event(j,{type:'verifyObjective',objectiveRevision:objective.objectiveRevision,verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'grant'},evidence:['proof'],limitations:[],remainingWork:[]}),/verifier|external|host completion bridge/i);
 assert.throws(()=>event(j,{type:'dispatch',role:'verifier',session:'stale-verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:'stale'}),/stale verifier/);
 j=verifierDispatch(j,'objective-verifier',objective.objectiveRevision);
 assert.throws(()=>event(j,{type:'verifyObjective',session:'root',stopped:true,objectiveRevision:objective.objectiveRevision,verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'grant'},evidence:['proof'],limitations:[],remainingWork:[]}),/role\/session|verifier|host completion bridge/i);
 assert.equal(continuation(j,caps).disposition,'wait');
});

test('objective revision binds the verifier-visible immutable intake and canonical authorities',()=>{
 const immutableIntake={schemaVersion:'asds.execution-intake-snapshot/1',requestContext:{objective:'Submit the literal credential.',project:{constraints:['UI only'],refusals:['No install']}},
   requirements:[{id:'R-N',kind:'negative',source:'request',text:'Do not reject provider-accepted credentials.'}],negativeAndPreservationRules:[{id:'R-N',kind:'negative',source:'request',text:'Do not reject provider-accepted credentials.'}],authorityReferences:{selection:{source:'user'}}};
 const canonicalReferences={package:{manifest:{sha256:'a'.repeat(64)},references:[{id:'coverage',path:'coverage.json',sha256:'b'.repeat(64)}]},authority:{authorizationDigest:'c'.repeat(64)}};
 const complete=context=>{
   let j=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project'],executionScope:{consumableTaskIds:['a'],excludedTaskIds:[]},...context},{version:3});
   j=accepted(j,'a');const receiptDigest=digest(replay(j).tasks.a.receipt);
   j=event(j,{type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'contract-a',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}});
   return event(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
 };
 const baseContext={immutableIntake,intakeDigest:digest(immutableIntake),canonicalReferences};
 assert.throws(()=>createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project'],...baseContext,intakeDigest:'forged'},{version:3}),/immutable intake|digest|bound/i);
 const packet=objectiveSnapshot(complete(baseContext));
 assert.deepEqual(packet.immutableIntake,immutableIntake);assert.deepEqual(packet.canonicalReferences,canonicalReferences);
 assert.equal(packet.intakeDigest,digest(immutableIntake));assert.match(packet.contextDigest,/^[a-f0-9]{64}$/);
 const changed=structuredClone(baseContext);changed.canonicalReferences.authority.authorizationDigest='d'.repeat(64);
 assert.notEqual(objectiveSnapshot(complete(changed)).objectiveRevision,packet.objectiveRevision);
});

test('journal v3 partial scope excludes work and can only finish as partial_consumed',()=>{
 const context={coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project'],executionScope:{consumableTaskIds:['a'],excludedTaskIds:['b']}};
 let j=createJournal(plan([task('a'),task('b')]),context,{version:3});
 assert.equal(replay(j).tasks.b.status,'excluded');assert.deepEqual(readyWave(j,caps).selected,['a']);
 j=accepted(j,'a');const receiptDigest=digest(replay(j).tasks.a.receipt);
 j=event(j,{type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'contract-a',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}});
 j=event(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
 const objective=objectiveSnapshot(j);
 j=verifierDispatch(j,'partial-verifier',objective.objectiveRevision);
 assert.throws(()=>event(j,{type:'verifyObjective',session:'partial-verifier',stopped:true,objectiveRevision:objective.objectiveRevision,verdict:'fail',outcome:'Consumable subset completed.',checks:{originalRequest:'not complete',taskCoverage:'partial',integratedBehavior:'verified subset',authority:'grant'},evidence:['proof'],limitations:['partial package'],remainingWork:['b']}),/host completion bridge/i);
 assert.equal(continuation(j,caps).disposition,'wait');
});

test('legacy journals reject v3-only events and resume through a linked successor without conversion',()=>{
 const legacy=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']},{version:2});
 assert.throws(()=>event(legacy,{type:'progressRequested',taskId:'a',receiptDigest:'r'}),/journal v3/i);
 const successor=createSuccessorJournal(legacy,{coordinator:'next-root',authorization:{source:'user',scope:'resume'},readScope:['project']});
 assert.equal(legacy.version,2);assert.equal(successor.version,3);
 assert.equal(successor.predecessor.version,2);assert.equal(successor.predecessor.sequence,0);
 assert.equal(replay(successor).predecessor.digest,successor.predecessor.digest);
});

test('pause and authorization change invalidate objective verifier until observed stop and fresh dispatch',()=>{
 let j=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project'],constraints:['bounded']},{version:3});
 j=accepted(j,'a');const receiptDigest=digest(replay(j).tasks.a.receipt);
 j=event(j,{type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'contract-a',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}});
 j=event(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
 const first=objectiveSnapshot(j);
 j=event(j,{type:'dispatch',role:'verifier',session:'verifier-1',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:first.objectiveRevision});
 j=event(j,{type:'pause',source:'user',reason:'authorization changing'});
 assert.throws(()=>event(j,{type:'verifyObjective',session:'verifier-1',stopped:true,objectiveRevision:first.objectiveRevision,verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'old'},evidence:['proof'],limitations:[],remainingWork:[]}),/paused|invalidated|host completion bridge/);
 j=event(j,{type:'resume',reason:'narrower grant',authorization:{source:'user follow-up',scope:'demo readback only'}});
 assert.throws(()=>event(j,{type:'dispatch',role:'verifier',session:'verifier-2',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:first.objectiveRevision}),/already active|stop/i);
 j=event(j,{type:'stopVerifier',session:'verifier-1',outcome:'cancelled',reason:'authorization changed',stopped:false});
 assert.equal(replay(j).objectiveVerifier.session,'verifier-1');
 assert.throws(()=>event(j,{type:'verifyObjective',session:'verifier-1',stopped:true,objectiveRevision:first.objectiveRevision,verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'old'},evidence:['proof'],limitations:[],remainingWork:[]}),/stopRequested|invalidated|host completion bridge/);
 j=event(j,{type:'stopVerifier',session:'verifier-1',outcome:'cancelled',reason:'host observed stop',stopped:true});
 assert.equal(replay(j).objectiveVerifier,null);assert.equal(replay(j).objectiveVerifierHistory.length,1);
 const second=objectiveSnapshot(j);assert.notEqual(second.objectiveRevision,first.objectiveRevision);
 assert.throws(()=>event(j,{type:'dispatch',role:'verifier',session:'verifier-2',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:first.objectiveRevision}),/stale/);
 j=verifierDispatch(j,'verifier-2',second.objectiveRevision);
 assert.equal(replay(j).objectiveVerifier.session,'verifier-2');
 assert.equal(continuation(j,caps).objectiveComplete,false);
});

test('failed or drifted objective verifier is archived and a never-reused session can retry',()=>{
 let j=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']},{version:3});
 j=accepted(j,'a');const receiptDigest=digest(replay(j).tasks.a.receipt);
 j=event(j,{type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'contract-a',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}});
 j=event(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
 const objective=objectiveSnapshot(j);
 j=event(j,{type:'dispatch',role:'verifier',session:'drifted-verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:objective.objectiveRevision});
 j=event(j,{type:'stopVerifier',session:'drifted-verifier',outcome:'drifted',reason:'workspace changed',stopped:true});
 assert.throws(()=>event(j,{type:'dispatch',role:'verifier',session:'drifted-verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:objective.objectiveRevision}),/unique|reuse/);
 j=event(j,{type:'dispatch',role:'verifier',session:'replacement-verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:objective.objectiveRevision});
 assert.equal(replay(j).objectiveVerifier.session,'replacement-verifier');
});

test('reopen invalidates verifier and proof and advances objective generation even when receipts repeat',()=>{
 let j=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']},{version:3});
 j=accepted(j,'a');const receiptDigest=digest(replay(j).tasks.a.receipt);
 j=event(j,{type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'contract-a',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}});
 j=event(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
 const completed=j,objective=objectiveSnapshot(j);j=event(j,{type:'dispatch',role:'verifier',session:'verifier-before-reopen',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:objective.objectiveRevision});
 j=event(j,{type:'reopen',taskId:'a',reason:'counterexample'});
 const state=replay(j);assert.equal(state.objectiveGeneration,1);assert.equal(state.objectiveVerifier.invalidated.reason,'reopen');
 assert.equal(state.objectiveInvalidationHistory.at(-1).generation,1);
 assert.throws(()=>event(j,{type:'verifyObjective',session:'verifier-before-reopen',stopped:true,objectiveRevision:objective.objectiveRevision,verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'grant'},evidence:['old proof'],limitations:[],remainingWork:[]}),/invalidated|host completion bridge/);
 j=event(j,{type:'stopVerifier',session:'verifier-before-reopen',outcome:'drifted',reason:'reopen invalidated snapshot',stopped:true});
 assert.ok(replay(j).sessions.includes('verifier-before-reopen'));assert.equal(replay(j).objectiveVerifierHistory.at(-1).session,'verifier-before-reopen');
 const fresh=verifierDispatch(completed,'proof-before-reopen',objective.objectiveRevision);
 assert.throws(()=>event(fresh,{type:'verifyObjective',session:'proof-before-reopen',stopped:true,objectiveRevision:objective.objectiveRevision,verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'grant'},evidence:['proof'],limitations:[],remainingWork:[]}),/host completion bridge/i);
});

test('replan increments the monotonic objective generation before new proof can exist',()=>{
 let j=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']},{version:3});
 const changed=plan([task('a',[],{contractRevision:'contract-a-v2'})]);
 j=event(j,{type:'replan',plan:changed,executionScope:{consumableTaskIds:['a'],excludedTaskIds:[]},reason:'contract correction',authorization:{source:'user',scope:'demo'}});
 assert.equal(replay(j).objectiveGeneration,1);
 j=event(j,{type:'reopen',taskId:'a',reason:'second invalidation'});
 assert.equal(replay(j).objectiveGeneration,2);
});

test('decompose and refine each advance objective generation for invalidated work',()=>{
 const context={coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']};
 const boundary={change:'demo',target:'same bounded outcome',exclusions:['outside demo'],review:{source:'test',verdict:'ready'}};
 let j=createJournal(plan([task('P')]),context,{version:3});
 const packaged=task('P',[],{nodeType:'package'}),child=task('C',[],{nodeType:'task',parentId:'P',write:['src/P.js'],boundary});
 const decomposed=plan([packaged,child]);
 j=event(j,{type:'decompose',taskId:'P',plan:decomposed,executionScope:{consumableTaskIds:['C'],excludedTaskIds:[]},reason:'separable result',authorization:{source:'user',scope:'demo'}});
 assert.equal(replay(j).objectiveGeneration,1);
 const narrowed=task('C',[],{nodeType:'task',parentId:'P',write:['src/P.js'],boundary,body:body+'Narrowed first result.',contractRevision:'contract-C-v2'});
 const added=task('C2',[],{nodeType:'task',parentId:'P',write:['src/P.js'],boundary,body:body+'Narrowed second result.'});
 const refined=plan([packaged,narrowed,added]);
 j=event(j,{type:'refine',taskId:'C',plan:refined,executionScope:{consumableTaskIds:['C','C2'],excludedTaskIds:[]},reason:'split verification',coverageReview:'original outcome remains covered',authorization:{source:'user',scope:'demo'}});
 assert.equal(replay(j).objectiveGeneration,2);
 assert.deepEqual(replay(j).objectiveInvalidationHistory.map(item=>item.reason),['decompose','refine']);
});

test('every task event is rejected before it can mutate an excluded task',()=>{
 const context={coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project'],executionScope:{consumableTaskIds:['a'],excludedTaskIds:['b']}};
 const base=createJournal(plan([task('a'),task('b')]),context,{version:3});
 for(const candidate of [
  {type:'reopen',taskId:'b',reason:'must stay excluded'},
  {type:'block',taskId:'b',owner:'root',reason:'must stay excluded'},
  {type:'operationBlock',taskId:'b',operation:'executor',owner:'root',reason:'must stay excluded'},
 ]) assert.throws(()=>event(base,candidate),/excluded task cannot have runtime events/);
 assert.equal(replay(base).tasks.b.status,'excluded');assert.deepEqual(readyWave(base,caps).selected,['a']);
});

test('v3 plan mutation requires a fresh exact closed execution scope and adopts it atomically',()=>{
 const base=createJournal(plan([task('a')]),{coordinator:'root',authorization:{source:'user',scope:'demo'},readScope:['project']},{version:3});
 const expanded=plan([task('a'),task('b')]);
 const replan={type:'replan',plan:expanded,reason:'add reviewed work',authorization:{source:'user',scope:'demo'}};
 assert.throws(()=>event(base,replan),/requires new executionScope/);
 assert.throws(()=>event(base,{...replan,executionScope:{consumableTaskIds:['a'],excludedTaskIds:[]}}),/exact non-empty partition/);
 assert.throws(()=>event(base,{...replan,executionScope:{consumableTaskIds:['a','b'],excludedTaskIds:['b']}}),/exact non-empty partition/);
 const dependent=plan([task('a'),task('b',['a'])]);
 assert.throws(()=>event(base,{...replan,plan:dependent,executionScope:{consumableTaskIds:['b'],excludedTaskIds:['a']}}),/depends on excluded/);
 let j=event(base,{...replan,executionScope:{consumableTaskIds:['a'],excludedTaskIds:['b']}});
 assert.deepEqual(replay(j).context.executionScope,{consumableTaskIds:['a'],excludedTaskIds:['b']});
 assert.equal(replay(j).tasks.b.status,'excluded');assert.deepEqual(readyWave(j,caps).selected,['a']);
 j=accepted(j,'a');const receiptDigest=digest(replay(j).tasks.a.receipt);
 j=event(j,{type:'progressRequested',taskId:'a',planningRevision:replay(j).plan.revision,contractRevision:'contract-a',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}});
 j=event(j,{type:'progressCommitted',taskId:'a',receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
 assert.deepEqual(objectiveSnapshot(j).executionScope,{consumableTaskIds:['a'],excludedTaskIds:['b']});
});
