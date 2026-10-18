import { digest, compilePlan, createJournal, createSuccessorJournal, replay, continuation, packetFor, appendEvent, assertCurrentPlan, objectiveSnapshot } from './orchestration.mjs';
import { validateExecutionHandoff, scopeDeliveredDecisionProjection } from './execution-handoff.mjs';
import { projectTaskManager } from './planning-graph.mjs';
import { projectRuntimeProjection, scopePlanningProjection } from './plan-projection.mjs';
import { reconcileProjectionReceipt, reconcileReceiptProgress } from './receipt-reconciliation.mjs';
import { commitTaskIndexProgress, inspectTaskIndexProgress } from './task-index-progress.mjs';
import { buildDagStatusView, renderDagTopology, formatDagStatusMarkdown } from './dag-status-view.mjs';
import { loadTasks, validateReviewedPlanningReadiness } from './validation.mjs';
import { readReviewEvidence, reviewDigest } from './harness-planning-review.mjs';

const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const required = (condition, message) => { if (!condition) throw new Error(message); };
const CANCELLED_SOURCE='asds.execution-consumer.cancelled';
const RESERVED_FACADE_EVENTS=new Set(['progressRequested','progressCommitted','verifyObjective']);
const WORKSPACE_BINDING_FIELDS=new Set([
  'packageRootRealpath','projectRootRealpath','workspaceId','repoIdentity','planningFingerprint',
  'workspaceBaselineFingerprint','currentFingerprint','writeScope','toolCalls','source',
]);
const REPO_IDENTITY_FIELDS=new Set(['vcs','rootRealpath','commonDirRealpath','baseRevision','headRevision']);
const TOOL_CALL_FIELDS=new Set(['id','operation','actor','session','role','source']);

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function exactFields(value,fields,label) {
  required(object(value),`${label} must be an object`);
  const keys=Object.keys(value);
  required(keys.length===fields.size&&keys.every(key=>fields.has(key)),`${label} has unknown or missing fields`);
}
function canonicalPath(value) {
  return nonempty(value)&&!value.includes('\\')&&!value.startsWith('/')&&!value.endsWith('/')&&!value.includes('\0')&&
    value.split('/').every(segment=>segment!==''&&segment!=='.'&&segment!=='..');
}
function canonicalWriteScope(plan,handoff) {
  const allowed=new Set(handoff.executionScope.consumableTaskIds);
  return [...new Set(plan.tasks.filter(task=>allowed.has(task.id)).flatMap(task=>task.write))].sort();
}

function immutableExecutionIntake(handoff, plan) {
  const planningReturn=handoff.planningReturn ?? {};
  const coverageRequirements=Array.isArray(planningReturn.coverage?.requirements)
    ? planningReturn.coverage.requirements : [];
  return {
    schemaVersion:'asds.execution-intake-snapshot/1',
    requestContext:clone(handoff.requestContext),
    originalRequestedProduct:clone(planningReturn.originalRequestedProduct),
    planningAuthority:clone(planningReturn.planningAuthority ?? {}),
    authorityReferences:{
      author:clone(handoff.author),selection:clone(handoff.selection),grants:clone(handoff.grants),
      authorization:clone(handoff.authorization),destination:clone(handoff.destination),
      coordinatorBoundary:clone(handoff.coordinatorBoundary),
    },
    requirements:clone(coverageRequirements),
    negativeAndPreservationRules:clone(coverageRequirements.filter(item=>['negative','preservation'].includes(item?.kind))),
    taskRequirements:plan.tasks.map(task=>({taskId:task.id,requirements:clone(task.requirements ?? []),
      exclusions:clone(task.boundary?.exclusions ?? [])})),
    decisions:clone(planningReturn.coverage?.decisions ?? []),
    blockers:clone(planningReturn.blockers ?? []),limitations:clone(planningReturn.limitations ?? []),
    remainingWork:clone(planningReturn.remainingWork ?? []),
  };
}

