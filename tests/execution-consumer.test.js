import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compilePlan, createJournal, appendEvent, replay, digest, objectiveSnapshot, packetFor } from '../lib/orchestration.mjs';
import { projectTaskManager } from '../lib/planning-graph.mjs';
import { createExecutionHandoff, inspectExecutionPackage } from '../lib/execution-handoff.mjs';
import { planningCandidateSha256, planningReadbackSha256 } from '../lib/planning-lifecycle.mjs';
import { projectionSourceDigest } from '../lib/plan-projection.mjs';
import { statusExecutionConsumer, eventExecutionConsumer, reconcileExecutionConsumer, progressExecutionConsumer, verifyExecutionConsumer, initExecutionConsumer, executionConsumer, validateExecutionSource, deriveExecutionConsumerContext, executionMutationBoundary, normalizeExecutionEvent, validateExecutionConsumerContextBinding } from '../lib/execution-consumer.mjs';

const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(title=>`## ${title}\nConcrete.\n`).join('');
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(tier=>[tier,{executor:{model:'e',effort:'high'},reviewer:{model:'r',effort:'medium'}}]))};
const task=id=>({id,dependsOn:[],write:[`${id}.js`],resources:[],scenarios:['works'],verification:['test'],kind:'implementation',openDecisions:[],body,contractRevision:`c-${id}`,owner:'worker',orchestration:{complexity:'bounded',uncertainty:'bounded',risk:'bounded',rationale:'bounded',skills:['tdd'],references:['task'],claims:[]}});
const caps={spawn:true,isolatedWrites:true,maxAgents:3,externalActive:0,models:[{model:'e',efforts:['high']},{model:'r',efforts:['medium']}]};
const observed={invocation:'test',scope:'declared',targets:['fixture'],source:'host'};
const add=(journal,event)=>appendEvent(journal,event,journal.events.length);
const snap=revision=>({revision,changedFiles:['A.js'],scopeFingerprint:`${revision}-scope`});
const workspaceBinding=(handoff,writeScope=['A.js'])=>({
  packageRootRealpath:handoff.packageRootRealpath,projectRootRealpath:handoff.projectRootRealpath,workspaceId:handoff.workspaceId,
  repoIdentity:structuredClone(handoff.repoIdentity),planningFingerprint:handoff.planningFingerprint,
  workspaceBaselineFingerprint:handoff.workspaceBaselineFingerprint,currentFingerprint:'host-current-1',
  writeScope:[...writeScope].sort(),toolCalls:[],source:'host:workspace-observer',
});

