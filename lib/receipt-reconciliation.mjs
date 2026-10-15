import { digest, replay, assertCurrentPlan } from './orchestration.mjs';
import { validateCanonicalReceipt, validateDelivery, validateTasks } from './contracts.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const nonempty = value => typeof value === 'string' && value.trim();
const strings = value => Array.isArray(value) && value.every(nonempty);
const material = task => Object.fromEntries(Object.entries(task)
  .filter(([key])=>key!=='contractRevision'));
// Fail closed: only fields named here may be explained by an independent
// equivalence review. New contract fields are execution-significant until ASDS
// deliberately classifies them otherwise.
const reconcilableMetadata = new Set(['owner']);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(field=>Object.hasOwn(value,field));
const fail = message => { throw new Error(message); };
const pendingProvenance = taskId => ({schemaVersion:'asds.receipt-reconciliation-pending/1',status:'provenance_required',taskId,canonicalReceipt:null,
  requiredContext:['workspaceBaselineFingerprint','progressRevision','baselineLedger','baselineObservation','hostAttestation','hostAuthority']});
const eventAt = (journal,sequence) => journal.events[sequence-1];
const AUTHORITY_KINDS=new Set(['delivery-attestation','baseline-observation','equivalence-attestation','progress-readback']);
const authorityCapabilities=new WeakSet(),authorityStates=new WeakMap();
const bindingFields=['kind','token','source','authorityGeneration','journalVersion','journalSequence','journalEventDigest','planningRevision','candidateRevision','integrationRevision','reviewRevision','payloadDigest'];
const validBinding=binding=>exact(binding,bindingFields)&&AUTHORITY_KINDS.has(binding.kind)&&hash(binding.token)&&nonempty(binding.source)&&
  !['caller','claim','host'].includes(binding.source.trim().toLowerCase())&&Number.isInteger(binding.authorityGeneration)&&binding.authorityGeneration>0&&
  binding.journalVersion===3&&Number.isInteger(binding.journalSequence)&&binding.journalSequence>=0&&hash(binding.journalEventDigest)&&
  [binding.planningRevision,binding.candidateRevision,binding.integrationRevision,binding.reviewRevision].every(nonempty)&&hash(binding.payloadDigest);

// Models an EC-05 adapter capability. The private brand/ledger prevents JSON or
// callback spoofing inside this process; authenticating the adapter itself remains
// a host responsibility and is intentionally not claimed by this deterministic core.
export function createHostAuthorityCapability(ledger) {
  if(!exact(ledger,['schemaVersion','source','authorityGeneration','bindings'])||ledger.schemaVersion!=='asds.host-authority-ledger/1'||
      !nonempty(ledger.source)||['caller','claim','host'].includes(ledger.source.trim().toLowerCase())||
      !Number.isInteger(ledger.authorityGeneration)||ledger.authorityGeneration<1||!Array.isArray(ledger.bindings)||!ledger.bindings.length||
      ledger.bindings.some(binding=>!validBinding(binding)||binding.source!==ledger.source||binding.authorityGeneration!==ledger.authorityGeneration)||
      new Set(ledger.bindings.map(binding=>binding.token)).size!==ledger.bindings.length)fail('invalid host authority ledger');
  const capability=Object.freeze({schemaVersion:'asds.host-authority-capability/1'});
  authorityCapabilities.add(capability);authorityStates.set(capability,{source:ledger.source,generation:ledger.authorityGeneration,
    registry:new Map(ledger.bindings.map(binding=>[binding.token,clone(binding)])),consumed:new Set()});
  return capability;
}

