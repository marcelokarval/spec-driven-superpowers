import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { replay, continuation, objectiveSnapshot, appendEvent, createSuccessorJournal, digest } from '../lib/orchestration.mjs';

const fixture=new URL('./fixtures/orchestration/login-pilot-v1/',import.meta.url);
const journal=JSON.parse(fs.readFileSync(new URL('run-v1.json',fixture)));
const expected=JSON.parse(fs.readFileSync(new URL('expected.json',fixture)));

test('sanitized pilot remains an honest replayable v1 regression fixture',()=>{
  const serialized=JSON.stringify(journal),state=replay(journal);
  assert.doesNotMatch(serialized,/\/home\/|marcelo|root-codex|\/root\/asds_|agy-/);
  assert.equal(state.journalVersion,1);
  assert.equal(createHash('sha256').update(JSON.stringify(state)).digest('hex'),expected.stateSha256);
  assert.equal(digest(state),expected.semanticDigest);
  assert.equal(state.sequence,expected.sequence);
  assert.deepEqual(journal.events.map(entry=>entry.event.type),expected.eventTypes);
  assert.deepEqual(Object.entries(state.tasks).filter(([,task])=>task.status==='accepted').map(([id])=>id).sort(),expected.acceptedTaskIds);
  const result=continuation(journal,{spawn:false,externalActive:0,externalReservations:[]});
  assert.equal(result.disposition,'verify_objective');
  assert.equal(result.objectiveComplete,false);
  const snapshot=objectiveSnapshot(journal);
  const completed=appendEvent(journal,{type:'verifyObjective',objectiveRevision:snapshot.objectiveRevision,verdict:'pass',
    outcome:'The bounded fixture objective is satisfied.',checks:{originalRequest:'matched',taskCoverage:'accepted',
      integratedBehavior:'receipts verified',authority:'fixture grant'},evidence:['replayed accepted receipts'],
    limitations:['Historical v1 run has no v2 isolation attestations'],remainingWork:[]},state.sequence);
  assert.equal(continuation(completed,{spawn:false,externalActive:0,externalReservations:[]}).disposition,'await_host_reobservation');
});

test('golden journal v2 replays byte-for-byte and semantically without v3 reinterpretation',()=>{
  const root=new URL('./fixtures/orchestration/golden-v2/',import.meta.url);
  const v2=JSON.parse(fs.readFileSync(new URL('run-v2.json',root)));
  const golden=JSON.parse(fs.readFileSync(new URL('expected.json',root)));
  const state=replay(v2);
  assert.equal(state.journalVersion,2);
  assert.equal(state.sequence,golden.sequence);
  assert.deepEqual(v2.events.map(entry=>entry.event.type),golden.eventTypes);
  assert.equal(createHash('sha256').update(JSON.stringify(state)).digest('hex'),golden.stateSha256);
  assert.equal(digest(state),golden.semanticDigest);
  assert.throws(()=>appendEvent(v2,{type:'progressRequested',taskId:'golden',receiptDigest:'v3-only'},state.sequence),/journal v3/);
});

test('v1 pilot accepted work requires explicit receipt reconciliation and imports without re-execution',()=>{
  const state=replay(journal),sourceDigest=journal.events.at(-1).digest;
  assert.throws(()=>createSuccessorJournal(journal,{coordinator:'successor-root',authorization:{source:'user',scope:'resume'},readScope:['fixture']}),/reconciliation.*accepted/i);
  const reconciliation=expected.acceptedTaskIds.map(taskId=>({taskId,receiptDigest:digest(state.tasks[taskId].receipt),decisionDigest:digest(state.tasks[taskId].decision)}));
  const successor=createSuccessorJournal(journal,{coordinator:'successor-root',authorization:{source:'user',scope:'resume'},readScope:['fixture']},{reconciliation});
  const resumed=replay(successor);
  assert.equal(successor.predecessor.digest,sourceDigest);
  assert.deepEqual(expected.acceptedTaskIds.map(id=>resumed.tasks[id].status),['completed','completed']);
  assert.deepEqual(expected.acceptedTaskIds.map(id=>resumed.tasks[id].receipt.integrationRevision),expected.acceptedTaskIds.map(id=>state.tasks[id].receipt.integrationRevision));
  assert.deepEqual(continuation(successor,{spawn:true,isolatedWrites:true,maxAgents:8,externalActive:0,models:[]}).actions,[]);
  assert.throws(()=>createSuccessorJournal(journal,{coordinator:'successor-root',authorization:{source:'user',scope:'resume'},readScope:['fixture']},{reconciliation:reconciliation.slice(1)}),/reconciliation.*accepted/i);
  assert.throws(()=>createSuccessorJournal(journal,{coordinator:'successor-root',authorization:{source:'user',scope:'resume'},readScope:['fixture']},{reconciliation:reconciliation.map((item,index)=>index?item:{...item,receiptDigest:'0'.repeat(64)})}),/does not match receipt/);
  assert.throws(()=>createSuccessorJournal(journal,{coordinator:'successor-root',authorization:{source:'user',scope:'resume'},readScope:['fixture'],executionScope:{consumableTaskIds:['0005'],excludedTaskIds:['0007']}},{reconciliation}),/depends on excluded/);
  assert.throws(()=>createSuccessorJournal(journal,{coordinator:'successor-root',authorization:{source:'user',scope:'resume'},readScope:['fixture'],executionScope:{consumableTaskIds:['0007'],excludedTaskIds:['0005']}},{reconciliation}),/reconciled.*excluded|excluded.*reconciled/i);
  assert.throws(()=>createSuccessorJournal(journal,{coordinator:'successor-root',authorization:{source:'user',scope:'resume'},readScope:['fixture']},{reconciliation:reconciliation.map((item,index)=>index?item:{...item,unexpected:true})}),/reconciliation.*fields/i);
});
