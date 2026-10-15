import { digest, assertCurrentPlan, readyWave, packetFor, replay, objectiveSnapshot, currentObjectiveRevision, applyV3 } from './orchestration.mjs';

const MATRIX_STATES = new Set(['documented', 'observed', 'unavailable', 'unknown']);
const REQUIRED_BROKERS = ['journal', 'evidence', 'progress'];
const WORKSPACE_BINDINGS = [
  'packageRootRealpath', 'projectRootRealpath', 'workspaceId', 'repoIdentity',
  'planningFingerprint', 'workspaceBaselineFingerprint', 'currentFingerprint',
  'writeScope', 'toolCalls',
];
const CAPABILITY_OPERATIONS = new Set([
  'observeCapabilities', 'observeWorkspace', 'enforceCoordinatorBoundary', 'authorize',
  'prepare', 'start', 'observeStop', 'snapshot', 'interrupt', 'integrate',
  'persistEvidence', 'commitProgress', 'wait', 'poll', 'send', 'cancelPrepared',
  'verifyHostObservation', 'withCapabilityLease', 'prepareIntent', 'persistStartState',
  'observeStartState', 'persistIntegrationState', 'observeIntegrationState',
  'persistProgressState', 'observeProgressState', 'observeVerifierResult',
  'observeObjectiveVerificationReceipt',
]);
const WORKSPACE_KEYS = new Set([...WORKSPACE_BINDINGS, 'source']);
const TRANSITION_KEYS = new Set([
  'operation', 'beforeFingerprint', 'afterFingerprint', 'beforeToolCalls',
  'afterToolCalls', 'writeScope', 'changedPaths', 'source',
]);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const same = (left, right) => left === undefined || right === undefined ? left === right : digest(left) === digest(right);
const manual = (reason, details = {}) => ({ status: 'manual_handoff_required', reason, ...details });
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};
const immutable = value => deepFreeze(clone(value));
// An authority observation is intentionally process-local and keyed by the
// concrete host adapter. No serializable journal field, callback or token can
// be replayed as this authority. A restarted bridge must ask the host to
// re-observe the durable receipt before terminal status is available again.
const objectiveAuthorities = new WeakMap();
function rememberObjectiveAuthority(host,journal,receipt) {
  let entries=objectiveAuthorities.get(host);if(!entries){entries=new Map();objectiveAuthorities.set(host,entries);}
  entries.set(digest(journal),digest(receipt));
}
function hasObjectiveAuthority(host,journal) {
  const receipt=replay(journal).objectiveVerification?.attestation;
  return Boolean(receipt&&objectiveAuthorities.get(host)?.get(digest(journal))===digest(receipt));
}

// Kept module-private: the public journal API never accepts objective completion.
// A trusted store receives this one-shot derivation only after the host-owned
// verifier workflow has observed and persisted all required evidence.
function deriveHostObjectiveJournal(journal,event,expectedSequence) {
  const state=replay(journal);
  if(expectedSequence!==state.sequence)throw new Error('stale expected sequence');
  const storedEvent=clone(event);applyV3(state,storedEvent);
  const entry={sequence:state.sequence+1,previous:journal.events.at(-1)?.digest??journal.digest,event:storedEvent};
  return {...clone(journal),events:[...clone(journal.events),{...entry,digest:digest(entry)}]};
}
const normalizeClaimName = value => value.normalize('NFC').toLowerCase();
function validatePaths(paths,label) {
  if(!Array.isArray(paths))throw new Error(`${label} must be an array`);
  for(const path of paths){
    if(!nonempty(path)||path.includes('\\')||path.startsWith('/')||path.endsWith('/')||path.includes('\0')||path.split('/').some(segment=>segment===''||segment==='.'||segment==='..'))throw new Error(`${label} requires canonical relative POSIX paths`);
  }
  if(new Set(paths).size!==paths.length)throw new Error(`${label} paths must be unique`);
  return paths;
}

