import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appendEvent, compilePlan, createJournal, digest, replay } from '../lib/orchestration.mjs';
import { validateCanonicalReceipt } from '../lib/contracts.mjs';
import { compareProjectionContract, createHostAuthorityCapability, reconcileProjectionReceipt, reconcileReceiptProgress } from '../lib/receipt-reconciliation.mjs';

const body=['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(heading=>`## ${heading}\nConcrete outcome and checks.\n`).join('\n');
const profile={version:1,tiers:Object.fromEntries(['bounded','medium','high'].map(tier=>[tier,{executor:{model:'executor',effort:'high'},reviewer:{model:'reviewer',effort:'medium'}}]))};
const caps={spawn:true,isolatedWrites:true,maxAgents:8,externalActive:0,models:[{model:'executor',efforts:['high']},{model:'reviewer',efforts:['medium']}]};
const task=(id,extra={})=>({id,dependsOn:[],write:[`src/${id}.js`],resources:[],scenarios:['demo/works'],verification:['test'],kind:'implementation',openDecisions:[],body,contractRevision:`projection-${id}`,owner:`worker-${id}`,orchestration:{complexity:'bounded',uncertainty:'bounded',risk:'bounded',rationale:'Bounded fixture.',skills:['test-driven-development'],references:['specs/demo/spec.md'],claims:[]},...extra});
const observed=command=>({invocation:command,scope:'declared',targets:['fixture'],source:'test-host'});
const snapshot=(id,revision)=>({revision,changedFiles:[`src/${id}.js`],scopeFingerprint:`${revision}-scope`});
const add=(journal,event)=>appendEvent(journal,event,journal.events.length);
const dispatch=(journal,id,role,session)=>{
  const current=replay(journal).tasks[id],revision=role==='reviewer'?(current.status==='delivered'?current.receipt.revision:current.receipt.integrationRevision):null;
  const capabilities=role==='reviewer'?{...caps,reviewIsolation:{enforced:true,mode:'read-only',provider:'test-host',projectScope:'fixture',targetRevision:revision}}:caps;
  return add(journal,{type:'dispatch',taskId:id,role,session,capabilities,context:{fresh:true,inheritedHistory:false,source:'host',...(role==='reviewer'?{reviewSnapshot:snapshot(id,revision)}:{})}});
};
function acceptedJournal(tasks=[task('A')],scope={consumableTaskIds:['A'],excludedTaskIds:[]}) {
  let journal=createJournal(compilePlan(tasks,profile),{coordinator:'root',authorization:{source:'user',scope:'fixture'},readScope:['project'],executionScope:scope},{version:3});
  journal=dispatch(journal,'A','executor','executor-A');
  journal=add(journal,{type:'deliver',taskId:'A',session:'executor-A',stopped:true,receipt:{status:'delivered',contractRevision:'projection-A',baseRevision:'base',revision:'candidate',changedFiles:['src/A.js'],evidence:[{command:'test',exitCode:0,revision:'candidate',observed:observed('test')}]}});
  journal=dispatch(journal,'A','reviewer','candidate-reviewer');
  journal=add(journal,{type:'reviewResult',taskId:'A',session:'candidate-reviewer',revision:'candidate',verdict:'pass',findings:[],evidence:['candidate review'],snapshotAfter:snapshot('A','candidate'),stopped:true});
  journal=dispatch(journal,'A','integrator','integrator-A');
  journal=add(journal,{type:'integrate',taskId:'A',session:'integrator-A',stopped:true,integrationRevision:'integration',integrationEvidence:[{command:'test',exitCode:0,revision:'integration',observed:observed('test')}]});
  journal=dispatch(journal,'A','reviewer','integration-reviewer');
  journal=add(journal,{type:'reviewResult',taskId:'A',session:'integration-reviewer',revision:'integration',verdict:'pass',findings:[],evidence:['integration review'],snapshotAfter:snapshot('A','integration'),stopped:true});
  return add(journal,{type:'decide',taskId:'A',disposition:'accepted',reason:'accepted fixture',checks:{scope:'current',behavior:'verified',independence:'separate sessions',integration:'current',authority:'grant'},limitations:[]});
}
const sha=value=>value.repeat(64);
const ledger={schemaVersion:'asds.workspace-baseline-ledger/1',workspaceBaselineFingerprint:sha('a'),candidateFingerprint:sha('b'),workspaceIdentityDigest:sha('3'),snapshotDigest:sha('4'),deltaDigest:sha('5'),observationToken:sha('6'),preexistingDirty:[{path:'src/A.js',sha256:sha('1')}],candidateChanges:[{path:'src/A.js',beforeSha256:sha('1'),afterSha256:sha('2')}],source:'host-bridge'};
const boundary=(journal)=>({journalVersion:3,journalSequence:journal.events.length,journalEventDigest:journal.events.at(-1).digest,planningRevision:replay(journal).plan.revision,candidateRevision:'candidate',integrationRevision:'integration',reviewRevision:'integration'});
const baselineObservationFor=journal=>({schemaVersion:'asds.workspace-baseline-observation/1',token:sha('6'),source:'host-bridge',authorityGeneration:1,...boundary(journal),workspaceIdentityDigest:sha('3'),snapshotDigest:sha('4'),deltaDigest:sha('5'),ledgerDigest:digest(ledger),preexistingDirty:ledger.preexistingDirty,candidateChanges:ledger.candidateChanges});
function hostAttestation(journal){
  const candidate=journal.events.find(entry=>entry.event.type==='deliver'),integration=journal.events.find(entry=>entry.event.type==='integrate');
  const reviews=journal.events.filter(entry=>entry.event.type==='review');
  const bindEvidence=(entry,phase,item)=>({phase,command:item.command,revision:item.revision,scope:item.observed.scope,targets:item.observed.targets,evidenceDigest:digest(item),toolCallDigest:sha(phase==='candidate'?'7':'8'),eventSequence:entry.sequence,eventDigest:entry.digest});
  const bindReview=(entry,phase)=>({phase,revision:entry.event.revision,reviewerSession:entry.event.session,eventSequence:entry.sequence,eventDigest:entry.digest});
  return {schemaVersion:'asds.delivery-host-attestation/1',token:sha('9'),source:'host-bridge',authorityGeneration:1,taskId:'A',...boundary(journal),
    evidence:[bindEvidence(candidate,'candidate',candidate.event.receipt.evidence[0]),bindEvidence(integration,'integration',integration.event.integrationEvidence[0])],
    reviews:[bindReview(reviews[0],'candidate'),bindReview(reviews[1],'integration')]};
}
const ownerMappings=()=>[{field:'owner',rationale:'Routing metadata only',evidence:['owner map']}];
function equivalenceAttestation(journal,mappings=ownerMappings()){
  const review=journal.events.find(entry=>entry.event.type==='review'&&entry.event.revision==='integration');
  return {schemaVersion:'asds.equivalence-attestation/1',token:sha('a'),source:'host-bridge',authorityGeneration:1,reviewerSession:'integration-reviewer',...boundary(journal),eventSequence:review.sequence,eventDigest:review.digest,mappingDigest:digest(mappings)};
}
const authorityBinding=(kind,payload,journal)=>({kind,token:payload.token,source:payload.source,authorityGeneration:payload.authorityGeneration,...boundary(journal),payloadDigest:digest(payload)});
function authorityCapability(journal){
  const delivery=hostAttestation(journal),baseline=baselineObservationFor(journal),equivalence=equivalenceAttestation(journal);
  return createHostAuthorityCapability(authorityLedger(journal,[authorityBinding('delivery-attestation',delivery,journal),authorityBinding('baseline-observation',baseline,journal),authorityBinding('equivalence-attestation',equivalence,journal)]));
}
const authorityLedger=(journal,bindings)=>({schemaVersion:'asds.host-authority-ledger/1',source:'host-bridge',authorityGeneration:1,bindings});
const context=(journal,overrides={})=>({workspaceBaselineFingerprint:sha('a'),progressRevision:sha('c'),runtimeRevision:digest(replay(journal).tasks.A),baselineLedger:ledger,baselineObservation:baselineObservationFor(journal),hostAttestation:hostAttestation(journal),hostAuthority:authorityCapability(journal),...overrides});
const equivalenceFor=(journal,projected,canonical)=>{
  const comparison=compareProjectionContract(projected,canonical),mappings=ownerMappings();
  return {schemaVersion:'asds.contract-equivalence/1',verdict:'pass',independent:true,reviewer:'integration-reviewer',source:'host-bridge',evidence:['comparison'],limitations:[],mappings,projectionContractRevision:'projection-A',canonicalContractRevision:'canonical-A',...comparison,
    attestation:equivalenceAttestation(journal,mappings)};
};
const readback=(journal,receipt,status,indexBeforeHash,indexAfterHash)=>({schemaVersion:'asds.index-readback/1',token:sha('b'),source:'progress-broker-host',authorityGeneration:2,...boundary(journal),candidateRevision:receipt.provenance.candidateRevision,integrationRevision:receipt.provenance.integrationRevision,reviewRevision:receipt.provenance.reviewRevision,brokerEventDigest:sha('e'),status,indexBeforeHash,...(indexAfterHash?{indexAfterHash}:{})});
const brokerArgs=(journal,receipt,observed)=>({indexReadback:observed,hostAuthority:createHostAuthorityCapability({schemaVersion:'asds.host-authority-ledger/1',source:'progress-broker-host',authorityGeneration:2,bindings:[authorityBinding('progress-readback',observed,journal)]})});

test('v3 accepted projection receipt becomes a canonical receipt linking every revision',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks;
  const canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:`canonical-${item.id}`}));
  const receipt=reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:context(journal)});
  assert.equal(receipt.schemaVersion,'asds.canonical-receipt/1');
  assert.equal(receipt.contractRevision,'canonical-A');
  assert.deepEqual(receipt.provenance,{...receipt.provenance,schemaVersion:'asds.receipt-provenance/1',taskId:'A',projectionRevision:'projection-A',canonicalRevision:'canonical-A',planningRevision:replay(journal).plan.revision,runtimeRevision:digest(replay(journal).tasks.A),candidateRevision:'candidate',integrationRevision:'integration',reviewRevision:'integration',progressRevision:sha('c'),journalVersion:3,journalSequence:journal.events.length,journalEventDigest:journal.events.at(-1).digest,runtimeReceiptDigest:digest(replay(journal).tasks.A.receipt),baselineLedger:ledger});
  assert.deepEqual(validateCanonicalReceipt(canonicalTasks[0],receipt,{...context(journal),planningRevision:replay(journal).plan.revision,projectionRevision:'projection-A',journalSequence:journal.events.length,journalEventDigest:journal.events.at(-1).digest,runtimeReceiptDigest:digest(replay(journal).tasks.A.receipt)}),[]);
});