function executionCanonicalReferences(handoff,plan) {
  const packageReferences=clone(handoff.planningReturn?.references ?? []);
  return {
    requestId:handoff.requestContext.requestId,requestSource:handoff.requestContext.source,
    project:clone(handoff.requestContext.project),destination:clone(handoff.destination),
    package:{rootRealpath:handoff.packageRootRealpath,id:handoff.packageId,planningRevision:handoff.planningRevision,
      planningFingerprint:handoff.planningFingerprint,...(handoff.planningManifest===undefined?{}:{manifest:clone(handoff.planningManifest)}),
      ...(handoff.canonicalIndex===undefined?{}:{index:clone(handoff.canonicalIndex)}),references:packageReferences},
    current:{projectRootRealpath:handoff.projectRootRealpath,workspaceId:handoff.workspaceId,repoIdentity:clone(handoff.repoIdentity),workspaceBaselineFingerprint:handoff.workspaceBaselineFingerprint},
    authority:{...(handoff.requestContext.binding===undefined?{}:{requestBinding:clone(handoff.requestContext.binding)}),
      ...(handoff.selection?.binding===undefined?{}:{selectionBinding:clone(handoff.selection.binding)}),
      ...(handoff.grants?.find(grant=>grant.kind==='execution')?.scope?.binding===undefined?{}:{executionGrantBinding:clone(handoff.grants.find(grant=>grant.kind==='execution').scope.binding)}),
      authorizationDigest:handoff.authorization===undefined?null:digest(handoff.authorization)},
    tasks:plan.tasks.map(task=>({taskId:task.id,contractRevision:task.contractRevision,
      requirements:clone(task.requirements ?? []),references:clone(task.orchestration?.references ?? [])})),
    source:{handoffDigest:digest(handoff),planRevision:plan.revision},
  };
}

export function validateExecutionWorkspaceBinding(handoff,plan,workspaceBinding) {
  // This pure boundary validates a host adapter's explicit claim; only the harness
  // can authenticate that the observation and its `source` are actually host-owned.
  exactFields(workspaceBinding,WORKSPACE_BINDING_FIELDS,'host-owned workspace binding');
  required(nonempty(workspaceBinding.currentFingerprint),'host-owned workspace binding currentFingerprint must be a nonempty string');
  required(nonempty(workspaceBinding.source)&&workspaceBinding.source!=='caller','host-owned workspace binding source must identify the host observer');
  required(Array.isArray(workspaceBinding.writeScope)&&workspaceBinding.writeScope.every(canonicalPath)&&new Set(workspaceBinding.writeScope).size===workspaceBinding.writeScope.length,
    'host-owned workspace binding writeScope requires unique canonical relative POSIX paths');
  const expectedWriteScope=canonicalWriteScope(plan,handoff);
  required(digest(workspaceBinding.writeScope)===digest(expectedWriteScope),'host-owned workspace binding writeScope differs from the canonical consumable task scope');
  required(Array.isArray(workspaceBinding.toolCalls),'host-owned workspace binding toolCalls must be an array');
  for(const toolCall of workspaceBinding.toolCalls) {
    exactFields(toolCall,TOOL_CALL_FIELDS,'host-owned workspace tool call');
    required([...TOOL_CALL_FIELDS].every(key=>nonempty(toolCall[key]))&&toolCall.source!=='caller','host-owned workspace tool call requires exact non-caller identity fields');
  }
  required(object(workspaceBinding.repoIdentity),'host-owned workspace binding repoIdentity must be an object');
  const repoKeys=Object.keys(workspaceBinding.repoIdentity);
  required(repoKeys.every(key=>REPO_IDENTITY_FIELDS.has(key))&&['vcs','rootRealpath','baseRevision'].every(key=>repoKeys.includes(key)),
    'host-owned workspace binding repoIdentity has unknown or missing fields');
  for(const key of ['packageRootRealpath','projectRootRealpath','workspaceId','planningFingerprint','workspaceBaselineFingerprint'])
    required(digest(workspaceBinding[key])===digest(handoff[key]),`host-owned workspace binding ${key} differs from the validated current handoff`);
  required(digest(workspaceBinding.repoIdentity)===digest(handoff.repoIdentity),'host-owned workspace binding repoIdentity differs from the validated current handoff');
  return clone(workspaceBinding);
}