function closed(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} schema requires an object`);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} schema has unknown fields: ${unknown.join(', ')}`);
  return value;
}
async function hostOwned(host, value, label, allowed) {
  const observation=clone(value);
  closed(observation, allowed, label);
  if (!nonempty(observation.source) || observation.source === 'caller' || typeof host?.verifyHostObservation !== 'function') throw new Error(`${label} requires verifiable host-owned provenance`);
  const before=digest(observation),candidate=clone(observation);
  if (await host.verifyHostObservation({ kind: label, observation: candidate }) !== true) throw new Error(`${label} provenance was not verified by the host adapter`);
  if (digest(candidate)!==before) throw new Error(`${label} mutated during host attestation`);
  closed(candidate,allowed,label);
  return deepFreeze(candidate);
}
async function hostRequestCall(host,operation,request,label,allowed,{allowMissing=false,transportAsResult=false,invoke}={}) {
  // Never let an adapter rewrite the expectation against which its receipt is checked.
  const expected=immutable(request),argument=clone(expected);
  const assertUnchanged=()=>{
    let unchanged=false;try{unchanged=same(argument,expected);}catch{}
    if(!unchanged)throw new Error(`${operation} mutated its request argument`);
  };
  let raw;
  try{raw=await (invoke?invoke(argument,assertUnchanged):host[operation](argument));}
  catch(error){assertUnchanged();if(transportAsResult)return {status:'transport_error',error:error.message};throw error;}
  assertUnchanged();
  let state;
  try{state=allowMissing&&(raw===undefined||raw===null)?raw:await hostOwned(host,raw,label,allowed);}
  finally{assertUnchanged();}
  return {status:'ready',expected,state};
}
function validateMatrix(matrix) {
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) throw new Error('host capability matrix required');
  for (const [name, entry] of Object.entries(matrix)) {
    if (!CAPABILITY_OPERATIONS.has(name)) throw new Error(`unknown host capability ${name}`);
    closed(entry, new Set(['state', 'source']), `host capability ${name}`);
    if (!MATRIX_STATES.has(entry.state) || !nonempty(entry.source) || entry.source === 'caller') throw new Error(`invalid host capability ${name}`);
  }
  return matrix;
}
const operationObserved = (capabilities, name) => capabilities?.matrix?.[name]?.state === 'observed';
function requireObserved(capabilities, host, name) {
  return operationObserved(capabilities, name) && typeof host?.[name] === 'function'
    ? null : manual(`${name} capability is unavailable or unknown`, { capability: name });
}
function validateBinding(binding,label='operation binding') {
  if(!binding||![binding.actor,binding.session,binding.role,binding.projectRootRealpath,binding.taskId,binding.requestedRole,binding.intent].every(nonempty))throw new Error(`${label} requires actor, session, role, project, task, requestedRole and intent`);
  validatePaths(binding.writeScope,`${label} writeScope`);
  if(binding.operationToolCall!==undefined)validateReservedToolCall(binding.operationToolCall,binding,`${label} operationToolCall`);
  return binding;
}
function validateReservedToolCall(toolCall,binding,label='reserved tool call') {
  closed(toolCall,new Set(['id','operation','actor','session','role','source']),label);
  if(![toolCall.id,toolCall.operation,toolCall.actor,toolCall.session,toolCall.role,toolCall.source].every(nonempty)||toolCall.source==='caller')throw new Error(`${label} requires exact host-owned identity fields`);
  if(toolCall.actor!==binding.actor||toolCall.session!==binding.session||toolCall.role!==binding.role)throw new Error(`${label} must bind the reserved actor, session and role`);
  return toolCall;
}
async function runLeased(host, capabilities, operation, binding, invoke) {
  const unavailable=requireObserved(capabilities,host,'withCapabilityLease');
  if(unavailable)return unavailable;
  validateBinding(binding,`${operation} lease binding`);
  const lease=immutable(capabilities.lease),request=immutable({operation,actor:binding.actor,session:binding.session,role:binding.role,projectRootRealpath:binding.projectRootRealpath,taskId:binding.taskId,requestedRole:binding.requestedRole,writeScope:clone(binding.writeScope),intent:binding.intent,...(binding.operationToolCall?{operationToolCall:clone(binding.operationToolCall)}:{}),lease});
  let invocations=0,invocationCompleted=false,invocationValue;
  try {
    const {state:result}=await hostRequestCall(host,'withCapabilityLease',request,'capability lease consumption',new Set(['status','operation','actor','session','role','projectRootRealpath','taskId','requestedRole','writeScope','intent','operationToolCall','generation','token','value','source']),{invoke:(argument,assertUnchanged)=>host.withCapabilityLease(argument,async()=>{
      assertUnchanged();if(++invocations!==1)throw new Error('capability lease callback may execute only once');
      try{invocationValue=await invoke(assertUnchanged);invocationCompleted=true;return invocationValue;}
      finally{assertUnchanged();}
    })});
    if(!['consumed','revoked'].includes(result.status)||result.operation!==operation||result.actor!==request.actor||result.session!==request.session||result.role!==request.role||result.projectRootRealpath!==request.projectRootRealpath||result.taskId!==request.taskId||result.requestedRole!==request.requestedRole||!same(result.writeScope,request.writeScope)||result.intent!==request.intent||!same(result.operationToolCall,request.operationToolCall)||result.generation!==lease.generation||result.token!==lease.token)throw new Error('capability lease consumption does not match exact operation identity/project/task/scope/generation');
    if(result.status==='revoked'){if(invocations)throw new Error(`revoked capability lease executed ${operation}`);return manual(`capability lease revoked before ${operation}`,{capability:operation,actor:request.actor,session:request.session,role:request.role});}
    if(invocations!==1||!Object.hasOwn(result,'value'))throw new Error('consumed capability lease requires exactly one operation result');
    return {status:'ready',value:clone(result.value),leaseConsumption:clone(result)};
  } catch(error) {
    if(invocations>0)error.leaseAmbiguity={operation,invoked:true,completed:invocationCompleted,value:clone(invocationValue),binding:clone(request)};
    throw error;
  }
}
function workspaceDrift(expected, actual, { transition = null, operation = null, allowedPaths = [], expectedWriteScope = allowedPaths } = {}) {
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object') return 'workspace observation missing';
  for (const field of WORKSPACE_BINDINGS.filter(field => !['currentFingerprint', 'toolCalls'].includes(field))) {
    if (Object.hasOwn(expected, field) && !same(expected[field], actual[field])) return `${field} changed`;
  }
  const fingerprintChanged = Object.hasOwn(expected, 'currentFingerprint') && !same(expected.currentFingerprint, actual.currentFingerprint);
  const toolCallsChanged = Object.hasOwn(expected, 'toolCalls') && !same(expected.toolCalls, actual.toolCalls);
  if (!transition) return !fingerprintChanged && !toolCallsChanged ? null : `${fingerprintChanged ? 'currentFingerprint' : 'toolCalls'} changed without an attributed transition`;
  if (transition.operation !== operation || transition.beforeFingerprint !== expected.currentFingerprint || transition.afterFingerprint !== actual.currentFingerprint ||
    !same(transition.beforeToolCalls, expected.toolCalls) || !same(transition.afterToolCalls, actual.toolCalls) || !same(transition.writeScope, expectedWriteScope)) return 'workspace transition does not bind the observed before/after state or exact operation write scope';
  const inScope = path => allowedPaths.some(scope => path === scope || path.startsWith(`${scope}/`));
  if (!transition.changedPaths.every(inScope)) return 'workspace transition contains out-of-scope drift';
  if (!['integrate', 'progress', 'stop'].includes(operation) && transition.changedPaths.length) return `${operation} cannot attribute project-file changes`;
  if (transition.changedPaths.length && !fingerprintChanged) return 'workspace transition claims file changes without a fingerprint change';
  if (fingerprintChanged && !transition.changedPaths.length) return 'workspace fingerprint changed without attributed paths';
  return null;
}
function validateRuntime(runtime) {
  closed(runtime, new Set(['spawn', 'isolatedWrites', 'maxAgents', 'externalActive', 'models', 'externalReservations', 'reviewIsolation']), 'runtime capabilities');
  if (typeof runtime.spawn!=='boolean'||typeof runtime.isolatedWrites!=='boolean'||!Number.isInteger(runtime.maxAgents)||runtime.maxAgents<0||!Number.isInteger(runtime.externalActive)||runtime.externalActive<0) throw new Error('runtime spawn/isolatedWrites booleans and non-negative integer maxAgents/externalActive required');
  if (!Array.isArray(runtime.models)) throw new Error('runtime capability models must be an array');
  for (const model of runtime.models) {
    closed(model, new Set(['model', 'efforts']), 'runtime model capability');
    if(!nonempty(model.model)||!Array.isArray(model.efforts)||!model.efforts.length||!model.efforts.every(nonempty)||new Set(model.efforts).size!==model.efforts.length)throw new Error('runtime model and efforts array are invalid');
  }
  if (runtime.reviewIsolation !== undefined) {
    const isolation=closed(runtime.reviewIsolation, new Set(['enforced', 'mode', 'provider', 'projectScope', 'targetRevision']), 'review isolation capability');
    if(isolation.enforced!==true||!['read-only','disposable-copy'].includes(isolation.mode)||![isolation.provider,isolation.projectScope,isolation.targetRevision].every(nonempty))throw new Error('review isolation capability is invalid');
  }
  if (runtime.externalReservations !== undefined) {
    if(!Array.isArray(runtime.externalReservations)||runtime.externalReservations.length!==runtime.externalActive)throw new Error('external reservations must cover every external actor');
    for(const reservation of runtime.externalReservations){
      closed(reservation,new Set(['actor','role','claims']),'external reservation');
      if(!nonempty(reservation.actor)||!nonempty(reservation.role)||!Array.isArray(reservation.claims))throw new Error('external reservation actor, role and claims array required');
      const claimKeys=new Set();
      for(const claim of reservation.claims){
        closed(claim,new Set(['type','name','mode']),'external reservation claim');
        if(!['path','resource'].includes(claim.type)||!nonempty(claim.name)||!['read','write','exclusive'].includes(claim.mode))throw new Error('external reservation claim is invalid');
        if(claim.type==='path')validatePaths([claim.name],'external reservation path claim');
        const key=`${claim.type}:${normalizeClaimName(claim.name)}`;if(claimKeys.has(key))throw new Error('external reservation resource claims must be unique and non-conflicting');claimKeys.add(key);
      }
    }
  }
  return runtime;
}
function validateToolCalls(toolCalls,label='workspace toolCalls') {
  if(!Array.isArray(toolCalls))throw new Error(`${label} must be an array`);
  for(const toolCall of toolCalls){
    closed(toolCall,new Set(['id','operation','actor','session','role','source']),'workspace tool call');
    if(![toolCall.id,toolCall.operation,toolCall.actor,toolCall.session,toolCall.role,toolCall.source].every(nonempty)||toolCall.source==='caller')throw new Error('workspace tool call requires exact host-owned identity fields');
  }
  return toolCalls;
}
function validateOperationToolCall(toolCall,transition,{operation,actor,session,role,reservedToolCall}) {
  if(!nonempty(toolCall))throw new Error(`${operation} requires a tool-call id`);
  if(!transition)throw new Error(`${operation} mutation requires a workspace transition with its attributed tool call`);
  validateToolCalls(transition.beforeToolCalls,'workspace transition beforeToolCalls');
  validateToolCalls(transition.afterToolCalls,'workspace transition afterToolCalls');
  const before=new Set(transition.beforeToolCalls.map(call=>digest(call)));
  if(!transition.beforeToolCalls.every(call=>transition.afterToolCalls.some(next=>same(call,next))))throw new Error(`${operation} workspace transition removed a prior tool call`);
  const added=transition.afterToolCalls.filter(call=>!before.has(digest(call)));
  if(added.length!==1||transition.afterToolCalls.length!==transition.beforeToolCalls.length+1)throw new Error(`${operation} workspace transition must add exactly one tool call`);
  const observed=added[0];
  if(observed.id!==toolCall||observed.operation!==operation||observed.actor!==actor||observed.session!==session||observed.role!==role||!nonempty(observed.source)||observed.source==='caller')throw new Error(`${operation} observation tool call does not match the exact attributed operation identity`);
  if(reservedToolCall&&!same(observed,reservedToolCall))throw new Error(`${operation} observation tool call does not match its host-owned reservation`);
}
function validateWorkspace(value) {
  if (value.repoIdentity !== undefined) {
    const repo=closed(value.repoIdentity, new Set(['vcs', 'rootRealpath', 'commonDirRealpath', 'baseRevision', 'headRevision']), 'workspace repository identity');
    if(!['git','hg','none'].includes(repo.vcs)||!nonempty(repo.rootRealpath)||!nonempty(repo.baseRevision)||(repo.commonDirRealpath!==undefined&&!nonempty(repo.commonDirRealpath))||(repo.headRevision!==undefined&&!nonempty(repo.headRevision)))throw new Error('workspace repository identity has invalid types');
  }
  if(value.writeScope!==undefined)validatePaths(value.writeScope,'workspace writeScope');
  for(const field of ['packageRootRealpath','projectRootRealpath','workspaceId','planningFingerprint','workspaceBaselineFingerprint','currentFingerprint','source'])if(Object.hasOwn(value,field)&&!nonempty(value[field]))throw new Error(`workspace ${field} must be a string`);
  if(value.toolCalls!==undefined)validateToolCalls(value.toolCalls);
  return value;
}
const START_STATE_KEYS=new Set(['requestId','status','actor','session','role','taskId','writeScope','operationToolCall','workspaceBeforeDigest','workspace','source']);
function validateStartState(value,label='start state') {
  closed(value,START_STATE_KEYS,label);
  if(!nonempty(value.requestId)||!['requested','observed','ambiguous'].includes(value.status)||![value.actor,value.session,value.role,value.taskId,value.workspaceBeforeDigest,value.source].every(nonempty)||value.source==='caller')throw new Error(`${label} requires exact identity, status, request and pre-start digest`);
  validatePaths(value.writeScope,`${label} writeScope`);
  validateReservedToolCall(value.operationToolCall,value,`${label} operationToolCall`);
  if(value.operationToolCall.operation!=='start')throw new Error(`${label} must reserve a start tool call`);
  if(value.status==='observed'){
    if(!value.workspace)throw new Error(`${label} observed state requires a workspace baseline`);
    closed(value.workspace,WORKSPACE_KEYS,'observed start workspace');validateWorkspace(value.workspace);
  }else if(value.workspace!==undefined)throw new Error(`${label} pending or ambiguous state cannot assert a workspace baseline`);
  return value;
}
async function persistStartState(host,capabilities,status,binding,{requestId,workspaceBefore,workspace}={}) {
  const unavailable=requireObserved(capabilities,host,'persistStartState');if(unavailable)return unavailable;
  const request={status,...(requestId?{requestId}:{}),actor:binding.actor,session:binding.session,role:binding.role,taskId:binding.taskId,writeScope:clone(binding.writeScope),operationToolCall:clone(binding.operationToolCall),workspaceBeforeDigest:digest(workspaceBefore),...(workspace?{workspace:clone(workspace)}:{})};
  const {state,expected}=await hostRequestCall(host,'persistStartState',request,'persisted start state',START_STATE_KEYS);validateStartState(state);
  for(const field of ['status','actor','session','role','taskId','workspaceBeforeDigest'])if(state[field]!==expected[field])throw new Error(`persisted start state does not bind exact ${field}`);
  if(expected.requestId&&state.requestId!==expected.requestId)throw new Error('persisted start state changed its request identity');
  if(!same(state.writeScope,expected.writeScope)||!same(state.operationToolCall,expected.operationToolCall)||!same(state.workspace,expected.workspace))throw new Error('persisted start state does not bind exact scope, tool call and workspace');
  return {status:'ready',state};
}
async function markStartAmbiguous(host,capabilities,binding,startRequest,workspaceBefore) {
  try{return await persistStartState(host,capabilities,'ambiguous',binding,{requestId:startRequest.requestId,workspaceBefore});}
  catch(error){return {status:'transport_error',outcome:'transport_error',reservationRetained:true,session:binding.session,startState:'pending_or_ambiguous',error:error.message};}
}
const INTEGRATION_STATE_KEYS=new Set([...START_STATE_KEYS,'workspaceTransition']);
function validateIntegrationState(value,label='integration state') {
  closed(value,INTEGRATION_STATE_KEYS,label);
  if(!nonempty(value.requestId)||!['requested','observed','ambiguous'].includes(value.status)||![value.actor,value.session,value.taskId,value.workspaceBeforeDigest,value.source].every(nonempty)||value.source==='caller'||value.role!=='integrator')throw new Error(`${label} requires exact integrator identity, status, request and pre-integration digest`);
  validatePaths(value.writeScope,`${label} writeScope`);
  validateReservedToolCall(value.operationToolCall,value,`${label} operationToolCall`);
  if(value.operationToolCall.operation!=='integrate')throw new Error(`${label} must reserve an integrate tool call`);
  if(value.status==='observed'){
    if(!value.workspace||!value.workspaceTransition)throw new Error(`${label} observed state requires a workspace baseline and transition proof`);
    closed(value.workspace,WORKSPACE_KEYS,'observed integration workspace');validateWorkspace(value.workspace);
    validateWorkspaceTransition(value.workspaceTransition);
  }else if(value.workspace!==undefined||value.workspaceTransition!==undefined)throw new Error(`${label} pending or ambiguous state cannot assert a workspace baseline or transition`);
  return value;
}
async function validateIntegrationBaseline(host,state,workspaceBefore) {
  closed(workspaceBefore,WORKSPACE_KEYS,'pre-integration workspace');validateWorkspace(workspaceBefore);
  if(digest(workspaceBefore)!==state.workspaceBeforeDigest)throw new Error('integration state does not bind the journal pre-integration workspace digest');
  const transition=await hostOwned(host,state.workspaceTransition,'workspace transition',TRANSITION_KEYS);
  validateWorkspaceTransition(transition);
  validateOperationToolCall(state.operationToolCall.id,transition,{operation:'integrate',actor:state.actor,session:state.session,role:state.role,reservedToolCall:state.operationToolCall});
  const drift=workspaceDrift(workspaceBefore,state.workspace,{transition,operation:'integrate',allowedPaths:state.writeScope});
  if(drift)throw new Error(`persisted integration workspace drift: ${drift}`);
}
async function persistIntegrationState(host,capabilities,status,binding,{requestId,workspaceBefore,workspace,workspaceTransition}={}) {
  const unavailable=requireObserved(capabilities,host,'persistIntegrationState');if(unavailable)return unavailable;
  const request={status,...(requestId?{requestId}:{}),actor:binding.actor,session:binding.session,role:binding.role,taskId:binding.taskId,writeScope:clone(binding.writeScope),operationToolCall:clone(binding.operationToolCall),workspaceBeforeDigest:digest(workspaceBefore),...(workspace?{workspace:clone(workspace),workspaceTransition:clone(workspaceTransition)}:{})};
  const {state,expected}=await hostRequestCall(host,'persistIntegrationState',request,'persisted integration state',INTEGRATION_STATE_KEYS);validateIntegrationState(state);
  for(const field of ['status','actor','session','role','taskId','workspaceBeforeDigest'])if(state[field]!==expected[field])throw new Error(`persisted integration state does not bind exact ${field}`);
  if(expected.requestId&&state.requestId!==expected.requestId)throw new Error('persisted integration state changed its request identity');
  for(const field of ['writeScope','operationToolCall','workspace','workspaceTransition'])if(!same(state[field],expected[field]))throw new Error(`persisted integration state does not bind exact ${field}`);
  if(status==='observed')await validateIntegrationBaseline(host,state,workspaceBefore);
  return {status:'ready',state};
}
async function markIntegrationAmbiguous(host,capabilities,binding,request,workspaceBefore) {
  try{return await persistIntegrationState(host,capabilities,'ambiguous',binding,{requestId:request.requestId,workspaceBefore});}
  catch{return {status:'transport_error'};}
}
const PROGRESS_REQUEST_FIELDS=['type','taskId','planningRevision','contractRevision','integrationRevision','receiptDigest','indexBeforeHash','expectedChange'];
const PROGRESS_STATE_KEYS=new Set(['requestId','status','actor','session','role','taskId','projectRootRealpath','canonicalIndex','progressRequested','workspaceBeforeDigest','workspace','workspaceTransition','indexAfterHash','source']);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function progressRequestBase(value) {
  closed(value,new Set([...PROGRESS_REQUEST_FIELDS,'indexReadback','authorityConsumption']),'progressRequested');
  const request=Object.fromEntries(PROGRESS_REQUEST_FIELDS.map(field=>[field,clone(value[field])]));
  if(request.type!=='progressRequested'||!['taskId','planningRevision','contractRevision','integrationRevision','receiptDigest'].every(field=>nonempty(request[field]))||!hash(request.indexBeforeHash))throw new Error('progressRequested requires exact task, revision, receipt and before-hash binding');
  closed(request.expectedChange,new Set(['from','to']),'progress checkbox change');
  if(request.expectedChange.from!=='[ ]'||request.expectedChange.to!=='[x]')throw new Error('progressRequested requires the exact checkbox transition');
  return request;
}
const progressRequestId=(projectRootRealpath,canonicalIndex,progressRequested)=>`progress:${digest({projectRootRealpath,canonicalIndex,progressRequested})}`;
function validateProgressState(value) {
  closed(value,PROGRESS_STATE_KEYS,'progress state');
  const request=progressRequestBase(value.progressRequested);
  if(!['requested','observed','ambiguous'].includes(value.status)||value.actor!=='progress-broker'||value.session!=='progress-broker'||value.role!=='progress-broker'||value.taskId!==request.taskId||!nonempty(value.projectRootRealpath)||value.canonicalIndex!=='tasks.md'||!hash(value.workspaceBeforeDigest)||!nonempty(value.source)||value.source==='caller'||value.requestId!==progressRequestId(value.projectRootRealpath,value.canonicalIndex,request)||!same(value.progressRequested,request))throw new Error('progress state does not bind its canonical request and broker identity');
  if(value.status==='observed'){
    if(!value.workspace||!value.workspaceTransition||!hash(value.indexAfterHash)||value.indexAfterHash===request.indexBeforeHash)throw new Error('observed progress state requires workspace, transition and distinct readback hash');
    closed(value.workspace,WORKSPACE_KEYS,'observed progress workspace');validateWorkspace(value.workspace);validateWorkspaceTransition(value.workspaceTransition);
  }else if(['workspace','workspaceTransition','indexAfterHash'].some(field=>value[field]!==undefined))throw new Error('pending or ambiguous progress cannot assert a workspace baseline or readback');
  return value;
}
async function validateProgressBaseline(host,state,before) {
  if(digest(before)!==state.workspaceBeforeDigest)throw new Error('progress baseline does not bind its causal pre-progress workspace');
  const transition=await hostOwned(host,state.workspaceTransition,'workspace transition',TRANSITION_KEYS);validateWorkspaceTransition(transition);
  if(!same(transition.beforeToolCalls,transition.afterToolCalls))throw new Error('progress broker cannot attribute added, removed or changed tool calls');
  const drift=workspaceDrift(before,state.workspace,{transition,operation:'progress',allowedPaths:[state.canonicalIndex]});
  if(drift)throw new Error(`persisted progress workspace drift: ${drift}`);
}
async function persistProgressState(host,capabilities,status,binding,{workspaceBefore,workspace,workspaceTransition,indexAfterHash}={}) {
  const unavailable=requireObserved(capabilities,host,'persistProgressState');if(unavailable)return unavailable;
  const request={...clone(binding),status,workspaceBeforeDigest:digest(workspaceBefore),...(workspace?{workspace:clone(workspace),workspaceTransition:clone(workspaceTransition),indexAfterHash}:{})};
  const {state,expected}=await hostRequestCall(host,'persistProgressState',request,'persisted progress state',PROGRESS_STATE_KEYS);validateProgressState(state);
  for(const field of Object.keys(expected))if(!same(state[field],expected[field]))throw new Error(`persisted progress state does not bind exact ${field}`);
  if(status==='observed')await validateProgressBaseline(host,state,workspaceBefore);
  return {status:'ready',state};
}
async function validateProgressJournalAuthority(host,journal,entry,request,status) {
  const event=entry.event,readback=event.indexReadback,consumption=event.authorityConsumption;
  const readbackKeys=new Set(['schemaVersion','token','source','authorityGeneration','journalVersion','journalSequence','journalEventDigest','planningRevision','candidateRevision','integrationRevision','reviewRevision','brokerEventDigest','status','indexBeforeHash',...(status==='closed'?['indexAfterHash']:[])]);
  const observed=await hostOwned(host,readback,'progress journal readback',readbackKeys);
  const before={...journal,events:journal.events.slice(0,entry.sequence-1)},state=replay(before),receipt=state.tasks[request.taskId]?.receipt;
  if(observed.schemaVersion!=='asds.index-readback/1'||observed.source!=='progress-broker-host'||!hash(observed.token)||!hash(observed.brokerEventDigest)||!Number.isInteger(observed.authorityGeneration)||observed.authorityGeneration<1||observed.journalVersion!==3||observed.journalSequence!==state.sequence||observed.journalEventDigest!==(before.events.at(-1)?.digest??before.digest)||observed.status!==status||observed.indexBeforeHash!==request.indexBeforeHash||observed.planningRevision!==request.planningRevision||observed.candidateRevision!==receipt?.revision||observed.integrationRevision!==request.integrationRevision||observed.reviewRevision!==request.integrationRevision||(status==='closed'&&observed.indexAfterHash!==event.indexAfterHash))throw new Error('progress journal readback is stale or does not bind its exact journal, receipt and hashes');
  const authority=await hostOwned(host,consumption,'progress journal authority consumption',new Set(['schemaVersion','kind','handle','token','source','authorityGeneration','binding']));
  const binding={kind:'progress-readback',token:observed.token,source:observed.source,authorityGeneration:observed.authorityGeneration,journalVersion:3,journalSequence:observed.journalSequence,journalEventDigest:observed.journalEventDigest,planningRevision:observed.planningRevision,candidateRevision:observed.candidateRevision,integrationRevision:observed.integrationRevision,reviewRevision:observed.reviewRevision,payloadDigest:digest(observed)};
  if(authority.schemaVersion!=='asds.host-authority-consumption/1'||authority.kind!==binding.kind||authority.token!==binding.token||authority.source!==binding.source||authority.authorityGeneration!==binding.authorityGeneration||!same(authority.binding,binding)||authority.handle!==digest({generation:binding.authorityGeneration,token:binding.token,binding}))throw new Error('progress journal authority consumption does not bind the attested readback');
}
async function progressWorkspaceFrom(host,journal,entry) {
  const request=progressRequestBase(entry.event),prefix={...journal,events:journal.events.slice(0,entry.sequence-1)},previous=await expectedWorkspaceFrom(host,prefix);
  if(previous.status!=='ready')return previous;
  const before=previous.workspace,canonicalIndex='tasks.md',requestId=progressRequestId(before.projectRootRealpath,canonicalIndex,request);
  if(typeof host?.observeCapabilities!=='function'||typeof host?.verifyHostObservation!=='function')return manual('persisted progress observation capability cannot be verified',{capability:'observeProgressState',requestId,reservationRetained:true});
  const capabilities=await observeCapabilities(host,'resolve-progress-state'),unavailable=requireObserved(capabilities,host,'observeProgressState');if(unavailable)return {...unavailable,requestId,reservationRetained:true};
  const resolved=await hostRequestCall(host,'observeProgressState',{requestId},'observed progress state',PROGRESS_STATE_KEYS,{allowMissing:true,transportAsResult:true});
  if(resolved.status!=='ready')return {...resolved,outcome:'transport_error',requestId,reservationRetained:true};
  const observed=resolved.state;
  if(observed===undefined||observed===null)return manual('progress proof is missing; no post-progress baseline is established',{requestId,progressState:'missing',reservationRetained:true});
  validateProgressState(observed);
  if(observed.requestId!==requestId||!same(observed.progressRequested,request)||observed.projectRootRealpath!==before.projectRootRealpath)throw new Error('observed progress state does not bind its journal request');
  if(observed.status!=='observed')return manual('progress remains pending or ambiguous; no post-progress baseline is established',{requestId,progressState:observed.status,reservationRetained:true});
  await validateProgressBaseline(host,observed,before);
  await validateProgressJournalAuthority(host,journal,entry,request,'open');
  const commits=journal.events.slice(entry.sequence).filter(item=>item.event.type==='progressCommitted'&&item.event.taskId===request.taskId);
  if(commits.length>1)throw new Error('ambiguous progress commit proof');
  if(commits[0]){
    const commit=closed(commits[0].event,new Set(['type','taskId','receiptDigest','indexBeforeHash','indexAfterHash','indexReadback','authorityConsumption']),'progressCommitted');
    if(commit.receiptDigest!==request.receiptDigest||commit.indexBeforeHash!==request.indexBeforeHash||commit.indexAfterHash!==observed.indexAfterHash)throw new Error('progress committed hash or receipt does not match the host ledger');
    await validateProgressJournalAuthority(host,journal,commits[0],request,'closed');
  }
  return {status:'ready',workspace:clone(observed.workspace)};
}
async function observeCapabilities(host, phase, previous = null) {
  const value = await hostOwned(host, await host.observeCapabilities({ phase }), 'capability observation', new Set(['runtime', 'matrix', 'lease', 'source']));
  validateMatrix(value.matrix); validateRuntime(value.runtime);
  closed(value.lease,new Set(['generation','token','source']),'capability lease');
  if(!Number.isInteger(value.lease.generation)||value.lease.generation<1||!nonempty(value.lease.token)||!nonempty(value.lease.source)||value.lease.source==='caller')throw new Error('capability lease requires host-owned positive generation and token');
  if (previous && (!same(previous.runtime, value.runtime)||!same(previous.matrix,value.matrix)||previous.source!==value.source)) {
    const revoked = Object.keys(previous.matrix).find(name => !same(previous.matrix[name], value.matrix[name]));
    return manual(`host capabilities changed during ${phase}`, { capability: revoked ?? 'runtime', previous: clone(previous), current: clone(value) });
  }
  if(previous&&(value.lease.generation<=previous.lease.generation||value.lease.token===previous.lease.token))throw new Error('capability lease generation/token must advance at every observation');
  return value;
}
function validateWorkspaceTransition(transition) {
  closed(transition,TRANSITION_KEYS,'workspace transition');
  if (!nonempty(transition.operation) || !nonempty(transition.beforeFingerprint) || !nonempty(transition.afterFingerprint) ||
    !['beforeToolCalls', 'afterToolCalls', 'writeScope', 'changedPaths'].every(field => Array.isArray(transition[field]))) throw new Error('workspace transition schema is incomplete');
  validatePaths(transition.writeScope,'workspace transition writeScope');
  validatePaths(transition.changedPaths,'workspace transition changedPaths');
  validateToolCalls(transition.beforeToolCalls,'workspace transition beforeToolCalls');
  validateToolCalls(transition.afterToolCalls,'workspace transition afterToolCalls');
  return transition;
}
async function observeWorkspace(host, capabilities, expectedWorkspace, phase, transitionContext = {}) {
  const unavailable = requireObserved(capabilities, host, 'observeWorkspace');
  if (unavailable) return unavailable;
  const observation = await hostOwned(host, await host.observeWorkspace({ phase }), 'workspace observation', WORKSPACE_KEYS);
  validateWorkspace(observation);
  const transition = transitionContext.transition;
  if (transition) {
    await hostOwned(host, transition, 'workspace transition', TRANSITION_KEYS);
    validateWorkspaceTransition(transition);
  }
  const drift = workspaceDrift(expectedWorkspace, observation, transitionContext);
  if (drift) throw new Error(`workspace drift during ${phase}: ${drift}`);
  return observation;
}
function validBoundary(boundary, coordinator) {
  return boundary?.enforced === true && boundary.projectReadOnly === true && boundary.coordinator === coordinator &&
    nonempty(boundary.source) && Array.isArray(boundary.violations) && boundary.violations.length === 0 &&
    Array.isArray(boundary.brokers) && same([...boundary.brokers].sort(), [...REQUIRED_BROKERS].sort());
}