test('only owner drift is equivalence-reviewable; execution fields and unknowns are irreconcilable',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,projected=projectionTasks[0];
  const canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A',owner:'canonical-owner'}));
  const equivalence=equivalenceFor(journal,projected,canonicalTasks[0]);
  assert.doesNotThrow(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',equivalence,context:context(journal)}));
  for(const change of [{body:`${body}\nChanged acceptance.`},{executionAuthorized:true},{source:'new-undocumented-authority'}]) {
    const changed=projectionTasks.map(item=>({...item,contractRevision:'canonical-A',...change}));
    assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks:changed,taskId:'A',equivalence:{...equivalence,...compareProjectionContract(projected,changed[0])},context:context(journal)}),/irreconcilable/);
  }
});

test('owner equivalence requires an attested reviewer/journal/revision mapping, not caller structure',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,projected=projectionTasks[0];
  const canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A',owner:'canonical-owner'}));
  const comparison=compareProjectionContract(projected,canonicalTasks[0]);
  const callerEquivalence={schemaVersion:'asds.contract-equivalence/1',verdict:'pass',independent:true,reviewer:'invented-reviewer',source:'host review',
    evidence:['caller supplied comparison'],limitations:[],mappings:[{field:'owner',rationale:'Routing metadata only',evidence:['caller map']}],
    projectionContractRevision:'projection-A',canonicalContractRevision:'canonical-A',...comparison};
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',equivalence:callerEquivalence,context:context(journal)}),/attest|journal|review/i);
});

