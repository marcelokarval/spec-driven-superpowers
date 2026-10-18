// Deterministic SYNTHETIC harness records, not real reviewer sessions or semantic certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHarnessPlanningReview, HARNESS_REVIEW_VERSION, reviewDigest } from '../lib/harness-planning-review.mjs';
import { validateReadiness } from '../lib/contracts.mjs';
import { loadTasks, validateReviewedPlanningReadiness, validatePlanningDelivery, validateChange } from '../lib/validation.mjs';
import { inspectExecutionPackage, createExecutionHandoff } from '../lib/execution-handoff.mjs';
import { validateExecutionSource, initExecutionConsumer, nextExecutionConsumer, eventExecutionConsumer } from '../lib/execution-consumer.mjs';
import { compilePlan } from '../lib/orchestration.mjs';
import { projectRuntimeProjection } from '../lib/plan-projection.mjs';
import { evaluatePlanningLifecycle, planningCandidateSha256 } from '../lib/planning-lifecycle.mjs';
import { syncPlanningPackage, collectCanonicalReferences } from '../lib/package-builder.mjs';
import { parse, stringify } from 'yaml';

const cliPath = name => new URL(`../scripts/${name}.mjs`, import.meta.url).pathname;
function cli(name, args, ok = true) {
  const result = spawnSync(process.execPath, [cliPath(name), ...args], { encoding: 'utf8' });
  assert.equal(result.status, ok ? 0 : 1, result.stderr || result.stdout);
  return ok ? (name === 'build-package' ? result.stdout : JSON.parse(result.stdout)) : (result.stderr || result.stdout);
}
const readManifest = root => JSON.parse(fs.readFileSync(path.join(root, 'planning-manifest.json')));
function fixture(root, future = false, overrides = {}) {
  const tasks = [{ id: '1', title: 'Synthetic resolver', kind: 'investigation', write: ['docs/decision.md'], resolvesDecisions: future ? ['D1'] : [] }];
  if (future) tasks.push(
    { id: '2', title: 'Synthetic consumer', dependsOn: ['1'], dependencyDetails: [{ id: '1', reason: 'Consumes decision', requiredOutput: 'docs/decision.md decision' }], decisionInputs: ['D1'], openDecisions: ['D1'], write: ['src/a.js'] },
    { id: '3', title: 'Synthetic downstream', dependsOn: ['2'], dependencyDetails: [{ id: '2', reason: 'Consumes result', requiredOutput: 'src/a.js result' }], write: ['src/b.js'] },
  );
  const spec = { packageId: 'synthetic-gates', author: { actorId: 'synthetic-author', sessionId: 'synthetic-author-session' },
    originalRequestedProduct: { kind: 'implementation', status: 'not_fulfilled', text: 'Synthetic future implementation', source: 'Synthetic unit fixture' },
    destination: root, persistenceGranted: true, authorization: 'SYNTHETIC fixture authorization only',
    reviewPolicy: { risk: 'elevated', domains: ['architecture'], independentRequired: true },
    layers: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`C${String(i + 1).padStart(2, '0')}`, { status: 'satisfied', reason: 'SYNTHETIC fixture assessment', references: ['tasks-index'] }])),
    tasks: tasks.map(task => ({ scenarios: ['synthetic/Behavior'], verification: ['synthetic future test'], ...task })), decisions: future ? [{ id: 'D1', material: true, status: 'unresolved', resolverTaskId: '1' }] : [],
    blockers: future ? [{ id: 'B1', decisionId: 'D1', owner: 'future decision owner', question: 'Which format?', consequence: 'Consumer waits', resolution: 'Resolver produces docs/decision.md', affectedTasks: ['2'] }] : [],
    ...overrides };
  fs.writeFileSync(path.join(root, 'spec.json'), JSON.stringify(spec));
  cli('build-package', ['--change', root, '--spec', path.join(root, 'spec.json')]);
}
function pair(root, mutate = () => {}) {
  const candidate = cli('planning-review', ['inspect', '--change', root]);
  let prior = null;
  for (const kind of ['fidelity', 'quality']) {
    const session = kind === 'fidelity' ? 'synthetic-coordinator' : 'synthetic-quality';
    const resultPath = `evidence/${kind}.json`;
    const content = JSON.stringify({ synthetic: true, kind, result: 'Test fixture only, not a native review' });
    fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(root, resultPath), content);
    const { manifestSha256, reviewErrors, ...binding } = candidate;
    const input = { schemaVersion: HARNESS_REVIEW_VERSION, ...binding, kind,
      reviewer: { actorId: session, sessionId: session, agentRole: 'synthetic-reviewer' },
      assignment: { id: `synthetic-${kind}`, requestedBySessionId: 'synthetic-coordinator', kind, candidateSha256: candidate.candidateSha256, scopeTaskIds: candidate.taskIds },
      priorReviewDigest: prior?.envelopeDigest ?? null, verdict: 'pass', findings: [], limitations: [],
      evidence: { harness: 'SYNTHETIC unit test', sessionId: session, messageIds: [`synthetic-${kind}-message`], requestDigest: reviewDigest('synthetic request'), resultDigest: reviewDigest(content), persistedResultPath: resultPath, observedBySessionId: 'synthetic-coordinator' } };
    mutate(input, kind);
    const review = createHarnessPlanningReview(input);
    const inputPath = path.join(root, `${kind}-input.json`);
    fs.writeFileSync(inputPath, JSON.stringify(review));
    cli('planning-review', ['record', '--change', root, '--input', inputPath]);
    prior = review;
  }
  return candidate;
}
function publish(root) {
  const inspected = cli('planning-review', ['inspect', '--change', root]);
  const receiptPath = path.join(root, 'receipt.json');
  const receipt = cli('planning-review', ['publish', '--change', root, '--observer', 'synthetic-coordinator', '--expected-manifest-sha256', inspected.manifestSha256, '--output', receiptPath]);
  assert.equal(cli('planning-review', ['verify', '--receipt', receiptPath]).matched, true);
  return { receipt, receiptPath };
}
function editTask(root, id, update) {
  const file = path.join(root, `tasks/task-${id}.md`), source = fs.readFileSync(file, 'utf8');
  const match = source.match(/^---\n([\s\S]*?)\n---/), fm = parse(match[1]);
  update(fm);
  fs.writeFileSync(file, source.replace(match[0], `---\n${stringify(fm).trimEnd()}\n---`));
}
function executionHandoff(root, withCurrent=false) {
  // Synthetic caller/workspace observations only; no execution grant exists outside this fixture.
  const now='2026-10-17T12:00:00.000Z', inspected=inspectExecutionPackage(root);
  const binding={requestId:'synthetic-request',packageId:inspected.packageId,planningRevision:inspected.planningRevision,planningFingerprint:inspected.planningFingerprint,consumableTaskIds:inspected.executionScope.consumableTaskIds};
  fs.mkdirSync(path.join(root,'.git'));
  const input={packageRoot:root,
    requestContext:{requestId:'synthetic-request',objective:'Synthetic future implementation',source:'Synthetic unit fixture',binding,project:{root,readScope:['.'],constraints:['fixture only'],refusals:[],authorizations:['synthetic grant']}},
    author:{actor:'synthetic-coordinator',adapter:'synthetic',source:'synthetic unit fixture',observedAt:now},
    selection:{consumer:'asds-execution-consumer',selected:true,source:'synthetic selection',observedAt:now,binding},
    grants:[{kind:'execution',granted:true,source:'synthetic grant',scope:{projectRoot:root,binding},validFrom:'2026-10-17T11:00:00.000Z',validUntil:'2026-10-17T13:00:00.000Z'},
      {kind:'evidence-persistence',granted:true,source:'synthetic grant',scope:{journal:'.asds/journal.jsonl',evidence:'.asds/evidence'},validFrom:'2026-10-17T11:00:00.000Z',validUntil:'2026-10-17T13:00:00.000Z'}],
    destination:{journal:'.asds/journal.jsonl',evidence:'.asds/evidence',source:'synthetic grant'},
    workspace:{projectRoot:root,workspaceId:'synthetic-workspace',repoIdentity:{vcs:'git',rootRealpath:root,commonDirRealpath:path.join(root,'.git'),baseRevision:'a'.repeat(40)},baseline:{version:1,baseRevision:'a'.repeat(40),workspaceRevision:`${'a'.repeat(40)}+worktree:${'b'.repeat(64)}`,committedSinceBase:[],staged:[],unstaged:[],untracked:[]},observedAt:now,source:'synthetic observer'},
    coordinatorBoundary:{enforced:true,projectReadOnly:true,brokers:['journal','evidence','progress'],source:'synthetic boundary',observedAt:now},now};
  const handoff=createExecutionHandoff(input);
  return withCurrent?{handoff,current:{packageRoot:root,workspace:input.workspace,now}}:handoff;
}
for (const future of [false, true]) test(`synthetic CLI pending-boundary delivery and execution exclusions (future=${future})`, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-package-gates-'));
  try {
    fixture(root, future);
    const tasks = loadTasks(root), frozen = tasks.map(t => fs.readFileSync(path.join(root, `tasks/task-${t.id}.md`), 'utf8'));
    assert.ok(validateReadiness(tasks[0]).length, 'generic readiness remains fail-closed');
    cli('planning-review', ['ready', '--change', root], false);
    const candidate = pair(root);
    cli('planning-review', ['ready', '--change', root]);
    const ready = readManifest(root);
    assert.equal(ready.candidateSha256, candidate.candidateSha256);
    assert.deepEqual(ready.usableTasks, ['1']);
    assert.deepEqual(ready.blockedTaskIds, future ? ['2', '3'] : []);
    const { receipt, receiptPath } = publish(root);
    const delivered = readManifest(root);
    assert.equal(delivered.state, 'delivered');
    assert.equal(evaluatePlanningLifecycle(delivered).canPartial, false);
    assert.deepEqual(receipt.usableTasks, ['1']);
    assert.deepEqual(receipt.blockedTaskIds, future ? ['2', '3'] : []);
    assert.deepEqual(delivered.readback.blockedTaskIds, receipt.blockedTaskIds);
    assert.deepEqual(delivered.readback.usableTasks, receipt.usableTasks);
    const executionScope=inspectExecutionPackage(root).executionScope;
    assert.deepEqual(executionScope, { consumableTaskIds: ['1'], excludedTaskIds: future ? ['2', '3'] : [] });
    const handoff=executionHandoff(root),scoped=handoff.taskManager;
    assert.deepEqual(handoff.executionScope,executionScope);
    assert.equal(Object.hasOwn(handoff,'partialScope'),false,'future execution blockers do not fabricate partial planning');
    assert.deepEqual(validateExecutionSource(handoff,loadTasks(root)).projection,scoped);
    if(future) {
      assert.equal(scoped.tasks.find(t=>t.id==='2').status,'excluded');
      assert.throws(()=>projectRuntimeProjection(scoped,{version:3,events:[{sequence:1,event:{type:'dispatch',taskId:'2',assignment:{role:'executor',session:'synthetic'}}}]},executionScope),/excluded task/);
    }
    assert.deepEqual(tasks.map(t => fs.readFileSync(path.join(root, `tasks/task-${t.id}.md`), 'utf8')), frozen);
    assert.ok(validateReadiness(loadTasks(root)[0]).length, 'package review does not approve a detached leaf');
    fs.writeFileSync(receiptPath, JSON.stringify({ ...receipt, usableTasks: ['2'] }));
    assert.match(cli('planning-review', ['verify', '--receipt', receiptPath], false), /./);
    fs.writeFileSync(receiptPath, JSON.stringify({ ...receipt, blockedTaskIds: ['1'] }));
    assert.match(cli('planning-review', ['verify', '--receipt', receiptPath], false), /blockedTaskIds/);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    fs.appendFileSync(path.join(root, 'evidence/fidelity.json'), '\nTAMPER');
    assert.match(cli('planning-review', ['verify', '--receipt', receiptPath], false), /drift|differ/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const defect of ['missing-Q', 'invalid-Q', 'stale-Q', 'evidence-drift', 'post-review-edit', 'missing-change', 'missing-target', 'missing-exclusions', 'unknown-open-decision', 'planning-layer', 'zero-usable']) {
  test(`synthetic package gate rejects ${defect} without rewriting reviewed contracts`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-package-negative-'));
    try {
      fixture(root);
      if (defect.startsWith('missing-') && !['missing-Q'].includes(defect)) {
        editTask(root, '1', fm => { delete fm.boundary[defect.slice('missing-'.length)]; });
        syncPlanningPackage(root);
      }
      if (defect === 'unknown-open-decision') {
        editTask(root, '1', fm => { fm.openDecisions=['D-unknown']; });
        syncPlanningPackage(root);
      }
      if (defect === 'planning-layer') {
        const layers=readManifest(root).layers;
        layers.C07={status:'blocked',reason:'SYNTHETIC missing planning specification',references:['tasks-index'],affectedTasks:['1']};
        syncPlanningPackage(root,{layers});
      }
      if (defect === 'zero-usable') syncPlanningPackage(root,{blockers:[{id:'B-all',owner:'synthetic owner',question:'Missing planning input?',consequence:'No usable contract',resolution:'Finish planning',affectedTasks:['1']}]});
      pair(root);
      const manifestPath=path.join(root,'planning-manifest.json');
      if (['missing-Q','invalid-Q','stale-Q'].includes(defect)) {
        const m=readManifest(root);
        if (defect==='missing-Q') m.reviews.pop();
        else { m.reviews[1][defect==='invalid-Q'?'verdict':'candidateSha256']=defect==='invalid-Q'?'blocked':'0'.repeat(64); }
        fs.writeFileSync(manifestPath,JSON.stringify(m));
      }
      if (defect==='evidence-drift') fs.appendFileSync(path.join(root,'evidence/quality.json'),'tamper');
      if (defect==='post-review-edit') fs.appendFileSync(path.join(root,'tasks/task-1.md'),'\nChanged acceptance after review.\n');
      const contract=fs.readFileSync(path.join(root,'tasks/task-1.md'),'utf8');
      assert.match(cli('planning-review',['ready','--change',root],false),/ready requires|readiness|boundary/);
      assert.equal(fs.readFileSync(path.join(root,'tasks/task-1.md'),'utf8'),contract);
      assert.notEqual(readManifest(root).state,'delivered');
      if (defect==='post-review-edit') {
        assert.equal(syncPlanningPackage(root).manifest.reviews.length,0);
      }
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
}

test('synthetic CLI denies author review, Q before F and reused F/Q identity', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(), 'asds-package-review-negative-'));
  try {
    fixture(root);
    assert.throws(()=>pair(root,(r,kind)=>{
      if(kind==='fidelity') { r.reviewer.actorId=r.author.actorId; r.reviewer.sessionId=r.author.sessionId; r.evidence.sessionId=r.author.sessionId; }
    }),/distinct from author/);
    assert.equal(readManifest(root).reviews.length,0);
    assert.throws(()=>pair(root,(r,kind)=>{
      if(kind==='fidelity') { r.kind='quality'; r.assignment.kind='quality'; }
    }),/prior registered fidelity/);
    assert.throws(()=>pair(root,(r,kind)=>{
      if(kind==='quality') { r.reviewer.actorId='synthetic-coordinator'; r.reviewer.sessionId='synthetic-coordinator'; r.evidence.sessionId='synthetic-coordinator'; }
    }),/distinct reviewer/);
    assert.equal(readManifest(root).reviews.length,1);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

for (const missing of [null,'boundary','change','target','exclusions']) {
  test(`synthetic implicit root leaf requires complete boundary under package F/Q (missing=${missing})`, () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(), 'asds-implicit-boundary-'));
    try {
      fixture(root);
      editTask(root,'1',fm=>{
        delete fm.nodeType;
        if(missing==='boundary') delete fm.boundary;
        else if(missing) delete fm.boundary[missing];
      });
      // A legacy manifest omits nodeType rather than the builder's null projection.
      // Exercise the admitted implicit-leaf graph without changing contract bytes.
      const legacy=readManifest(root);
      delete legacy.tasks[0].nodeType;
      legacy.references=collectCanonicalReferences(root);
      legacy.candidateSha256=planningCandidateSha256(legacy);
      fs.writeFileSync(path.join(root,'planning-manifest.json'),JSON.stringify(legacy));
      const file=path.join(root,'tasks/task-1.md'),before=fs.readFileSync(file,'utf8');
      pair(root);
      const errors=validateReviewedPlanningReadiness(root,readManifest(root));
      if(missing) {
        assert.ok(errors.some(error=>/reviewed bounded/.test(error)),errors.join('; '));
      } else {
        assert.deepEqual(errors,[]);
        assert.equal(evaluatePlanningLifecycle(readManifest(root)).canReady,true);
      }
      assert.equal(fs.readFileSync(file,'utf8'),before,'implicit leaf compatibility must not rewrite reviewed bytes');
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
}

for(const state of ['ready','delivered','partial']) for(const evidence of ['missing','drift']) {
  test(`synthetic candidate flag cannot bypass ${state} review evidence (${evidence})`,()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(), 'asds-candidate-evidence-'));
    try {
      fixture(root);
      pair(root);
      cli('planning-review',['ready','--change',root]);
      if(state!=='ready')publish(root);
      assert.deepEqual(validatePlanningDelivery(root,{candidate:true}),[]);
      assert.deepEqual(validateChange(root,{candidate:true}),[]);
      const m=readManifest(root);
      if(state==='partial')m.state='partial';
      if(evidence==='missing') {
        fs.unlinkSync(path.join(root,m.reviews[0].evidence.persistedResultPath));
        m.references=m.references.filter(ref=>ref.role!=='review-evidence');
      } else fs.appendFileSync(path.join(root,m.reviews[0].evidence.persistedResultPath),'TAMPER');
      fs.writeFileSync(path.join(root,'planning-manifest.json'),JSON.stringify(m));
      for(const candidate of [false,true])for(const validate of [validatePlanningDelivery,validateChange]) {
        const errors=validate(root,{candidate});
        assert.ok(errors.some(error=>/review evidence (readback|bytes differ)/.test(error)),`${validate.name} candidate=${candidate}: ${errors.join('; ')}`);
      }
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
}

test('synthetic official consumer dispatches reviewed pending usable leaf, never detached or excluded tasks',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(), 'asds-contextual-dispatch-'));
  // Same isolated e/r profile shape as execution-consumer.test.js, not global configuration.
  const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(tier=>[tier,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
  const capabilities={spawn:true,isolatedWrites:true,maxAgents:3,externalActive:0,models:[{model:'e',efforts:['high']},{model:'r',efforts:['medium']}]};
  try {
    fixture(root,true);
    for(const id of ['1','2','3'])editTask(root,id,fm=>{fm.orchestration={complexity:'bounded',uncertainty:'bounded',risk:'bounded',rationale:'Synthetic bounded execution fixture',skills:['tdd'],references:[`tasks/task-${id}.md`],claims:[]};});
    syncPlanningPackage(root);
    pair(root);cli('planning-review',['ready','--change',root]);publish(root);
    const {handoff,current}=executionHandoff(root,true),source=loadTasks(root),sourceBefore=JSON.stringify(source);
    const workspaceBinding={packageRootRealpath:handoff.packageRootRealpath,projectRootRealpath:handoff.projectRootRealpath,workspaceId:handoff.workspaceId,repoIdentity:handoff.repoIdentity,planningFingerprint:handoff.planningFingerprint,workspaceBaselineFingerprint:handoff.workspaceBaselineFingerprint,currentFingerprint:'synthetic-current',writeScope:['docs/decision.md'],toolCalls:[],source:'synthetic host observer'};
    const input={handoff,current,source,profile,workspaceBinding};
    assert.throws(()=>compilePlan(source,profile),/reviewed bounded/,'detached generic compilation stays closed');
    const {journal}=initExecutionConsumer(input);
    const next=nextExecutionConsumer({...input,journal,capabilities});
    assert.ok(next.actions.some(action=>action.operation==='executor'&&action.taskId==='1'),JSON.stringify(next));
    assert.ok(next.actions.every(action=>!['2','3'].includes(action.taskId)));
    const noSpawn=nextExecutionConsumer({...input,journal,capabilities:{...capabilities,spawn:false}});
    assert.ok(noSpawn.actions.every(action=>action.operation!=='executor'),'package review does not bypass spawn permissions');
    assert.throws(()=>initExecutionConsumer({...input,profile:{version:1,tiers:{}}}),/profile/);
    const dispatched=eventExecutionConsumer({...input,journal,expectedSequence:0,event:{type:'dispatch',taskId:'1',role:'executor',session:'synthetic-executor',capabilities,context:{fresh:true,inheritedHistory:false,source:'synthetic host'}}});
    assert.equal(dispatched.state.tasks['1'].active.session,'synthetic-executor');
    assert.equal(dispatched.state.plan.tasks.find(t=>t.id==='1').contractRevision,source.find(t=>t.id==='1').contractRevision);
    assert.throws(()=>eventExecutionConsumer({...input,journal,expectedSequence:0,event:{type:'dispatch',taskId:'2',role:'executor',session:'synthetic-excluded',capabilities,context:{fresh:true,inheritedHistory:false,source:'synthetic host'}}}),/excluded|scope|readiness|not ready|unresolved/);
    assert.equal(JSON.stringify(source),sourceBefore,'caller source remains unchanged');
    assert.equal(loadTasks(root)[0].boundary.review.verdict,'pending','persisted contract remains pending');
    for(const mutate of [s=>{delete s[0].boundary;},s=>{s[0].body+='\nChanged';},s=>{s[0].orchestration.skills=[];}]) {
      const changed=structuredClone(source);mutate(changed);
      assert.throws(()=>initExecutionConsumer({...input,source:changed}),/source|bound|contract/);
    }
    assert.throws(()=>nextExecutionConsumer({...input,journal,capabilities,handoff:{...handoff,planningFingerprint:'0'.repeat(64)}}),/fingerprint|binding|differs/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('synthetic package approval leaves missing execution metadata blocked',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(), 'asds-contextual-metadata-'));
  const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(tier=>[tier,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
  const capabilities={spawn:true,isolatedWrites:true,maxAgents:3,externalActive:0,models:[{model:'e',efforts:['high']},{model:'r',efforts:['medium']}]};
  try {
    fixture(root);pair(root);cli('planning-review',['ready','--change',root]);publish(root);
    const {handoff,current}=executionHandoff(root,true),source=loadTasks(root);
    const workspaceBinding={packageRootRealpath:handoff.packageRootRealpath,projectRootRealpath:handoff.projectRootRealpath,workspaceId:handoff.workspaceId,repoIdentity:handoff.repoIdentity,planningFingerprint:handoff.planningFingerprint,workspaceBaselineFingerprint:handoff.workspaceBaselineFingerprint,currentFingerprint:'synthetic-current',writeScope:['docs/decision.md'],toolCalls:[],source:'synthetic host observer'};
    const input={handoff,current,source,profile,workspaceBinding};
    const {journal}=initExecutionConsumer(input);
    const next=nextExecutionConsumer({...input,journal,capabilities});
    assert.ok(!next.actions.some(action=>action.operation==='executor'));
    assert.match(next.blockers.executor['1'],/justified classification/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