function resolveAuthorities(capability,requests,consume=false) {
  if(!object(capability)||!authorityCapabilities.has(capability))fail('official host authority capability is required');
  if(!Array.isArray(requests)||!requests.length||requests.some(request=>!validBinding(request))||new Set(requests.map(request=>request.token)).size!==requests.length)
    fail('invalid host authority consumption batch');
  const state=authorityStates.get(capability),resolved=[];
  for(const request of requests){
    const stored=state.registry.get(request.token);
    if(!stored||state.consumed.has(request.token)||digest(stored)!==digest(request))fail(`host authority rejected stale, replayed or mismatched ${request.kind} binding`);
    resolved.push(stored);
  }
  if(consume)for(const binding of resolved)state.consumed.add(binding.token);
  return resolved.map(binding=>({schemaVersion:'asds.host-authority-consumption/1',kind:binding.kind,
    handle:digest({generation:state.generation,token:binding.token,binding}),token:binding.token,source:state.source,authorityGeneration:state.generation,binding:clone(binding)}));
}
const prepareAuthorities=(capability,requests)=>resolveAuthorities(capability,requests,false);
const consumeAuthorities=(capability,requests)=>resolveAuthorities(capability,requests,true);

function assertDeliveryHostBoundary(journal,attestation) {
  if(!object(attestation))fail('delivery host attestation is required');
  const boundary=eventAt(journal,attestation.journalSequence);
  if(!boundary||boundary.digest!==attestation.journalEventDigest)fail('delivery host attestation does not match current journal boundary');
  for(const evidence of attestation.evidence??[]){
    const entry=eventAt(journal,evidence.eventSequence),event=entry?.event;
    const items=evidence.phase==='candidate'?event?.receipt?.evidence:event?.integrationEvidence;
    if(entry?.digest!==evidence.eventDigest||!Array.isArray(items)||!items.some(item=>digest(item)===evidence.evidenceDigest))
      fail(`delivery host attestation evidence is not journal-bound: ${evidence.phase}/${evidence.command}`);
  }
  for(const review of attestation.reviews??[]){
    const entry=eventAt(journal,review.eventSequence),event=entry?.event;
    if(entry?.digest!==review.eventDigest||!['review','reviewResult'].includes(event?.type)||event.session!==review.reviewerSession||event.revision!==review.revision)
      fail(`delivery host attestation review is not journal-bound: ${review.phase}`);
  }
}

const authorityBinding=(kind,payload,{journalSequence,journalEventDigest,planningRevision,candidateRevision,integrationRevision,reviewRevision})=>({
  kind,token:payload.token,source:payload.source,authorityGeneration:payload.authorityGeneration,journalVersion:3,journalSequence,journalEventDigest,
  planningRevision,candidateRevision,integrationRevision,reviewRevision,payloadDigest:digest(payload),
});

function validateEquivalenceAttestation(journal,equivalence,boundary) {
  const attestation=equivalence?.attestation;
  const fields=['schemaVersion','token','source','authorityGeneration','reviewerSession','journalVersion','journalSequence','journalEventDigest',
    'planningRevision','candidateRevision','integrationRevision','reviewRevision','eventSequence','eventDigest','mappingDigest'];
  const entry=eventAt(journal,attestation?.eventSequence),event=entry?.event;
  return exact(attestation,fields)&&attestation.schemaVersion==='asds.equivalence-attestation/1'&&hash(attestation.token)&&
    nonempty(attestation.source)&&!['caller','claim','host'].includes(attestation.source.trim().toLowerCase())&&
    Number.isInteger(attestation.authorityGeneration)&&attestation.authorityGeneration>0&&attestation.reviewerSession===equivalence.reviewer&&
    attestation.journalVersion===3&&attestation.journalSequence===boundary.journalSequence&&attestation.journalEventDigest===boundary.journalEventDigest&&
    attestation.planningRevision===boundary.planningRevision&&attestation.candidateRevision===boundary.candidateRevision&&
    attestation.integrationRevision===boundary.integrationRevision&&attestation.reviewRevision===boundary.reviewRevision&&
    entry?.digest===attestation.eventDigest&&['review','reviewResult'].includes(event?.type)&&event.session===attestation.reviewerSession&&
    event.revision===attestation.reviewRevision&&attestation.mappingDigest===digest(equivalence.mappings);
}