test('caller-invented host tokens and sources cannot be self-attested into a canonical receipt',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks;
  const canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A'}));
  const forged=context(journal,{hostAttestation:{...hostAttestation(journal),token:sha('f'),source:'attacker-bridge'}});
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:forged}),/host-owned|consume|token|attestation/i);
});

test('official authority capability rejects callback/object spoof, replay, cross-kind and stale bindings',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A'}));
  const base=context(journal);
  for(const hostAuthority of [()=>({}),{schemaVersion:'asds.host-authority-capability/1'}])
    assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:{...base,hostAuthority}}),/official host authority capability/i);
  const replayContext=context(journal);
  assert.equal(reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:replayContext}).schemaVersion,'asds.canonical-receipt/1');
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:replayContext}),/replayed|stale/i);
  const delivery=authorityBinding('delivery-attestation',hostAttestation(journal),journal),baseline=authorityBinding('baseline-observation',baselineObservationFor(journal),journal);
  const crossKind=createHostAuthorityCapability(authorityLedger(journal,[{...delivery,kind:'baseline-observation'},baseline]));
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:{...context(journal),hostAuthority:crossKind}}),/mismatched|delivery-attestation/i);
  const stale=createHostAuthorityCapability(authorityLedger(journal,[{...delivery,planningRevision:'stale'},baseline]));
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:{...context(journal),hostAuthority:stale}}),/stale|mismatched/i);
  const stalePayload={...hostAttestation(journal),evidence:hostAttestation(journal).evidence.map((item,index)=>index?item:{...item,targets:['forged-target']})};
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:{...context(journal),hostAttestation:stalePayload}}),/payload|mismatched|authority/i);
});