function boundaryDisposition(handoff) {
  const boundary = handoff?.coordinatorBoundary;
  if (boundary?.enforced !== true || boundary?.projectReadOnly !== true ||
      digest([...(boundary?.brokers ?? [])].sort()) !== digest(['evidence', 'journal', 'progress'])) {
    return { status: 'manual_handoff_required', disposition: 'manual_handoff_required', reason: 'host-owned read-only coordinator boundary and exact journal/evidence/progress brokers are required' };
  }
  return null;
}

function validateCurrent(handoff, current) {
  required(object(handoff), 'execution handoff is required');
  required(object(current), 'current package/workspace observation is required');
  const validation = validateExecutionHandoff(handoff, current);
  required(validation.valid, validation.errors.join('; '));
}

function sourcePlan(source, profile) {
  required(Array.isArray(source) && source.length > 0, 'current source tasks are required');
  return compilePlan(source, profile, { allowUnready: true });
}

// Called only after current handoff and source projection validation. Keep this
// adaptation private: detached compilation must not acquire package approval.
function reviewedExecutionSource(handoff, source) {
  if (!handoff.planningReturn?.references?.some(ref=>ref.id==='review:fidelity')) return source;
  const root=handoff.packageRootRealpath;
  const bytes=readReviewEvidence(root,'planning-manifest.json');
  required(reviewDigest(bytes)===handoff.planningManifest?.sha256,'reviewed source manifest differs from the bound handoff');
  const persisted=loadTasks(root);
  required(digest(source)===digest(persisted),'current source contracts differ from reviewed persisted bytes');
  const errors=validateReviewedPlanningReadiness(root,JSON.parse(bytes),persisted);
  required(!errors.length,`reviewed source readiness: ${errors.join('; ')}`);
  const usable=new Set(handoff.executionScope.consumableTaskIds);
  return source.map(task=>{
    if (!usable.has(task.id) || task.boundary?.review?.verdict!=='pending') return task;
    // Runtime-only view; id, body and byte-bound contractRevision remain exact.
    return {...task,boundary:{...task.boundary,review:{...task.boundary.review,
      verdict:'ready',source:`verified package F/Q: ${handoff.planningFingerprint}`}}};
  });
}

export function validateExecutionSource(handoff, source) {
  required(handoff?.taskManager?.version === 'asds.task-manager-projection/1', 'handoff task-manager projection is required');
  required(Array.isArray(source) && source.length > 0, 'current source tasks are required');
  const full=projectTaskManager(source,{blockers:handoff.planningReturn?.blockers ?? []});
  const canonical=handoff.executionScope?.excludedTaskIds?.length
    ? (handoff.planningReturn?.state==='delivered'
      ? scopeDeliveredDecisionProjection(full,handoff.planningReturn?.blockers??[])
      : scopePlanningProjection(full,handoff.executionScope,handoff.partialScope?.provenance ?? {})) : full;
  const canonicalDigest=digest(canonical), handoffDigest=digest(handoff.taskManager);
  required(canonicalDigest===handoffDigest,'current source canonical task-manager projection differs from the execution handoff');
  return {digest:canonicalDigest,projection:canonical};
}

export function deriveExecutionConsumerContext(handoff, plan, context = {}, workspaceBinding = null) {
  required(object(context),'execution consumer context must be an object');
  const allowed=new Set(['runId','references']);
  for(const key of Object.keys(context)) required(allowed.has(key),`unknown or protected execution consumer context field: ${key}`);
  if(Object.hasOwn(context,'runId')) required(typeof context.runId==='string'&&context.runId.trim(),'context.runId must be a nonempty string');
  if(Object.hasOwn(context,'references')) required(Array.isArray(context.references)&&context.references.every(item=>typeof item==='string'&&item.trim())&&new Set(context.references).size===context.references.length,'context.references must contain unique nonempty strings');
  const boundWorkspace=validateExecutionWorkspaceBinding(handoff,plan,workspaceBinding);
  const coordinator = handoff.author.actor;
  const immutableIntake=immutableExecutionIntake(handoff,plan);
  const canonicalReferences=executionCanonicalReferences(handoff,plan);
  return {
    ...clone(context),coordinator,
    authorization:{source:handoff.grants.find(grant=>grant.kind==='execution').source,scope:handoff.projectRootRealpath},
    readScope:clone(handoff.requestContext.project.readScope),
    executionScope: clone(handoff.executionScope),
    immutableIntake,intakeDigest:digest(immutableIntake),canonicalReferences,
    consumerBinding: {
      schemaVersion: 'asds.execution-consumer-binding/1', handoffDigest: digest(handoff),
      planningFingerprint: handoff.planningFingerprint, workspaceId: handoff.workspaceId,
      workspaceBaselineFingerprint: handoff.workspaceBaselineFingerprint, planRevision: plan.revision,
      workspaceBindingDigest:digest(boundWorkspace),
    },
    workspaceBinding:boundWorkspace,
  };
}