export function compareProjectionContract(projected,canonical) {
  const left=material(projected),right=material(canonical);
  const fields=[...new Set([...Object.keys(left),...Object.keys(right)])].sort();
  return {projectedDigest:digest(left),canonicalDigest:digest(right),differences:fields.filter(field=>digest(left[field]??null)!==digest(right[field]??null))};
}

/**
 * Translate an accepted projection receipt to the current canonical task identity.
 * This never makes validateDelivery accept either identity: the projection receipt
 * is validated first, material execution fields must match, and provenance records
 * both immutable identities.
 */
export function reconcileProjectionReceipt({ journal, projectionTasks, canonicalTasks, taskId, equivalence = null, context = {} }) {
  context=context??{};
  const state = replay(journal);
  if (state.journalVersion !== 3) fail('canonical receipt provenance requires journal v3');
  assertCurrentPlan(journal, projectionTasks);
  if (state.context.executionScope.excludedTaskIds.includes(taskId)) fail(`${taskId}: excluded task cannot receive an accepted receipt`);
  const execution = state.tasks[taskId];
  if (!execution || execution.status !== 'accepted') throw new Error('projection task must be accepted before receipt reconciliation');
  const projected = projectionTasks.find(task => task.id === taskId);
  const canonical = canonicalTasks.find(task => task.id === taskId);
  if (!projected || !canonical) throw new Error('task must exist in projection and canonical contracts');
  const canonicalErrors=validateTasks(canonicalTasks,{legacyExecution:true});
  if (canonicalErrors.length) throw new Error(`invalid canonical task graph: ${canonicalErrors.join('; ')}`);
  const errors = validateDelivery(projected, execution.receipt, { requireObservedExecution: state.journalVersion >= 2 });
  if (errors.length) throw new Error(errors.join('; '));
  const comparison=compareProjectionContract(projected,canonical);
  const contextMissing=!Object.keys(context).length;
  if (comparison.differences.length) {
    const forbidden=comparison.differences.filter(field=>!reconcilableMetadata.has(field));
    if (forbidden.length) throw new Error(`projection changes irreconcilable execution fields: ${forbidden.join(', ')}`);
    if(contextMissing)return pendingProvenance(taskId);
    const equivalenceFields=['schemaVersion','verdict','independent','reviewer','source','evidence','limitations','mappings','projectionContractRevision','canonicalContractRevision','projectedDigest','canonicalDigest','differences','attestation'];
    const mappings=equivalence?.mappings;
    const mapped=Array.isArray(mappings) && mappings.length===comparison.differences.length &&
      new Set(mappings.map(item=>item?.field)).size===mappings.length && mappings.every(item=>
        exact(item,['field','rationale','evidence']) && comparison.differences.includes(item.field) && nonempty(item.rationale) && strings(item.evidence) && item.evidence.length);
    const valid=exact(equivalence,equivalenceFields) && equivalence.schemaVersion==='asds.contract-equivalence/1' && equivalence.verdict==='pass' &&
      equivalence.independent===true && nonempty(equivalence.reviewer) && nonempty(equivalence.source) &&
      !['caller','claim'].includes(equivalence.source.trim().toLowerCase()) && equivalence.reviewer!==projected.owner && equivalence.reviewer!==canonical.owner &&
      strings(equivalence.evidence) && equivalence.evidence.length && strings(equivalence.limitations) && mapped &&
      equivalence.projectionContractRevision===projected.contractRevision && equivalence.canonicalContractRevision===canonical.contractRevision &&
      equivalence.projectedDigest===comparison.projectedDigest && equivalence.canonicalDigest===comparison.canonicalDigest &&
      digest(equivalence.differences)===digest(comparison.differences)&&validateEquivalenceAttestation(journal,equivalence,{
        journalSequence:state.sequence,journalEventDigest:journal.events.at(-1)?.digest??journal.digest,planningRevision:state.plan.revision,
        candidateRevision:execution.receipt.revision,integrationRevision:execution.receipt.integrationRevision,reviewRevision:execution.receipt.integrationRevision,
      });
    if (!valid) throw new Error(`projection and canonical contracts differ; current journal-bound attested independent equivalence review required for: ${comparison.differences.join(', ')}`);
  }
  if(contextMissing)return pendingProvenance(taskId);
  const receipt = clone(execution.receipt);
  const runtimeRevision=digest(execution), runtimeReceiptDigest=digest(execution.receipt);
  const lastEventDigest=journal.events.at(-1)?.digest ?? journal.digest;
  if (!hash(context.workspaceBaselineFingerprint) || !hash(context.progressRevision) || !object(context.baselineLedger) ||
      !object(context.baselineObservation)||!object(context.hostAttestation)) fail('canonical receipt context requires baseline, host and progress provenance');
  if (context.planningRevision !== undefined && context.planningRevision !== state.plan.revision) fail('canonical receipt planning revision mismatch');
  if (context.projectionRevision !== undefined && context.projectionRevision !== projected.contractRevision) fail('canonical receipt projection revision mismatch');
  if (context.runtimeRevision !== undefined && context.runtimeRevision !== runtimeRevision) fail('canonical receipt runtime revision mismatch');
  if (context.journalSequence !== undefined && context.journalSequence !== state.sequence) fail('canonical receipt journal sequence mismatch');
  if (context.journalEventDigest !== undefined && context.journalEventDigest !== lastEventDigest) fail('canonical receipt journal event digest mismatch');
  if (context.runtimeReceiptDigest !== undefined && context.runtimeReceiptDigest !== runtimeReceiptDigest) fail('canonical receipt runtime receipt digest mismatch');
  assertDeliveryHostBoundary(journal,context.hostAttestation);
  const bindingContext={journalSequence:state.sequence,journalEventDigest:lastEventDigest,planningRevision:state.plan.revision,candidateRevision:receipt.revision,
    integrationRevision:receipt.integrationRevision,reviewRevision:receipt.integrationRevision};
  const authorityRequests=[authorityBinding('delivery-attestation',context.hostAttestation,bindingContext),authorityBinding('baseline-observation',context.baselineObservation,bindingContext)];
  if(comparison.differences.length)authorityRequests.push(authorityBinding('equivalence-attestation',equivalence.attestation,bindingContext));
  const authorityConsumptions=prepareAuthorities(context.hostAuthority,authorityRequests);
  receipt.schemaVersion = 'asds.canonical-receipt/1';
  receipt.contractRevision = canonical.contractRevision;
  receipt.hostAttestation=clone(context.hostAttestation);
  receipt.baselineObservation=clone(context.baselineObservation);
  receipt.authorityConsumptions=authorityConsumptions;
  receipt.reconciliation = {
    schemaVersion: 'asds.receipt-reconciliation/1',
    taskId,
    projectionContractRevision: projected.contractRevision,
    canonicalContractRevision: canonical.contractRevision,
    projectedContractDigest: comparison.projectedDigest,
    canonicalContractDigest: comparison.canonicalDigest,
    differences: comparison.differences,
    equivalence: comparison.differences.length ? clone(equivalence) : null,
    planRevision: state.plan.revision,
    journalSequence: state.sequence,
    journalEventDigest: journal.events.at(-1)?.digest ?? journal.digest,
  };
  receipt.provenance = {
    schemaVersion:'asds.receipt-provenance/1',taskId,
    projectionRevision:projected.contractRevision,canonicalRevision:canonical.contractRevision,
    planningRevision:state.plan.revision,runtimeRevision,candidateRevision:receipt.revision,
    integrationRevision:receipt.integrationRevision,reviewRevision:receipt.integrationRevision,
    progressRevision:context.progressRevision,journalVersion:3,journalSequence:state.sequence,
    journalEventDigest:lastEventDigest,runtimeReceiptDigest,baselineLedger:clone(context.baselineLedger),
  };
  const deliveryErrors = validateCanonicalReceipt(canonical, receipt, {
    workspaceBaselineFingerprint:context.workspaceBaselineFingerprint,projectionRevision:projected.contractRevision,
    planningRevision:state.plan.revision,runtimeRevision,progressRevision:context.progressRevision,
    journalSequence:state.sequence,journalEventDigest:lastEventDigest,runtimeReceiptDigest,
    hostAttestation:context.hostAttestation,baselineObservation:context.baselineObservation,
  });
  if (deliveryErrors.length) throw new Error(deliveryErrors.join('; '));
  consumeAuthorities(context.hostAuthority,authorityRequests);
  return receipt;
}