test('failed final receipt validation does not consume a reusable authority batch',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A'}));
  const reusable=context(journal);
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:{...reusable,workspaceBaselineFingerprint:sha('f')}}),/baseline|fingerprint/i);
  assert.equal(reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:reusable}).schemaVersion,'asds.canonical-receipt/1');
});

test('baseline observation cannot be recomputed around omitted dirt or a null prior hash',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A'}));
  for(const candidateChanges of [ledger.candidateChanges,[{path:'src/A.js',beforeSha256:null,afterSha256:sha('2')}]] ){
    const incomplete={...ledger,preexistingDirty:[],candidateChanges};
    const observation={...baselineObservationFor(journal),ledgerDigest:digest(incomplete),preexistingDirty:[],candidateChanges};
    assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:context(journal,{baselineLedger:incomplete,baselineObservation:observation})}),/baseline|dirty|snapshot|delta|before/i);
  }
});

test('owner mapping digest must have existed in the original review attestation',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,projected=projectionTasks[0];
  const canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A',owner:'canonical-owner'}));
  const equivalence=equivalenceFor(journal,projected,canonicalTasks[0]);
  const mappings=equivalence.mappings.map(mapping=>({...mapping,rationale:'Post-fact caller rationale',evidence:['post-fact map']}));
  const forged={...equivalence,mappings,attestation:{...equivalence.attestation,mappingDigest:digest(mappings)}};
  assert.throws(()=>reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',equivalence:forged,context:context(journal)}),/original|review|mapping|attest/i);
});

test('legacy reconcile call without v3 provenance returns an explicit fail-closed migration result',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks;
  const canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A'}));
  const result=reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A'});
  assert.deepEqual(result,{schemaVersion:'asds.receipt-reconciliation-pending/1',status:'provenance_required',taskId:'A',canonicalReceipt:null,
    requiredContext:['workspaceBaselineFingerprint','progressRevision','baselineLedger','baselineObservation','hostAttestation','hostAuthority']});
  assert.equal(reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks:canonicalTasks.map(task=>({...task,owner:'canonical-owner'})),taskId:'A'}).status,'provenance_required');
  assert.equal(reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:null}).status,'provenance_required');
});

test('stale provenance, fake evidence, excluded tasks and legacy receipts fail closed',()=>{
  const partial=acceptedJournal([task('A'),task('B')],{consumableTaskIds:['A'],excludedTaskIds:['B']}),projectionTasks=replay(partial).plan.tasks;
  const canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:`canonical-${item.id}`}));
  assert.throws(()=>reconcileProjectionReceipt({journal:partial,projectionTasks,canonicalTasks,taskId:'B',context:context(partial)}),/excluded|accepted/);
  assert.throws(()=>reconcileProjectionReceipt({journal:partial,projectionTasks,canonicalTasks,taskId:'A',context:context(partial,{planningRevision:'stale'})}),/planning|revision/i);
  const fake=structuredClone(partial),delivery=fake.events.find(entry=>entry.event.type==='deliver').event.receipt;
  delivery.evidence[0].observed.source='claim';
  let resigned=createJournal(fake.plan,fake.context,{version:3});
  assert.throws(()=>{for(const entry of fake.events) resigned=appendEvent(resigned,entry.event,resigned.events.length);},/observed|metadata/i);
  const legacy=JSON.parse(fs.readFileSync(new URL('./fixtures/orchestration/login-pilot-v1/run-v1.json',import.meta.url)));
  assert.throws(()=>reconcileProjectionReceipt({journal:legacy,projectionTasks:replay(legacy).plan.tasks,canonicalTasks:replay(legacy).plan.tasks,taskId:'0007',context:{}}),/journal v3|provenance/i);
});

