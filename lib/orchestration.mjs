import { isPackage, childrenOf, validateRefinement } from './decomposition.mjs';
import { createHash } from 'node:crypto';
import { validateTasks, validateReadiness, validateDelivery, affectedTasks, safePath } from './contracts.mjs';

const tiers = ['bounded', 'medium', 'high'];
const legacyRoles = ['executor', 'reviewer'];
const v3TaskRoles = ['executor', 'integrator', 'reviewer'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(nonempty);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const norm = value => value.normalize('NFC').toLowerCase();
const authorization = value => value && nonempty(value.source) && nonempty(value.scope);
const initialTask = (status = 'pending') => ({ status, active: null, receipt: null, reviews: [], executorSessions: [], blocker: null, decision: null });
const v3InitialTask = (status = 'pending') => ({ ...initialTask(status), progress:null });
const freshTask = state => state.journalVersion===3?v3InitialTask():initialTask();

// Additive protocol; legacy contracts and Accelerate intake are unchanged.
export function compilePlan(tasks, profile, { allowUnready = false } = {}) {
  const errors = validateTasks(tasks, { legacyExecution: true });
  requireThat(!errors.length, errors.join('; '));
  requireThat(profile?.version === 1, 'unsupported profile version');
  for (const tier of tiers) for (const role of legacyRoles) {
    const selection = profile.tiers?.[tier]?.[role];
    requireThat(nonempty(selection?.model) && nonempty(selection?.effort), `missing ${tier}/${role} profile`);
  }
  const compiled = [...tasks].sort((a, b) => a.id.localeCompare(b.id, 'en')).map(task => {
    const errors = validateReadiness(task);
    if (!allowUnready) requireThat(!errors.length, errors.join('; '));
    requireThat(nonempty(task.contractRevision), `${task.id}: missing contract revision`);
    if (task.approvalCriteria !== undefined) {
      requireThat(Array.isArray(task.approvalCriteria) && task.approvalCriteria.every(item =>
        ['id', 'source', 'criterion', 'verification'].every(key => nonempty(item?.[key]))) &&
        new Set(task.approvalCriteria.map(item => item.id)).size === task.approvalCriteria.length, `${task.id}: invalid approval criteria`);
    }
    const metadata = task.orchestration;
    let tier = null;
    try {
      if (!isPackage(task)) {
      requireThat(metadata && ['complexity', 'uncertainty', 'risk'].every(key => tiers.includes(metadata[key])) && nonempty(metadata.rationale), `${task.id}: justified classification required`);
      requireThat(strings(metadata.skills) && metadata.skills.length && strings(metadata.references) && metadata.references.length, `${task.id}: bounded skills and references required`);
      requireThat(Array.isArray(metadata.claims), `${task.id}: claims must be declared`);
      for (const claim of metadata.claims) requireThat(nonempty(claim?.name) && ['read', 'write', 'exclusive'].includes(claim.mode) && Array.isArray(claim.roles) && claim.roles.length && claim.roles.every(role => legacyRoles.includes(role)), `${task.id}: invalid resource claim`);
      tier = tiers[Math.max(...['complexity', 'uncertainty', 'risk'].map(key => tiers.indexOf(metadata[key])))];
      }
    } catch (error) { if (!allowUnready) throw error; errors.push(error.message); }
    // Recompute derived readiness, never trust caller-supplied diagnostics.
    const { readinessErrors: ignored, ...source } = clone(task);
    return { ...source, tier, ...((allowUnready || tasks.some(item => item.nodeType !== undefined)) ? { readinessErrors: errors } : {}) };
  });
  const plan = { version: tasks.some(task => task.nodeType !== undefined) ? 3 : allowUnready ? 2 : 1, tasks: compiled, profile: clone(profile) };
  return { ...plan, revision: digest(plan) };
}

function checkPlan(plan) {
  requireThat([1, 2, 3].includes(plan?.version), 'unsupported plan version');
  const rebuilt = compilePlan(plan.tasks, plan.profile, { allowUnready: plan.version !== 1 });
  requireThat(digest(rebuilt) === digest(plan), 'plan revision/content mismatch');
}

export function renderDag(plan) {
  checkPlan(plan);
  const lines = ['flowchart TD'];
  const index = new Map(plan.tasks.map((task, i) => [task.id, `t${i}`]));
  for (const task of plan.tasks) lines.push(`    ${index.get(task.id)}["${task.id} · ${isPackage(task) ? 'package' : task.tier}"]`);
  for (const task of plan.tasks) for (const dep of task.dependsOn) lines.push(`    ${index.get(dep)} --> ${index.get(task.id)}`);
  for (const task of plan.tasks) if (task.parentId) lines.push(`    ${index.get(task.id)} --> ${index.get(task.parentId)}`);
  return lines.join('\n');
}

function executionScope(plan, context, version) {
  const executable = plan.tasks.filter(task => !isPackage(task)).map(task => task.id);
  if (version < 3) return { consumableTaskIds: executable, excludedTaskIds: [] };
  const supplied = context.executionScope ?? { consumableTaskIds: executable, excludedTaskIds: [] };
  requireThat(strings(supplied.consumableTaskIds) && Array.isArray(supplied.excludedTaskIds) && supplied.excludedTaskIds.every(nonempty), 'journal v3 execution scope requires consumable/excluded task IDs');
  const all = [...supplied.consumableTaskIds, ...supplied.excludedTaskIds];
  requireThat(supplied.consumableTaskIds.length > 0 && all.length === executable.length && new Set(all).size === executable.length && all.every(id => executable.includes(id)), 'journal v3 execution scope must be an exact non-empty partition');
  requireThat(digest(supplied.consumableTaskIds)===digest(executable.filter(id=>supplied.consumableTaskIds.includes(id))) && digest(supplied.excludedTaskIds)===digest(executable.filter(id=>supplied.excludedTaskIds.includes(id))), 'journal v3 execution scope must use canonical task order');
  const excluded=new Set(supplied.excludedTaskIds),byId=new Map(plan.tasks.map(task=>[task.id,task]));
  const reachesExcluded=(id,seen=new Set())=>{
    if(excluded.has(id))return true;if(seen.has(id))return false;seen.add(id);
    return (byId.get(id)?.dependsOn??[]).some(dependency=>reachesExcluded(dependency,seen));
  };
  requireThat(!supplied.consumableTaskIds.some(id=>reachesExcluded(id)), 'consumable task depends on excluded task');
  return { consumableTaskIds: [...supplied.consumableTaskIds], excludedTaskIds: [...supplied.excludedTaskIds] };
}

function journalHeader(journal) {
  return { version: journal.version, plan: clone(journal.plan), context: clone(journal.context), ...(journal.predecessor ? { predecessor: clone(journal.predecessor) } : {}) };
}

export function createJournal(plan, context, { version = 3, predecessor = null } = {}) {
  checkPlan(plan);
  requireThat([1, 2, 3].includes(version), 'unsupported journal version');
  requireThat(nonempty(context?.coordinator) && authorization(context.authorization) && strings(context.readScope) && context.readScope.length, 'coordinator, authorization source/scope and read scope required');
  const scope = executionScope(plan, context, version);
  if (version === 3) {
    requireThat(plan.tasks.every(task => task.owner !== context.coordinator), 'coordinator/root cannot be an executable task owner');
    if (context.immutableIntake !== undefined || context.intakeDigest !== undefined || context.canonicalReferences !== undefined) {
      requireThat(context.immutableIntake && typeof context.immutableIntake === 'object' && !Array.isArray(context.immutableIntake) &&
        nonempty(context.intakeDigest) && context.intakeDigest === digest(context.immutableIntake) &&
        context.canonicalReferences && typeof context.canonicalReferences === 'object' && !Array.isArray(context.canonicalReferences),
      'journal v3 immutable intake, digest and canonical references must be complete and mutually bound');
    }
    context = { ...clone(context), executionScope: scope };
    if (predecessor !== null) requireThat([1,2,3].includes(predecessor?.version) && nonempty(predecessor.digest) && Number.isInteger(predecessor.sequence) && predecessor.sequence >= 0 && nonempty(predecessor.planRevision) &&
      Array.isArray(predecessor.acceptedImports) && new Set(predecessor.acceptedImports.map(item=>item?.taskId)).size===predecessor.acceptedImports.length,
    'invalid predecessor journal binding');
    if(predecessor) requireThat(predecessor.acceptedImports.every(item=>scope.consumableTaskIds.includes(item.taskId)), 'reconciled predecessor task cannot be excluded');
  } else requireThat(predecessor === null, 'legacy journal cannot declare a successor binding');
  const header = { version, plan: clone(plan), context: clone(context), ...(predecessor ? { predecessor: clone(predecessor) } : {}) };
  return { ...header, digest: digest(header), events: [] };
}

export function createSuccessorJournal(predecessorJournal, context, { reconciliation = [] } = {}) {
  const prior = replay(predecessorJournal);
  requireThat(Array.isArray(reconciliation), 'successor reconciliation must be an array');
  requireThat(reconciliation.every(item=>item&&typeof item==='object'&&!Array.isArray(item)&&digest(Object.keys(item).sort())===digest(['decisionDigest','receiptDigest','taskId'])&&
    nonempty(item.taskId)&&nonempty(item.receiptDigest)&&nonempty(item.decisionDigest)), 'successor reconciliation fields must be exactly taskId, receiptDigest and decisionDigest');
  const accepted=prior.plan.tasks.filter(task=>['accepted','completed'].includes(prior.tasks[task.id].status));
  requireThat(reconciliation.length===accepted.length && new Set(reconciliation.map(item=>item?.taskId)).size===accepted.length && accepted.every(task=>reconciliation.some(item=>item?.taskId===task.id)), 'successor reconciliation must cover every accepted task exactly once');
  const sourceDigest=predecessorJournal.events.at(-1)?.digest ?? predecessorJournal.digest;
  const acceptedImports=accepted.map(task=>{
    const current=prior.tasks[task.id],item=reconciliation.find(entry=>entry.taskId===task.id);
    requireThat(current.receipt && current.decision && item.receiptDigest===digest(current.receipt) && item.decisionDigest===digest(current.decision), `successor reconciliation for accepted task ${task.id} does not match receipt/decision`);
    return {taskId:task.id,contractRevision:task.contractRevision,integrationRevision:current.receipt.integrationRevision,
      receiptDigest:item.receiptDigest,decisionDigest:item.decisionDigest,sourceJournalDigest:sourceDigest,receipt:clone(current.receipt),decision:clone(current.decision)};
  });
  const predecessor = { version: predecessorJournal.version, digest: sourceDigest,
    sequence: prior.sequence, planRevision: prior.plan.revision, acceptedImports };
  return createJournal(prior.plan, context, { version: 3, predecessor });
}

function claimsFor(task, role) {
  if (role === 'integrator') return [...claimsFor(task, 'executor'), ...claimsFor(task, 'reviewer')];
  return [
    ...task.write.map(name => ({ type: 'path', name: norm(name), mode: 'exclusive' })),
    ...task.resources.map(name => ({ type: 'resource', name: norm(name), mode: 'exclusive' })),
    ...task.orchestration.claims.filter(claim => claim.roles.includes(role)).map(claim => ({ type: 'resource', name: norm(claim.name), mode: claim.mode })),
  ];
}
function conflict(left, right) {
  return left.some(a => right.some(b => a.type === b.type &&
    (a.name === b.name || a.type === 'path' && (a.name.startsWith(`${b.name}/`) || b.name.startsWith(`${a.name}/`))) &&
    !(a.mode === 'read' && b.mode === 'read')));
}
function externalReservations(capabilities) {
  requireThat(Number.isInteger(capabilities?.externalActive) && capabilities.externalActive >= 0, 'external actor count must be observed');
  const external = capabilities.externalReservations ?? [];
  requireThat(Array.isArray(external) && external.length === capabilities.externalActive, 'external reservations must cover every external actor');
  return external.map(item => {
    requireThat(Array.isArray(item?.claims), 'external claims required');
    return { claims: item.claims.map(claim => {
      requireThat(['path', 'resource'].includes(claim?.type) && nonempty(claim.name) && ['read', 'write', 'exclusive'].includes(claim.mode) && (claim.type !== 'path' || safePath(claim.name)), 'invalid external claim');
      return { ...claim, name: norm(claim.name) };
    }) };
  });
}
function dependencyComplete(state, id) {
  const task = state.plan.tasks.find(item => item.id === id), status = state.tasks[id]?.status;
  return state.journalVersion < 3 ? status === 'accepted' : isPackage(task) ? status === 'accepted' : status === 'completed';
}
function dispatchReason(state, task, role, capabilities, reserved = []) {
  const current = state.tasks[task.id];
  if (isPackage(task)) return 'package is coordinator-owned; dispatch its ready children';
  if (state.paused) return `paused: ${state.paused.reason}`;
  if (task.readinessErrors?.length) return task.readinessErrors.join('; ');
  if (current.operationBlocks?.[role]) return `blocked ${role}: ${current.operationBlocks[role].reason}`;
  if (current.active) return `active ${current.active.session}`;
  if (role === 'executor' && current.status !== 'pending') return current.blocker ? `blocked by ${current.blocker.owner}: ${current.blocker.reason}` : `state ${current.status}`;
  if (role === 'reviewer' && !['delivered', 'integration_pending'].includes(current.status)) return `state ${current.status}`;
  if (role === 'integrator' && current.status !== 'reviewed') return `state ${current.status}`;
  const missing = task.dependsOn.filter(id => !dependencyComplete(state, id));
  if (missing.length) return `dependencies: ${missing.join(', ')}`;
  if (capabilities?.spawn !== true) return 'spawn unavailable; use explicitly recorded host/manual workflow';
  const selection = state.plan.profile.tiers[task.tier][role === 'integrator' ? 'executor' : role];
  if (!capabilities.models?.some(item => item.model === selection.model && item.efforts?.includes(selection.effort))) return `model/effort unavailable: ${selection.model}/${selection.effort}`;
  if (!Number.isInteger(capabilities.maxAgents) || capabilities.maxAgents < 2 || !Number.isInteger(capabilities.externalActive) || capabilities.externalActive < 0) return 'invalid total agent budget';
  const active = Object.values(state.tasks).filter(item => item.active).map(item => item.active);
  let external;
  try { external = externalReservations(capabilities); } catch (error) { return error.message; }
  if (1 + capabilities.externalActive + active.filter(item => item.role !== 'integrator').length + reserved.length >= capabilities.maxAgents) return 'agent budget exhausted (coordinator included)';
  if ((active.length || reserved.length || capabilities.externalActive) && capabilities.isolatedWrites !== true) return 'parallel isolation unavailable';
  if ([...active, ...external, ...reserved].some(item => conflict(claimsFor(task, role), item.claims))) return 'resource or write-scope reservation conflict';
  return null;
}

export function readyWave(journal, capabilities, role = 'executor') {
  requireThat(legacyRoles.includes(role), 'unknown role');
  const state = replay(journal), selected = [], blocked = Object.create(null), reserved = [];
  for (const task of state.plan.tasks) {
    const reason = dispatchReason(state, task, role, capabilities, reserved);
    if (reason) blocked[task.id] = reason;
    else { selected.push(task.id); reserved.push({ claims: claimsFor(task, role) }); }
  }
  return { version: 1, planRevision: state.plan.revision, sequence: state.sequence, role, selected, blocked };
}

function activeSession(current, event, role) {
  requireThat(current.active?.session === event.session && current.active?.role === role, 'active role/session mismatch');
  requireThat(event.stopped === true, 'host must confirm worker stopped before releasing resources');
}
function receiptErrors(task, receipt, hardened = false) {
  const errors = validateDelivery(task, receipt, { requireObservedExecution: hardened });
  requireThat(!errors.length, errors.join('; '));
}
function reviewSnapshot(value) {
  requireThat(value && nonempty(value.revision) && strings(value.changedFiles) && nonempty(value.scopeFingerprint), 'host review snapshot required');
  return { revision: value.revision, changedFiles: [...value.changedFiles].sort(), scopeFingerprint: value.scopeFingerprint };
}
function snapshotMatches(left, right) {
  return digest(reviewSnapshot(left)) === digest(reviewSnapshot(right));
}
function objectiveRevisionFor(state) {
  return digest(objectiveVerificationBasis(state));
}
export function currentObjectiveRevision(journal) { return objectiveRevisionFor(replay(journal)); }
function objectiveVerificationBasis(state) {
  return {
    planRevision: state.plan.revision,
    ...(state.journalVersion===3?{contextDigest:digest(state.context),
      ...(state.context.immutableIntake===undefined?{}:{immutableIntake:clone(state.context.immutableIntake)}),
      ...(state.context.intakeDigest===undefined?{}:{intakeDigest:state.context.intakeDigest}),
      ...(state.context.canonicalReferences===undefined?{}:{canonicalReferences:clone(state.context.canonicalReferences)})}:{}),
    ...(state.journalVersion===3?{objectiveGeneration:state.objectiveGeneration}:{}),
    accepted: state.plan.tasks.map(task => ({
      taskId: task.id,
      contractRevision: task.contractRevision,
      status:state.tasks[task.id].status,
      integrationRevision: state.tasks[task.id].receipt?.integrationRevision,
      decision: state.tasks[task.id].decision,
      ...(state.journalVersion===3?{progress:state.tasks[task.id].progress}:{}),
    })),
  };
}
function applyLegacy(state, event) {
  if (event.type === 'verifyObjective') {
    requireThat(state.objectiveVerification?.verdict !== 'pass', 'objective already complete');
    requireThat(!state.paused && Object.values(state.tasks).every(task => task.status === 'accepted' && !task.active), 'objective verification requires every task accepted and no active worker');
    requireThat(event.objectiveRevision === objectiveRevisionFor(state), 'stale objective revision');
    requireThat(['pass','fail'].includes(event.verdict) && nonempty(event.outcome) &&
      ['originalRequest','taskCoverage','integratedBehavior','authority'].every(key => nonempty(event.checks?.[key])) &&
      strings(event.evidence) && event.evidence.length && strings(event.limitations) && strings(event.remainingWork),
    'objective verdict, outcome, checks, evidence, limitations and remaining work required');
    requireThat(event.verdict === 'pass' ? event.remainingWork.length === 0 : event.remainingWork.length > 0,
      'passing objective cannot retain work; failed objective must name remaining work');
    state.objectiveVerification = clone(event);
    return;
  }
  requireThat(state.objectiveVerification?.verdict !== 'pass' || ['reopen','replan','decompose','refine'].includes(event.type), 'objective already complete');
  if (event.type === 'pause') {
    requireThat(nonempty(event.source) && nonempty(event.reason), 'explicit pause source/reason required');
    state.paused = { source: event.source, reason: event.reason }; return;
  }
  if (event.type === 'resume') {
    requireThat(state.paused && authorization(event.authorization) && nonempty(event.reason), 'resume requires pause and authorization');
    state.paused = null; state.context.authorization = clone(event.authorization); return;
  }
  if (event.type === 'replan' || event.type === 'decompose' || event.type === 'refine') {
    checkPlan(event.plan);
    requireThat(nonempty(event.reason) && authorization(event.authorization), 'replan reason and authorization reference required');
    // Removing tasks loses audit identity; retire work with a blocked disposition instead.
    requireThat(state.plan.tasks.every(task => event.plan.tasks.some(next => next.id === task.id)), 'replan cannot remove task identities');
    if (event.type === 'decompose') {
      requireThat(!state.paused, 'decomposition paused');
      const old = state.plan.tasks.find(task => task.id === event.taskId);
      const next = event.plan.tasks.find(task => task.id === event.taskId);
      requireThat(old && !isPackage(old) && !old.parentId && isPackage(next), 'decompose converts a root task to a package');
      requireThat(!state.tasks[old.id].active && state.tasks[old.id].status !== 'accepted', 'stop worker before decomposing unfinished work');
      const retained = task => Object.fromEntries(Object.entries(task).filter(([key]) => !['nodeType','boundary','contractRevision','readinessErrors','tier'].includes(key)));
      requireThat(digest(retained(old)) === digest(retained(next)), 'decomposition must preserve original outcome and scope');
      requireThat(digest(state.plan.profile) === digest(event.plan.profile), 'decomposition cannot change profile');
      for (const task of event.plan.tasks) {
        const prior = state.plan.tasks.find(item => item.id === task.id);
        if (!prior) requireThat(task.parentId === old.id, 'new tasks must belong to decomposed package');
        else if (task.id !== old.id) {
          const sibling = item => Object.fromEntries(Object.entries(item).filter(([key]) => !['contractRevision','readinessErrors','tier'].includes(key)));
          requireThat(digest(sibling(task)) === digest(sibling(prior)), 'decomposition cannot rewrite existing sibling contracts');
        }
      }
    }
    if (event.type === 'refine') {
      requireThat(!state.paused && !state.tasks[event.taskId]?.active && state.tasks[event.taskId]?.status !== 'accepted', 'refinement requires stopped unfinished work');
      requireThat(nonempty(event.coverageReview), 'semantic coverage review required');
      requireThat(digest(state.plan.profile) === digest(event.plan.profile), 'refinement cannot change profile');
      const errors = validateRefinement(state.plan.tasks, event.plan.tasks, event.taskId);
      requireThat(!errors.length, errors.join('; '));
    }
    const profileChanged = digest(state.plan.profile) !== digest(event.plan.profile);
    const identity = task => task ? Object.fromEntries(Object.entries(task).filter(([key]) => key !== 'readinessErrors')) : null;
    const changed = event.plan.tasks.filter(task => profileChanged || digest(identity(task)) !== digest(identity(state.plan.tasks.find(old => old.id === task.id)))).map(task => task.id);
    const affected = affectedTasks(event.plan.tasks, changed);
    for (const id of affected) requireThat(!state.tasks[id]?.active, `replan blocked by active worker ${id}`);
    for (const id of affected) state.tasks[id] = freshTask(state);
    state.plan = clone(event.plan); state.context.authorization = clone(event.authorization);
    state.objectiveVerification = null;
    return;
  }
  const task = state.plan.tasks.find(task => task.id === event.taskId);
  requireThat(task, `unknown task ${event.taskId}`);
  const current = state.tasks[task.id];
  if (isPackage(task) && !['acceptPackage','block','unblock','operationBlock','operationUnblock','reopen'].includes(event.type)) throw new Error('package cannot execute worker transitions');
  switch (event.type) {
    case 'acceptPackage': {
      requireThat(isPackage(task) && !state.paused && current.status === 'pending' && !current.operationBlocks?.acceptance, 'package acceptance unavailable');
      requireThat([...task.dependsOn, ...childrenOf(state.plan.tasks, task.id).map(child => child.id)].every(id => dependencyComplete(state, id)), 'package prerequisites and children must be accepted');
      requireThat(!task.readinessErrors?.length, 'package contract not ready');
      for (const criterion of task.approvalCriteria ?? []) requireThat(event.approvalEvidence?.some(item => item.id === criterion.id && item.source === criterion.source && item.contractRevision === task.contractRevision && item.revision === event.receipt?.integrationRevision && item.verdict === 'pass' && nonempty(item.evidence)), 'package approval criterion lacks current evidence');
      requireThat(event.receipt?.status === 'integrated', 'integrated package receipt required');
      const errors = validateDelivery(task, event.receipt, { requireObservedExecution: state.journalVersion >= 2 });
      requireThat(!errors.length, errors.join('; '));
      requireThat(nonempty(event.reason) && strings(event.limitations), 'package outcome assessment required');
      current.status = 'accepted'; current.receipt = clone(event.receipt); current.decision = clone(event);
      break;
    }

    case 'operationBlock':
      requireThat(['executor', 'reviewer', 'integration', 'acceptance'].includes(event.operation) && nonempty(event.owner) && nonempty(event.reason) && current.status !== 'accepted', 'operation blocker requires stage, owner and reason; reopen accepted work first');
      current.operationBlocks ??= {};
      current.operationBlocks[event.operation] = { owner: event.owner, reason: event.reason }; break;
    case 'operationUnblock':
      requireThat(current.operationBlocks?.[event.operation] && nonempty(event.reason), 'existing operation blocker and resolution required');
      delete current.operationBlocks[event.operation]; break;
    case 'dispatch': {
      requireThat(legacyRoles.includes(event.role), 'unknown role');
      const reason = dispatchReason(state, task, event.role, event.capabilities);
      requireThat(!reason, reason);
      requireThat(nonempty(event.session) && event.session !== state.context.coordinator && !state.sessions.includes(event.session), 'fresh independent unique session required');
      requireThat(event.context?.fresh === true && event.context?.inheritedHistory === false && nonempty(event.context.source), 'fresh bounded context provenance required');
      const purpose = event.role === 'executor' ? 'implementation' : current.status === 'delivered' ? 'candidate' : 'integration';
      let reviewBoundary = null;
      if (event.role === 'reviewer' && state.journalVersion >= 2) {
        const revision = purpose === 'candidate' ? current.receipt.revision : current.receipt.integrationRevision;
        const isolation = event.capabilities?.reviewIsolation;
        requireThat(isolation?.enforced === true && ['read-only','disposable-copy'].includes(isolation.mode) &&
          nonempty(isolation.provider) && nonempty(isolation.projectScope) && isolation.targetRevision === revision,
        'reviewer requires host-enforced read-only or disposable-copy isolation bound to the candidate');
        const before = reviewSnapshot(event.context?.reviewSnapshot);
        requireThat(before.revision === revision && digest(before.changedFiles) === digest([...current.receipt.changedFiles].sort()), 'review snapshot does not match candidate scope');
        reviewBoundary = { isolation: clone(isolation), snapshotBefore: before };
      }
      current.active = { session: event.session, role: event.role, purpose, context: clone(event.context), claims: claimsFor(task, event.role), planRevision: state.plan.revision, ...(reviewBoundary ? { reviewBoundary } : {}) };
      state.sessions.push(event.session);
      if (event.role === 'executor') { current.executorSessions.push(event.session); current.status = 'executing'; }
      else current.status = 'reviewing';
      break;
    }
    case 'deliver':
      activeSession(current, event, 'executor');
      requireThat(current.status === 'executing', 'task not executing');
      requireThat(event.receipt?.status === 'delivered', 'executor may only deliver');
      receiptErrors(task, event.receipt, state.journalVersion >= 2);
      current.receipt = clone(event.receipt); current.active = null; current.status = 'delivered';
      break;
    case 'reviewResult': {
      activeSession(current, event, 'reviewer');
      requireThat(current.status === 'reviewing', 'review not active');
      const purpose = current.active.purpose;
      const revision = purpose === 'candidate' ? current.receipt.revision : current.receipt.integrationRevision;
      requireThat(event.revision === revision, 'stale review revision');
      if (state.journalVersion >= 2) {
        const after = reviewSnapshot(event.snapshotAfter);
        requireThat(after.revision === revision && snapshotMatches(current.active.reviewBoundary.snapshotBefore, after), 'review target drifted or differs from the frozen candidate');
      }
      requireThat(['pass', 'fail'].includes(event.verdict) && strings(event.findings) && strings(event.evidence) && event.evidence.length, 'review verdict, findings and evidence required');
      requireThat(event.verdict !== 'pass' || !event.findings.length, 'unresolved findings cannot pass');
      current.reviews.push({ session: event.session, context: current.active.context, purpose, revision, verdict: event.verdict, findings: clone(event.findings), evidence: clone(event.evidence) });
      if (event.verdict === 'pass') {
        if (purpose === 'candidate') {
          current.receipt.status = 'reviewed';
          current.receipt.reviews = { spec: revision, quality: revision, independent: true };
        } else {
          current.receipt.status = 'integrated';
          current.receipt.integrationReviews = { spec: revision, quality: revision, independent: true };
        }
        receiptErrors(task, current.receipt, state.journalVersion >= 2);
      }
      current.active = null;
      current.status = event.verdict === 'fail' ? 'blocked' : purpose === 'candidate' ? 'reviewed' : 'forensic_pending';
      current.blocker = event.verdict === 'fail' ? { owner: state.context.coordinator, reason: event.findings.join('; ') || 'review failed' } : null;
      break;
    }
    case 'beginIntegration': {
      requireThat(!state.paused && !current.operationBlocks?.integration, 'integration paused or blocked');
      requireThat(current.status === 'reviewed' && !current.active, 'independently reviewed candidate required');
      const active = Object.values(state.tasks).filter(item => item.active).map(item => item.active);
      const external = externalReservations(event.capabilities);
      requireThat(!(active.length || external.length) || event.capabilities.isolatedWrites === true, 'parallel integration isolation unavailable');
      // Root performs integration; reserve every role's declared resources before mutation.
      const claims = [...claimsFor(task, 'executor'), ...claimsFor(task, 'reviewer')];
      requireThat(![...active, ...external].some(item => item.role === 'integrator' || conflict(claims, item.claims)), 'integration reservation conflict');
      current.active = { session: state.context.coordinator, role: 'integrator', purpose: 'integration', claims, planRevision: state.plan.revision };
      current.status = 'integrating';
      break;
    }
    case 'integrate': {
      requireThat(current.status === 'integrating' && current.active?.role === 'integrator', 'reserve integration before mutation');
      requireThat(nonempty(event.integrationRevision), 'missing integration revision');
      const evidence = event.integrationEvidence;
      requireThat(Array.isArray(evidence) && task.verification.every(command => evidence.some(item => item?.command === command && item.exitCode === 0 && item.revision === event.integrationRevision)) && evidence.every(item => item?.exitCode === 0 && item.revision === event.integrationRevision), 'missing passing or stale integration evidence');
      requireThat(!validateDelivery(task, { ...current.receipt, status:'integrated', integrationRevision:event.integrationRevision,
        integrationEvidence:evidence, integrationReviews:{spec:event.integrationRevision,quality:event.integrationRevision,independent:true} },
      { requireObservedExecution: state.journalVersion >= 2 }).some(error => error.includes('observed execution metadata')), 'integration evidence lacks observed execution metadata');
      current.receipt.integrationRevision = event.integrationRevision;
      current.receipt.integrationEvidence = clone(evidence);
      // No integration review is asserted until the fresh reviewer actually returns.
      current.active = null; current.status = 'integration_pending';
      break;
    }
    case 'decide':
      requireThat(['accepted', 'rework', 'blocked'].includes(event.disposition), 'invalid forensic disposition');
      if (event.disposition === 'accepted') {
        requireThat(!state.paused && !current.operationBlocks?.acceptance, 'acceptance paused or blocked');
        for (const criterion of task.approvalCriteria ?? []) {
          requireThat(event.approvalEvidence?.some(item => item.id === criterion.id && item.source === criterion.source &&
            item.contractRevision === task.contractRevision && item.revision === current.receipt?.integrationRevision &&
            item.verdict === 'pass' && nonempty(item.evidence)), `approval criterion lacks current evidence: ${criterion.id}`);
        }
        requireThat(current.status === 'forensic_pending' && !current.active, 'independent integration review required before acceptance');
        requireThat(nonempty(event.reason) && ['scope', 'behavior', 'independence', 'integration', 'authority'].every(key => nonempty(event.checks?.[key])) && strings(event.limitations), 'finite forensic checks and limitations required');
        receiptErrors(task, current.receipt, state.journalVersion >= 2);
        requireThat(task.dependsOn.every(id => dependencyComplete(state, id)), 'dependencies no longer accepted');
        current.status = 'accepted'; current.decision = clone(event);
      } else {
        requireThat(!current.active && current.status !== 'accepted', 'stop active worker or replan accepted work first');
        requireThat(nonempty(event.reason), 'disposition reason required');
        current.decision = clone(event);
        if (event.disposition === 'rework') {
          current.status = 'pending'; current.receipt = null; current.reviews = []; current.blocker = null;
        } else { current.status = 'blocked'; current.blocker = { owner: state.context.coordinator, reason: event.reason }; }
      }
      break;
    case 'stop':
      requireThat(current.active?.session === event.session && nonempty(event.reason) && typeof event.stopped === 'boolean', 'active session, stopped observation and reason required');
      current.status = 'blocked'; current.blocker = { owner: state.context.coordinator, reason: event.reason };
      if (event.stopped) current.active = null; // Cancellation request alone never releases a lease.
      break;
    case 'block':
      requireThat(!current.active && current.status !== 'accepted' && nonempty(event.owner) && nonempty(event.reason), 'stop active worker or replan accepted work; blocker owner/reason required');
      current.status = 'blocked'; current.blocker = { owner: event.owner, reason: event.reason };
      break;
    case 'reopen': {
      requireThat(nonempty(event.reason), 'reopen reason required');
      const affected = affectedTasks(state.plan.tasks, [task.id]);
      for (const id of affected) requireThat(!state.tasks[id].active, `reopen blocked by active worker ${id}`);
      for (const id of affected) state.tasks[id] = freshTask(state);
      state.objectiveVerification = null;
      break;
    }
    case 'unblock':
      requireThat(current.status === 'blocked' && !current.active && nonempty(event.reason), 'stopped blocked work and resolution reason required');
      // Conservative recovery: previous candidate must be delivered and reviewed again.
      current.status = 'pending'; current.receipt = null; current.reviews = []; current.blocker = null;
      break;
    default: throw new Error(`unknown event ${event.type}`);
  }
}

const v3OnlyEvents = new Set(['progressRequested', 'progressCommitted', 'stopVerifier']);
function v3Scope(state) { return state.context.executionScope; }
function v3ConsumableComplete(state) {
  const selected = new Set(v3Scope(state).consumableTaskIds);
  return state.plan.tasks.every(task => !selected.has(task.id) || state.tasks[task.id].status === 'completed');
}
function v3RequiredPackagesComplete(state) {
  const consumable=new Set(v3Scope(state).consumableTaskIds);
  const descendantLeaves=id=>childrenOf(state.plan.tasks,id).flatMap(child=>isPackage(child)?descendantLeaves(child.id):[child.id]);
  return state.plan.tasks.filter(isPackage).every(task=>{
    const leaves=descendantLeaves(task.id);
    return !leaves.length||leaves.some(id=>!consumable.has(id))||state.tasks[task.id].status==='accepted';
  });
}
function validateObjectiveEvent(event,state) {
  requireThat(['pass','fail'].includes(event.verdict) && nonempty(event.outcome) &&
    ['originalRequest','taskCoverage','integratedBehavior','authority'].every(key => nonempty(event.checks?.[key])) &&
    strings(event.evidence) && event.evidence.length && strings(event.limitations) && strings(event.remainingWork),
  'objective verdict, outcome, checks, evidence, limitations and remaining work required');
  requireThat(event.verdict === 'pass' ? event.remainingWork.length === 0 : event.remainingWork.length > 0,
    'passing objective cannot retain work; failed objective must name remaining work');
  const receipt=event.attestation;
  requireThat(receipt && receipt.schemaVersion==='asds.objective-verification-receipt/1' && receipt.status==='closed' &&
    receipt.kind==='objective-verification' && nonempty(receipt.token) && nonempty(receipt.source) && receipt.source!=='caller' &&
    receipt.actor===state.objectiveVerifier?.context?.reservedActor && receipt.session===event.session && receipt.role==='verifier' &&
    receipt.objectiveRevision===event.objectiveRevision && receipt.journalSequence===state.sequence &&
    nonempty(receipt.resultDigest) && receipt.resultDigest===digest({verdict:event.verdict,outcome:event.outcome,checks:event.checks,
      evidence:event.evidence,limitations:event.limitations,remainingWork:event.remainingWork}) &&
    nonempty(receipt.resultObservationDigest) && nonempty(receipt.evidenceDigest) && receipt.evidenceDigest===digest(event.evidence) &&
    [receipt.stopDigest,receipt.workspaceDigest,receipt.snapshotDigest,receipt.priorSnapshotDigest].every(nonempty),
  'verifyObjective requires a closed official host-owned attestation bound to assignment, objective revision, result, evidence, stop, workspace and snapshots');
}
function archiveVerifier(state,outcome,reason) {
  const active=state.objectiveVerifier;
  requireThat(active,'objective verifier is not active');
  state.objectiveVerifierHistory.push({...clone(active),outcome,reason,closedSequence:state.sequence+1});
  state.objectiveVerifier=null;
}
function invalidateObjective(state,reason,source=null) {
  state.objectiveGeneration+=1;
  const invalidated={reason,...(source?{source}:{}),generation:state.objectiveGeneration,sequence:state.sequence+1};
  if(state.objectiveVerifier) state.objectiveVerifier.invalidated=clone(invalidated);
  if(state.objectiveVerification) {
    state.objectiveVerificationHistory.push({...clone(state.objectiveVerification),invalidated:clone(invalidated)});
    state.objectiveVerification=null;
  }
  state.objectiveInvalidationHistory.push({...clone(invalidated),verifierSession:state.objectiveVerifier?.session??null});
}

export function applyV1(state, event) {
  requireThat(!v3OnlyEvents.has(event.type) && !['integrator','verifier'].includes(event.role), 'event requires journal v3');
  applyLegacy(state, event);
}
export function applyV2(state, event) {
  requireThat(!v3OnlyEvents.has(event.type) && !['integrator','verifier'].includes(event.role), 'event requires journal v3');
  applyLegacy(state, event);
}
export function applyV3(state, event) {
  if (event.taskId !== undefined) {
    const scopedTask=state.plan.tasks.find(item=>item.id===event.taskId);
    requireThat(scopedTask,`unknown task ${event.taskId}`);
    requireThat(!v3Scope(state).excludedTaskIds.includes(event.taskId),`${event.taskId}: excluded task cannot have runtime events`);
  }
  if (event.type === 'review') { applyLegacy(state,{...event,type:'reviewResult'}); return; }
  if (event.type === 'pause') {
    invalidateObjective(state,'pause',event.source);
    applyLegacy(state,event);return;
  }
  if (event.type === 'resume') { applyLegacy(state,event);return; }
  if (['replan','decompose','refine'].includes(event.type)) {
    requireThat(Object.hasOwn(event,'executionScope'),'journal v3 plan mutation requires new executionScope');
    const nextScope=executionScope(event.plan,{executionScope:event.executionScope},3),priorScope=v3Scope(state);
    const priorConsumable=new Set(priorScope.consumableTaskIds),nextConsumable=new Set(nextScope.consumableTaskIds);
    for(const task of state.plan.tasks.filter(item=>!isPackage(item))) if(priorConsumable.has(task.id)!==nextConsumable.has(task.id)) {
      const current=state.tasks[task.id];
      requireThat(!current.active&&['pending','excluded'].includes(current.status)&&!current.receipt&&!current.decision,`${task.id}: execution scope change after runtime work requires a successor journal`);
    }
    invalidateObjective(state,event.type);
    applyLegacy(state,event);
    state.context.executionScope=clone(nextScope);
    const excluded=new Set(nextScope.excludedTaskIds);
    for(const task of state.plan.tasks.filter(item=>!isPackage(item))) {
      const wasExcluded=priorScope.excludedTaskIds.includes(task.id),current=state.tasks[task.id];
      if(excluded.has(task.id)) {
        requireThat(['pending','excluded'].includes(current.status)&&!current.active&&!current.receipt&&!current.decision,`${task.id}: reconciled/runtime task cannot become excluded`);
        if(!wasExcluded||current.status!=='excluded')state.tasks[task.id]=v3InitialTask('excluded');
      } else if(wasExcluded&&current.status==='excluded') state.tasks[task.id]=v3InitialTask();
    }
    return;
  }
  if (event.type === 'reopen') { invalidateObjective(state,'reopen');applyLegacy(state,event);return; }
  if (event.type === 'stopVerifier') {
    requireThat(state.objectiveVerifier?.session===event.session && ['stopped','cancelled','failed','drifted'].includes(event.outcome) && nonempty(event.reason) && typeof event.stopped==='boolean','active verifier session, outcome, reason and stopped observation required');
    if(!event.stopped) {state.objectiveVerifier.stopRequested={outcome:event.outcome,reason:event.reason,sequence:state.sequence+1};state.objectiveVerifier.invalidated={reason:'stopRequested',sequence:state.sequence+1};return;}
    archiveVerifier(state,event.outcome,event.reason);return;
  }
  if (event.type === 'dispatch' && v3TaskRoles.includes(event.role)) requireThat(event.session !== state.context.coordinator, 'coordinator/root cannot be dispatched as a worker');
  if (event.type === 'dispatch' && event.role === 'verifier') {
    requireThat(!state.paused && v3ConsumableComplete(state) && v3RequiredPackagesComplete(state) && !state.objectiveVerification, 'verifier requires completed consumable scope');
    requireThat(!state.objectiveVerifier, 'objective verifier already active');
    requireThat(nonempty(event.session) && event.session !== state.context.coordinator && !state.sessions.includes(event.session), 'fresh unique verifier session distinct from coordinator/root required');
    requireThat(event.context?.fresh === true && event.context?.inheritedHistory === false && nonempty(event.context.source), 'fresh bounded verifier context provenance required');
    requireThat(event.capabilities?.spawn === true, 'spawn unavailable for verifier');
    requireThat(event.objectiveRevision === objectiveRevisionFor(state), 'stale verifier objective revision');
    state.objectiveVerifier = { session:event.session, role:'verifier', purpose:'objective', context:clone(event.context), objectiveRevision:event.objectiveRevision };
    state.sessions.push(event.session); return;
  }
  if (event.type === 'verifyObjective') {
    requireThat(state.objectiveVerifier, 'external verifier dispatch required');
    requireThat(!state.paused && !state.objectiveVerifier.invalidated && !state.objectiveVerifier.stopRequested, 'objective verifier is paused, invalidated or stopRequested; observe stop and redispatch');
    requireThat(state.objectiveVerifier.session === event.session && event.stopped === true, 'active verifier role/session and stopped observation required');
    requireThat(v3ConsumableComplete(state) && v3RequiredPackagesComplete(state), 'objective verification requires completed consumable scope');
    requireThat(event.objectiveRevision === state.objectiveVerifier.objectiveRevision && event.objectiveRevision === objectiveRevisionFor(state), 'stale objective revision');
    validateObjectiveEvent(event,state);
    const excluded = v3Scope(state).excludedTaskIds;
    if (excluded.length) {
      requireThat(event.verdict === 'fail', 'partial scope cannot pass the original objective');
      requireThat(excluded.every(id => event.remainingWork.includes(id)), 'partial objective proof must preserve every excluded task as remaining work');
    }
    // Replay proves only that the serialized event is structurally coherent. It
    // cannot prove that a host actually persisted or re-observed the receipt:
    // every byte in a journal can be authored by its caller. Host authority is
    // therefore deliberately absent from replay state and is qualified only by
    // the host bridge's process-local trust root.
    state.objectiveVerification = { ...clone(event), producer:{ role:'verifier', session:event.session }, authorityStatus:'structural_only' };
    archiveVerifier(state,'completed','objective proof recorded');return;
  }
  const task = event.taskId ? state.plan.tasks.find(item => item.id === event.taskId) : null;
  if (event.type === 'beginIntegration') throw new Error('journal v3 requires a distinct integrator dispatch');
  if (event.type === 'dispatch' && event.role === 'integrator') {
    requireThat(task && !isPackage(task), 'integrator requires executable task');
    const current = state.tasks[task.id], reason = dispatchReason(state, task, 'integrator', event.capabilities);
    requireThat(!reason, reason);
    requireThat(nonempty(event.session) && event.session !== state.context.coordinator && !state.sessions.includes(event.session), 'fresh unique integrator session distinct from coordinator/root required; session reuse forbidden');
    requireThat(event.context?.fresh === true && event.context?.inheritedHistory === false && nonempty(event.context.source), 'fresh bounded context provenance required');
    current.active = { session:event.session, role:'integrator', purpose:'integration', context:clone(event.context), claims:claimsFor(task,'integrator'), planRevision:state.plan.revision };
    current.status = 'integrating'; state.sessions.push(event.session); return;
  }
  if (event.type === 'integrate') {
    requireThat(task && !isPackage(task), 'integration requires executable task');
    const current = state.tasks[task.id]; activeSession(current,event,'integrator');
    requireThat(current.status === 'integrating', 'reserve integration before mutation');
    requireThat(nonempty(event.integrationRevision), 'missing integration revision');
    const evidence=event.integrationEvidence;
    requireThat(Array.isArray(evidence) && task.verification.every(command => evidence.some(item => item?.command === command && item.exitCode === 0 && item.revision === event.integrationRevision)) && evidence.every(item => item?.exitCode === 0 && item.revision === event.integrationRevision), 'missing passing or stale integration evidence');
    requireThat(!validateDelivery(task,{...current.receipt,status:'integrated',integrationRevision:event.integrationRevision,integrationEvidence:evidence,integrationReviews:{spec:event.integrationRevision,quality:event.integrationRevision,independent:true}},{requireObservedExecution:true}).some(error=>error.includes('observed execution metadata')),'integration evidence lacks observed execution metadata');
    current.receipt.integrationRevision=event.integrationRevision;current.receipt.integrationEvidence=clone(evidence);
    current.active=null;current.status='integration_pending';return;
  }
  if (event.type === 'progressRequested') {
    requireThat(task && !isPackage(task), 'progress requires executable task');
    const current=state.tasks[task.id];
    requireThat(current.status === 'accepted' && current.receipt?.status === 'integrated', 'progress requires accepted reconciled task');
    requireThat(event.planningRevision === state.plan.revision && event.contractRevision === task.contractRevision && event.integrationRevision === current.receipt.integrationRevision, 'progress revision mismatch');
    requireThat(nonempty(event.receiptDigest) && event.receiptDigest === digest(current.receipt), 'progress receipt digest mismatch');
    requireThat(nonempty(event.indexBeforeHash) && event.expectedChange?.from === '[ ]' && event.expectedChange?.to === '[x]', 'progress request requires index before hash and exact checkbox change');
    current.progress={status:'pending',planningRevision:event.planningRevision,contractRevision:event.contractRevision,integrationRevision:event.integrationRevision,receiptDigest:event.receiptDigest,indexBeforeHash:event.indexBeforeHash,expectedChange:clone(event.expectedChange)};
    current.status='progress_pending';return;
  }
  if (event.type === 'progressCommitted') {
    requireThat(task && !isPackage(task), 'progress requires executable task');
    const current=state.tasks[task.id], progress=current.progress;
    requireThat(current.status === 'progress_pending' && progress?.status === 'pending' && event.receiptDigest === progress.receiptDigest && event.indexBeforeHash === progress.indexBeforeHash, 'progressCommitted requires matching progressRequested receipt and before hash');
    requireThat(nonempty(event.indexAfterHash) && event.indexAfterHash !== event.indexBeforeHash, 'progress commit requires distinct readback after hash');
    current.progress={...progress,status:'committed',indexAfterHash:event.indexAfterHash};current.status='completed';return;
  }
  applyLegacy(state,event);
}

function replayVersion(journal, version, handler) {
  requireThat(journal?.version === version && Array.isArray(journal.events), 'unsupported journal version');
  const header = journalHeader(journal);
  const rebuilt = { ...header, digest: digest(header), events: [] };
  requireThat(rebuilt.digest === journal.digest, 'journal header digest mismatch');
  const excluded = new Set(version === 3 ? journal.context.executionScope.excludedTaskIds : []);
  const state = { version: 1, journalVersion: journal.version, plan: clone(journal.plan), context: clone(journal.context), sequence: 0, paused: null, sessions: [], objectiveVerification: null,
    ...(version===3?{objectiveGeneration:0,objectiveVerifier:null,objectiveVerifierHistory:[],objectiveVerificationHistory:[],objectiveInvalidationHistory:[]}:{}),...(journal.predecessor ? {predecessor:clone(journal.predecessor)} : {}),tasks: Object.fromEntries(journal.plan.tasks.map(task => [task.id, version===3?v3InitialTask(excluded.has(task.id)?'excluded':'pending'):initialTask()])) };
  Object.setPrototypeOf(state.tasks, null);
  if(version===3&&journal.predecessor?.acceptedImports) for(const imported of journal.predecessor.acceptedImports) {
    const task=journal.plan.tasks.find(item=>item.id===imported.taskId),current=state.tasks[imported.taskId];
    requireThat(task&&current&&!excluded.has(task.id)&&task.contractRevision===imported.contractRevision&&imported.sourceJournalDigest===journal.predecessor.digest&&
      imported.receiptDigest===digest(imported.receipt)&&imported.decisionDigest===digest(imported.decision)&&imported.integrationRevision===imported.receipt?.integrationRevision,
    `invalid predecessor reconciliation for ${imported.taskId}`);
    current.receipt=clone(imported.receipt);current.decision=clone(imported.decision);
    if(isPackage(task)) current.status='accepted'; else {current.status='completed';current.progress={status:'committed',source:'predecessor-reconciliation',receiptDigest:imported.receiptDigest,sourceJournalDigest:imported.sourceJournalDigest};}
  }
  let previous = journal.digest;
  for (const entry of journal.events) {
    requireThat(entry.sequence === state.sequence + 1 && entry.previous === previous && entry.digest === digest({ sequence: entry.sequence, previous: entry.previous, event: entry.event }), 'journal sequence/digest mismatch');
    handler(state, entry.event); state.sequence = entry.sequence; previous = entry.digest;
  }
  return state;
}
export const replayV1 = journal => replayVersion(journal,1,applyV1);
export const replayV2 = journal => replayVersion(journal,2,applyV2);
export const replayV3 = journal => replayVersion(journal,3,applyV3);
export function replay(journal) {
  if(journal?.version===1)return replayV1(journal);
  if(journal?.version===2)return replayV2(journal);
  if(journal?.version===3)return replayV3(journal);
  throw new Error('unsupported journal version');
}

export function appendEvent(journal, event, expectedSequence) {
  const state = replay(journal);
  requireThat(expectedSequence === state.sequence, 'stale expected sequence');
  requireThat(journal.version !== 3 || event.type !== 'verifyObjective',
    'verifyObjective is reserved for the host completion bridge');
  const storedEvent=journal.version===3&&event.type==='reviewResult'?{...clone(event),type:'review'}:clone(event);
  ({1:applyV1,2:applyV2,3:applyV3}[journal.version])(state, storedEvent);
  const entry = { sequence: state.sequence + 1, previous: journal.events.at(-1)?.digest ?? journal.digest, event: storedEvent };
  return { ...clone(journal), events: [...clone(journal.events), { ...entry, digest: digest(entry) }] };
}

export function assertCurrentPlan(journal, tasks) {
  const state = replay(journal);
  requireThat(compilePlan(tasks, state.plan.profile, { allowUnready: state.plan.version !== 1 }).revision === state.plan.revision, 'current contracts differ from accepted plan; replan required');
}

export function packetFor(journal, taskId) {
  const state = replay(journal), task = state.plan.tasks.find(task => task.id === taskId), current = state.tasks[taskId];
  requireThat(task && current.active && (state.journalVersion===3?v3TaskRoles:legacyRoles).includes(current.active.role), 'packet requires active worker assignment');
  const role = current.active.role;
  return { version: 1, planRevision: state.plan.revision, sequence: state.sequence, task: clone(task), assignment: clone(current.active),
    selection: clone(state.plan.profile.tiers[task.tier][role==='integrator'?'executor':role]), coordinator: state.context.coordinator,
    authorizationReference: clone(state.context.authorization), coordinationContext: clone(state.context), executionAuthorized: false,
    readScope: clone(state.context.readScope), skills: clone(task.orchestration.skills), references: clone(task.orchestration.references),
    candidateRevision: role === 'reviewer' ? current.active.purpose === 'candidate' ? current.receipt.revision : current.receipt.integrationRevision : null,
    candidateScope: role === 'reviewer' ? { baseRevision: current.receipt.baseRevision,
      revision: current.active.purpose === 'candidate' ? current.receipt.revision : current.receipt.integrationRevision,
      changedFiles: clone(current.receipt.changedFiles), preexistingChangedFiles: clone(current.receipt.preexistingChangedFiles ?? []),
      reviewBoundary: clone(current.active.reviewBoundary ?? null) } : null,
    reviewInstruction: role === 'reviewer' ? 'First inspect the contract and frozen candidate independently. Request executor evidence only after recording initial findings. Verify host isolation; fresh context alone is not filesystem isolation.' : null };
}

// A host must consume this after transitions/status; this does not spawn or grant authority.
export function continuation(journal, capabilities) {
  const state = replay(journal);
  const result = { version: 1, sequence: state.sequence, planRevision: state.plan.revision,
    objectiveComplete: false, executionAuthorized: false, actions: [], blockers: {} };
  if (state.objectiveVerification) return { ...result, disposition:'await_host_reobservation', objectiveVerification:clone(state.objectiveVerification), active:[] };
  if (state.paused) return { ...result, disposition: 'paused', pause: state.paused };
  // Alternatives are re-evaluated after each action; do not dispatch both waves from this snapshot.
  for (const role of ['reviewer', 'executor']) {
    const wave = readyWave(journal, capabilities, role);
    for (const taskId of wave.selected) result.actions.push({ operation: role, taskId });
    result.blockers[role] = wave.blocked;
  }
  for (const [taskId, current] of Object.entries(state.tasks)) {
    const operation = current.status === 'reviewed' ? (state.journalVersion===3?'integrator':'integration') : current.status === 'forensic_pending' ? 'acceptance' : current.status === 'accepted' && state.journalVersion===3 && !isPackage(state.plan.tasks.find(task=>task.id===taskId)) ? 'progress' : null;
    const contract = state.plan.tasks.find(task => task.id === taskId);
    if (isPackage(contract) && !contract.readinessErrors?.length && current.status === 'pending' && !current.operationBlocks?.acceptance && [...contract.dependsOn, ...childrenOf(state.plan.tasks, taskId).map(child => child.id)].every(id => dependencyComplete(state,id))) result.actions.push({ operation: 'packageAcceptance', taskId });
    if (operation && !current.operationBlocks?.[operation]) result.actions.push({ operation, taskId });
    if (isPackage(contract) && contract.readinessErrors?.length) result.blockers[taskId] = { packageAcceptance: contract.readinessErrors };
    if (current.operationBlocks) result.blockers[taskId] = clone(current.operationBlocks);
  }
  const active = Object.entries(state.tasks).filter(([, task]) => task.active).map(([id]) => id);
  if(state.objectiveVerifier)active.push('objective');
  const complete = state.journalVersion===3 ? v3ConsumableComplete(state) && v3RequiredPackagesComplete(state) : Object.values(state.tasks).every(task => task.status === 'accepted');
  // Task coverage is necessary, not sufficient for the objective. Root checks the final outcome.
  return { ...result, active, disposition: state.objectiveVerifier ? 'wait' : active.length ? 'await_workers' : complete ? 'verify_objective' : result.actions.length ? 'continue' : 'blocked' };
}

export function objectiveSnapshot(journal) {
  const state = replay(journal);
  const complete=state.journalVersion===3?v3ConsumableComplete(state)&&v3RequiredPackagesComplete(state):Object.values(state.tasks).every(task => task.status === 'accepted');
  requireThat(complete && Object.values(state.tasks).every(task=>!task.active) && !state.objectiveVerifier, 'objective snapshot requires every consumable task completed and no active worker');
  const basis=objectiveVerificationBasis(state);
  return { version:1, planRevision:state.plan.revision, sequence:state.sequence, objectiveRevision:digest(basis),
    ...(state.journalVersion===3&&state.context.immutableIntake?{immutableIntake:clone(state.context.immutableIntake),intakeDigest:state.context.intakeDigest,
      canonicalReferences:clone(state.context.canonicalReferences),contextDigest:basis.contextDigest}:{}),
    ...(state.journalVersion===3?{executionScope:clone(state.context.executionScope)}:{}),accepted:state.plan.tasks.filter(task=>state.tasks[task.id].status!=='excluded').map(task=>({taskId:task.id,integrationRevision:state.tasks[task.id].receipt?.integrationRevision})) };
}