function officialRun(t) {
  const now='2026-10-09T12:00:00.000Z',sha=value=>createHash('sha256').update(String(value)).digest('hex');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'asds-consumer-unit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'tasks'));fs.mkdirSync(path.join(root,'.git'));
  const leaf={...task('A'),title:'A',nodeType:'task',boundary:{change:'Implement A',target:'A.js',exclusions:['No installation'],review:{verdict:'ready',source:'fixture-review'}},dependencyDetails:[],requirements:['R-A'],decisionInputs:[],resolvesDecisions:[]};
  const manager=projectTaskManager([leaf]),index=`# Tasks\n- [ ] [Task A](tasks/task-A.md): A\n\n- Onda 1: A\n`,contract=`---\n${JSON.stringify(leaf)}\n---\n# Task A: A\n\n## Scope and dependencies\nBounded.\n`,review='# Review\nCurrent.\n';
  fs.writeFileSync(path.join(root,'tasks.md'),index);fs.writeFileSync(path.join(root,'tasks','task-A.md'),contract);fs.writeFileSync(path.join(root,'reviews.md'),review);
  const references=[{id:'tasks.md',path:'tasks.md',role:'index',sha256:projectionSourceDigest(index,true)},{id:'task-A',path:'tasks/task-A.md',role:'contract',sha256:sha(contract)},{id:'reviews.md',path:'reviews.md',role:'review',sha256:sha(review)}];
  const manifest={schemaVersion:'asds.planning-delivery/1',returnVersion:'asds.planning-return/1',packageId:'unit',revision:'r1',state:'delivered',attendanceOutcome:'planning_delivered',originalRequestedProduct:{kind:'implementation',text:'implement',source:'request',status:'not_fulfilled'},planningContribution:{product:'reviewed-planning-package',executionPerformed:false,usableTasks:['A'],limitations:[]},synthetic:false,author:'planner',authority:{preservedRefusals:['no install'],authorization:'authorized',destination:root},references,tasks:[leaf],blockers:[],decisions:[],taskManager:manager,remainingWork:[],layers:Object.fromEntries(Array.from({length:16},(_,i)=>[`C${String(i+1).padStart(2,'0')}`,{status:'satisfied',reason:'current',references:['tasks.md']}])),reviewPolicy:{risk:'ordinary-low',independentRequired:false,mode:'self-review',domains:['general']}};
  const candidate=planningCandidateSha256(manifest);manifest.reviews=['fidelity','quality'].map(kind=>({kind,revision:'r1',candidateSha256:candidate,mode:'self-review',reviewer:'planner',synthetic:false,liveEvidence:`external-${kind}`,verdict:'pass',reference:'reviews.md',scopeTaskIds:['A'],findings:[]}));manifest.readback={status:'matched',revision:'r1',candidateSha256:planningCandidateSha256(manifest),readbackSha256:planningReadbackSha256(manifest),destination:root,synthetic:false,executionEvidence:false,evidence:'readback',verifiedBy:'fixture',referenceIds:references.map(item=>item.id),taskIds:['A'],checks:{bytes:true,files:true,ids:true,relations:true,decisions:true,reviews:true}};fs.writeFileSync(path.join(root,'planning-manifest.json'),JSON.stringify(manifest));
  const baseline={version:1,baseRevision:'a'.repeat(40),workspaceRevision:`worktree:${sha('base')}`,committedSinceBase:[],staged:[],unstaged:[],untracked:[]},workspace={projectRoot:root,workspaceId:'ws',repoIdentity:{vcs:'git',rootRealpath:root,commonDirRealpath:path.join(root,'.git'),baseRevision:baseline.baseRevision},baseline,observedAt:now,source:'host'};
  const inspected=inspectExecutionPackage(root),authorityBinding={requestId:'r',packageId:inspected.packageId,planningRevision:inspected.planningRevision,planningFingerprint:inspected.planningFingerprint,consumableTaskIds:inspected.executionScope.consumableTaskIds};
  const input={packageRoot:root,requestContext:{requestId:'r',objective:'implement',source:'user',project:{root,readScope:['.'],constraints:[],refusals:[],authorizations:['execute']},binding:authorityBinding},author:{actor:'root',adapter:'fixture',source:'session',observedAt:now},selection:{consumer:'asds-execution-consumer',selected:true,source:'user',observedAt:now,binding:authorityBinding},grants:[{kind:'execution',granted:true,source:'user',scope:{projectRoot:root,binding:authorityBinding},validFrom:'2026-10-09T11:00:00.000Z',validUntil:'2026-10-09T13:00:00.000Z'},{kind:'evidence-persistence',granted:true,source:'user',scope:{journal:'.asds/journal',evidence:'.asds/evidence'},validFrom:'2026-10-09T11:00:00.000Z',validUntil:'2026-10-09T13:00:00.000Z'}],destination:{journal:'.asds/journal',evidence:'.asds/evidence',source:'user'},workspace,coordinatorBoundary:{enforced:true,projectReadOnly:true,brokers:['journal','evidence','progress'],source:'host',observedAt:now},now};
  const handoff=createExecutionHandoff(input),current={packageRoot:root,workspace,now},observedBinding={packageRootRealpath:handoff.packageRootRealpath,projectRootRealpath:handoff.projectRootRealpath,workspaceId:handoff.workspaceId,repoIdentity:handoff.repoIdentity,planningFingerprint:handoff.planningFingerprint,workspaceBaselineFingerprint:handoff.workspaceBaselineFingerprint,currentFingerprint:sha('current'),writeScope:['A.js'],toolCalls:[],source:'host'};
  return {handoff,current,source:[leaf],journal:initExecutionConsumer({handoff,current,source:[leaf],profile,workspaceBinding:observedBinding}).journal};
}