// `documented` is not runtime evidence. Only a current `observed` capability may be used.
async function observeHostContractInternal(host, { expectedWorkspace, coordinator, phase = 'preflight' }) {
  if (typeof host?.observeCapabilities !== 'function' || typeof host?.verifyHostObservation !== 'function') return manual('host capability/provenance observation is unavailable or unknown', { capability: 'observeCapabilities' });
  const capabilities = await observeCapabilities(host, phase);
  if (!operationObserved(capabilities, 'verifyHostObservation')) return manual('host-owned provenance verification is unavailable or unknown', { capability:'verifyHostObservation' });
  const workspace = await observeWorkspace(host, capabilities, expectedWorkspace, phase);
  if (workspace?.status === 'manual_handoff_required') return workspace;
  const afterWorkspace = await observeCapabilities(host, `${phase}:after-workspace`, capabilities);
  if (afterWorkspace?.status === 'manual_handoff_required') return afterWorkspace;
  const unavailable = requireObserved(afterWorkspace, host, 'enforceCoordinatorBoundary');
  if (unavailable) return unavailable;
  const boundary = await hostOwned(host, await host.enforceCoordinatorBoundary({ coordinator, phase, expectedWorkspace: clone(expectedWorkspace) }), 'coordinator boundary', new Set(['enforced', 'projectReadOnly', 'brokers', 'coordinator', 'violations', 'source']));
  if (!validBoundary(boundary, coordinator)) return manual('host-owned coordinator read-only boundary and exact brokers are not enforced', { boundary: clone(boundary) });
  const currentCapabilities = await observeCapabilities(host, `${phase}:after-boundary`, afterWorkspace);
  if (currentCapabilities?.status === 'manual_handoff_required') return currentCapabilities;
  return { status: 'ready', capabilities: clone(currentCapabilities), workspace: clone(workspace), boundary: clone(boundary) };
}
export async function observeHostContract(...args){return immutable(await observeHostContractInternal(...args));}
async function expectedWorkspaceFrom(host,journal) {
  const latest=[...journal.events].reverse().find(entry=>entry.event?.context?.startRequest||entry.event?.context?.integrationRequest||entry.event?.type==='progressRequested');
  if(latest?.event.type==='progressRequested')return progressWorkspaceFrom(host,journal,latest);
  const integrationRequest=latest?.event.context.integrationRequest;
  if(integrationRequest){
    const event=latest.event,request=validateIntegrationState(integrationRequest,'journal integration request');
    if(event.context.startRequest||event.type!=='dispatch'||event.role!=='integrator'||request.status!=='requested'||request.actor!==event.context.reservedActor||request.session!==event.session||request.taskId!==event.taskId||!same(request.writeScope,replay(journal).plan.tasks.find(task=>task.id===event.taskId)?.write))throw new Error('journal integration request does not bind its exact integrator dispatch and scope');
    if(typeof host?.observeCapabilities!=='function'||typeof host?.verifyHostObservation!=='function')return manual('persisted integration observation capability cannot be verified',{capability:'observeIntegrationState',requestId:request.requestId,reservationRetained:true,session:request.session});
    const capabilities=await observeCapabilities(host,'resolve-integration-state');
    const unavailable=requireObserved(capabilities,host,'observeIntegrationState');if(unavailable)return {...unavailable,requestId:request.requestId,reservationRetained:true,session:request.session};
    const resolved=await hostRequestCall(host,'observeIntegrationState',{requestId:request.requestId},'observed integration state',INTEGRATION_STATE_KEYS,{allowMissing:true,transportAsResult:true});
    if(resolved.status!=='ready')return {...resolved,outcome:'transport_error',reservationRetained:true,requestId:request.requestId,session:request.session};
    const observed=resolved.state;
    if(observed===undefined||observed===null)return manual('integration proof is missing; no post-integration baseline is established',{requestId:request.requestId,integrationState:'missing',reservationRetained:true,session:request.session});
    validateIntegrationState(observed,'observed integration state');
    for(const field of ['requestId','actor','session','role','taskId','workspaceBeforeDigest'])if(observed[field]!==request[field])throw new Error(`observed integration state does not bind journal ${field}`);
    if(!same(observed.writeScope,request.writeScope)||!same(observed.operationToolCall,request.operationToolCall))throw new Error('observed integration state does not bind journal scope and tool call');
    if(observed.status!=='observed')return manual('integration remains pending or ambiguous; no post-integration baseline is established',{requestId:request.requestId,integrationState:observed.status,reservationRetained:true,session:request.session});
    await validateIntegrationBaseline(host,observed,event.context.workspaceSnapshotBefore);
    return {status:'ready',workspace:clone(observed.workspace)};
  }
  const request=latest?.event.context.startRequest;
  if(request){
    validateStartState(request,'journal start request');
    if(typeof host?.observeCapabilities!=='function'||typeof host?.verifyHostObservation!=='function')return manual('persisted start observation capability cannot be verified',{capability:'observeStartState',requestId:request.requestId});
    const capabilities=await observeCapabilities(host,'resolve-start-state');
    const unavailable=requireObserved(capabilities,host,'observeStartState');if(unavailable)return {...unavailable,requestId:request.requestId};
    const resolved=await hostRequestCall(host,'observeStartState',{requestId:request.requestId},'observed start state',START_STATE_KEYS,{transportAsResult:true});
    if(resolved.status!=='ready')return {...resolved,outcome:'transport_error',reservationRetained:true,requestId:request.requestId};
    const observed=resolved.state;validateStartState(observed,'observed start state');
    for(const field of ['requestId','actor','session','role','taskId','workspaceBeforeDigest'])if(observed[field]!==request[field])throw new Error(`observed start state does not bind journal ${field}`);
    if(!same(observed.writeScope,request.writeScope)||!same(observed.operationToolCall,request.operationToolCall))throw new Error('observed start state does not bind journal scope and tool call');
    if(observed.status!=='observed')return manual('start remains pending or ambiguous; no post-start baseline is established',{requestId:request.requestId,startState:observed.status,reservationRetained:true,session:request.session});
    return {status:'ready',workspace:clone(observed.workspace)};
  }
  const binding = replay(journal).context.workspaceBinding;
  if (!binding || typeof binding !== 'object') throw new Error('journal requires a host-owned workspace binding');
  return {status:'ready',workspace:binding};
}
function reservedIdentities(journal) {
  const state=replay(journal),identities=new Set([state.context.coordinator,...state.sessions]);
  for(const entry of journal.events)if(nonempty(entry.event?.context?.reservedActor))identities.add(entry.event.context.reservedActor);
  return identities;
}
async function reobserve(host, contract, expectedWorkspace, phase, transitionContext = {}) {
  const capabilities = await observeCapabilities(host, phase, contract.capabilities);
  if (capabilities?.status === 'manual_handoff_required') return capabilities;
  const workspace = await observeWorkspace(host, capabilities, expectedWorkspace, phase, transitionContext);
  if (workspace?.status === 'manual_handoff_required') return workspace;
  const afterWorkspace = await observeCapabilities(host, `${phase}:after-workspace`, capabilities);
  if (afterWorkspace?.status === 'manual_handoff_required') return afterWorkspace;
  const boundary = await hostOwned(host, await host.enforceCoordinatorBoundary({ coordinator: contract.boundary.coordinator, phase, expectedWorkspace: clone(expectedWorkspace) }), 'coordinator boundary', new Set(['enforced', 'projectReadOnly', 'brokers', 'coordinator', 'violations', 'source']));
  if (!validBoundary(boundary, contract.boundary.coordinator)) return manual(`coordinator boundary lost during ${phase}`, { boundary: clone(boundary) });
  const currentCapabilities = await observeCapabilities(host, `${phase}:after-boundary`, afterWorkspace);
  if (currentCapabilities?.status === 'manual_handoff_required') return currentCapabilities;
  return { status: 'ready', capabilities:currentCapabilities, workspace, boundary };
}
async function authorize(host, contract, operation, context, expectedWorkspace, phase) {
  const unavailable = requireObserved(contract.capabilities, host, 'authorize');
  if (unavailable) return unavailable;
  validateBinding(context,`${operation} authorization binding`);
  const {state:grant,expected}=await hostRequestCall(host,'authorize',{operation,...context},'authorization observation',new Set(['granted','source','scope','validUntil','operation','actor','session','role','projectRootRealpath','taskId','requestedRole','writeScope','intent','operationToolCall']));
  if(typeof grant.granted!=='boolean'||!nonempty(grant.source)||!nonempty(grant.scope)||(grant.validUntil!==undefined&&!nonempty(grant.validUntil))||
    ['operation','actor','session','role','projectRootRealpath','taskId','requestedRole','intent'].some(field=>!nonempty(grant[field]))||!Array.isArray(grant.writeScope))throw new Error('authorization observation schema has invalid types');
  if (grant.granted !== true) throw new Error(`host authorization required for ${operation}`);
  if (grant.operation !== expected.operation || grant.actor !== expected.actor || grant.session !== expected.session || grant.role !== expected.role||grant.scope!==expected.projectRootRealpath||grant.projectRootRealpath!==expected.projectRootRealpath||grant.taskId!==expected.taskId||grant.requestedRole!==expected.requestedRole||!same(grant.writeScope,expected.writeScope)||grant.intent!==expected.intent||!same(grant.operationToolCall,expected.operationToolCall)) throw new Error(`${operation} authorization must bind the exact operation, actor, session, role, project, task, requestedRole, writeScope and intent`);
  const observation = await reobserve(host, contract, expectedWorkspace, phase);
  return observation.status === 'ready' ? { status: 'ready', grant, observation } : observation;
}
async function preparationIntent(host,contract,{taskId,role,projectRootRealpath,writeScope,operation='start'}) {
  const unavailable=requireObserved(contract.capabilities,host,'prepareIntent');
  if(unavailable)return unavailable;
  const {state:intent,expected}=await hostRequestCall(host,'prepareIntent',{taskId,requestedRole:role,projectRootRealpath,writeScope,toolOperation:operation},'preparation intent',new Set(['intent','actor','session','role','taskId','requestedRole','projectRootRealpath','writeScope','toolOperation','operationToolCall','source']));
  validateBinding(intent,'preparation intent');
  if(intent.role!==expected.requestedRole||intent.requestedRole!==expected.requestedRole||intent.taskId!==expected.taskId||intent.projectRootRealpath!==expected.projectRootRealpath||!same(intent.writeScope,expected.writeScope)||intent.toolOperation!==expected.toolOperation||intent.operationToolCall?.operation!==expected.toolOperation)throw new Error('preparation intent does not bind the exact task, role, project, operation and write scope');
  return {status:'ready',intent};
}
function dispatchReady(journal, capabilities, taskId, role) {
  return role === 'integrator' ? replay(journal).tasks[taskId]?.status === 'reviewed' : readyWave(journal, capabilities, role).selected.includes(taskId);
}
const dispatchState = role => role === 'executor' ? 'executing' : role === 'reviewer' ? 'reviewing' : 'integrating';
const reviewSnapshotIdentity = value => value && ({
  revision: value.revision,
  changedFiles: [...(value.changedFiles ?? [])].sort(),
  scopeFingerprint: value.scopeFingerprint,
});
async function frozenSnapshot(host, contract, request, expectedWorkspace, phase) {
  const unavailable = requireObserved(contract.capabilities, host, 'snapshot');
  if (unavailable) return unavailable;
  const {state:snapshot,expected}=await hostRequestCall(host,'snapshot',request,'host snapshot',new Set(['revision','changedFiles','scopeFingerprint','workspaceTransition','source']));
  if(!nonempty(snapshot.revision)||!Array.isArray(snapshot.changedFiles)||!snapshot.changedFiles.every(nonempty)||new Set(snapshot.changedFiles).size!==snapshot.changedFiles.length||!nonempty(snapshot.scopeFingerprint))throw new Error('host snapshot revision, unique changedFiles array and scopeFingerprint required');
  if(nonempty(expected.revision)&&snapshot.revision!==expected.revision)throw new Error('host snapshot revision does not match the requested current revision');
  validatePaths(snapshot.changedFiles,'host snapshot changedFiles');
  const observation = await reobserve(host, contract, expectedWorkspace, phase, { transition:snapshot.workspaceTransition, operation:'snapshot', allowedPaths:[] });
  return observation.status === 'ready' ? { status: 'ready', snapshot, observation } : observation;
}
async function cancelStandby(host,capabilities,prepared,{role,reservationRetained=false,binding}={}){
  const unavailable=requireObserved(capabilities,host,'cancelPrepared');
  if(unavailable)return {...unavailable,reservationRetained,session:prepared?.session??null};
  let leased;
  try{leased=await runLeased(host,capabilities,'cancelPrepared',{...binding,actor:binding?.actor??prepared?.session,session:binding?.session??prepared?.session,role},()=>host.cancelPrepared(prepared));}
  catch(error){return {status:'transport_error',outcome:'transport_error',reservationRetained,session:prepared?.session??null,error:error.message};}
  if(leased.status!=='ready')return {...leased,reservationRetained,session:prepared?.session??null};
  const result=await hostOwned(host,leased.value,'prepared cancellation',new Set(['cancelled','session','source']));
  if(result.cancelled!==true||(result.session!==undefined&&result.session!==prepared.session))throw new Error('prepared cancellation does not match standby session');
  return {status:'cancelled',reservationRetained:false,session:prepared.session};
}

