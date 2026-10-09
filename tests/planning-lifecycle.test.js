import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planningCandidateSha256, planningReadbackSha256, evaluatePlanningLifecycle, transitionPlanning, revisePlanning, cancelPlanning } from '../lib/planning-lifecycle.mjs';
const fixture = kind => JSON.parse(readFileSync(new URL(`../examples/planning-delivery/${kind}/planning-manifest.json`, import.meta.url)));
const intake = { received: true, planningAccepted: true };
function candidate() {
  const m = fixture('complete'); m.state = 'draft'; m.synthetic = false; m.author = 'author';
  m.authority.destination = '/authorized/plan'; m.readback = null;
  m.layers.C15 = { status: 'blocked', reason: 'Awaiting store readback', references: [] };
  m.tasks = m.tasks.map(t => ({ ...t, write: [] }));
  const hash = planningCandidateSha256(m);
  m.reviews = ['fidelity', 'quality'].map(kind => ({ kind, revision: m.revision, candidateSha256: hash,
    mode: 'self-review', reviewer: 'author', synthetic: false, liveEvidence: 'external-review-session',
    verdict: 'pass', reference: 'reviews.md', scopeTaskIds: ['0001','0002','0003'], findings: [] }));
  return m;
}
function receipt(m, ids = ['0001','0002','0003']) {
  return { revision: m.revision, candidateSha256: planningCandidateSha256(m), readbackSha256: planningReadbackSha256(m), destination: m.authority.destination,
    status: 'matched', synthetic: false, executionEvidence: false, referenceIds: m.references.map(r=>r.id),
    taskIds: ids, evidence: 'external-store-readback', verifiedBy: 'store-adapter', checks: {
      bytes: true, ids: true, relations: true, decisions: true, reviews: true, files: true } };
}
function ready() { return transitionPlanning(transitionPlanning(candidate(), 'reviewing', { intake }), 'ready'); }
test('planning ready requires no implementation, store or execution journal', () => {
  const m = ready(); assert.equal(m.state, 'ready'); assert.ok(m.tasks.every(t=>t.implementationStatus==='not_started'));
  const e = evaluatePlanningLifecycle(m); assert.equal(e.canReady,true); assert.equal(e.canDeliver,false);
  assert.equal(e.executionPerformed,false); assert.equal(e.coverage.structuralStatus,'not-evaluated');
  assert.equal(e.layers.length,16); assert.equal(e.storeVerified,false);
});
test('ready is distinct from delivered and receipt is explicit external evidence, not disk verification', () => {
  const m = ready(); assert.throws(()=>transitionPlanning(m,'delivered'),/readback/);
  m.layers.C15 = { status:'satisfied', reason:'Store readback supplied', references:['tasks.md'] }; m.readback=receipt(m);
  const delivered=transitionPlanning(m,'delivered'); assert.equal(delivered.state,'delivered');
  assert.equal(evaluatePlanningLifecycle(delivered).storeVerified,false);
  assert.equal(delivered.originalRequestedProduct.status,'not_fulfilled');
});
test('a satisfied persistence layer cannot omit its durable readback receipt while reviewing', () => {
  const m=candidate();
  m.state='reviewing';
  m.layers.C15={status:'satisfied',reason:'Draft bytes were read back',references:['tasks.md']};
  m.readback=null;
  assert.ok(evaluatePlanningLifecycle(m).errors.includes('C15 satisfied requires a durable matching readback receipt'));
});
test('intake received, planning acceptance and destination authorization are separate', () => {
  for(const i of [undefined,{}, {received:true}, {planningAccepted:true}]) assert.throws(()=>transitionPlanning(candidate(),'reviewing',{intake:i}),/intake/);
  const m=ready(); m.authority.authorization=''; m.readback=receipt(m); assert.equal(evaluatePlanningLifecycle(m).canDeliver,false);
});
test('all layers evaluated; mandatory layers cannot be NA; empty rationale or missing reference fails', () => {
  for(const edit of [m=>delete m.layers.C03, m=>m.layers.C04.reason='', m=>m.layers.C07.status='not_applicable',
    m=>m.layers.C02.references=['missing'],m=>m.layers.C17={},m=>m.layers.C03.status='skip']) {
    const m=candidate(); edit(m); assert.equal(evaluatePlanningLifecycle(m).canReady,false);
  }
});
test('reviews bind revision, fingerprint, ordered kinds, live evidence, findings, scope and independence', () => {
  for(const edit of [m=>m.reviews=[], m=>m.reviews.reverse(),m=>m.reviews[0].revision='old',
    m=>m.reviews[1].candidateSha256='0'.repeat(64),m=>m.reviews[0].liveEvidence=null,
    m=>m.reviews[0].synthetic=true,m=>m.reviews[1].findings=[{severity:'material',status:'open'}],
    m=>m.reviews[0].scopeTaskIds=['0001'],m=>m.reviewPolicy.independentRequired=true,
    m=>m.reviewPolicy.risk='sensitive',m=>m.reviews[0].reference='missing',m=>m.reviews[0].reviewer=null]) {
    const m=candidate(); edit(m); assert.equal(evaluatePlanningLifecycle(m).canReady,false);
  }
  const m=candidate(); m.reviewPolicy.independentRequired=true; m.reviewPolicy.risk='sensitive';
  m.reviews.forEach(r=>{r.mode='independent';r.reviewer='reviewer';r.candidateSha256=planningCandidateSha256(m);});
  assert.equal(evaluatePlanningLifecycle(m).canReady,true);
});
test('partial localizes blockers, propagates dependents, and preserves independently draftable work', () => {
  const m=candidate(); m.blockers=[{id:'B',owner:'owner',question:'format?',consequence:'export held',resolution:'choose format',affectedTasks:['0002']}];
  for(const id of ['C04','C07','C11','C12','C13','C14']) m.layers[id]={status:'blocked',reason:'B',references:['brief.md'],affectedTasks:['0002']};
  m.reviews.forEach(r=>{r.scopeTaskIds=['0001'];r.candidateSha256=planningCandidateSha256(m);});
  let e=evaluatePlanningLifecycle(m); assert.deepEqual(e.readyTaskIds,['0001']); assert.deepEqual(e.blockedTaskIds,['0002','0003']);
  assert.deepEqual(e.draftableTaskIds,['0001','0002','0003']); assert.equal(e.canReady,false);
  m.layers.C15={status:'satisfied',reason:'Subset persisted',references:['tasks.md']}; m.readback=receipt(m,['0001']);
  const partial=transitionPlanning(transitionPlanning(m,'reviewing',{intake}),'partial'); assert.equal(partial.state,'partial');
  assert.equal(partial.blockers.length,1); assert.deepEqual(partial.planningContribution.usableTasks,['0001']);
  assert.equal(evaluatePlanningLifecycle(partial).canPartial,true);
  assert.equal(evaluatePlanningLifecycle(partial).storeVerified,false);
  assert.equal(transitionPlanning(partial,'draft').state,'draft');
});
test('synthetic T01 complete/partial/blocked never qualify live delivery, absent T04 is not invalid coverage', () => {
  for(const kind of ['complete','partial','blocked']) {
    const e=evaluatePlanningLifecycle(fixture(kind)); assert.equal(e.canDeliver,false); assert.equal(e.coverage.structuralStatus,'not-evaluated');
  }
});
test('readback rejects stale, synthetic, missing/duplicate files, wrong destination and unchecked comparisons', () => {
  for(const edit of [r=>r.revision='old',r=>r.candidateSha256='bad',r=>r.synthetic=true,r=>r.executionEvidence=true,
    r=>delete r.readbackSha256,r=>r.readbackSha256='0'.repeat(64),r=>r.destination='other',r=>r.referenceIds.pop(),r=>r.referenceIds.push(r.referenceIds[0]),r=>r.checks.bytes=false,
    r=>r.evidence='',r=>r.verifiedBy='',r=>r.taskIds=['0001'],r=>r.status='mismatch']) {
    const m=ready();m.layers.C15={status:'satisfied',reason:'readback',references:['tasks.md']};m.readback=receipt(m);edit(m.readback);
    assert.equal(evaluatePlanningLifecycle(m).canDeliver,false);
  }
});
test('answered decisions never reopen interview; material unresolved choice must have localized blocker', () => {
  const m=candidate(); assert.deepEqual(evaluatePlanningLifecycle(m).questions,[]);
  m.decisions.push({id:'D-new',status:'pending',material:true,owner:'owner',source:'brief.md',reason:'format'});
  assert.equal(evaluatePlanningLifecycle(m).canReady,false);
  m.blockers=[{id:'B',decisionId:'D-new',owner:'owner',question:'format?',consequence:'held',resolution:'choose',affectedTasks:['0002']}];
  assert.equal(evaluatePlanningLifecycle(m).questions.length,1);
  m.blockers[0].decisionId='D01'; assert.ok(evaluatePlanningLifecycle(m).errors.some(e=>e.includes('resolved')));
});
test('invalid graph, coverage and shapes fail closed without throwing evaluation', () => {
  for(const m of [null,{}, {...candidate(),tasks:[]}, {...candidate(),references:[]}, {...candidate(),layers:null},
    {...candidate(),coverage:{}}, {...candidate(),coverage:{tasks:[null]}}, {...candidate(),blockers:[null]}]) assert.equal(evaluatePlanningLifecycle(m).canReady,false);
  const m=candidate();m.tasks[1].dependsOn=['ghost'];assert.equal(evaluatePlanningLifecycle(m).canReady,false);
});
test('material revision invalidates reviews/readback, preserving previous and coherent cancellation', () => {
  const m=ready(), before=structuredClone(m); const revised=revisePlanning(m,'complete-r2');
  assert.equal(revised.state,'draft');assert.deepEqual(revised.reviews,[]);assert.equal(revised.readback,null);
  assert.equal(evaluatePlanningLifecycle(revised).canReady,false);assert.deepEqual(m,before);
  assert.throws(()=>revisePlanning(m,m.revision),/revision/);
  const stopped=cancelPlanning(m,'Operator interrupted');assert.equal(stopped.state,'ready');assert.equal(stopped.attendanceOutcome,'cancelled');
  assert.throws(()=>cancelPlanning(m,''),/reason/);assert.throws(()=>transitionPlanning(stopped,'reviewing',{intake}),/cancelled/);
});
test('state matrix rejects integrated, shortcuts and mutation of delivered; superseding requires coherent successor', () => {
  assert.throws(()=>transitionPlanning(candidate(),'ready'),/transition/);assert.throws(()=>transitionPlanning(candidate(),'integrated'),/transition/);
  const m=ready();m.layers.C15={status:'satisfied',reason:'receipt',references:['tasks.md']};m.readback=receipt(m);
  const d=transitionPlanning(m,'delivered');assert.throws(()=>transitionPlanning(d,'draft'),/transition/);
  assert.throws(()=>transitionPlanning(d,'superseded'),/successor/);
  const successor=ready(); successor.revision='r2'; successor.reviews.forEach(r=>{r.revision='r2';r.candidateSha256=planningCandidateSha256(successor);});
  assert.equal(transitionPlanning(d,'superseded',{successor}).state,'superseded');
  assert.throws(()=>transitionPlanning(d,'superseded',{successor:{packageId:d.packageId,revision:'r2',state:'ready'}}),/successor/);
  const b=candidate();b.reviews=[];const blocked=transitionPlanning(b,'blocked');assert.equal(blocked.state,'blocked');
  assert.equal(transitionPlanning(blocked,'reviewing',{intake}).state,'reviewing');
});
for (const state of ['delivered','partial']) test(`superseding rejects declared ${state} successor that only satisfies ready`, () => {
  const prior = ready(); prior.layers.C15={status:'satisfied',reason:'readback',references:['tasks.md']}; prior.readback=receipt(prior);
  const delivered = transitionPlanning(prior,'delivered');
  {
    const successor=ready(); successor.revision='r2'; successor.state=state;
    successor.reviews.forEach(r=>{r.revision='r2';r.candidateSha256=planningCandidateSha256(successor);});
    const before=structuredClone({delivered,successor});
    const e=evaluatePlanningLifecycle(successor);
    assert.equal(e.canReady,true);assert.equal(e.canDeliver,false);assert.equal(e.canPartial,false);
    assert.throws(()=>transitionPlanning(delivered,'superseded',{successor}),/successor/,state);
    assert.deepEqual({delivered,successor},before);
  }
});
test('superseding accepts only the matching ready, delivered or partial gate without input mutation', () => {
  const prior=ready();prior.layers.C15={status:'satisfied',reason:'readback',references:['tasks.md']};prior.readback=receipt(prior);
  const delivered=transitionPlanning(prior,'delivered');
  for (const state of ['ready','delivered','partial']) {
    const successor=ready();successor.revision='r2';successor.state=state;
    if (state==='partial') successor.blockers=[{id:'B',owner:'owner',question:'format?',consequence:'held',resolution:'choose',affectedTasks:['0002']}];
    successor.reviews.forEach(r=>{r.revision='r2';r.candidateSha256=planningCandidateSha256(successor);});
    if (state!=='ready') {
      successor.layers.C15={status:'satisfied',reason:'readback',references:['tasks.md']};
      successor.readback=receipt(successor,state==='partial'?['0001']:['0001','0002','0003']);
    }
    const e=evaluatePlanningLifecycle(successor);
    assert.equal(e[{ready:'canReady',delivered:'canDeliver',partial:'canPartial'}[state]],true);
    assert.equal(e.storeVerified,false);
    const before=structuredClone({delivered,successor});
    const next=transitionPlanning(delivered,'superseded',{successor});
    assert.equal(next.state,'superseded');assert.equal(next.supersededBy,'r2');
    assert.deepEqual({delivered,successor},before);
  }
});
test('finding envelopes fail closed on missing, unknown or case-variant severity/status', () => {
  const findings=[{}, {severity:'material'}, {status:'resolved'},
    {severity:'MAterial',status:'open'}, {severity:'unknown',status:'resolved'},
    {severity:'material',status:'unknown'}, {severity:'material',status:'Resolved'},
    {severity:'non-material',status:'OPEN'}, {severity:'Non-material',status:'resolved'},
    {severity:'',status:'resolved'}, {severity:'material',status:''},
    {severity:' material',status:'resolved'}, {severity:'material',status:'resolved '},
    {severity:null,status:'resolved'}, {severity:'material',status:null}];
  for (const finding of findings) {
    const m=candidate();m.reviews[0].findings=[finding];const before=structuredClone(m);
    const e=evaluatePlanningLifecycle(m);
    assert.equal(e.canReady,false,JSON.stringify(finding));assert.equal(e.canDeliver,false);assert.equal(e.canPartial,false);
    assert.ok(e.errors.some(error=>error.includes('review envelope')));assert.deepEqual(m,before);
  }
});
test('case-variant material finding cannot bypass the material gate', () => {
  const m=candidate();m.reviews[0].findings=[{severity:'MAterial',status:'open'}];
  assert.equal(evaluatePlanningLifecycle(m).canReady,false);
});
test('finding gates require material resolution and permit explicit non-material open/resolved', () => {
  for (const [severity,status,canReady] of [['material','open',false],['material','resolved',true],
    ['non-material','open',true],['non-material','resolved',true]]) {
    const m=candidate();m.reviews[0].findings=[{severity,status}];const before=structuredClone(m);
    const e=evaluatePlanningLifecycle(m);assert.equal(e.canReady,canReady);assert.equal(e.storeVerified,false);
    assert.deepEqual(m,before);
  }
});
test('pure dependency surface excludes filesystem, journal, model and host execution modules', () => {
  const source=readFileSync(new URL('../lib/planning-lifecycle.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from\s+['"](?:node:fs|node:child_process|.*(?:orchestration|host-bridge|planning-store))/);
  const m=candidate(),before=structuredClone(m);evaluatePlanningLifecycle(m);assert.deepEqual(m,before);
});

test('old readback cannot attest changed review artifact hashes or paths', () => {
  for (const edit of [r=>r.sha256='0'.repeat(64), r=>r.path='reviews/replaced.md']) {
    const m=ready(); m.layers.C15={status:'satisfied',reason:'readback',references:['tasks.md']}; m.readback=receipt(m);
    assert.equal(evaluatePlanningLifecycle(m).canDeliver,true);
    const before=planningCandidateSha256(m), oldReceipt=structuredClone(m.readback);
    edit(m.references.find(r=>r.role==='review'));
    assert.equal(planningCandidateSha256(m),before, 'review identity stays non-circular');
    assert.deepEqual(m.readback,oldReceipt);
    assert.deepEqual(evaluatePlanningLifecycle(m).errors,[]);
    assert.equal(evaluatePlanningLifecycle(m).canDeliver,false);
    assert.throws(()=>transitionPlanning(m,'delivered'),/readback/);
    m.readback=receipt(m);
    assert.equal(transitionPlanning(m,'delivered').state,'delivered');
    assert.equal(evaluatePlanningLifecycle(m).storeVerified,false);
  }
});
test('readback binds all artifacts, task boundaries, decisions and delivery policy independently of renewed reviews', () => {
  const edits=[
    ...['source','index','contract'].flatMap(role=>[
      m=>m.references.find(r=>r.role===role).sha256='0'.repeat(64),
      m=>m.references.find(r=>r.role===role).path='changed/'+role+'.md']),
    m=>m.tasks[1].read=['changed-source.md'], m=>{m.tasks[1].dependsOn=['0002'];m.tasks[1].dependencyDetails=[{id:'0002',reason:'changed precedence',requiredOutput:'export interface'}];},
    m=>m.decisions[0].reason='changed decision', m=>m.authority.authorization='renewed authorization',
    m=>m.reviewPolicy.reason='renewed policy', m=>m.layers.C16.reason='renewed delivery',
    m=>m.parallelism.reason='renewed recommendation', m=>m.planningContribution.limitations=['changed limit'],
    m=>m.reviews[0].liveEvidence='renewed review session', m=>m.author='changed-author',
    m=>m.returnVersion='changed-return-contract'
  ];
  for (const edit of edits) {
    const m=ready();m.layers.C15={status:'satisfied',reason:'readback',references:['tasks.md']};m.readback=receipt(m);
    const before=planningReadbackSha256(m);edit(m);
    m.reviews.forEach(r=>r.candidateSha256=planningCandidateSha256(m));
    assert.equal(evaluatePlanningLifecycle(m).canReady,true);
    assert.notEqual(planningReadbackSha256(m),before);
    assert.equal(evaluatePlanningLifecycle(m).canDeliver,false);
    assert.throws(()=>transitionPlanning(m,'delivered'),/readback/);
    m.readback=receipt(m);assert.equal(evaluatePlanningLifecycle(m).canDeliver,true);
    assert.equal(evaluatePlanningLifecycle(m).storeVerified,false);
  }
});
test('readback digest is pure, excludes its receipt and transition bookkeeping, and survives partial delivery', () => {
  const m=ready(), before=structuredClone(m), fingerprint=planningReadbackSha256(m);
  assert.match(fingerprint,/^[a-f0-9]{64}$/);assert.deepEqual(m,before);
  m.readback={arbitrary:'receipt'};m.state='delivered';m.attendanceOutcome='planning_delivered';
  m.tasks[1].implementationStatus='historically_completed';m.planningContribution.usableTasks=['0001'];
  assert.equal(planningReadbackSha256(m),fingerprint);
});
test('reviewing cannot promote to ready without current sufficient reviews', () => {
  const m=transitionPlanning(candidate(),'reviewing',{intake}); m.reviews=[];
  assert.equal(evaluatePlanningLifecycle(m).canReady,false);
  assert.throws(()=>transitionPlanning(m,'ready'),/planning ready gate/);
  const blocked=transitionPlanning(candidate(),'reviewing',{intake});
  blocked.layers.C11={status:'blocked',reason:'missing contracts',references:[]};
  assert.throws(()=>transitionPlanning(blocked,'ready'),/planning ready gate/);
});

function coverageFor(m) {
  const requirements=[...new Set(m.tasks.flatMap(t=>t.requirements))].map(id=>({id,kind:'obligation',source:'brief.md',text:id}));
  const tasks=m.tasks.map(t=>({id:t.id,nodeType:t.nodeType,parentId:t.parentId,requirements:t.requirements}));
  const leaves=tasks.filter(t=>t.nodeType==='task');
  const acceptances=leaves.map(t=>({id:'A'+t.id,taskId:t.id,text:'criterion'}));
  const scenarios=leaves.map(t=>({id:'S'+t.id}));
  const mappings=leaves.flatMap(t=>t.requirements.map(requirementId=>({requirementId,decisionIds:[],scenarioId:'S'+t.id,taskId:t.id,acceptanceId:'A'+t.id})));
  return {requirements,decisions:[],scenarios,tasks,acceptances,mappings};
}
test('explicit T04 coverage is bound additively; valid map remains need-review, not semantic pass',()=>{
  const m=candidate();m.coverage=coverageFor(m);m.reviews.forEach(r=>r.candidateSha256=planningCandidateSha256(m));
  const e=evaluatePlanningLifecycle(m);assert.equal(e.coverage.structuralStatus,'valid');assert.equal(e.coverage.semanticStatus,'need-review');assert.equal(e.canReady,true);
  m.coverage.tasks.reverse();assert.ok(evaluatePlanningLifecycle(m).errors.includes('coverage task inventory differs from candidate'));
});
test('malformed nested envelopes and policy fail closed; global blockers preserve drafting and material boundary',()=>{
  for(const edit of [m=>m.reviewPolicy=null,m=>m.reviewPolicy={},m=>m.references[0].sha256='bad',
    m=>m.references.push(m.references[0]),m=>m.layers.C04=null,m=>m.layers.C03.references=[],
    m=>m.reviews[0].findings=[null],m=>m.reviews[0].findings=null,m=>m.reviews[0].scopeTaskIds=null,
    m=>m.reviews[0].scopeTaskIds=['ghost'],m=>m.reviews[0].mode='fake',m=>m.reviews[0].verdict='blocked',
    m=>m.blockers=[{id:'B',affectedTasks:['ghost']}],m=>m.blockers=[{id:'B',affectedTasks:[]}],
    m=>m.planningContribution.executionPerformed=true,m=>m.originalRequestedProduct.status='fulfilled']) {
    const m=candidate();edit(m);assert.equal(evaluatePlanningLifecycle(m).canReady,false);
  }
  const m=candidate();m.blockers=[{id:'B',owner:'owner',question:'reviewer?',consequence:'global',resolution:'review'}];
  const e=evaluatePlanningLifecycle(m);assert.equal(e.canReady,false);assert.deepEqual(e.blockedTaskIds,['0001','0002','0003']);assert.equal(e.draftableTaskIds.length,3);
  m.blockers[0].affectedTasks=['P01'];assert.equal(evaluatePlanningLifecycle(m).blockedTaskIds.length,3);
  m.blockers.push(m.blockers[0]);assert.ok(evaluatePlanningLifecycle(m).errors.some(e=>e.includes('invalid blocker')));
});
test('metadata drift invalidates review; declared hash is not accepted as verified on disk',()=>{
  const m=candidate();m.references[0].sha256='0'.repeat(64);assert.equal(evaluatePlanningLifecycle(m).canReady,false);
  assert.equal(evaluatePlanningLifecycle(m).storeVerified,false);
  const historical=candidate(), fingerprint=planningCandidateSha256(historical);
  historical.tasks[1].implementationStatus='historically_completed';
  assert.equal(planningCandidateSha256(historical),fingerprint);
  assert.equal(evaluatePlanningLifecycle(historical).canReady,true);
});
test('cancellation cannot be bypassed by revision helper and ready cannot be passed via malformed product',()=>{
  const stopped=cancelPlanning(ready(),'stop');assert.throws(()=>revisePlanning(stopped,'r2'),/cancelled/);
});


// Refresh supplied external envelopes so a status failure is not a stale-proof failure.
function refreshDecisionEvidence(m, taskIds = ['0001','0002','0003']) {
  m.reviews.forEach(r=>{r.scopeTaskIds=taskIds;r.candidateSha256=planningCandidateSha256(m);});
  m.layers.C15={status:'satisfied',reason:'Supplied readback',references:['tasks.md']};
  m.readback=receipt(m,taskIds);
}
for (const status of [undefined,null,'unknown','UNRESOLVED','Resolved','resolved ',0,true,{},[]]) {
  test(`explicit material decision rejects invalid status ${JSON.stringify(status)} even with fresh envelopes`,()=>{
    for (const withBlocker of [false,true]) {
      const m=ready();
      const d={id:'D-hostile',material:true,owner:'owner',source:'brief.md',reason:'format choice'};
      if(status!==undefined)d.status=status;
      m.decisions.push(d);
      if(withBlocker)m.blockers=[{id:'B',decisionId:d.id,owner:'owner',question:'format?',consequence:'held',resolution:'choose',affectedTasks:['0002']}];
      refreshDecisionEvidence(m,withBlocker?['0001']:['0001','0002','0003']);
      const before=structuredClone(m),e=evaluatePlanningLifecycle(m);
      assert.equal(e.canReady,false);assert.equal(e.canDeliver,false);assert.equal(e.canPartial,false);
      assert.ok(e.errors.some(error=>error.includes('invalid material decision status')));
      assert.throws(()=>transitionPlanning({...m,state:'reviewing'},'ready'),/ready gate/);
      assert.throws(()=>transitionPlanning(m,'delivered'),/readback\/review gate/);
      assert.throws(()=>transitionPlanning(m,'partial'),/readback\/review gate/);
      assert.deepEqual(m,before);assert.equal(e.storeVerified,false);
    }
  });
}
for (const status of ['pending','unresolved','proposed']) test(`material ${status} requires blocker and preserves localized partial delivery`,()=>{
  const m=ready();m.decisions.push({id:'D-choice',material:true,status,owner:'owner',source:'brief.md',reason:'format choice'});
  refreshDecisionEvidence(m);
  let e=evaluatePlanningLifecycle(m);
  assert.ok(e.errors.some(error=>error.includes('unresolved material decision needs blocker')));
  assert.equal(e.canReady,false);assert.equal(e.canDeliver,false);assert.equal(e.canPartial,false);
  assert.throws(()=>transitionPlanning(m,'delivered'),/readback\/review gate/);
  m.blockers=[{id:'B',decisionId:'D-choice',owner:'owner',question:'format?',consequence:'held',resolution:'choose',affectedTasks:['0002']}];
  refreshDecisionEvidence(m,['0001']);const before=structuredClone(m);e=evaluatePlanningLifecycle(m);
  assert.deepEqual(e.errors,[]);assert.equal(e.canReady,false);assert.equal(e.canDeliver,false);assert.equal(e.canPartial,true);
  assert.deepEqual(e.readyTaskIds,['0001']);assert.deepEqual(e.blockedTaskIds,['0002','0003']);
  assert.deepEqual(e.draftableTaskIds,['0001','0002','0003']);assert.equal(e.questions.length,1);
  const partial=transitionPlanning(m,'partial');assert.equal(partial.state,'partial');assert.deepEqual(partial.planningContribution.usableTasks,['0001']);
  assert.deepEqual(m,before);assert.equal(e.storeVerified,false);
});
test('resolved material choice is reused without reopening interview or fabricating approval',()=>{
  const m=ready();m.decisions.push({id:'D-resolved',material:true,status:'resolved',owner:'owner',source:'brief.md',reason:'operator choice'});
  refreshDecisionEvidence(m);const before=structuredClone(m),e=evaluatePlanningLifecycle(m);
  assert.deepEqual(e.errors,[]);assert.deepEqual(e.questions,[]);assert.equal(e.canReady,true);assert.equal(e.canDeliver,true);
  assert.equal(transitionPlanning({...m,state:'reviewing'},'ready').state,'ready');
  assert.equal(transitionPlanning(m,'delivered').state,'delivered');assert.deepEqual(m,before);
});
test('non-material choices and T01 absent material markers do not acquire a material blocker requirement',()=>{
  for(const material of [false,undefined])for(const status of ['pending','unresolved','proposed','resolved']) {
    const m=ready(),d={id:'D-nonmaterial',status,owner:'owner',source:'brief.md',reason:'nonblocking choice'};
    if(material!==undefined)d.material=material;m.decisions.push(d);refreshDecisionEvidence(m);
    const before=structuredClone(m),e=evaluatePlanningLifecycle(m);
    assert.deepEqual(e.errors,[]);assert.equal(e.canReady,true);assert.equal(e.canDeliver,true);assert.deepEqual(e.questions,[]);
    assert.deepEqual(m,before);
  }
});