test('receipt and checkbox remain independent until a current reconciled progress pair exists',()=>{
  let journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A'}));
  const receipt=reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:context(journal)});
  const request={type:'progressRequested',taskId:'A',planningRevision:replay(journal).plan.revision,contractRevision:'canonical-A',integrationRevision:'integration',receiptDigest:receipt.provenance.runtimeReceiptDigest,indexBeforeHash:sha('c'),expectedChange:{from:'[ ]',to:'[x]'}};
  let open=readback(journal,receipt,'open',sha('c')),closed=readback(journal,receipt,'closed',sha('c'),sha('d'));
  assert.throws(()=>reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:{...receipt,provenance:{...receipt.provenance,runtimeRevision:'stale'}},taskId:'A',progressRequested:request,...brokerArgs(journal,receipt,open)}),/runtime revision/i);
  const ready=reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,...brokerArgs(journal,receipt,open)});
  assert.equal(ready.status,'ready_to_request');
  assert.equal(ready.event.authorityConsumption.kind,'progress-readback');
  assert.throws(()=>reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,indexReadback:{status:'open',indexBeforeHash:sha('c'),source:'invented-broker'}}),/broker|host-owned|provenance/i);
  assert.throws(()=>reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,...brokerArgs(journal,receipt,closed)}),/checkbox|progressRequested/i);
  const forgedJournal=add(journal,{...ready.event,authorityConsumption:{...ready.event.authorityConsumption,handle:sha('f')}});
  const forgedOpen=readback(forgedJournal,receipt,'open',sha('c'));
  assert.throws(()=>reconcileReceiptProgress({journal:forgedJournal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,...brokerArgs(forgedJournal,receipt,forgedOpen)}),/forged|authority consumption/i);
  journal=add(journal,ready.event);
  open=readback(journal,receipt,'open',sha('c'));closed=readback(journal,receipt,'closed',sha('c'),sha('d'));
  const inspection=brokerArgs(journal,receipt,open);
  assert.equal(reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,...inspection}).status,'ready_to_commit');
  assert.equal(reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,...inspection}).status,'ready_to_commit',
    'pure readiness inspection must not burn an authority token without a canonical event');
  const recovered=reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,...brokerArgs(journal,receipt,closed)});
  assert.equal(recovered.status,'recover_commit');
  const committed=recovered.event;
  journal=add(journal,committed);
  closed=readback(journal,receipt,'closed',sha('c'),sha('d'));
  assert.equal(reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,progressCommitted:committed,...brokerArgs(journal,receipt,closed)}).status,'committed');
  assert.throws(()=>reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:{...request,receiptDigest:sha('f')},progressCommitted:committed,...brokerArgs(journal,receipt,closed)}),/receipt|provenance/i);
});

test('invalid progress ordering does not consume the readback capability needed by a valid retry',()=>{
  const journal=acceptedJournal(),projectionTasks=replay(journal).plan.tasks,canonicalTasks=projectionTasks.map(item=>({...item,contractRevision:'canonical-A'}));
  const receipt=reconcileProjectionReceipt({journal,projectionTasks,canonicalTasks,taskId:'A',context:context(journal)});
  const request={type:'progressRequested',taskId:'A',planningRevision:replay(journal).plan.revision,contractRevision:'canonical-A',integrationRevision:'integration',receiptDigest:receipt.provenance.runtimeReceiptDigest,indexBeforeHash:sha('c'),expectedChange:{from:'[ ]',to:'[x]'}};
  const open=readback(journal,receipt,'open',sha('c')),authority=brokerArgs(journal,receipt,open).hostAuthority;
  const premature={type:'progressCommitted',taskId:'A',receiptDigest:request.receiptDigest,indexBeforeHash:sha('c'),indexAfterHash:sha('d')};
  assert.throws(()=>reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,progressCommitted:premature,indexReadback:open,hostAuthority:authority}),/before progressRequested/i);
  assert.equal(reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt:receipt,taskId:'A',progressRequested:request,indexReadback:open,hostAuthority:authority}).status,'ready_to_request');
});