async function preserveAmbiguousPreparation({error,host,store,loadTasks,taskId,role,state,contract,snapshot=null,forbiddenSessions=[]}) {
  const ambiguity=error?.leaseAmbiguity;
  if(!ambiguity?.invoked)return null;
  const identityJournal=store.read(),used=reservedIdentities(identityJournal);
  const boundActor=nonempty(ambiguity.binding?.actor)&&!used.has(ambiguity.binding.actor)&&!forbiddenSessions.includes(ambiguity.binding.actor)?ambiguity.binding.actor:null;
  const boundSession=nonempty(ambiguity.binding?.session)&&!used.has(ambiguity.binding.session)&&!forbiddenSessions.includes(ambiguity.binding.session)?ambiguity.binding.session:null;
  let prepared=null,identityReserved=false;
  if(ambiguity.completed&&ambiguity.value&&typeof ambiguity.value==='object'){
    try {
      const candidate={...ambiguity.value,source:ambiguity.value.source??ambiguity.value.context?.source};
      prepared=clone(await hostOwned(host,candidate,'ambiguous prepared session',new Set(['session','context','preparedOnly','toolCall','process','source'])));
      if(prepared.context)prepared.context=clone(await hostOwned(host,prepared.context,'ambiguous prepared context',new Set(['fresh','inheritedHistory','source'])));
      const invalid=!nonempty(prepared.session)||prepared.session!==ambiguity.binding?.session||prepared.session===state.context.coordinator||forbiddenSessions.includes(prepared.session)||prepared.preparedOnly!==true||
        prepared.toolCall!==undefined||prepared.process!==undefined||prepared.context?.fresh!==true||prepared.context?.inheritedHistory!==false||!nonempty(prepared.context?.source);
      if(invalid)prepared=null;
    } catch {
      prepared=null;
    }
  }
  if(boundActor&&boundSession){
    try {
      const journal=store.read();assertCurrentPlan(journal,loadTasks());
      if(dispatchReady(journal,contract.capabilities.runtime,taskId,role)){
        const context={...(prepared?clone(prepared.context):{fresh:false,inheritedHistory:true,source:'ambiguous-prepare'}),reservedActor:boundActor,workspaceSnapshotBefore:clone(contract.workspace),...(snapshot?{reviewSnapshot:clone(snapshot)}:{})};
        store.append({type:'dispatch',taskId,role,session:boundSession,context,capabilities:contract.capabilities.runtime},replay(journal).sequence);
        identityReserved=true;
      }
    } catch {
      identityReserved=false;
    }
  }
  return manual('prepare capability lease receipt is invalid after invocation; standby state is ambiguous',{
    outcome:'ambiguous_prepare',reservationRetained:true,session:boundSession,identityReserved,error:error.message,
  });
}