function validateProgressRequest(request, taskId, receipt) {
  const fields=['type','taskId','planningRevision','contractRevision','integrationRevision','receiptDigest','indexBeforeHash','expectedChange'];
  if (!exact(request,fields) || request.type!=='progressRequested' || request.taskId!==taskId ||
      request.planningRevision!==receipt.provenance.planningRevision || request.contractRevision!==receipt.provenance.canonicalRevision ||
      request.integrationRevision!==receipt.provenance.integrationRevision || request.receiptDigest!==receipt.provenance.runtimeReceiptDigest ||
      request.indexBeforeHash!==receipt.provenance.progressRevision || !hash(request.indexBeforeHash) ||
      !exact(request.expectedChange,['from','to']) || request.expectedChange.from!=='[ ]' || request.expectedChange.to!=='[x]') {
    fail('progressRequested does not match current canonical receipt provenance');
  }
}

function validateIndexReadback(readback, request) {
  const common=['schemaVersion','token','source','authorityGeneration','journalVersion','journalSequence','journalEventDigest','planningRevision','candidateRevision','integrationRevision','reviewRevision','brokerEventDigest','status','indexBeforeHash'];
  const fields=readback?.status==='closed'?[...common,'indexAfterHash']:common;
  if (!exact(readback,fields) || readback.schemaVersion!=='asds.index-readback/1'||!hash(readback.token)||!hash(readback.brokerEventDigest)||
      !Number.isInteger(readback.authorityGeneration)||readback.authorityGeneration<1||readback.journalVersion!==3||
      !Number.isInteger(readback.journalSequence)||readback.journalSequence<0||!hash(readback.journalEventDigest)||
      ![readback.planningRevision,readback.candidateRevision,readback.integrationRevision,readback.reviewRevision].every(nonempty)||
      !['open','closed'].includes(readback.status) || readback.indexBeforeHash!==request.indexBeforeHash ||
      readback.source!=='progress-broker-host'||
      (readback.status==='closed' && (!hash(readback.indexAfterHash) || readback.indexAfterHash===readback.indexBeforeHash))) {
    fail('invalid checkbox index readback provenance');
  }
}