function accepted(scope={consumableTaskIds:['A'],excludedTaskIds:[]},context={},tasksOverride=null) {
  const tasks=tasksOverride ?? (scope.excludedTaskIds.includes('B')?[task('A'),task('B')]:[task('A')]);
  let journal=createJournal(compilePlan(tasks,profile),{coordinator:'root',authorization:{source:'user',scope:'project'},readScope:['.'],executionScope:scope,...context},{version:3});
  journal=add(journal,{type:'dispatch',taskId:'A',role:'executor',session:'executor',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}});
  journal=add(journal,{type:'deliver',taskId:'A',session:'executor',stopped:true,receipt:{status:'delivered',contractRevision:'c-A',baseRevision:'B',revision:'D',changedFiles:['A.js'],evidence:[{command:'test',exitCode:0,revision:'D',observed}]}});
  const reviewCaps={...caps,reviewIsolation:{enforced:true,mode:'read-only',provider:'host',projectScope:'fixture',targetRevision:'D'}};
  journal=add(journal,{type:'dispatch',taskId:'A',role:'reviewer',session:'candidate-reviewer',capabilities:reviewCaps,context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snap('D')}});
  journal=add(journal,{type:'review',taskId:'A',session:'candidate-reviewer',revision:'D',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snap('D'),stopped:true});
  journal=add(journal,{type:'dispatch',taskId:'A',role:'integrator',session:'integrator',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}});
  journal=add(journal,{type:'integrate',taskId:'A',session:'integrator',stopped:true,integrationRevision:'I',integrationEvidence:[{command:'test',exitCode:0,revision:'I',observed}]});
  const integrationCaps={...caps,reviewIsolation:{enforced:true,mode:'read-only',provider:'host',projectScope:'fixture',targetRevision:'I'}};
  journal=add(journal,{type:'dispatch',taskId:'A',role:'reviewer',session:'integration-reviewer',capabilities:integrationCaps,context:{fresh:true,inheritedHistory:false,source:'host',reviewSnapshot:snap('I')}});
  journal=add(journal,{type:'review',taskId:'A',session:'integration-reviewer',revision:'I',verdict:'pass',findings:[],evidence:['review'],snapshotAfter:snap('I'),stopped:true});
  journal=add(journal,{type:'decide',taskId:'A',disposition:'accepted',reason:'accepted',checks:{scope:'ok',behavior:'ok',independence:'ok',integration:'ok',authority:'ok'},limitations:[]});
  const receiptDigest=digest(replay(journal).tasks.A.receipt);
  journal=add(journal,{type:'progressRequested',taskId:'A',planningRevision:replay(journal).plan.revision,contractRevision:'c-A',integrationRevision:'I',receiptDigest,indexBeforeHash:'before',expectedChange:{from:'[ ]',to:'[x]'}});
  return {journal,receiptDigest};
}