// Preparation is standby-only. Only start may release a reserved non-root worker.
async function hostDispatchInternal({ store, loadTasks, host, taskId, role }) {
  let journal = store.read();
  assertCurrentPlan(journal, loadTasks());
  const state = replay(journal),workspaceResolution=await expectedWorkspaceFrom(host,journal);
  if(workspaceResolution.status!=='ready')return workspaceResolution;
  const expectedWorkspace=workspaceResolution.workspace;
  if (!['executor', 'reviewer', 'integrator'].includes(role)) throw new Error(`unsupported worker role ${role}`);
  let contract = await observeHostContract(host, { expectedWorkspace, coordinator: state.context.coordinator, phase: 'dispatch-preflight' });
  if (contract.status !== 'ready') return contract;
  for (const operation of ['prepareIntent','prepare','start','persistStartState']) { const unavailable = requireObserved(contract.capabilities, host, operation); if (unavailable) return unavailable; }
  if (!dispatchReady(journal, contract.capabilities.runtime, taskId, role)) throw new Error('task is not ready for the requested role');
  const taskWrite=loadTasks().find(task=>task.id===taskId)?.write;validatePaths(taskWrite,'task write scope');
  const operationWrite=['reviewer','verifier'].includes(role)?[]:taskWrite;
  let snapshot = null;
  if (role === 'reviewer') {
    const current = replay(journal).tasks[taskId];
    const revision = current.status === 'delivered' ? current.receipt?.revision : current.receipt?.integrationRevision;
    const frozen = await frozenSnapshot(host, contract, { target: 'review', taskId, revision, writeScope:[],phase: 'before-review' }, expectedWorkspace, 'post-review-snapshot');
    if (frozen.status !== 'ready') return frozen;
    snapshot = frozen.snapshot;contract={...contract,capabilities:frozen.observation.capabilities};
  }
  const reservedIntent=await preparationIntent(host,contract,{taskId,role,projectRootRealpath:expectedWorkspace.projectRootRealpath,writeScope:operationWrite});
  if(reservedIntent.status!=='ready')return reservedIntent;
  const usedIdentities=reservedIdentities(journal);
  if([reservedIntent.intent.actor,reservedIntent.intent.session].some(identity=>usedIdentities.has(identity)))throw new Error('preparation intent must reserve fresh actor and session identities distinct from coordinator and prior roles');
  const operationBinding={...clone(reservedIntent.intent),context:state.context};
  const authorized = await authorize(host, contract, 'dispatch', operationBinding, expectedWorkspace, 'post-authorize');
  if (authorized.status !== 'ready') return authorized;
  contract={...contract,capabilities:authorized.observation.capabilities};
  let preparation;
  try{preparation=await runLeased(host,contract.capabilities,'prepare',operationBinding,()=>host.prepare({ taskId, role, intent:clone(reservedIntent.intent), purpose: role === 'integrator' ? 'integration' : role === 'reviewer' ? 'review' : 'implementation' }));}
  catch(error){return await preserveAmbiguousPreparation({error,host,store,loadTasks,taskId,role,state,contract,snapshot})??{status:'transport_error',outcome:'transport_error',reservationRetained:false,error:error.message};}
  if(preparation.status!=='ready')return {...preparation,reservationRetained:false};
  let prepared = preparation.value;
  const preparedObservation={...prepared,source:prepared?.source??prepared?.context?.source};
  prepared=clone(await hostOwned(host, preparedObservation, 'prepared session', new Set(['session', 'context', 'preparedOnly', 'toolCall', 'process', 'source'])));
  if (prepared?.context) prepared.context=clone(await hostOwned(host, prepared.context, 'prepared context', new Set(['fresh', 'inheritedHistory', 'source'])));
  const invalidPrepared = !nonempty(prepared?.session) || prepared.session!==reservedIntent.intent.session || prepared.session === state.context.coordinator || prepared.preparedOnly !== true ||
    prepared.toolCall !== undefined || prepared.process !== undefined || prepared.context?.fresh !== true || prepared.context?.inheritedHistory !== false || !nonempty(prepared.context?.source);
  if (invalidPrepared) {
    const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role,reservationRetained:true,binding:operationBinding});
    if(cancellation.status!=='cancelled')return cancellation;
    throw new Error('host prepare must attest a fresh standby-only session without project work');
  }
  let reserved=false,startRequest=null,startWorkspaceBefore=null;
  try {
    const afterPrepare = await reobserve(host, contract, expectedWorkspace, 'post-prepare');
    if (afterPrepare.status !== 'ready') { const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role,reservationRetained:true,binding:operationBinding});return cancellation.status==='cancelled'?afterPrepare:cancellation; }
    contract={...contract,capabilities:afterPrepare.capabilities};
    journal = store.read(); assertCurrentPlan(journal, loadTasks());
    if (!dispatchReady(journal, contract.capabilities.runtime, taskId, role)) throw new Error('task is no longer ready');
    startWorkspaceBefore=clone(afterPrepare.workspace);
    const requested=await persistStartState(host,contract.capabilities,'requested',operationBinding,{workspaceBefore:startWorkspaceBefore});
    if(requested.status!=='ready'){const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role,reservationRetained:true,binding:operationBinding});return cancellation.status==='cancelled'?requested:cancellation;}
    startRequest=clone(requested.state);
    const context = { ...clone(prepared.context), reservedActor:operationBinding.actor, workspaceSnapshotBefore: clone(afterPrepare.workspace), startRequest, ...(snapshot ? { reviewSnapshot: clone(snapshot) } : {}) };
    store.append({ type: 'dispatch', taskId, role, session: prepared.session, context, capabilities: contract.capabilities.runtime }, replay(journal).sequence);
    reserved=true;
    const freshAuthorization = await authorize(host, contract, 'start', { ...operationBinding,context:replay(store.read()).context }, expectedWorkspace, 'pre-start');
    if (freshAuthorization.status !== 'ready') return {...freshAuthorization,reservationRetained:true,session:prepared.session};
    contract={...contract,capabilities:freshAuthorization.observation.capabilities};
    journal = store.read(); assertCurrentPlan(journal, loadTasks());
  } catch (error) {
    if(!reserved){const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role,reservationRetained:true,binding:operationBinding});if(cancellation.status!=='cancelled')return cancellation;}
    throw error;
  }
  journal = store.read(); assertCurrentPlan(journal, loadTasks());
  const current = replay(journal);
  if (current.paused) throw new Error('host start paused; reservation retained');
  if (current.tasks[taskId]?.status !== dispatchState(role)) throw new Error('host task state changed; reservation retained');
  if (current.tasks[taskId]?.operationBlocks?.[role]) throw new Error('host start blocked; reservation retained');
  const packet = packetFor(journal, taskId);
  if (packet.assignment.session !== prepared.session || packet.assignment.role !== role) throw new Error('host assignment changed; reservation retained');
  let startObservation;
  try { const launched=await runLeased(host,contract.capabilities,'start',operationBinding,()=>host.start(prepared, packet));if(launched.status!=='ready')return {...launched,reservationRetained:true,session:prepared.session,startState:'requested'};startObservation=launched.value; }
  catch (error) { const ambiguity=await markStartAmbiguous(host,contract.capabilities,operationBinding,startRequest,startWorkspaceBefore);return {status:'transport_error',outcome:'transport_error',reservationRetained:true,session:prepared.session,startState:ambiguity.status==='ready'?'ambiguous':'pending_or_ambiguous',error:error.message}; }
  startObservation=await hostOwned(host, startObservation, 'start observation', new Set(['session', 'toolCall', 'workspaceTransition', 'source']));
  if (startObservation.session !== prepared.session || !nonempty(startObservation.toolCall)) throw new Error('host start requires matching session, tool-call evidence and provenance; reservation retained');
  validateOperationToolCall(startObservation.toolCall,startObservation.workspaceTransition,{operation:'start',actor:operationBinding.actor,session:prepared.session,role,reservedToolCall:operationBinding.operationToolCall});
  const afterStart = await reobserve(host, contract, expectedWorkspace, 'post-start', { transition:startObservation.workspaceTransition, operation:'start', allowedPaths:operationBinding.writeScope });
  if (afterStart.status !== 'ready') {await markStartAmbiguous(host,contract.capabilities,operationBinding,startRequest,startWorkspaceBefore);return { ...afterStart, reservationRetained: true, session: prepared.session,startState:'ambiguous' };}
  let observedStart;try{observedStart=await persistStartState(host,afterStart.capabilities,'observed',operationBinding,{requestId:startRequest.requestId,workspaceBefore:startWorkspaceBefore,workspace:afterStart.workspace});}
  catch(error){return {status:'transport_error',outcome:'transport_error',reservationRetained:true,session:prepared.session,startState:'pending',error:error.message};}
  if(observedStart.status!=='ready')return {...observedStart,reservationRetained:true,session:prepared.session,startState:'pending'};
  return { status: 'started', started: true, session: prepared.session, observation: clone(startObservation), workspace: clone(afterStart.workspace), planRevision: packet.planRevision, sequence: packet.sequence };
}
export async function hostDispatch(args){return immutable(await hostDispatchInternal(args));}