function assertBound({ journal, handoff, current, source }) {
  validateCurrent(handoff, current);
  validateExecutionSource(handoff,source);
  const state = replay(journal), binding = state.context.consumerBinding;
  required(state.journalVersion === 3, 'official execution consumer mutations require journal v3 or an explicit successor journal');
  required(binding?.schemaVersion === 'asds.execution-consumer-binding/1', 'journal lacks execution consumer source/current binding');
  required(binding.handoffDigest === digest(handoff) && binding.planningFingerprint === handoff.planningFingerprint &&
    binding.workspaceId === handoff.workspaceId && binding.workspaceBaselineFingerprint === handoff.workspaceBaselineFingerprint,
  'stale handoff, source or workspace binding');
  assertCurrentPlan(journal, reviewedExecutionSource(handoff,source));
  required(binding.planRevision === state.plan.revision, 'stale source plan binding');
  validateExecutionConsumerContextBinding(handoff,journal);
  return state;
}

export function validateExecutionConsumerContextBinding(handoff,journal) {
  const state=replay(journal),supplemental={};
  for(const key of ['runId','references'])if(Object.hasOwn(state.context,key))supplemental[key]=clone(state.context[key]);
  const expected=deriveExecutionConsumerContext(handoff,state.plan,supplemental,state.context.workspaceBinding);
  for(const key of ['authorization','readScope','executionScope','coordinator','immutableIntake','intakeDigest','canonicalReferences','consumerBinding','workspaceBinding'])
    required(digest(state.context[key])===digest(expected[key]),`stale execution consumer context binding: ${key}`);
  validateExecutionConsumerTerminalIntegrity(journal);
  return expected;
}

export function validateExecutionConsumerTerminalIntegrity(journal) {
  replay(journal);
  const markers=journal.events.map((entry,index)=>({entry,index})).filter(({entry})=>entry.event?.type==='pause'&&entry.event.source===CANCELLED_SOURCE);
  required(markers.length<=1,'ambiguous execution consumer terminal cancellation markers');
  if(markers.length) {
    const event=markers[0].entry.event;
    required(Object.keys(event).length===3&&['type','source','reason'].every(key=>Object.hasOwn(event,key))&&typeof event.reason==='string'&&event.reason.trim(),'forged execution consumer terminal cancellation marker');
    required(markers[0].index===journal.events.length-1,'execution consumer terminal cancellation must be the final journal event');
  }
  return true;
}

function classify(journal, capabilities = null) {
  const state = replay(journal);
  if (state.objectiveVerification) return { disposition:'await_host_reobservation', status:'await_host_reobservation', objectiveVerification:clone(state.objectiveVerification) };
  if (state.paused?.source===CANCELLED_SOURCE) return { disposition:'cancelled', status:'cancelled', cancellation:clone(state.paused) };
  if (state.paused) return { disposition:'paused', status:'paused', pause:clone(state.paused) };
  if (capabilities) {
    const next = continuation(journal, capabilities);
    const disposition = next.disposition === 'objective_blocked' ? 'blocked' : next.disposition;
    return { ...next, disposition, status:disposition };
  }
  return { disposition:'blocked', status:'blocked' };
}