test('official facade is pure and exposes exactly the lifecycle commands',()=>{
  assert.deepEqual(Object.keys(executionConsumer).sort(),['event','init','next','packet','progress','reconcile','status','verify']);
  const source=fs.readFileSync(fileURLToPath(new URL('../lib/execution-consumer.mjs',import.meta.url)),'utf8');
  assert.doesNotMatch(source,/node:child_process|execSync|spawnSync|\bprompt\s*\(/);
});

test('status is read-only, preserves progress recovery and never pauses or completes it',()=>{
  const {journal}=accepted(),before=JSON.stringify(journal);
  const result=statusExecutionConsumer({journal});
  assert.equal(result.disposition,'blocked');
  assert.equal(result.state.tasks.A.status,'progress_pending');
  assert.equal(result.state.paused,null);
  assert.equal(result.state.objectiveVerification,null);
  assert.equal(JSON.stringify(journal),before);
});

test('full and partial terminal states remain gated behind the host completion bridge',()=>{
  let full=accepted();
  full.journal=add(full.journal,{type:'progressCommitted',taskId:'A',receiptDigest:full.receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
  let objective=objectiveSnapshot(full.journal);
  full.journal=add(full.journal,{type:'dispatch',role:'verifier',session:'verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host',reservedActor:'actor:verifier'},objectiveRevision:objective.objectiveRevision});
  assert.throws(()=>add(full.journal,{type:'verifyObjective',session:'verifier',stopped:true,objectiveRevision:objective.objectiveRevision,verdict:'pass',outcome:'done',checks:{originalRequest:'matched',taskCoverage:'all',integratedBehavior:'verified',authority:'grant'},evidence:['proof'],limitations:[],remainingWork:[]}),/host completion bridge/i);
  assert.notEqual(statusExecutionConsumer({journal:full.journal}).disposition,'complete');

  let partial=accepted({consumableTaskIds:['A'],excludedTaskIds:['B']});
  partial.journal=add(partial.journal,{type:'progressCommitted',taskId:'A',receiptDigest:partial.receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
  objective=objectiveSnapshot(partial.journal);
  partial.journal=add(partial.journal,{type:'dispatch',role:'verifier',session:'partial-verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host',reservedActor:'actor:partial-verifier'},objectiveRevision:objective.objectiveRevision});
  assert.throws(()=>add(partial.journal,{type:'verifyObjective',session:'partial-verifier',stopped:true,objectiveRevision:objective.objectiveRevision,verdict:'fail',outcome:'usable subset consumed',checks:{originalRequest:'not complete',taskCoverage:'partial',integratedBehavior:'verified subset',authority:'grant'},evidence:['proof'],limitations:['partial package'],remainingWork:['B']}),/host completion bridge/i);
  assert.notEqual(statusExecutionConsumer({journal:partial.journal}).disposition,'partial_consumed');
});

test('mutation refuses absent or stale current binding before appending',()=>{
  const journal=createJournal(compilePlan([task('A')],profile),{coordinator:'root',authorization:{source:'user',scope:'project'},readScope:['.'],executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]}},{version:3});
  assert.throws(()=>eventExecutionConsumer({journal,handoff:{},current:null,source:[task('A')],event:{type:'pause',source:'user',reason:'stop'},expectedSequence:0}),/current .* observation/i);
  assert.equal(journal.events.length,0);
});

test('source binding validates the complete canonical task-manager projection',()=>{
  const a={...task('A'),title:'A',dependencyDetails:[],decisionInputs:['D1'],resolvesDecisions:['D1']};
  const b={...task('B'),title:'B',dependsOn:['A'],dependencyDetails:[{id:'A',reason:'needs A',requiredOutput:'A output'}],decisionInputs:['D1'],resolvesDecisions:[]};
  const manager=projectTaskManager([a,b]);
  const handoff={taskManager:manager,executionScope:{consumableTaskIds:['A','B'],excludedTaskIds:[]},planningReturn:{blockers:[]}};
  assert.equal(validateExecutionSource(handoff,[a,b]).digest,digest(manager));
  const divergent={...b,dependsOn:[],dependencyDetails:[]};
  assert.throws(()=>validateExecutionSource(handoff,[a,divergent]),/canonical|projection|source/i);
  for(const mutate of [
    value=>{value.plannedWaves=[['A','B']];},
    value=>{value.tasks[0].blocks=[];},
    value=>{value.tasks[0].parallelWith=['B'];},
    value=>{value.tasks[0].serializesWith=['B'];},
    value=>{value.tasks[1].decisionInputs=[];},
  ]) {
    const stale=structuredClone(manager);mutate(stale);
    assert.throws(()=>validateExecutionSource({...handoff,taskManager:stale},[a,b]),/canonical|projection|source/i);
  }
});

test('an archived cancelled verifier is retryable verify_objective, not a cancelled run',()=>{
  let current=accepted();
  current.journal=add(current.journal,{type:'progressCommitted',taskId:'A',receiptDigest:current.receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
  const objective=objectiveSnapshot(current.journal);
  current.journal=add(current.journal,{type:'dispatch',role:'verifier',session:'cancelled-verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:objective.objectiveRevision});
  current.journal=add(current.journal,{type:'stopVerifier',session:'cancelled-verifier',outcome:'cancelled',reason:'host observed stop',stopped:true});
  const status=statusExecutionConsumer({journal:current.journal,capabilities:caps});
  assert.equal(status.disposition,'verify_objective');
  assert.equal(status.next.disposition,'verify_objective');
});

test('consumer context rejects protected/unknown overrides and packets retain canonical references',()=>{
  const plan=compilePlan([task('A')],profile),handoff={
    author:{actor:'caller'},grants:[{kind:'execution',source:'user'}],projectRootRealpath:'/project',
    requestContext:{requestId:'request-1',source:'user',project:{readScope:['.'],constraints:['keep'],refusals:['no install'],authorizations:['execute']}},
    destination:{journal:'run/journal.json',evidence:'run/evidence',source:'user'},packageRootRealpath:'/package',packageId:'package',planningRevision:'planning-1',
    planningFingerprint:'a'.repeat(64),workspaceId:'workspace',workspaceBaselineFingerprint:'b'.repeat(64),repoIdentity:{vcs:'git',rootRealpath:'/project',commonDirRealpath:'/project/.git',baseRevision:'c'.repeat(40)},executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]},
  };
  for(const key of ['authorization','readScope','project','destination','source','current','consumerBinding','canonicalReferences','unknown'])
    assert.throws(()=>deriveExecutionConsumerContext(handoff,plan,{[key]:{forged:true}}),/context|unknown|protected/i);
  const context=deriveExecutionConsumerContext(handoff,plan,{runId:'run-1',references:['ticket-1']},workspaceBinding(handoff));
  assert.equal(context.authorization.source,'user');assert.deepEqual(context.readScope,['.']);
  assert.equal(context.canonicalReferences.requestId,'request-1');assert.equal(context.canonicalReferences.destination.journal,'run/journal.json');
  let journal=createJournal(plan,context,{version:3});
  journal=add(journal,{type:'dispatch',taskId:'A',role:'executor',session:'executor',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'}});
  assert.deepEqual(packetFor(journal,'A').coordinationContext.canonicalReferences,context.canonicalReferences);
});

test('consumer context and objective packet preserve complete immutable intake, negative rules and authority references',()=>{
  const coveredTask={...task('A'),requirements:['REQ-N','REQ-P'],boundary:{exclusions:['Do not reject an existing accepted credential']}};
  const plan=compilePlan([coveredTask],profile),binding={requestId:'request-1',packageId:'package',planningRevision:'planning-1',planningFingerprint:'a'.repeat(64),consumableTaskIds:['A']};
  const handoff={
    author:{actor:'caller',adapter:'fixture',source:'session',observedAt:'2026-10-09T12:00:00.000Z'},
    selection:{consumer:'asds-execution-consumer',selected:true,source:'user selection',observedAt:'2026-10-09T12:00:00.000Z',binding},
    grants:[{kind:'execution',granted:true,source:'user grant',scope:{projectRoot:'/project',binding},validFrom:'2026-10-09T11:00:00.000Z',validUntil:'2026-10-09T13:00:00.000Z'}],
    authorization:{executionAuthorized:true,authorityBindingSha256:'d'.repeat(64)},projectRootRealpath:'/project',
    requestContext:{requestId:'request-1',objective:'Keep literal legacy credentials accepted during sign-in.',source:'user request',
      project:{root:'/project',readScope:['.'],constraints:['Change presentation only'],refusals:['Do not install'],authorizations:['Execute the reviewed package']},binding},
    destination:{journal:'run/journal.json',evidence:'run/evidence',source:'user'},coordinatorBoundary:{enforced:true,projectReadOnly:true,brokers:['journal','evidence','progress'],source:'host',observedAt:'2026-10-09T12:00:00.000Z'},
    packageRootRealpath:'/package',packageId:'package',planningRevision:'planning-1',planningManifest:{path:'planning-manifest.json',sha256:'e'.repeat(64)},canonicalIndex:{path:'tasks.md',referenceId:'tasks',sha256:'f'.repeat(64),readbackRevision:'planning-1'},
    planningFingerprint:'a'.repeat(64),workspaceId:'workspace',workspaceBaselineFingerprint:'b'.repeat(64),repoIdentity:{vcs:'git',rootRealpath:'/project',commonDirRealpath:'/project/.git',baseRevision:'c'.repeat(40)},executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]},
    planningReturn:{originalRequestedProduct:{kind:'implementation',text:'Keep literal legacy credentials accepted during sign-in.',source:'user request',status:'not_fulfilled'},planningAuthority:{preservedRefusals:['Do not install'],authorization:'user'},blockers:[],limitations:[],remainingWork:[],
      coverage:{requirements:[{id:'REQ-N',kind:'negative',source:'user request',text:'Do not reject credentials the provider accepts.'},{id:'REQ-P',kind:'preservation',source:'provider contract',text:'Preserve literal credential submission.'}],decisions:[]},
      references:[{id:'requirements',path:'coverage.json',role:'coverage',sha256:'1'.repeat(64)}]},
  };
  const context=deriveExecutionConsumerContext(handoff,plan,{runId:'run-1'},workspaceBinding(handoff));
  assert.equal(context.immutableIntake.requestContext.objective,handoff.requestContext.objective);
  assert.deepEqual(context.immutableIntake.negativeAndPreservationRules.map(item=>item.id),['REQ-N','REQ-P']);
  assert.deepEqual(context.immutableIntake.requestContext.project.refusals,['Do not install']);
  assert.equal(context.immutableIntake.authorityReferences.selection.source,'user selection');
  assert.equal(context.intakeDigest,digest(context.immutableIntake));
  assert.deepEqual(context.canonicalReferences.package.references,handoff.planningReturn.references);
  assert.deepEqual(context.canonicalReferences.tasks[0].requirements,['REQ-N','REQ-P']);

  let complete=accepted(undefined,context,[coveredTask]);
  complete.journal=add(complete.journal,{type:'progressCommitted',taskId:'A',receiptDigest:complete.receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
  const packet=objectiveSnapshot(complete.journal);
  assert.equal(packet.intakeDigest,context.intakeDigest);
  assert.deepEqual(packet.immutableIntake,context.immutableIntake);
  assert.deepEqual(packet.canonicalReferences,context.canonicalReferences);

  const changed=structuredClone(context);changed.immutableIntake.negativeAndPreservationRules[0].text='Weakened rule';changed.intakeDigest=digest(changed.immutableIntake);
  let changedComplete=accepted(undefined,changed,[coveredTask]);
  changedComplete.journal=add(changedComplete.journal,{type:'progressCommitted',taskId:'A',receiptDigest:changedComplete.receiptDigest,indexBeforeHash:'before',indexAfterHash:'after'});
  const changedPacket=objectiveSnapshot(changedComplete.journal);
  assert.notEqual(changedPacket.objectiveRevision,packet.objectiveRevision,'negative/preservation intake changes must invalidate the verifier revision');
  assert.throws(()=>add(changedComplete.journal,{type:'dispatch',role:'verifier',session:'stale-intake-verifier',capabilities:caps,context:{fresh:true,inheritedHistory:false,source:'host'},objectiveRevision:packet.objectiveRevision}),/stale verifier/i);
});

test('consumer context requires an explicit closed host-owned workspace binding',()=>{
  const plan=compilePlan([task('A')],profile),handoff={
    author:{actor:'caller'},grants:[{kind:'execution',source:'user'}],projectRootRealpath:'/project',
    requestContext:{requestId:'request-1',source:'user',project:{readScope:['.'],constraints:[],refusals:[],authorizations:['execute']}},
    destination:{journal:'run/journal.json',evidence:'run/evidence',source:'user'},packageRootRealpath:'/package',packageId:'package',planningRevision:'planning-1',
    planningFingerprint:'a'.repeat(64),workspaceId:'workspace',workspaceBaselineFingerprint:'b'.repeat(64),
    repoIdentity:{vcs:'git',rootRealpath:'/project',commonDirRealpath:'/project/.git',baseRevision:'c'.repeat(40)},executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]},
  };
  const workspaceBinding={
    packageRootRealpath:'/package',projectRootRealpath:'/project',workspaceId:'workspace',repoIdentity:structuredClone(handoff.repoIdentity),
    planningFingerprint:handoff.planningFingerprint,workspaceBaselineFingerprint:handoff.workspaceBaselineFingerprint,
    currentFingerprint:'host-current-1',writeScope:['A.js'],toolCalls:[],source:'host:workspace-observer',
  };
  assert.throws(()=>deriveExecutionConsumerContext(handoff,plan,{runId:'run-1'}),/workspace binding|required|host-owned/i);
  assert.throws(()=>deriveExecutionConsumerContext(handoff,plan,{workspaceBinding}),/unknown|protected|context/i);
  for(const forged of [
    {...workspaceBinding,currentFingerprint:''},
    {...workspaceBinding,writeScope:[]},
    {...workspaceBinding,writeScope:['../escape.js']},
    {...workspaceBinding,toolCalls:[{id:'call-1',operation:'start',actor:'worker',session:'s',role:'executor',source:'caller'}]},
    {...workspaceBinding,source:'caller'},
    {...workspaceBinding,unknown:true},
    {...workspaceBinding,workspaceId:'other'},
  ]) assert.throws(()=>deriveExecutionConsumerContext(handoff,plan,{runId:'run-1'},forged),/workspace|binding|host-owned|unknown|canonical|scope/i);
  const context=deriveExecutionConsumerContext(handoff,plan,{runId:'run-1'},workspaceBinding);
  assert.deepEqual(context.workspaceBinding,workspaceBinding);
  workspaceBinding.currentFingerprint='mutated-after-call';
  assert.equal(context.workspaceBinding.currentFingerprint,'host-current-1');
});

test('plan-changing events require explicit rebind and append nothing',()=>{
  const journal=createJournal(compilePlan([task('A')],profile),{coordinator:'root',authorization:{source:'user',scope:'project'},readScope:['.'],executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]}},{version:3});
  for(const type of ['replan','decompose','refine']) {
    const result=executionMutationBoundary({journal,event:{type}});
    assert.equal(result.disposition,'manual_handoff_required');assert.equal(result.reasonCode,'rebind_required');
    assert.equal(result.journal,journal);assert.equal(result.journal.events.length,0);
    assert.equal(statusExecutionConsumer({journal:result.journal,capabilities:caps}).disposition,'continue');
  }
});

test('generic event path reserves progress and objective proof for their validated commands',()=>{
  const journal=createJournal(compilePlan([task('A')],profile),{coordinator:'root',authorization:{source:'user',scope:'project'},readScope:['.'],executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]}},{version:3});
  const index='- [ ] A\n',before=JSON.stringify(journal);
  for(const event of [
    {type:'progressRequested',taskId:'A',receiptDigest:'invented',indexBeforeHash:'invented'},
    {type:'progressCommitted',taskId:'A',receiptDigest:'invented',indexBeforeHash:'invented',indexAfterHash:'invented'},
    {type:'verifyObjective',session:'caller',verdict:'pass',outcome:'invented'},
  ]) {
    const result=executionMutationBoundary({journal,event});
    assert.equal(result.disposition,'manual_handoff_required');
    assert.equal(result.reasonCode,'reserved_event');
    assert.equal(result.journal,journal);
    assert.equal(result.journal.events.length,0);
  }
  assert.equal(JSON.stringify(journal),before);
  assert.equal(index,'- [ ] A\n');
  const primitive=add(journal,{type:'pause',source:'user',reason:'ordinary event remains available'});
  assert.equal(primitive.events.length,1,'the EC-03 append primitive remains independently available');
});
test('verify facade cannot append caller-authored or string-only objective completion',()=>{
 const run=officialRun({after:()=>{}}),before=JSON.stringify(run.journal);
 const result=verifyExecutionConsumer({journal:run.journal,handoff:run.handoff,current:run.current,source:run.source,expectedSequence:0,event:{type:'verifyObjective',verdict:'pass',outcome:'done',evidence:['claim']}});
 assert.equal(result.disposition,'manual_handoff_required');assert.equal(result.reasonCode,'reserved_event');assert.match(result.reason,/hostCompleteVerifier/);assert.equal(JSON.stringify(run.journal),before);
});