const authorityConsumptionFields=['schemaVersion','kind','handle','token','source','authorityGeneration','binding'];
function validateAuthorityConsumption(consumption,expectedBinding) {
  if(!exact(consumption,authorityConsumptionFields)||consumption.schemaVersion!=='asds.host-authority-consumption/1'||consumption.kind!==expectedBinding.kind||
      consumption.token!==expectedBinding.token||consumption.source!==expectedBinding.source||consumption.authorityGeneration!==expectedBinding.authorityGeneration||
      digest(consumption.binding)!==digest(expectedBinding)||consumption.handle!==digest({generation:consumption.authorityGeneration,token:consumption.token,binding:consumption.binding}))
    fail('invalid or forged progress authority consumption receipt');
}

const journalEntries = (journal,type,taskId) => journal.events.filter(entry=>entry.event.type===type&&entry.event.taskId===taskId);
function validatePersistedProgressAuthority(journal,entry,request,receipt,expectedStatus) {
  const event=entry?.event,baseFields=event?.type==='progressRequested'
    ? ['type','taskId','planningRevision','contractRevision','integrationRevision','receiptDigest','indexBeforeHash','expectedChange']
    : ['type','taskId','receiptDigest','indexBeforeHash','indexAfterHash'];
  if(!exact(event,[...baseFields,'indexReadback','authorityConsumption']))fail(`${event?.type??'progress'} lacks persisted authority receipt`);
  validateIndexReadback(event.indexReadback,request);
  const beforeSequence=entry.sequence-1,beforeDigest=beforeSequence===0?journal.digest:journal.events[beforeSequence-1]?.digest;
  if(event.indexReadback.status!==expectedStatus||event.indexReadback.journalSequence!==beforeSequence||event.indexReadback.journalEventDigest!==beforeDigest||
      event.indexReadback.planningRevision!==receipt.provenance.planningRevision||event.indexReadback.candidateRevision!==receipt.provenance.candidateRevision||
      event.indexReadback.integrationRevision!==receipt.provenance.integrationRevision||event.indexReadback.reviewRevision!==receipt.provenance.reviewRevision)
    fail(`${event.type} persisted authority has stale readback binding`);
  if(expectedStatus==='closed'&&event.indexReadback.indexAfterHash!==event.indexAfterHash)fail('progressCommitted persisted readback hash mismatch');
  validateAuthorityConsumption(event.authorityConsumption,authorityBinding('progress-readback',event.indexReadback,event.indexReadback));
}