export function initExecutionConsumer({ handoff, current, source, profile, context = {}, workspaceBinding, predecessor = null, reconciliation = [] }) {
  validateCurrent(handoff, current);
  const manual = boundaryDisposition(handoff); if (manual) return manual;
  validateExecutionSource(handoff,source);
  const plan = sourcePlan(reviewedExecutionSource(handoff,source), profile);
  const boundContext = deriveExecutionConsumerContext(handoff, plan, context, workspaceBinding);
  const journal = predecessor ? createSuccessorJournal(predecessor, boundContext, { reconciliation }) : createJournal(plan, boundContext, { version:3 });
  required(replay(journal).plan.revision === plan.revision, 'predecessor plan differs from the current bound source; explicit replanning is required');
  return { status:'initialized', disposition:'blocked', journal, state:replay(journal) };
}

export function nextExecutionConsumer({ journal, handoff, current, source, capabilities }) {
  assertBound({ journal, handoff, current, source });
  return classify(journal, capabilities);
}

export function packetExecutionConsumer({ journal, handoff, current, source, taskId }) {
  const state=assertBound({ journal, handoff, current, source }),packet=packetFor(journal, taskId);
  return {...packet,canonicalReferences:clone(state.context.canonicalReferences)};
}

const manualMutation=(journal,reasonCode,reason)=>({journal,state:replay(journal),status:'manual_handoff_required',disposition:'manual_handoff_required',reasonCode,reason});
const terminalMutationBoundary=journal=>replay(journal).paused?.source===CANCELLED_SOURCE
  ? manualMutation(journal,'terminal_cancelled','the execution consumer run is terminally cancelled; no later mutation or authority consumption is allowed') : null;
export function executionMutationBoundary({journal,event}) {
  const terminal=terminalMutationBoundary(journal);if(terminal)return terminal;
  if(RESERVED_FACADE_EVENTS.has(event?.type)) return manualMutation(journal,'reserved_event',`${event.type} is reserved for its validated execution consumer command`);
  if(['replan','decompose','refine'].includes(event?.type)) return manualMutation(journal,'rebind_required','plan-changing events require a new validated handoff and explicit successor/rebind; the current journal was not changed');
  if(event?.type==='cancelled') return manualMutation(journal,'terminal_cancel_unsupported','use the official cancel event; a caller-supplied cancelled outcome is not accepted');
  if(event?.type==='resume') {
    const allowed=new Set(['type','reason','authorization']);
    if(!object(event)||Object.keys(event).some(key=>!allowed.has(key))) return manualMutation(journal,'rebind_required','resume cannot replace context, source, current state or consumer bindings');
    const authority=replay(journal).context.authorization;
    if(event.authorization!==undefined&&digest(event.authorization)!==digest(authority)) return manualMutation(journal,'rebind_required','resume authorization differs from the handoff-derived journal authority');
  }
  return null;
}

export function normalizeExecutionEvent(journal,event) {
  required(object(event),'execution event must be an object');
  if(event.type==='cancel') {
    required(Object.keys(event).every(key=>['type','reason'].includes(key))&&typeof event.reason==='string'&&event.reason.trim(),'cancel requires exactly a nonempty reason');
    return {type:'pause',source:CANCELLED_SOURCE,reason:event.reason};
  }
  if(event.type!=='resume')return clone(event);
  const boundary=executionMutationBoundary({journal,event});
  required(!boundary,boundary?.reason ?? 'resume requires rebind');
  return {type:'resume',reason:event.reason,authorization:clone(replay(journal).context.authorization)};
}

export function eventExecutionConsumer({ journal, handoff, current, source, event, expectedSequence }) {
  assertBound({ journal, handoff, current, source });
  required(Number.isInteger(expectedSequence), 'expectedSequence is required');
  const boundary=executionMutationBoundary({journal,event});if(boundary)return boundary;
  const nextJournal = appendEvent(journal, normalizeExecutionEvent(journal,event), expectedSequence);
  return { journal:nextJournal, state:replay(nextJournal), ...classify(nextJournal) };
}

export function reconcileExecutionConsumer({ journal, handoff, current, source, canonicalTasks, taskId, equivalence = null, context = {} }) {
  assertBound({ journal, handoff, current, source });
  const terminal=terminalMutationBoundary(journal);if(terminal)return terminal;
  return reconcileProjectionReceipt({ journal, projectionTasks:source, canonicalTasks, taskId, equivalence, context });
}