test('resume preserves handoff-derived authority and forged authority appends nothing',()=>{
  const authority={source:'user',scope:'/project'};
  let journal=createJournal(compilePlan([task('A')],profile),{coordinator:'root',authorization:authority,readScope:['.'],executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]}},{version:3});
  journal=add(journal,{type:'pause',source:'user',reason:'review'});
  const forged={type:'resume',reason:'continue',authorization:{source:'attacker',scope:'other'},context:{consumerBinding:'forged'}};
  const blocked=executionMutationBoundary({journal,event:forged});
  assert.equal(blocked.reasonCode,'rebind_required');assert.equal(blocked.journal,journal);assert.equal(blocked.journal.events.length,1);
  const normalized=normalizeExecutionEvent(journal,{type:'resume',reason:'continue'});
  assert.deepEqual(normalized.authorization,authority);
  const resumed=add(journal,normalized);
  assert.deepEqual(replay(resumed).context.authorization,authority);
});

test('consumer cancel persists a reserved terminal marker and blocks every later mutation',()=>{
  let journal=createJournal(compilePlan([task('A')],profile),{coordinator:'root',authorization:{source:'user',scope:'project'},readScope:['.'],executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]}},{version:3});
  assert.throws(()=>normalizeExecutionEvent(journal,{type:'cancel'}),/reason/i);
  journal=add(journal,normalizeExecutionEvent(journal,{type:'cancel',reason:'user request'}));
  assert.equal(journal.events.at(-1).event.type,'pause');assert.equal(journal.events.at(-1).event.source,'asds.execution-consumer.cancelled');
  assert.equal(statusExecutionConsumer({journal}).disposition,'cancelled');
  for(const type of ['resume','block','cancel']) {
    const result=executionMutationBoundary({journal,event:{type,reason:'later',taskId:'A'}});
    assert.equal(result.disposition,'manual_handoff_required');assert.equal(result.reasonCode,'terminal_cancelled');assert.equal(result.journal.events.length,1);
  }
});