function assertReceiptJournalBinding(journal,taskId,receipt) {
  const provenance=receipt.provenance, sequence=provenance.journalSequence;
  if(sequence>journal.events.length) fail('canonical receipt journal sequence is stale or unavailable');
  const eventDigest=sequence===0?journal.digest:journal.events[sequence-1]?.digest;
  if(eventDigest!==provenance.journalEventDigest) fail('canonical receipt journal event digest mismatch');
  const boundary=replay({...clone(journal),events:clone(journal.events.slice(0,sequence))}),execution=boundary.tasks[taskId];
  if(!execution||execution.status!=='accepted'||digest(execution)!==provenance.runtimeRevision||
      digest(execution.receipt)!==provenance.runtimeReceiptDigest) fail('canonical receipt runtime revision is not bound to its accepted journal boundary');
}

export function reconcileReceiptProgress({journal,canonicalTasks,canonicalReceipt,taskId,progressRequested,progressCommitted,indexReadback,hostAuthority}) {
  const state=replay(journal);
  if(state.journalVersion!==3) fail('receipt/progress reconciliation requires journal v3');
  if(state.context.executionScope.excludedTaskIds.includes(taskId)) fail(`${taskId}: excluded task cannot receive receipt or progress`);
  const canonical=canonicalTasks.find(task=>task.id===taskId),runtime=state.tasks[taskId];
  if(!canonical||!runtime) fail('task must exist in canonical and runtime contracts');
  const receiptErrors=validateCanonicalReceipt(canonical,canonicalReceipt,{
    workspaceBaselineFingerprint:canonicalReceipt?.provenance?.baselineLedger?.workspaceBaselineFingerprint,
    projectionRevision:state.plan.tasks.find(task=>task.id===taskId)?.contractRevision,
    planningRevision:state.plan.revision,runtimeRevision:canonicalReceipt?.provenance?.runtimeRevision,
    progressRevision:canonicalReceipt?.provenance?.progressRevision,journalSequence:canonicalReceipt?.provenance?.journalSequence,
    journalEventDigest:canonicalReceipt?.provenance?.journalEventDigest,runtimeReceiptDigest:digest(runtime.receipt),
    hostAttestation:canonicalReceipt?.hostAttestation,baselineObservation:canonicalReceipt?.baselineObservation,
  });
  if(receiptErrors.length) fail(receiptErrors.join('; '));
  assertReceiptJournalBinding(journal,taskId,canonicalReceipt);
  validateProgressRequest(progressRequested,taskId,canonicalReceipt);
  validateIndexReadback(indexReadback,progressRequested);
  const currentEventDigest=journal.events.at(-1)?.digest??journal.digest;
  if(indexReadback.journalSequence!==state.sequence||indexReadback.journalEventDigest!==currentEventDigest||
      indexReadback.planningRevision!==canonicalReceipt.provenance.planningRevision||indexReadback.candidateRevision!==canonicalReceipt.provenance.candidateRevision||
      indexReadback.integrationRevision!==canonicalReceipt.provenance.integrationRevision||indexReadback.reviewRevision!==canonicalReceipt.provenance.reviewRevision)
    fail('progress broker readback has stale revision or journal binding');
  const readbackBinding=authorityBinding('progress-readback',indexReadback,{journalSequence:state.sequence,journalEventDigest:journal.events.at(-1)?.digest??journal.digest,
    planningRevision:canonicalReceipt.provenance.planningRevision,candidateRevision:canonicalReceipt.provenance.candidateRevision,
    integrationRevision:canonicalReceipt.provenance.integrationRevision,reviewRevision:canonicalReceipt.provenance.reviewRevision});
  const requestedEntries=journalEntries(journal,'progressRequested',taskId), committedEntries=journalEntries(journal,'progressCommitted',taskId);
  if(requestedEntries.length>1||committedEntries.length>1) fail('ambiguous duplicate receipt/progress events');
  const storedRequestEntry=requestedEntries[0],storedCommitEntry=committedEntries[0],storedRequest=storedRequestEntry?.event,storedCommit=storedCommitEntry?.event;
  let result,event;
  if(!storedRequest) {
    if(storedCommit||progressCommitted) fail('progressCommitted cannot exist before progressRequested');
    if(indexReadback.status!=='open') fail('closed checkbox cannot certify a receipt without progressRequested');
    if(runtime.status!=='accepted') fail('receipt is not at the accepted progress boundary');
    event={...progressRequested,contractRevision:canonicalReceipt.provenance.projectionRevision};
    result={status:'ready_to_request',receiptDigest:progressRequested.receiptDigest};
  } else {
    const projectedRequest={...progressRequested,contractRevision:canonicalReceipt.provenance.projectionRevision};
    const storedRequestBase=Object.fromEntries(Object.keys(projectedRequest).map(key=>[key,storedRequest[key]]));
    if(digest(storedRequestBase)!==digest(projectedRequest)) fail('stored progressRequested differs from current receipt provenance');
    validatePersistedProgressAuthority(journal,storedRequestEntry,projectedRequest,canonicalReceipt,'open');
    if(storedCommit) {
      if(!progressCommitted||digest(progressCommitted)!==digest(storedCommit))fail('progressCommitted does not match current receipt pair');
      validatePersistedProgressAuthority(journal,storedCommitEntry,projectedRequest,canonicalReceipt,'closed');
      if(indexReadback.status!=='closed'||indexReadback.indexAfterHash!==storedCommit.indexAfterHash||runtime.status!=='completed') fail('checkbox readback differs from committed progress pair');
      result={status:'committed',receiptDigest:storedCommit.receiptDigest,indexAfterHash:storedCommit.indexAfterHash};
    } else {
      if(progressCommitted) fail('unrecorded progressCommitted cannot certify checkbox state');
      if(runtime.status!=='progress_pending') fail('progressRequested is not the current runtime boundary');
      if(indexReadback.status==='open')result={status:'ready_to_commit',receiptDigest:storedRequest.receiptDigest};
      else {
        event={type:'progressCommitted',taskId,receiptDigest:storedRequest.receiptDigest,indexBeforeHash:storedRequest.indexBeforeHash,indexAfterHash:indexReadback.indexAfterHash};
        result={status:'recover_commit',receiptDigest:storedRequest.receiptDigest,indexAfterHash:indexReadback.indexAfterHash};
      }
    }
  }
  const [readbackAuthority]=prepareAuthorities(hostAuthority,[readbackBinding]);
  if(event){
    result.authorityConsumption=readbackAuthority;
    result.event={...event,indexReadback:clone(indexReadback),authorityConsumption:clone(readbackAuthority)};
    consumeAuthorities(hostAuthority,[readbackBinding]);
  } else {
    // Pure readback inspection does not burn a token or create an unpersisted
    // consumption receipt. The returned receipt is the already persisted proof.
    result.authorityConsumption=clone((storedCommit??storedRequest).authorityConsumption);
  }
  return result;
}