export function progressExecutionConsumer({ journal, handoff, current, source, canonicalTasks, canonicalReceipt, taskId, progressRequested, progressCommitted,
  indexReadback, hostAuthority, broker = null, brokerOptions = {} }) {
  const state = assertBound({ journal, handoff, current, source });
  const terminal=terminalMutationBoundary(journal);if(terminal)return terminal;
  const reconciliation = reconcileReceiptProgress({ journal, canonicalTasks, canonicalReceipt, taskId, progressRequested, progressCommitted, indexReadback, hostAuthority });
  if (!reconciliation.event) {
    const brokerResult = reconciliation.status === 'ready_to_commit' && broker
      ? commitTaskIndexProgress({ ...broker, progressRequested, progressCommitted:null }, brokerOptions) : null;
    return { journal, reconciliation, brokerResult, ...classify(journal) };
  }
  const event = reconciliation.event, brokerResult = null;
  const nextJournal = appendEvent(journal, event, state.sequence);
  return { journal:nextJournal, reconciliation, brokerResult, state:replay(nextJournal), ...classify(nextJournal) };
}

export function inspectProgressExecutionConsumer({ journal, handoff, current, source, broker }) {
  assertBound({ journal, handoff, current, source });
  return inspectTaskIndexProgress(broker);
}

export function verifyExecutionConsumer({ journal, handoff, current, source, event, expectedSequence }) {
  if (event === undefined) return objectivePacketExecutionConsumer({ journal, handoff, current, source });
  assertBound({ journal, handoff, current, source });
  return manualMutation(journal,'reserved_event','verifyObjective completion is reserved for hostCompleteVerifier; caller-authored or string-only objective results cannot complete the run');
}

function runtimeProjectionFor(handoff, journal) {
  const imported=(journal.predecessor?.acceptedImports ?? []).filter(item=>handoff.taskManager.tasks.some(task=>task.id===item.taskId))
    .map(item=>({event:{type:'progressCommitted',taskId:item.taskId,sourceJournalDigest:item.sourceJournalDigest}}));
  const events=[...imported,...journal.events].map((entry,index)=>{
    const event=entry.event ?? entry;
    const objectiveOnly=(event.type==='dispatch'&&event.role==='verifier')||event.type==='stopVerifier';
    return {...clone(entry),sequence:index+1,event:objectiveOnly?{type:'pause'}:clone(event)};
  });
  const projection=projectRuntimeProjection(handoff.taskManager,{...clone(journal),events},handoff.executionScope);
  projection.journalSequence=journal.events.length;
  return projection;
}

export function statusExecutionConsumer({ journal, handoff = null, current = null, source = null, capabilities = null, dagViewOptions = {} }) {
  const before = digest(journal);validateExecutionConsumerTerminalIntegrity(journal);
  const supplied=[handoff,current,source].filter(value=>value!==null).length;
  required(supplied===0||supplied===3,'status binding validation requires handoff, current and source together');
  const state=supplied===3?assertBound({journal,handoff,current,source}):replay(journal);
  required(before === digest(journal), 'status must not mutate the journal');
  const next=classify(journal,capabilities);
  const runtimeProjection = handoff?.taskManager ? runtimeProjectionFor(handoff,journal) : null;
  const dagStatusView = runtimeProjection ? buildDagStatusView(runtimeProjection, { mode: 'consumer', ...dagViewOptions }) : null;
  const dagStatusMarkdown = dagStatusView ? formatDagStatusMarkdown(dagStatusView) : null;
  return { status:'read_only', disposition:next.disposition, state, ...(capabilities ? { next } : {}),
    ...(runtimeProjection ? { runtimeProjection, dagStatusView, dagStatusMarkdown } : {}) };
}

export { buildDagStatusView, renderDagTopology, formatDagStatusMarkdown };

export function objectivePacketExecutionConsumer({ journal, handoff, current, source }) {
  assertBound({ journal, handoff, current, source });
  return objectiveSnapshot(journal);
}

export const executionConsumer = Object.freeze({
  init:initExecutionConsumer, next:nextExecutionConsumer, packet:packetExecutionConsumer, event:eventExecutionConsumer,
  reconcile:reconcileExecutionConsumer, progress:progressExecutionConsumer, verify:verifyExecutionConsumer, status:statusExecutionConsumer,
});