test('terminal cancel blocks progress and reconciliation before authority, readback or broker effects',t=>{
  const run=officialRun(t),cancelled=eventExecutionConsumer({...run,event:{type:'cancel',reason:'stop permanently'},expectedSequence:0}).journal;
  const before=JSON.stringify(cancelled);let touched=0;
  const untouched=target=>new Proxy(target,{get(value,key,receiver){touched+=1;return Reflect.get(value,key,receiver);}});
  const progress=progressExecutionConsumer({...run,journal:cancelled,canonicalTasks:untouched([]),canonicalReceipt:untouched({}),taskId:'A',
    progressRequested:{type:'progressRequested'},progressCommitted:null,indexReadback:untouched({}),hostAuthority:untouched({}),broker:untouched({})});
  assert.equal(progress.disposition,'manual_handoff_required');assert.equal(progress.reasonCode,'terminal_cancelled');assert.equal(progress.journal,cancelled);
  assert.equal(JSON.stringify(cancelled),before);assert.equal(cancelled.events.length,1);assert.equal(touched,0,'no receipt/readback/authority/broker input may be observed after terminal cancel');
  const reconciliation=reconcileExecutionConsumer({...run,journal:cancelled,canonicalTasks:untouched([]),taskId:'A',context:untouched({hostAuthority:untouched({})})});
  assert.equal(reconciliation.reasonCode,'terminal_cancelled');assert.equal(reconciliation.journal,cancelled);assert.equal(touched,0,'reconciliation cannot consume authority after terminal cancel');
  assert.equal(JSON.stringify(cancelled),before);
});

