import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPlanningPackage, recordPlanningReviews } from '../lib/package-builder.mjs';
import { planningCandidateSha256 } from '../lib/planning-lifecycle.mjs';
import { syncPlanningPackage } from '../lib/package-builder.mjs';
import { harnessCandidate, reviewDigest, HARNESS_REVIEW_VERSION, createHarnessPlanningReview, validateHarnessReview } from '../lib/harness-planning-review.mjs';
import { publishReviewedPlanningPackage, verifyPlanningReceipt, publishPlanningBundle, readPlanningBundle } from '../lib/planning-store.mjs';
import { spawnSync } from 'node:child_process';
import { createExecutionHandoff, inspectExecutionPackage } from '../lib/execution-handoff.mjs';
import { validateChange } from '../lib/validation.mjs';
import { createPlanningReturn, acceptWork, receiveHandoff } from '../lib/handoff.mjs';
import { planInstall, applyInstall } from '../lib/install.mjs';
import { planningReadbackSha256 } from '../lib/planning-lifecycle.mjs';
import { fileURLToPath } from 'node:url';

function fixture(root, overrides = {}) {
  return buildPlanningPackage(root,{packageId:'synthetic-csv',revision:'r1',author:{actorId:'synthetic-author',sessionId:'synthetic-C'},
    destination:root,persistenceGranted:true,authorization:'synthetic test grant, not runtime provenance',
    reviewPolicy:{risk:'elevated',domains:['authorization'],independentRequired:true},
    originalRequestedProduct:{kind:'implementation',status:'not_fulfilled',text:'CSV own orders only',source:'synthetic user'},
    layers:Object.fromEntries(Array.from({length:16},(_,i)=>[`C${String(i+1).padStart(2,'0')}`,{status:'satisfied',reason:'Synthetic explicit layer assessment, no runtime proof',references:['tasks-index']} ])),
    tasks:[{id:'0001',title:'CSV own orders',owner:'future-executor',write:['src/csv'],resources:[],dependsOn:[],requirements:['R1'],scenarios:['S1'],verification:['future-test'],
      boundary:{change:'CSV export',target:'src/csv',exclusions:['other users orders'],review:{verdict:'ready',source:'synthetic fixture before freeze'}}}], ...overrides}).manifest;
}
function review(root,m,kind,prior=null) {
  const c=harnessCandidate(m),sessionId=`synthetic-${kind}`;
  const content=JSON.stringify({synthetic:true,kind,verdict:'pass',result:'fixture only; not runtime qualification'});
  fs.mkdirSync(path.join(root,'evidence'),{recursive:true});
  fs.writeFileSync(path.join(root,`evidence/${kind}.json`),content);
  const r={schemaVersion:HARNESS_REVIEW_VERSION,...c,kind,reviewer:{actorId:sessionId,sessionId,agentRole:'same-reviewer-role',parentSessionId:'synthetic-C'},
    assignment:{id:`assignment-${kind}`,requestedBySessionId:m.author.sessionId,kind,candidateSha256:c.candidateSha256,scopeTaskIds:c.taskIds},
    priorReviewDigest:prior?.envelopeDigest??null,verdict:'pass',findings:[],limitations:[],
    evidence:{harness:'synthetic test',sessionId,messageIds:[`synthetic-message-${kind}`],requestDigest:reviewDigest('synthetic request'),resultDigest:reviewDigest(content),persistedResultPath:`evidence/${kind}.json`,observedBySessionId:m.author.sessionId}};
  r.envelopeDigest=reviewDigest(r);return r;
}
test('C1 A01/A02 synthetic explicit F and Q distinct sessions can deliver and reopen in new Node',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-positive-'));
  try {
    let m=fixture(root);
    const taskBefore=fs.readFileSync(path.join(root,'tasks/task-0001.md'),'utf8');
    const q=review(root,m,'quality');assert.throws(()=>recordPlanningReviews(root,q),/prior registered fidelity/);
    assert.throws(()=>syncPlanningPackage(root,{state:'ready'}),/ready requires/);
    const f=review(root,m,'fidelity');m=recordPlanningReviews(root,f).manifest;
    assert.equal(m.reviews.length,1);
    assert.equal(fs.readFileSync(path.join(root,'tasks/task-0001.md'),'utf8'),taskBefore);
    const quality=review(root,m,'quality',f);
    m=recordPlanningReviews(root,quality).manifest;
    m=syncPlanningPackage(root,{state:'ready'}).manifest;
    const frozenManifest=fs.readFileSync(path.join(root,'planning-manifest.json'));
    await assert.rejects(publishReviewedPlanningPackage(root,{verifiedBy:'synthetic-C',expectedManifestSha256:'0'.repeat(64)}),/CAS required/);
    await assert.rejects(publishReviewedPlanningPackage(root,{verifiedBy:'synthetic-C',expectedManifestSha256:reviewDigest(frozenManifest),failAfter:1}),/injected planning publication failure/);
    assert.deepEqual(fs.readFileSync(path.join(root,'planning-manifest.json')),frozenManifest,'ordinary failure preserves coherent ready package');
    const receipt=await publishReviewedPlanningPackage(root,{verifiedBy:'synthetic-C',expectedManifestSha256:reviewDigest(fs.readFileSync(path.join(root,'planning-manifest.json')))});
    assert.equal((await verifyPlanningReceipt(receipt,{status:'delivered'})).matched,true);
    const work=acceptWork(receiveHandoff({objective:'CSV own orders only',project:root,scope:['CSV'],constraints:['no product execution'],risks:['ownership'],references:[],authorizations:[]}));
    const returned=await createPlanningReturn(work,{status:'delivered',outcome:'Synthetic planning only',revision:'r1',manifest:'planning-manifest.json',evidence:['synthetic store receipt'],remainingPlanningWork:[],limitations:[],persistenceReceipt:receipt,originalRequest:{product:'implementation',status:'not_fulfilled'}});
    assert.equal(returned.status,'delivered',returned.limitations.join('; '));assert.equal(returned.owner,null);
    assert.deepEqual(validateChange(root),[]);
    const now='2026-10-15T12:00:00.000Z';
    fs.mkdirSync(path.join(root,'.git'));
    const inspected=inspectExecutionPackage(root),binding={requestId:'synthetic-request',packageId:inspected.packageId,planningRevision:inspected.planningRevision,planningFingerprint:inspected.planningFingerprint,consumableTaskIds:inspected.executionScope.consumableTaskIds};
    const input={packageRoot:root,requestContext:{requestId:'synthetic-request',objective:'CSV own orders only',source:'synthetic user',binding,project:{root,readScope:['.'],constraints:['no product run'],refusals:[],authorizations:['synthetic only']}},author:{actor:'synthetic-C',adapter:'synthetic',source:'synthetic session',observedAt:now},selection:{consumer:'asds-execution-consumer',selected:true,source:'synthetic selection',observedAt:now,binding},grants:[{kind:'execution',granted:true,source:'synthetic grant',scope:{projectRoot:root,binding},validFrom:'2026-10-15T11:00:00.000Z',validUntil:'2026-10-15T13:00:00.000Z'},{kind:'evidence-persistence',granted:true,source:'synthetic grant',scope:{journal:'.asds/journal.jsonl',evidence:'.asds/evidence'},validFrom:'2026-10-15T11:00:00.000Z',validUntil:'2026-10-15T13:00:00.000Z'}],destination:{journal:'.asds/journal.jsonl',evidence:'.asds/evidence',source:'synthetic grant'},workspace:{projectRoot:root,workspaceId:'synthetic-workspace',repoIdentity:{vcs:'git',rootRealpath:root,commonDirRealpath:path.join(root,'.git'),baseRevision:'a'.repeat(40)},baseline:{version:1,baseRevision:'a'.repeat(40),workspaceRevision:`${'a'.repeat(40)}+worktree:${'b'.repeat(64)}`,committedSinceBase:[],staged:[],unstaged:[],untracked:[]},observedAt:now,source:'synthetic observer'},coordinatorBoundary:{enforced:true,projectReadOnly:true,brokers:['journal','evidence','progress'],source:'synthetic boundary',observedAt:now},now};
    const envelope=createExecutionHandoff(input);
    assert.equal(envelope.schemaVersion,'asds.execution-handoff/1');
    assert.deepEqual(envelope.executionScope.consumableTaskIds,['0001']); // envelope only; no consumer run
    const index=path.join(root,'tasks.md');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('- [ ] [Task 0001]','- [x] [Task 0001]'));
    assert.equal((await verifyPlanningReceipt(receipt)).matched,true,'canonical checkbox progress only');
    const preserved=syncPlanningPackage(root).manifest;
    assert.equal(preserved.state,'delivered');assert.equal(preserved.reviews.length,2);
    assert.match(fs.readFileSync(index,'utf8'),/\[x\] \[Task 0001\]/);
    assert.throws(()=>syncPlanningPackage(root,{completedTaskIds:[]}),/progress belongs/);
    const child=spawnSync(process.execPath,['--input-type=module','-e',`import {verifyPlanningReceipt} from ${JSON.stringify(new URL('../lib/planning-store.mjs',import.meta.url).href)};let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(await verifyPlanningReceipt(JSON.parse(s),{status:'delivered'})));`],{input:JSON.stringify(receipt),encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).matched,true,child.stdout);
    fs.appendFileSync(path.join(root,'evidence/fidelity.json'),'tamper');
    assert.equal((await verifyPlanningReceipt(receipt)).matched,false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('C1 A07 reviewer name cannot synthesize two PASS reviews', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-passive-red-'));
  try {
    buildPlanningPackage(root, { tasks: [{ id:'0001', title:'Synthetic', owner:'author', write:['src/a'], resources:[], dependsOn:[], requirements:['R1'], scenarios:['S1'], verification:['future test'] }] });
    const before = fs.readFileSync(path.join(root,'tasks/task-0001.md'),'utf8');
    assert.throws(() => recordPlanningReviews(root, 'reviewer-name'), /explicit|schema|object/i);
    assert.equal(fs.readFileSync(path.join(root,'tasks/task-0001.md'),'utf8'), before);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('C1 A08 builder cannot invent persistence permission or matched readback', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-passive-red-'));
  try {
    const { manifest } = buildPlanningPackage(root, { state:'reviewing', tasks: [{ id:'0001', title:'Synthetic', owner:'author', write:['src/a'], resources:[], dependsOn:[], requirements:['R1'], scenarios:['S1'], verification:['future test'] }] });
    assert.notEqual(manifest.authority.persistenceGranted, true);
    assert.equal(manifest.readback, null);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('C1 A09 material author and policy participate in candidate binding', () => {
  const m={packageId:'synthetic',revision:'r1',author:{actorId:'a',sessionId:'A'},reviewPolicy:{risk:'high'},references:[]};
  assert.notEqual(planningCandidateSha256(m),planningCandidateSha256({...m,author:{actorId:'b',sessionId:'B'}}));
  assert.notEqual(planningCandidateSha256(m),planningCandidateSha256({...m,reviewPolicy:{risk:'other'}}));
});

test('synthetic negative matrix rejects missing identity, wrong prior, reused sessions, drift, findings and evidence',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-negative-'));
  try {
    let m=fixture(root);const f=review(root,m,'fidelity');
    for(const mutate of [r=>delete r.verdict,r=>delete r.limitations,r=>r.author.sessionId='other',r=>r.reviewer.actorId=r.author.actorId,r=>r.reviewer.sessionId=r.author.sessionId,r=>r.assignment.scopeTaskIds=[],r=>r.policyDigest='0'.repeat(64),r=>r.inventoryDigest='0'.repeat(64),r=>r.candidateSha256='0'.repeat(64),r=>r.evidence.messageIds=[],r=>r.evidence.persistedResultPath='../escape',r=>r.limitations=[{description:'Cannot inspect ownership',blocksCoverage:true}],r=>r.findings=[{id:'F1',severity:'material',status:'open',evidence:'missing ownership',expectedCorrection:'filter',disposition:'unresolved'}]]) {
      const r=structuredClone(f);mutate(r);assert.ok(validateHarnessReview(createHarnessPlanningReview(r),harnessCandidate(m)).length);
    }
    const blocked=createHarnessPlanningReview({...f,verdict:'blocked',findings:[],limitations:[{description:'No readable source',blocksCoverage:true}]});
    assert.deepEqual(validateHarnessReview(blocked,harnessCandidate(m)),[],'blocked need not invent finding');
    m=recordPlanningReviews(root,f).manifest;
    const q=review(root,m,'quality',f);
    for(const mutate of [r=>r.priorReviewDigest='0'.repeat(64),r=>r.reviewer.sessionId=f.reviewer.sessionId,r=>r.reviewer.actorId=f.reviewer.actorId]){
      const r=structuredClone(q);mutate(r);assert.throws(()=>recordPlanningReviews(root,createHarnessPlanningReview(r)),/prior fidelity|distinct|evidence/);
    }
    const manifestBefore=fs.readFileSync(path.join(root,'planning-manifest.json'));
    assert.throws(()=>buildPlanningPackage(root,{state:'delivered',tasks:[]}),/delivered requires/);
    assert.deepEqual(fs.readFileSync(path.join(root,'planning-manifest.json')),manifestBefore);
    fs.appendFileSync(path.join(root,'tasks/task-0001.md'),'\nMaterial contract change\n');
    assert.throws(()=>recordPlanningReviews(root,q),/material drift/);
    assert.equal(syncPlanningPackage(root).manifest.reviews.length,0);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('fresh synthetic project payload is self-contained, passive, and excludes removed launchers',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-payload-'));
  try {
    const payload=planInstall({scope:'project',target:root});
    for(const f of payload)assert.doesNotMatch(f.path,/review-authority|review-supervisor|host-bridge|server\.cjs|start-server\.sh|reviewer-primary/);
    applyInstall(payload); // isolated fixture only, no global installation
    const lib=path.join(root,'.agents/skills/spec-driven-superpowers/lib');
    const cli=path.join(root,'.agents/skills/spec-driven-superpowers/scripts/planning-review.mjs');
    const observed=spawnSync(process.execPath,[cli],{encoding:'utf8'});assert.equal(observed.status,1);assert.match(observed.stderr,/--change required/);
    for(const name of fs.readdirSync(lib))if(name.endsWith('.mjs')){
      const code=fs.readFileSync(path.join(lib,name),'utf8');
      for(const [,rel] of code.matchAll(/from ['"]\.\/([^'"]+)['"]/g))assert.equal(fs.existsSync(path.join(lib,rel)),true,`${name} -> ${rel}`);
      assert.doesNotMatch(code,/node:net|node:http|node:https|\.listen\(|host\.start\(/,name);
    }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

function registerPair(root, m) {
  const f=review(root,m,'fidelity');m=recordPlanningReviews(root,f).manifest;
  return recordPlanningReviews(root,review(root,m,'quality',f)).manifest;
}
function pendingBoundaryPair(root) {
  fixture(root);
  const file=path.join(root,'tasks/task-0001.md');
  const before=fs.readFileSync(file,'utf8');assert.match(before,/verdict: ready/);
  fs.writeFileSync(file,before.replace('verdict: ready','verdict: pending'));
  const m=registerPair(root,syncPlanningPackage(root).manifest);
  assert.equal(m.reviews.length,2);assert.ok(m.reviews.every(r=>r.verdict==='pass'));
  return m;
}
test('C9 P1 ready rejects persisted pending boundary despite valid F/Q',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-boundary-ready-'));
  try {
    pendingBoundaryPair(root);
    const before=fs.readFileSync(path.join(root,'planning-manifest.json'));
    assert.throws(()=>syncPlanningPackage(root,{state:'ready'}),/reviewed bounded|readiness|boundary/);
    assert.deepEqual(fs.readFileSync(path.join(root,'planning-manifest.json')),before);
    assert.match(fs.readFileSync(path.join(root,'tasks/task-0001.md'),'utf8'),/verdict: pending/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('C9 P1 publish cannot bypass persisted readiness by forcing manifest ready',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-boundary-publish-'));
  try {
    const m=pendingBoundaryPair(root);m.state='ready';
    const file=path.join(root,'planning-manifest.json');fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');
    const before=fs.readFileSync(file);
    await assert.rejects(publishReviewedPlanningPackage(root,{verifiedBy:'synthetic-C',expectedManifestSha256:reviewDigest(before)}),/reviewed bounded|readiness|boundary/);
    assert.deepEqual(fs.readFileSync(file),before,'rejection must not finalize delivered');
    const raw=readPlanningBundle(root,['planning-manifest.json',...m.references.map(r=>r.path)]);
    m.state='delivered';m.attendanceOutcome='planning_delivered';
    raw.files.find(f=>f.path==='planning-manifest.json').content=JSON.stringify(m,null,2)+'\n';
    raw.files.forEach(f=>delete f.sha256);
    const receipt=publishPlanningBundle(root,raw,{expectedRevision:m.revision});
    const checked=await verifyPlanningReceipt(receipt,{status:'delivered'});
    assert.equal(checked.matched,false);
    assert.ok(checked.errors.some(error=>/reviewed bounded/.test(error)),'raw delivered/readback cannot bypass contract readiness');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
for(const progress of [false,true])test(`C9 P1 planning delivery no-op resync preserves frozen material/reviews/readback (progress=${progress})`,async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-planning-resync-'));
  try {
    let m=registerPair(root,fixture(root,{originalRequestedProduct:{kind:'planning',status:'in_progress',text:'Plan CSV own orders only',source:'synthetic user'}}));
    m=syncPlanningPackage(root,{state:'ready'}).manifest;
    const receipt=await publishReviewedPlanningPackage(root,{verifiedBy:'synthetic-C',expectedManifestSha256:reviewDigest(fs.readFileSync(path.join(root,'planning-manifest.json')))});
    const delivered=JSON.parse(fs.readFileSync(path.join(root,'planning-manifest.json')));
    const index=path.join(root,'tasks.md');
    if(progress)fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('- [ ] [Task 0001]','- [x] [Task 0001]'));
    m=syncPlanningPackage(root).manifest;
    assert.equal(m.candidateSha256,delivered.candidateSha256);
    assert.equal(m.state,'delivered');assert.deepEqual(m.reviews,delivered.reviews);assert.deepEqual(m.readback,delivered.readback);
    assert.equal((await verifyPlanningReceipt(receipt)).matched,true);
    if(progress)assert.match(fs.readFileSync(index,'utf8'),/\[x\] \[Task 0001\]/);
    const changed=syncPlanningPackage(root,{originalRequestedProduct:{...m.originalRequestedProduct,text:'Materially different original objective'}}).manifest;
    assert.notEqual(changed.candidateSha256,delivered.candidateSha256);
    assert.equal(changed.state,'reviewing');assert.deepEqual(changed.reviews,[]);assert.equal(changed.readback,null);
    if(progress)assert.match(fs.readFileSync(index,'utf8'),/\[x\] \[Task 0001\]/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('C9 P2 executable schema rejects invalid parentSessionId',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-schema-parity-'));
  try {
    const m=fixture(root),f=review(root,m,'fidelity');
    for(const value of [17,'','   ',null,{},[]]) {
      const r=structuredClone(f);r.reviewer.parentSessionId=value;
      assert.ok(validateHarnessReview(createHarnessPlanningReview(r),harnessCandidate(m)).length,`invalid parent ${JSON.stringify(value)}`);
    }
    const noParent=structuredClone(f);delete noParent.reviewer.parentSessionId;
    assert.deepEqual(validateHarnessReview(createHarnessPlanningReview(noParent),harnessCandidate(m)),[]);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
for(const field of ['findings','limitations'])test(`C9 P2 executable schema rejects unknown ${field} properties`,()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-nested-parity-'));
  try {
    const m=fixture(root),r=review(root,m,'fidelity');
    r[field]=field==='findings'?[{id:'N1',severity:'non-material',status:'open',evidence:'fixture',expectedCorrection:'optional improvement',disposition:'deferred',unknown:true}]:[{description:'Nonblocking fixture limit',blocksCoverage:false,unknown:true}];
    assert.ok(validateHarnessReview(createHarnessPlanningReview(r),harnessCandidate(m)).length,'unknown nested property must reject');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

const c10AuthorFixture={actorId:'ses_ec355f101ffeug9mfrO0v161eh',sessionId:'ses_ec355f101ffeug9mfrO0v161eh'};
const c10CoordinatorFixture='ses_ec3692bb6ffeW2ypMeuSN2v8Ug';
function coordinatedFixtureReview(root,m,kind,coordinator,prior=null) {
  // Uses the actual C10 identity SHAPE only: reviewer/results remain synthetic,
  // files live in an isolated test directory, never the frozen C10 package.
  const r=review(root,m,kind,prior);
  r.assignment.requestedBySessionId=coordinator;
  r.evidence.observedBySessionId=coordinator;
  r.reviewer.parentSessionId=coordinator;
  return createHarnessPlanningReview(r);
}
test('C10 synthetic author/coordinator separation registers F then Q without impersonating author',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-coordinator-'));
  try {
    let m=fixture(root,{author:c10AuthorFixture});
    const f=coordinatedFixtureReview(root,m,'fidelity',c10CoordinatorFixture);
    assert.deepEqual(validateHarnessReview(f,harnessCandidate(m)),[]);
    m=recordPlanningReviews(root,f).manifest;
    const q=coordinatedFixtureReview(root,m,'quality',c10CoordinatorFixture,f);
    assert.deepEqual(validateHarnessReview(q,harnessCandidate(m),f),[]);
    m=recordPlanningReviews(root,q).manifest;
    assert.deepEqual(m.author,c10AuthorFixture);
    assert.ok(m.reviews.every(r=>r.assignment.requestedBySessionId===c10CoordinatorFixture && r.evidence.observedBySessionId===c10CoordinatorFixture));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('C10 coordinator identities must be explicit, consistent and separate from reviewers',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-coordinator-negative-'));
  try {
    const m=fixture(root,{author:c10AuthorFixture}),f=coordinatedFixtureReview(root,m,'fidelity',c10CoordinatorFixture);
    for(const field of ['requestedBySessionId','observedBySessionId'])for(const value of [undefined,false,null,'','   ',17]) {
      const r=structuredClone(f),o=field==='requestedBySessionId'?r.assignment:r.evidence;
      if(value===undefined)delete o[field];else o[field]=value;
      assert.ok(validateHarnessReview(createHarnessPlanningReview(r),harnessCandidate(m)).length,`${field}: ${JSON.stringify(value)}`);
    }
    for(const mutate of [r=>r.evidence.observedBySessionId='synthetic-different-observer',r=>r.reviewer.sessionId=c10CoordinatorFixture,r=>r.reviewer.actorId=c10CoordinatorFixture,r=>r.reviewer.sessionId=c10AuthorFixture.sessionId,r=>r.reviewer.actorId=c10AuthorFixture.actorId]) {
      const r=structuredClone(f);mutate(r);assert.ok(validateHarnessReview(createHarnessPlanningReview(r),harnessCandidate(m)).length);
    }
    const q=coordinatedFixtureReview(root,m,'quality',c10CoordinatorFixture,f);
    for(const mutate of [r=>{r.assignment.requestedBySessionId='synthetic-other-coordinator';r.evidence.observedBySessionId='synthetic-other-coordinator';},r=>r.reviewer.sessionId=f.reviewer.sessionId,r=>r.reviewer.actorId=f.reviewer.actorId]) {
      const r=structuredClone(q);mutate(r);assert.ok(validateHarnessReview(createHarnessPlanningReview(r),harnessCandidate(m),f).length);
    }
    const legacy=review(root,m,'fidelity'); // existing author=coordinator stays valid
    assert.deepEqual(validateHarnessReview(legacy,harnessCandidate(m)),[]);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('C10 synthetic post-review layer assessment reaches ready/publish without material or review hash cycle',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-passive-layer-transition-'));
  try {
    let m=fixture(root,{author:c10AuthorFixture});
    const layers=structuredClone(m.layers);
    for(const id of ['C12','C13','C14','C16'])layers[id]={status:'blocked',reason:'Synthetic native review/convergence/delivery assessment not yet observed',references:['tasks-index']};
    m=syncPlanningPackage(root,{layers}).manifest;
    const candidate=m.candidateSha256,inventory=harnessCandidate(m).inventoryDigest;
    const f=coordinatedFixtureReview(root,m,'fidelity',c10CoordinatorFixture);m=recordPlanningReviews(root,f).manifest;
    assert.equal(m.layers.C12.status,'blocked','recording F must not invent a layer assessment');
    const q=coordinatedFixtureReview(root,m,'quality',c10CoordinatorFixture,f);m=recordPlanningReviews(root,q).manifest;
    assert.ok(['C12','C13','C14','C15','C16'].every(id=>m.layers[id].status==='blocked'));
    assert.throws(()=>syncPlanningPackage(root,{state:'ready'}),/ready requires/);
    const reviews=structuredClone(m.reviews),preAssessmentReadbackHash=planningReadbackSha256(m);
    const assessed=structuredClone(m.layers);
    for(const id of ['C12','C13','C14','C16'])assessed[id]={status:'satisfied',reason:'Explicit SYNTHETIC test-only assessment after both fixture reviews, no material findings; C16 is ready-for-delivery state/limits, not publication',references:['review:fidelity','review:quality']};
    m=syncPlanningPackage(root,{state:'ready',layers:assessed,reconcilePackages:false,writeDagMermaid:false,writeDagStatus:false}).manifest;
    const ready=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/planning-review.mjs',import.meta.url)),'ready','--change',root],{encoding:'utf8'});
    assert.equal(ready.status,0,ready.stderr);
    m=JSON.parse(fs.readFileSync(path.join(root,'planning-manifest.json')));
    assert.equal(m.candidateSha256,candidate);assert.equal(harnessCandidate(m).inventoryDigest,inventory);assert.deepEqual(m.reviews,reviews);
    assert.notEqual(planningReadbackSha256(m),preAssessmentReadbackHash,'layer results belong to final readback identity');
    assert.equal(m.layers.C15.status,'blocked');assert.equal(m.readback,null);
    const receipt=await publishReviewedPlanningPackage(root,{verifiedBy:c10CoordinatorFixture,expectedManifestSha256:reviewDigest(fs.readFileSync(path.join(root,'planning-manifest.json')))});
    const checked=await verifyPlanningReceipt(receipt,{status:'delivered'});
    assert.equal(checked.matched,true,checked.errors.join('; '));assert.equal(checked.manifest.candidateSha256,candidate);assert.deepEqual(checked.manifest.reviews,reviews);
    assert.equal(checked.manifest.layers.C15.status,'satisfied');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