async function hostObserveStopInternal({ host, session, expectedWorkspace, coordinator, assignment, interrupt = false, reason = 'stop requested' }) {
  closed(assignment,new Set(['actor','session','role','writeScope']),'stop assignment');
  if(!nonempty(session)||![assignment.actor,assignment.session,assignment.role].every(nonempty)||assignment.session!==session||
    !['executor','integrator','reviewer','verifier'].includes(assignment.role)||!Array.isArray(assignment.writeScope)||!assignment.writeScope.every(nonempty)||
    (['reviewer','verifier'].includes(assignment.role)&&assignment.writeScope.length))throw new Error('stop assignment requires complete actor/session/role identity and exact write scope; reviewer/verifier have zero write scope');
  validatePaths(assignment.writeScope,'stop assignment writeScope');
  let contract = await observeHostContract(host, { expectedWorkspace, coordinator, phase: 'stop-preflight' });
  if (contract.status !== 'ready') return contract;
  let cancellation = null;
  if (interrupt) {
    const unavailable = requireObserved(contract.capabilities, host, 'interrupt'); if (unavailable) return unavailable;
    const operationBinding={actor:assignment.actor,session:assignment.session,role:assignment.role,projectRootRealpath:expectedWorkspace.projectRootRealpath,taskId:`session:${session}`,requestedRole:assignment.role,writeScope:assignment.writeScope,intent:`stop:${session}`,reason};
    const authorized=await authorize(host,contract,'interrupt',operationBinding,expectedWorkspace,'pre-interrupt');
    if(authorized.status!=='ready')return authorized;
    contract={...contract,capabilities:authorized.observation.capabilities};
    let leased;
    try { leased=await runLeased(host,contract.capabilities,'interrupt',operationBinding,()=>host.interrupt({ session, reason })); }
    catch (error) { return { status: 'transport_error', stopped: false, outcome: 'transport_error', session, error: error.message }; }
    if(leased.status!=='ready')return {...leased,stopped:false,session};
    cancellation = await hostOwned(host, leased.value, 'interrupt observation', new Set(['requested', 'session', 'workspaceTransition', 'source']));
    if(cancellation.requested!==true||(cancellation.session!==undefined&&cancellation.session!==session))throw new Error('interrupt observation must confirm the requested session');
    const observed = await reobserve(host, contract, expectedWorkspace, 'post-interrupt', { transition:cancellation.workspaceTransition, operation:'interrupt', allowedPaths:[] }); if (observed.status !== 'ready') return observed;
    contract={...contract,capabilities:observed.capabilities};
  }
  const unavailable = requireObserved(contract.capabilities, host, 'observeStop'); if (unavailable) return unavailable;
  let rawObservation;
  try {
    rawObservation = await host.observeStop({ session });
  } catch (error) {
    return { status: 'transport_error', stopped: false, outcome: 'transport_error', session, cancellation: clone(cancellation), error: error.message };
  }
  const observation = await hostOwned(host, rawObservation, 'stop observation', new Set(['session', 'stopped', 'outcome', 'reason', 'toolCall', 'toolResult', 'process', 'processExit', 'sessionState', 'workspaceTransition', 'source']));
  const outcomes=new Set(['completed','cancelled','failed','stopped','running','cancel_requested']);
  if (observation.session !== session || typeof observation.stopped !== 'boolean' || !outcomes.has(observation.outcome) ||
    (observation.stopped&&!['completed','cancelled','failed','stopped'].includes(observation.outcome))||(!observation.stopped&&!['running','cancel_requested'].includes(observation.outcome))||
    (observation.reason!==undefined&&!nonempty(observation.reason))||(observation.toolCall!==undefined&&!nonempty(observation.toolCall))||
    (observation.processExit!==undefined&&!Number.isInteger(observation.processExit))||
    (observation.sessionState!==undefined&&!['running','stopped','failed','cancelled','completed'].includes(observation.sessionState))) throw new Error('invalid stop outcome or evidence schema');
  if(observation.toolResult!==undefined){const tool=closed(observation.toolResult,new Set(['status','exitCode','source']),'stop tool result');if(!['completed','failed'].includes(tool.status)||(tool.exitCode!==undefined&&!Number.isInteger(tool.exitCode))||!nonempty(tool.source))throw new Error('invalid stop tool result schema');}
  if(observation.process!==undefined){const process=closed(observation.process,new Set(['id','state','exitCode','source']),'stop process');if(!nonempty(process.id)||!['running','stopped','failed','completed','cancelled'].includes(process.state)||(process.exitCode!==undefined&&!Number.isInteger(process.exitCode))||!nonempty(process.source))throw new Error('invalid stop process schema');}
  const allowedPaths=assignment.role==='reviewer'||assignment.role==='verifier'?[]:assignment.writeScope;
  const observed = await reobserve(host, contract, expectedWorkspace, 'post-stop', { transition:observation.workspaceTransition, operation:'stop', allowedPaths }); if (observed.status !== 'ready') return observed;
  return { status: observation.stopped ? 'stopped' : interrupt ? 'cancel_requested' : 'running', cancellation: clone(cancellation), ...clone(observation), workspace: clone(observed.workspace) };
}
export async function hostObserveStop(args){return immutable(await hostObserveStopInternal(args));}

async function hostCompleteReviewInternal({ store, loadTasks, host, taskId, result }) {
  let journal = store.read(); assertCurrentPlan(journal, loadTasks());
  const state = replay(journal), active = state.tasks[taskId]?.active;
  if (active?.role !== 'reviewer') throw new Error('active reviewer required');
  const workspaceResolution=await expectedWorkspaceFrom(host,journal);
  if(workspaceResolution.status!=='ready')return workspaceResolution;
  const expectedWorkspace=workspaceResolution.workspace;
  const stopActor=active.context?.reservedActor??active.session;
  const stop = await hostObserveStop({ host, session: active.session, expectedWorkspace, coordinator: state.context.coordinator, assignment:{actor:stopActor,session:active.session,role:'reviewer',writeScope:[]} });
  if (['manual_handoff_required', 'transport_error'].includes(stop.status)) return stop;
  if (stop.session !== active.session || stop.stopped !== true || stop.outcome !== 'completed') throw new Error('host must confirm matching completed reviewer stop');
  const contract = await observeHostContract(host, { expectedWorkspace, coordinator: state.context.coordinator, phase: 'review-completion' });
  if (contract.status !== 'ready') return contract;
  const after = await frozenSnapshot(host, contract, { target: 'review', taskId, revision: result.revision, writeScope:[],phase: 'after-review' }, expectedWorkspace, 'post-review-completion-snapshot');
  if (after.status !== 'ready') return after;
  const before = active.reviewBoundary?.snapshotBefore;
  if (!before || !same(reviewSnapshotIdentity(before), reviewSnapshotIdentity(after.snapshot))) throw new Error('review snapshot drift detected');
  journal = store.read(); assertCurrentPlan(journal, loadTasks());
  const current = replay(journal);
  if (current.tasks[taskId]?.active?.session !== active.session) throw new Error('review assignment changed before completion');
  return replay(store.append({ type: 'reviewResult', taskId, session: active.session, stopped: true, revision: result.revision,
    verdict: result.verdict, findings: result.findings, evidence: result.evidence, snapshotAfter: clone(after.snapshot) }, current.sequence));
}
export async function hostCompleteReview(args){return immutable(await hostCompleteReviewInternal(args));}

async function hostDispatchVerifierInternal({store,loadTasks,host}) {
  let journal=store.read();assertCurrentPlan(journal,loadTasks());
  const state=replay(journal),workspaceResolution=await expectedWorkspaceFrom(host,journal);
  if(workspaceResolution.status!=='ready')return workspaceResolution;
  const expectedWorkspace=workspaceResolution.workspace,objective=objectiveSnapshot(journal);
  let contract=await observeHostContract(host,{expectedWorkspace,coordinator:state.context.coordinator,phase:'verifier-preflight'});
  if(contract.status!=='ready')return contract;
  for(const operation of ['snapshot','prepareIntent','prepare','start','persistStartState']){const unavailable=requireObserved(contract.capabilities,host,operation);if(unavailable)return unavailable;}
  const frozen=await frozenSnapshot(host,contract,{target:'objective',revision:objective.objectiveRevision,writeScope:[],phase:'before-objective-verification'},expectedWorkspace,'post-objective-snapshot');
  if(frozen.status!=='ready')return frozen;
  contract={...contract,capabilities:frozen.observation.capabilities};
  const taskId=`objective:${objective.objectiveRevision}`,role='verifier';
  const reservedIntent=await preparationIntent(host,contract,{taskId,role,projectRootRealpath:expectedWorkspace.projectRootRealpath,writeScope:[]});
  if(reservedIntent.status!=='ready')return reservedIntent;
  const usedIdentities=reservedIdentities(journal);
  if([reservedIntent.intent.actor,reservedIntent.intent.session].some(identity=>usedIdentities.has(identity)))throw new Error('objective verifier intent must reserve fresh actor and session identities distinct from coordinator and prior roles');
  const operationBinding={...clone(reservedIntent.intent),context:state.context};
  const authorized=await authorize(host,contract,'dispatchVerifier',operationBinding,expectedWorkspace,'post-verifier-authorize');
  if(authorized.status!=='ready')return authorized;
  contract={...contract,capabilities:authorized.observation.capabilities};
  let preparation;
  try{preparation=await runLeased(host,contract.capabilities,'prepare',operationBinding,()=>host.prepare({role,purpose:'objective',objective:clone(objective),intent:clone(reservedIntent.intent)}));}
  catch(error){return manual('objective verifier preparation may have executed with an invalid lease receipt',{outcome:'ambiguous_prepare',reservationRetained:Boolean(error.leaseAmbiguity?.invoked),session:error.leaseAmbiguity?.binding?.session??null,error:error.message});}
  if(preparation.status!=='ready')return {...preparation,reservationRetained:false};
  let prepared=preparation.value;
  const preparedObservation={...prepared,source:prepared?.source??prepared?.context?.source};
  prepared=clone(await hostOwned(host,preparedObservation,'prepared verifier session',new Set(['session','context','preparedOnly','toolCall','process','source'])));
  if(prepared.context)prepared.context=clone(await hostOwned(host,prepared.context,'prepared verifier context',new Set(['fresh','inheritedHistory','source'])));
  if(prepared.session!==reservedIntent.intent.session||prepared.preparedOnly!==true||prepared.toolCall!==undefined||prepared.process!==undefined||prepared.context?.fresh!==true||prepared.context?.inheritedHistory!==false){
    const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role,reservationRetained:true,binding:operationBinding});if(cancellation.status!=='cancelled')return cancellation;
    throw new Error('objective verifier prepare must attest its fresh standby-only reserved identity');
  }
  const afterPrepare=await reobserve(host,contract,expectedWorkspace,'post-verifier-prepare');
  if(afterPrepare.status!=='ready'){const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role,reservationRetained:true,binding:operationBinding});return cancellation.status==='cancelled'?afterPrepare:cancellation;}
  contract={...contract,capabilities:afterPrepare.capabilities};
  journal=store.read();assertCurrentPlan(journal,loadTasks());const currentObjective=objectiveSnapshot(journal);
  if(currentObjective.objectiveRevision!==objective.objectiveRevision)throw new Error('objective changed before verifier reservation');
  const startWorkspaceBefore=clone(afterPrepare.workspace);
  const requested=await persistStartState(host,contract.capabilities,'requested',operationBinding,{workspaceBefore:startWorkspaceBefore});
  if(requested.status!=='ready')return requested;
  const startRequest=clone(requested.state);
  const context={...clone(prepared.context),reservedActor:operationBinding.actor,workspaceSnapshotBefore:clone(afterPrepare.workspace),startRequest,objectiveSnapshot:clone(objective),reviewSnapshot:clone(frozen.snapshot)};
  store.append({type:'dispatch',role,session:prepared.session,capabilities:contract.capabilities.runtime,context,objectiveRevision:objective.objectiveRevision},replay(journal).sequence);
  const startAuthorization=await authorize(host,contract,'startVerifier',{...operationBinding,context:replay(store.read()).context},expectedWorkspace,'pre-verifier-start');
  if(startAuthorization.status!=='ready')return {...startAuthorization,reservationRetained:true,session:prepared.session};
  contract={...contract,capabilities:startAuthorization.observation.capabilities};
  const packet={version:1,objective:clone(objective),task:{id:taskId,write:[]},assignment:{role,session:prepared.session,writeScope:[]},coordinator:state.context.coordinator,executionAuthorized:false};
  let launched,insideLeaseCapabilities=contract.capabilities;
  try{launched=await runLeased(host,contract.capabilities,'start',operationBinding,async assertLeaseUnchanged=>{
    const insideLease=await reobserve(host,contract,expectedWorkspace,'inside-verifier-start-lease');
    if(insideLease.status!=='ready')throw new Error(`verifier start lease lost host boundary: ${insideLease.reason??insideLease.status}`);
    insideLeaseCapabilities=insideLease.capabilities;
    const latestJournal=store.read();assertCurrentPlan(latestJournal,loadTasks());const latest=replay(latestJournal);
    if(latest.paused||latest.objectiveVerifier?.session!==prepared.session||latest.objectiveVerifier?.invalidated||latest.objectiveVerifier?.stopRequested||latest.objectiveVerifier?.objectiveRevision!==objective.objectiveRevision)throw new Error('objective verifier changed, paused or invalidated immediately before start');
    assertLeaseUnchanged();
    return host.start(prepared,packet);
  });}
  catch(error){const ambiguity=await markStartAmbiguous(host,insideLeaseCapabilities,operationBinding,startRequest,startWorkspaceBefore);return {status:'transport_error',outcome:'transport_error',reservationRetained:true,session:prepared.session,startState:ambiguity.status==='ready'?'ambiguous':'pending_or_ambiguous',error:error.message};}
  if(launched.status!=='ready')return {...launched,reservationRetained:true,session:prepared.session,startState:'requested'};
  contract={...contract,capabilities:insideLeaseCapabilities};
  const startObservation=await hostOwned(host,launched.value,'verifier start observation',new Set(['session','toolCall','workspaceTransition','source']));
  if(startObservation.session!==prepared.session)throw new Error('objective verifier start session does not match its reservation');
  validateOperationToolCall(startObservation.toolCall,startObservation.workspaceTransition,{operation:'start',actor:operationBinding.actor,session:prepared.session,role,reservedToolCall:operationBinding.operationToolCall});
  const afterStart=await reobserve(host,contract,expectedWorkspace,'post-verifier-start',{transition:startObservation.workspaceTransition,operation:'start',allowedPaths:[]});
  if(afterStart.status!=='ready'){await markStartAmbiguous(host,contract.capabilities,operationBinding,startRequest,startWorkspaceBefore);return {...afterStart,reservationRetained:true,session:prepared.session,startState:'ambiguous'};}
  let observedStart;try{observedStart=await persistStartState(host,afterStart.capabilities,'observed',operationBinding,{requestId:startRequest.requestId,workspaceBefore:startWorkspaceBefore,workspace:afterStart.workspace});}
  catch(error){return {status:'transport_error',outcome:'transport_error',reservationRetained:true,session:prepared.session,startState:'pending',error:error.message};}
  if(observedStart.status!=='ready')return {...observedStart,reservationRetained:true,session:prepared.session,startState:'pending'};
  return {status:'started',started:true,role,session:prepared.session,objectiveRevision:objective.objectiveRevision,observation:clone(startObservation),workspace:clone(afterStart.workspace)};
}
export async function hostDispatchVerifier(args){return immutable(await hostDispatchVerifierInternal(args));}