test('bound context is rederived and rejects direct-core authority drift or events after terminal cancel',()=>{
  const plan=compilePlan([task('A')],profile),handoff={
    author:{actor:'caller'},grants:[{kind:'execution',source:'user'}],projectRootRealpath:'/project',
    requestContext:{requestId:'request-1',source:'user',project:{readScope:['.'],constraints:[],refusals:[],authorizations:['execute']}},
    destination:{journal:'run/journal.json',evidence:'run/evidence',source:'user'},packageRootRealpath:'/package',packageId:'package',planningRevision:'planning-1',
    planningFingerprint:'a'.repeat(64),workspaceId:'workspace',workspaceBaselineFingerprint:'b'.repeat(64),repoIdentity:{vcs:'git',rootRealpath:'/project',commonDirRealpath:'/project/.git',baseRevision:'c'.repeat(40)},executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]},
  };
  let journal=createJournal(plan,deriveExecutionConsumerContext(handoff,plan,{},workspaceBinding(handoff)),{version:3});
  validateExecutionConsumerContextBinding(handoff,journal);
  journal=add(journal,{type:'pause',source:'user',reason:'pause'});
  const drifted=add(journal,{type:'resume',reason:'forged',authorization:{source:'attacker',scope:'other'}});
  assert.throws(()=>validateExecutionConsumerContextBinding(handoff,drifted),/stale|authority|context/i);
  let cancelled=createJournal(plan,deriveExecutionConsumerContext(handoff,plan,{},workspaceBinding(handoff)),{version:3});
  cancelled=add(cancelled,normalizeExecutionEvent(cancelled,{type:'cancel',reason:'done'}));
  validateExecutionConsumerContextBinding(handoff,cancelled);
  const adulterated=add(cancelled,{type:'resume',reason:'bypass',authorization:replay(cancelled).context.authorization});
  assert.throws(()=>validateExecutionConsumerContextBinding(handoff,adulterated),/terminal|cancel|event/i);
});

test('status rejects duplicate, forged and post-terminal cancellation markers without a handoff',()=>{
  const make=()=>createJournal(compilePlan([task('A')],profile),{coordinator:'root',authorization:{source:'user',scope:'project'},readScope:['.'],executionScope:{consumableTaskIds:['A'],excludedTaskIds:[]}},{version:3});
  let post=add(make(),{type:'pause',source:'asds.execution-consumer.cancelled',reason:'done'});
  post=add(post,{type:'resume',reason:'bypass',authorization:{source:'user',scope:'project'}});
  assert.throws(()=>statusExecutionConsumer({journal:post}),/terminal|cancel|final/i);
  let duplicate=add(make(),{type:'pause',source:'asds.execution-consumer.cancelled',reason:'one'});
  duplicate=add(duplicate,{type:'pause',source:'asds.execution-consumer.cancelled',reason:'two'});
  assert.throws(()=>statusExecutionConsumer({journal:duplicate}),/ambiguous|marker|cancel/i);
  const forged=add(make(),{type:'pause',source:'asds.execution-consumer.cancelled',reason:'done',forged:true});
  assert.throws(()=>statusExecutionConsumer({journal:forged}),/forged|marker|cancel/i);
});