const OBJECTIVE_RECEIPT_KEYS=new Set(['schemaVersion','status','kind','token','source','actor','session','role','objectiveRevision','journalSequence','resultDigest','resultObservationDigest','evidenceDigest','stopDigest','workspaceDigest','snapshotDigest','priorSnapshotDigest']);
function objectiveResult(result){
  closed(result,new Set(['verdict','outcome','checks','evidence','limitations','remainingWork']),'objective verifier result');
  if(!['pass','fail'].includes(result.verdict)||!nonempty(result.outcome)||!result.checks||typeof result.checks!=='object'||Array.isArray(result.checks)||
    !['originalRequest','taskCoverage','integratedBehavior','authority'].every(key=>nonempty(result.checks[key]))||
    !Array.isArray(result.evidence)||!result.evidence.length||!result.evidence.every(nonempty)||
    !Array.isArray(result.limitations)||!result.limitations.every(nonempty)||!Array.isArray(result.remainingWork)||!result.remainingWork.every(nonempty))throw new Error('objective verifier result requires verdict, checks, evidence, limitations and remaining work');
  if(result.verdict==='pass'?result.remainingWork.length!==0:result.remainingWork.length===0)throw new Error('objective verifier result remaining work does not match verdict');
  return clone(result);
}
async function hostCompleteVerifierInternal({store,loadTasks,host,result:callerResult}) {
  let journal=store.read();assertCurrentPlan(journal,loadTasks());
  const state=replay(journal),active=state.objectiveVerifier;
  if(active?.role!=='verifier'||!nonempty(active.session)||!nonempty(active.context?.reservedActor))throw new Error('active host-dispatched verifier assignment required');
  const objectiveRevision=active.objectiveRevision;
  if(objectiveRevision!==currentObjectiveRevision(journal))throw new Error('stale objective revision before verifier completion');
  const workspaceResolution=await expectedWorkspaceFrom(host,journal);if(workspaceResolution.status!=='ready')return workspaceResolution;
  const expectedWorkspace=workspaceResolution.workspace;
  const stop=await hostObserveStop({host,session:active.session,expectedWorkspace,coordinator:state.context.coordinator,
    assignment:{actor:active.context.reservedActor,session:active.session,role:'verifier',writeScope:[]}});
  if(['manual_handoff_required','transport_error'].includes(stop.status))return stop;
  if(stop.session!==active.session||stop.stopped!==true||stop.outcome!=='completed')throw new Error('host must confirm matching completed verifier stop');
  let contract=await observeHostContract(host,{expectedWorkspace,coordinator:state.context.coordinator,phase:'verifier-completion'});
  if(contract.status!=='ready')return contract;
  for(const operation of ['observeVerifierResult','persistEvidence']){const unavailable=requireObserved(contract.capabilities,host,operation);if(unavailable)return unavailable;}
  const after=await frozenSnapshot(host,contract,{target:'objective',revision:objectiveRevision,writeScope:[],phase:'after-objective-verification'},expectedWorkspace,'post-objective-verification-snapshot');
  if(after.status!=='ready')return after;
  const before=active.context?.reviewSnapshot;
  if(!before||!same(reviewSnapshotIdentity(before),reviewSnapshotIdentity(after.snapshot)))throw new Error('objective verifier snapshot drift detected');
  journal=store.read();assertCurrentPlan(journal,loadTasks());const current=replay(journal),currentActive=current.objectiveVerifier;
  if(currentActive?.session!==active.session||currentActive.objectiveRevision!==objectiveRevision||currentActive.invalidated||currentActive.stopRequested||current.paused)throw new Error('verifier assignment or objective changed before completion');
  if(objectiveRevision!==currentObjectiveRevision(journal))throw new Error('stale objective revision at verifier completion');
  const observedEnvelope=clone(await hostOwned(host,await host.observeVerifierResult({session:active.session,actor:active.context.reservedActor,
    role:'verifier',objectiveRevision,journalSequence:current.sequence}),'objective verifier result observation',
    new Set(['session','actor','role','objectiveRevision','journalSequence','result','source'])));
  if(observedEnvelope.session!==active.session||observedEnvelope.actor!==active.context.reservedActor||observedEnvelope.role!=='verifier'||
    observedEnvelope.objectiveRevision!==objectiveRevision||observedEnvelope.journalSequence!==current.sequence)throw new Error('host-observed verifier result does not bind the active assignment and objective revision');
  const verifiedResult=objectiveResult(observedEnvelope.result);
  if(callerResult!==undefined&&!same(objectiveResult(callerResult),verifiedResult))throw new Error('caller-provided verifier result does not match the host-observed result');
  const resultDigest=digest(verifiedResult),request={schemaVersion:'asds.objective-verification-evidence/1',kind:'objective-verification',status:'closed',
    actor:active.context.reservedActor,session:active.session,role:'verifier',objectiveRevision,journalSequence:current.sequence,resultDigest,
    resultObservationDigest:digest(observedEnvelope),evidenceDigest:digest(verifiedResult.evidence),stopDigest:digest(stop),workspaceDigest:digest(after.observation.workspace),snapshotDigest:digest(after.snapshot),priorSnapshotDigest:digest(before)};
  const binding={actor:request.actor,session:request.session,role:'verifier',projectRootRealpath:expectedWorkspace.projectRootRealpath,
    taskId:`objective:${objectiveRevision}`,requestedRole:'verifier',writeScope:[],intent:`completeVerifier:${objectiveRevision}`};
  const authorized=await authorize(host,{...contract,capabilities:after.observation.capabilities},'completeVerifier',binding,expectedWorkspace,'pre-verifier-completion');
  if(authorized.status!=='ready')return authorized;
  const persisted=await runLeased(host,authorized.observation.capabilities,'persistEvidence',binding,()=>host.persistEvidence(clone(request)));
  if(persisted.status!=='ready')return persisted;
  const receipt=await hostOwned(host,persisted.value,'objective verification receipt',OBJECTIVE_RECEIPT_KEYS);
  for(const [key,value] of Object.entries(request))if(key!=='schemaVersion'&&key!=='status'&&key!=='kind'&&!same(receipt[key],value))throw new Error(`objective verification receipt does not bind ${key}`);
  if(receipt.schemaVersion!=='asds.objective-verification-receipt/1'||receipt.status!=='closed'||receipt.kind!=='objective-verification'||!nonempty(receipt.token)||!nonempty(receipt.source)||receipt.source==='caller')throw new Error('objective verification receipt must be closed and host-owned');
  const afterReceipt=await reobserve(host,{...contract,capabilities:authorized.observation.capabilities},expectedWorkspace,'post-verifier-receipt');
  if(afterReceipt.status!=='ready')return afterReceipt;
  journal=store.read();assertCurrentPlan(journal,loadTasks());const latest=replay(journal);
  if(latest.objectiveVerifier?.session!==active.session||latest.objectiveVerifier.objectiveRevision!==objectiveRevision||latest.sequence!==current.sequence)throw new Error('verifier assignment changed before receipt commit');
  if(typeof store?.persistHostJournal!=='function')throw new Error('objective completion requires a host-journal persistence boundary; generic caller append is not authoritative');
  const event={type:'verifyObjective',session:active.session,stopped:true,objectiveRevision,...verifiedResult,attestation:clone(receipt)};
  const nextJournal=deriveHostObjectiveJournal(journal,event,latest.sequence);
  const persistedJournal=await store.persistHostJournal(clone(nextJournal),{expectedSequence:latest.sequence,expectedDigest:digest(journal)});
  if(!same(persistedJournal,nextJournal)||!same(store.read(),nextJournal))throw new Error('host-journal persistence did not return and read back the exact derived journal');
  rememberObjectiveAuthority(host,nextJournal,receipt);
  return authoritativeObjectiveStatus({journal:nextJournal,host});
}
export async function hostCompleteVerifier(args){return immutable(await hostCompleteVerifierInternal(args));}

export function authoritativeObjectiveStatus({journal,host}) {
  const state=replay(journal),verification=state.objectiveVerification;
  if(!verification)return immutable({status:'not_verified',disposition:'blocked',objectiveComplete:false,state});
  if(!hasObjectiveAuthority(host,journal))return immutable({status:'await_host_reobservation',disposition:'await_host_reobservation',objectiveComplete:false,state});
  const disposition=verification.verdict==='pass'?'complete':state.context.executionScope.excludedTaskIds.length?'partial_consumed':'objective_blocked';
  return immutable({status:disposition,disposition,objectiveComplete:verification.verdict==='pass',objectiveVerification:clone(verification),state});
}

export async function hostReobserveObjectiveCompletion({store,loadTasks,host}) {
  const journal=store.read();assertCurrentPlan(journal,loadTasks());
  const state=replay(journal),verification=state.objectiveVerification,receipt=verification?.attestation;
  if(!verification||!receipt)return authoritativeObjectiveStatus({journal,host});
  const workspaceResolution=await expectedWorkspaceFrom(host,journal);if(workspaceResolution.status!=='ready')return workspaceResolution;
  const contract=await observeHostContract(host,{expectedWorkspace:workspaceResolution.workspace,coordinator:state.context.coordinator,phase:'objective-reobservation'});
  if(contract.status!=='ready')return contract;
  const unavailable=requireObserved(contract.capabilities,host,'observeObjectiveVerificationReceipt');if(unavailable)return unavailable;
  const request={token:receipt.token,objectiveRevision:receipt.objectiveRevision,journalSequence:receipt.journalSequence,receiptDigest:digest(receipt)};
  const observed=await hostOwned(host,await host.observeObjectiveVerificationReceipt(clone(request)),'objective verification receipt reobservation',new Set([...OBJECTIVE_RECEIPT_KEYS,'receiptDigest']));
  if(observed.receiptDigest!==request.receiptDigest||!same({...observed,receiptDigest:undefined},{...receipt,receiptDigest:undefined}))throw new Error('host reobservation did not return the exact persisted objective receipt');
  if(!same(store.read(),journal))throw new Error('journal changed during objective receipt reobservation');
  rememberObjectiveAuthority(host,journal,receipt);
  return authoritativeObjectiveStatus({journal,host});
}

async function hostIntegrateInternal({ store, loadTasks, host, taskId }) {
  let journal = store.read(); assertCurrentPlan(journal, loadTasks());
  const state = replay(journal),workspaceResolution=await expectedWorkspaceFrom(host,journal);
  if(workspaceResolution.status!=='ready')return workspaceResolution;
  const expectedWorkspace=workspaceResolution.workspace;
  if (state.tasks[taskId]?.status !== 'reviewed') throw new Error('integration requires an independently reviewed candidate');
  const candidateDigest=digest(state.tasks[taskId].receipt),objectiveGeneration=state.objectiveGeneration;
  let contract = await observeHostContract(host, { expectedWorkspace, coordinator: state.context.coordinator, phase: 'integration-preflight' });
  if (contract.status !== 'ready') return contract;
  if (!operationObserved(contract.capabilities, 'integrate') || typeof host.integrate !== 'function') {
    const dispatched = await hostDispatch({ store, loadTasks, host, taskId, role: 'integrator' });
    return dispatched.status === 'manual_handoff_required' ? dispatched : { operation: 'dispatch_integrator', ...dispatched };
  }
  for(const operation of ['prepareIntent','prepare','persistIntegrationState','observeIntegrationState']){const unavailable=requireObserved(contract.capabilities,host,operation);if(unavailable)return unavailable;}
  const integrationWrite=loadTasks().find(task=>task.id===taskId)?.write;validatePaths(integrationWrite,'integration write scope');
  const reservedIntent=await preparationIntent(host,contract,{taskId,role:'integrator',projectRootRealpath:expectedWorkspace.projectRootRealpath,writeScope:integrationWrite,operation:'integrate'});
  if(reservedIntent.status!=='ready')return reservedIntent;
  const usedIdentities=reservedIdentities(journal);
  if([reservedIntent.intent.actor,reservedIntent.intent.session].some(identity=>usedIdentities.has(identity)))throw new Error('native integration preparation intent must reserve fresh actor and session identities distinct from coordinator and prior roles');
  const operationBinding={...clone(reservedIntent.intent),context:state.context};
  let preparation;
  try{preparation=await runLeased(host,contract.capabilities,'prepare',operationBinding,()=>host.prepare({ taskId, role:'integrator', intent:clone(reservedIntent.intent),purpose:'integration', native:true }));}
  catch(error){return await preserveAmbiguousPreparation({error,host,store,loadTasks,taskId,role:'integrator',state,contract,forbiddenSessions:state.sessions})??{status:'transport_error',outcome:'transport_error',reservationRetained:false,error:error.message};}
  if(preparation.status!=='ready')return {...preparation,reservationRetained:false};
  let prepared=preparation.value;
  const preparedObservation={...prepared,source:prepared?.source??prepared?.context?.source};
  prepared=clone(await hostOwned(host, preparedObservation, 'prepared session', new Set(['session', 'context', 'preparedOnly', 'toolCall', 'process', 'source'])));
  if (prepared?.context) prepared.context=clone(await hostOwned(host, prepared.context, 'prepared context', new Set(['fresh', 'inheritedHistory', 'source'])));
  if (!nonempty(prepared?.session) || prepared.session!==reservedIntent.intent.session||prepared.session === state.context.coordinator || state.sessions.includes(prepared.session) || prepared.preparedOnly !== true ||
    prepared.toolCall !== undefined || prepared.process !== undefined || prepared.context?.fresh !== true || prepared.context?.inheritedHistory !== false) {
    const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role:'integrator',reservationRetained:true,binding:operationBinding});
    if(cancellation.status!=='cancelled')return cancellation;
    throw new Error('native integration requires a fresh distinct standby integrator session; root, worker and reviewer session reuse is forbidden');
  }
  let reserved=false,integrationRequest=null,integrationWorkspaceBefore=null;
  try {
    const afterPrepare = await reobserve(host, contract, expectedWorkspace, 'post-integration-prepare');
    if (afterPrepare.status !== 'ready') {const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role:'integrator',reservationRetained:true,binding:operationBinding});return cancellation.status==='cancelled'?afterPrepare:cancellation;}
    contract={...contract,capabilities:afterPrepare.capabilities};
    journal = store.read(); assertCurrentPlan(journal, loadTasks());
    if (replay(journal).tasks[taskId]?.status !== 'reviewed') throw new Error('integration candidate changed before native reservation');
    integrationWorkspaceBefore=clone(afterPrepare.workspace);
    const requested=await persistIntegrationState(host,contract.capabilities,'requested',operationBinding,{workspaceBefore:integrationWorkspaceBefore});
    if(requested.status!=='ready'){const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role:'integrator',reservationRetained:true,binding:operationBinding});return cancellation.status==='cancelled'?requested:cancellation;}
    integrationRequest=clone(requested.state);
    store.append({type:'dispatch',taskId,role:'integrator',session:prepared.session,context:{...clone(prepared.context),reservedActor:operationBinding.actor,workspaceSnapshotBefore:integrationWorkspaceBefore,integrationRequest},capabilities:contract.capabilities.runtime},replay(journal).sequence);
    reserved=true;
    const authorized = await authorize(host, contract, 'integrate', operationBinding, expectedWorkspace, 'pre-integrate');
    if (authorized.status !== 'ready') return {...authorized,reservationRetained:true,session:prepared.session};
    contract={...contract,capabilities:authorized.observation.capabilities};
  } catch (error) {
    if(!reserved){const cancellation=await cancelStandby(host,contract.capabilities,prepared,{role:'integrator',reservationRetained:true,binding:operationBinding});if(cancellation.status!=='cancelled')return cancellation;}
    throw error;
  }
  journal=store.read();let packet=packetFor(journal,taskId),insideLeaseCapabilities=contract.capabilities;
  let integration;
  try{integration=await runLeased(host,contract.capabilities,'integrate',operationBinding,async assertLeaseUnchanged=>{
    const insideLease=await reobserve(host,contract,expectedWorkspace,'inside-integration-lease');
    if(insideLease.status!=='ready')throw new Error(`integration lease lost host boundary: ${insideLease.reason??insideLease.status}`);
    insideLeaseCapabilities=insideLease.capabilities;
    const latestJournal=store.read();assertCurrentPlan(latestJournal,loadTasks());const latest=replay(latestJournal),current=latest.tasks[taskId];
    if(latest.paused||current?.status!=='integrating'||current.active?.session!==prepared.session||current.active?.role!=='integrator'||current.operationBlocks?.integration||digest(current.receipt)!==candidateDigest||latest.objectiveGeneration!==objectiveGeneration)throw new Error('integration assignment, candidate, objective or pause state changed immediately before integrate');
    packet=packetFor(latestJournal,taskId);
    assertLeaseUnchanged();
    return host.integrate(prepared,packet);
  });}
  catch(error){const ambiguity=await markIntegrationAmbiguous(host,insideLeaseCapabilities,operationBinding,integrationRequest,integrationWorkspaceBefore);return {status:'transport_error',outcome:'transport_error',reservationRetained:true,session:prepared.session,integrationState:ambiguity.status==='ready'?'ambiguous':'pending_or_ambiguous',error:error.message};}
  if(integration.status!=='ready')return {...integration,reservationRetained:true,session:prepared.session,integrationState:'requested'};
  contract={...contract,capabilities:insideLeaseCapabilities};
  const result = await hostOwned(host, integration.value, 'integration observation', new Set(['session', 'role', 'toolCall', 'workspaceTransition', 'source']));
  if (result.session !== prepared.session || result.role !== 'integrator' || result.session === state.context.coordinator || state.sessions.includes(result.session) || !nonempty(result.toolCall)) throw new Error('native integration requires its authorized fresh integrator actor/session and tool-call evidence; reviewer or worker session reuse is forbidden');
  validateOperationToolCall(result.toolCall,result.workspaceTransition,{operation:'integrate',actor:operationBinding.actor,session:prepared.session,role:'integrator',reservedToolCall:operationBinding.operationToolCall});
  const after = await reobserve(host, contract, expectedWorkspace, 'post-integrate', { transition:result.workspaceTransition, operation:'integrate', allowedPaths:packet.task.write });
  if (after.status !== 'ready') {await markIntegrationAmbiguous(host,contract.capabilities,operationBinding,integrationRequest,integrationWorkspaceBefore);return {...after,reservationRetained:true,session:prepared.session,integrationState:'ambiguous'};}
  let observedIntegration;
  try{observedIntegration=await persistIntegrationState(host,after.capabilities,'observed',operationBinding,{requestId:integrationRequest.requestId,workspaceBefore:integrationWorkspaceBefore,workspace:after.workspace,workspaceTransition:result.workspaceTransition});}
  catch(error){return {status:'transport_error',outcome:'transport_error',reservationRetained:true,session:prepared.session,integrationState:'pending_or_ambiguous',error:error.message};}
  if(observedIntegration.status!=='ready')return {...observedIntegration,reservationRetained:true,session:prepared.session,integrationState:'requested'};
  return { status: 'integrated_observed', operation: 'native_integration', result: clone(result), workspace: clone(after.workspace) };
}
export async function hostIntegrate(args){return immutable(await hostIntegrateInternal(args));}

async function hostCommitProgressInternal({ host, request, expectedWorkspace, coordinator }) {
  request=clone(request);expectedWorkspace=clone(expectedWorkspace);
  let contract = await observeHostContract(host, { expectedWorkspace, coordinator, phase: 'progress-preflight' });
  if (contract.status !== 'ready') return contract;
  for(const operation of ['commitProgress','persistProgressState','observeProgressState']){const unavailable=requireObserved(contract.capabilities,host,operation);if(unavailable)return unavailable;}
  const broker='progress-broker';
  const canonicalIndex = request.canonicalIndex ?? 'tasks.md';validatePaths([canonicalIndex],'progress canonical index');
  if(canonicalIndex!=='tasks.md')return manual('durable progress baseline requires the canonical journal-bound tasks.md index');
  const progressRequested=progressRequestBase(request.progressRequested);
  if(request.taskId!==progressRequested.taskId||request.indexBeforeHash!==progressRequested.indexBeforeHash)throw new Error('progress broker request does not bind its durable progressRequested task and before hash');
  const progressBinding={requestId:progressRequestId(expectedWorkspace.projectRootRealpath,canonicalIndex,progressRequested),actor:broker,session:broker,role:broker,projectRootRealpath:expectedWorkspace.projectRootRealpath,taskId:request.taskId,canonicalIndex,progressRequested};
  const operationBinding={request:clone(request),actor:broker,session:broker,role:broker,projectRootRealpath:expectedWorkspace.projectRootRealpath,taskId:request.taskId,requestedRole:broker,writeScope:[canonicalIndex],intent:progressBinding.requestId};
  const authorized = await authorize(host, contract, 'commitProgress', operationBinding, expectedWorkspace, 'pre-progress');
  if (authorized.status !== 'ready') return authorized;
  contract={...contract,capabilities:authorized.observation.capabilities};
  const resolved=await hostRequestCall(host,'observeProgressState',{requestId:progressBinding.requestId},'existing progress state',PROGRESS_STATE_KEYS,{allowMissing:true,transportAsResult:true});
  if(resolved.status!=='ready')return {...resolved,outcome:'transport_error',reservationRetained:true,requestId:progressBinding.requestId};
  const prior=resolved.state;
  if(prior!==undefined&&prior!==null){
    const existing=validateProgressState(prior);
    if(existing.requestId!==progressBinding.requestId)throw new Error('existing progress state does not bind the requested transaction');
    return manual('progress request already exists; recover its host proof and journal readback without rerunning the broker',{requestId:progressBinding.requestId,progressState:existing.status,reservationRetained:true});
  }
  const workspaceBefore=clone(authorized.observation.workspace),requested=await persistProgressState(host,contract.capabilities,'requested',progressBinding,{workspaceBefore});
  if(requested.status!=='ready')return requested;
  let committed,insideLeaseCapabilities=contract.capabilities;
  try{committed=await runLeased(host,contract.capabilities,'commitProgress',operationBinding,async assertLeaseUnchanged=>{
    const insideLease=await reobserve(host,contract,expectedWorkspace,'inside-progress-lease');
    if(insideLease.status!=='ready')throw new Error(`progress lease lost host boundary: ${insideLease.reason??insideLease.status}`);
    insideLeaseCapabilities=insideLease.capabilities;
    assertLeaseUnchanged();
    return host.commitProgress(clone(request));
  });}
  catch(error){let progressState='pending_or_ambiguous';try{const ambiguous=await persistProgressState(host,insideLeaseCapabilities,'ambiguous',progressBinding,{workspaceBefore});if(ambiguous.status==='ready')progressState='ambiguous';}catch{}return {status:'transport_error',outcome:'transport_error',reservationRetained:true,requestId:progressBinding.requestId,progressState,error:error.message};}
  if(committed.status!=='ready')return {...committed,reservationRetained:true,requestId:progressBinding.requestId,progressState:'requested'};
  contract={...contract,capabilities:insideLeaseCapabilities};
  const result = await hostOwned(host, committed.value, 'progress broker observation', new Set(['beforeHash', 'afterHash', 'changedPaths', 'workspaceTransition', 'source']));
  if (!nonempty(result.beforeHash)||result.beforeHash !== request.indexBeforeHash || !nonempty(result.afterHash) || result.afterHash === result.beforeHash || !Array.isArray(result.changedPaths) || !result.changedPaths.every(nonempty)||!same(result.changedPaths, [canonicalIndex])) throw new Error('progress broker must return matching before hash, distinct after hash and only the canonical index path');
  validatePaths(result.changedPaths,'progress changedPaths');
  if(!result.workspaceTransition)throw new Error('progress mutation requires its attributed workspace transition; progress request retained');
  const after = await reobserve(host, contract, expectedWorkspace, 'post-progress', { transition:result.workspaceTransition, operation:'progress', allowedPaths:[canonicalIndex] });
  if (after.status !== 'ready') return {...after,reservationRetained:true,requestId:progressBinding.requestId,progressState:'requested'};
  let observedProgress;
  try{observedProgress=await persistProgressState(host,after.capabilities,'observed',progressBinding,{workspaceBefore,workspace:after.workspace,workspaceTransition:result.workspaceTransition,indexAfterHash:result.afterHash});}
  catch(error){return {status:'transport_error',outcome:'transport_error',reservationRetained:true,requestId:progressBinding.requestId,progressState:'pending_or_ambiguous',error:error.message};}
  if(observedProgress.status!=='ready')return {...observedProgress,reservationRetained:true,requestId:progressBinding.requestId,progressState:'requested'};
  return { status: 'progress_committed', ...clone(result), workspace: clone(after.workspace) };
}
export async function hostCommitProgress(args){return immutable(await hostCommitProgressInternal(args));}
