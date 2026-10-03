import { createHash } from 'node:crypto';
import { validateTasks, validateReadiness, validateDelivery, affectedTasks, safePath } from './contracts.mjs';

const tiers = ['bounded', 'medium', 'high'];
const roles = ['executor', 'reviewer'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(nonempty);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const norm = value => value.normalize('NFC').toLowerCase();
const authorization = value => value && nonempty(value.source) && nonempty(value.scope);
const initialTask = () => ({ status: 'pending', active: null, receipt: null, reviews: [], executorSessions: [], blocker: null, decision: null });

// Additive protocol; legacy contracts and Accelerate intake are unchanged.
export function compilePlan(tasks, profile, { allowUnready = false } = {}) {
  const errors = validateTasks(tasks);
  requireThat(!errors.length, errors.join('; '));
  requireThat(profile?.version === 1, 'unsupported profile version');
  for (const tier of tiers) for (const role of roles) {
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
      requireThat(metadata && ['complexity', 'uncertainty', 'risk'].every(key => tiers.includes(metadata[key])) && nonempty(metadata.rationale), `${task.id}: justified classification required`);
      requireThat(strings(metadata.skills) && metadata.skills.length && strings(metadata.references) && metadata.references.length, `${task.id}: bounded skills and references required`);
      requireThat(Array.isArray(metadata.claims), `${task.id}: claims must be declared`);
      for (const claim of metadata.claims) requireThat(nonempty(claim?.name) && ['read', 'write', 'exclusive'].includes(claim.mode) && Array.isArray(claim.roles) && claim.roles.length && claim.roles.every(role => roles.includes(role)), `${task.id}: invalid resource claim`);
      tier = tiers[Math.max(...['complexity', 'uncertainty', 'risk'].map(key => tiers.indexOf(metadata[key])))];
    } catch (error) { if (!allowUnready) throw error; errors.push(error.message); }
    // Recompute derived readiness, never trust caller-supplied diagnostics.
    const { readinessErrors: ignored, ...source } = clone(task);
    return { ...source, tier, ...(allowUnready ? { readinessErrors: errors } : {}) };
  });
  const plan = { version: allowUnready ? 2 : 1, tasks: compiled, profile: clone(profile) };
  return { ...plan, revision: digest(plan) };
}

function checkPlan(plan) {
  requireThat([1, 2].includes(plan?.version), 'unsupported plan version');
  const rebuilt = compilePlan(plan.tasks, plan.profile, { allowUnready: plan.version === 2 });
  requireThat(digest(rebuilt) === digest(plan), 'plan revision/content mismatch');
}

export function renderDag(plan) {
  checkPlan(plan);
  const lines = ['flowchart TD'];
  const index = new Map(plan.tasks.map((task, i) => [task.id, `t${i}`]));
  for (const task of plan.tasks) lines.push(`    ${index.get(task.id)}["${task.id} · ${task.tier}"]`);
  for (const task of plan.tasks) for (const dep of task.dependsOn) lines.push(`    ${index.get(dep)} --> ${index.get(task.id)}`);
  return lines.join('\n');
}

export function createJournal(plan, context) {
  checkPlan(plan);
  requireThat(nonempty(context?.coordinator) && authorization(context.authorization) && strings(context.readScope) && context.readScope.length, 'coordinator, authorization source/scope and read scope required');
  const header = { version: 1, plan: clone(plan), context: clone(context) };
  return { ...header, digest: digest(header), events: [] };
}

function claimsFor(task, role) {
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
function dispatchReason(state, task, role, capabilities, reserved = []) {
  const current = state.tasks[task.id];
  if (state.paused) return `paused: ${state.paused.reason}`;
  if (task.readinessErrors?.length) return task.readinessErrors.join('; ');
  if (current.operationBlocks?.[role]) return `blocked ${role}: ${current.operationBlocks[role].reason}`;
  if (current.active) return `active ${current.active.session}`;
  if (role === 'executor' && current.status !== 'pending') return current.blocker ? `blocked by ${current.blocker.owner}: ${current.blocker.reason}` : `state ${current.status}`;
  if (role === 'reviewer' && !['delivered', 'integration_pending'].includes(current.status)) return `state ${current.status}`;
  const missing = task.dependsOn.filter(id => state.tasks[id].status !== 'accepted');
  if (missing.length) return `dependencies: ${missing.join(', ')}`;
  if (capabilities?.spawn !== true) return 'spawn unavailable; use explicitly recorded host/manual workflow';
  const selection = state.plan.profile.tiers[task.tier][role];
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
  requireThat(roles.includes(role), 'unknown role');
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
function receiptErrors(task, receipt) {
  const errors = validateDelivery(task, receipt);
  requireThat(!errors.length, errors.join('; '));
}
function apply(state, event) {
  if (event.type === 'pause') {
    requireThat(nonempty(event.source) && nonempty(event.reason), 'explicit pause source/reason required');
    state.paused = { source: event.source, reason: event.reason }; return;
  }
  if (event.type === 'resume') {
    requireThat(state.paused && authorization(event.authorization) && nonempty(event.reason), 'resume requires pause and authorization');
    state.paused = null; state.context.authorization = clone(event.authorization); return;
  }
  if (event.type === 'replan') {
    checkPlan(event.plan);
    requireThat(nonempty(event.reason) && authorization(event.authorization), 'replan reason and authorization reference required');
    // Removing tasks loses audit identity; retire work with a blocked disposition instead.
    requireThat(state.plan.tasks.every(task => event.plan.tasks.some(next => next.id === task.id)), 'replan cannot remove task identities');
    const profileChanged = digest(state.plan.profile) !== digest(event.plan.profile);
    const changed = event.plan.tasks.filter(task => profileChanged || digest(task) !== digest(state.plan.tasks.find(old => old.id === task.id) ?? null)).map(task => task.id);
    const affected = affectedTasks(event.plan.tasks, changed);
    for (const id of affected) requireThat(!state.tasks[id]?.active, `replan blocked by active worker ${id}`);
    for (const id of affected) state.tasks[id] = initialTask();
    state.plan = clone(event.plan); state.context.authorization = clone(event.authorization);
    return;
  }
  const task = state.plan.tasks.find(task => task.id === event.taskId);
  requireThat(task, `unknown task ${event.taskId}`);
  const current = state.tasks[task.id];
  switch (event.type) {
    case 'operationBlock':
      requireThat(['executor', 'reviewer', 'integration', 'acceptance'].includes(event.operation) && nonempty(event.owner) && nonempty(event.reason) && current.status !== 'accepted', 'operation blocker requires stage, owner and reason; reopen accepted work first');
      current.operationBlocks ??= {};
      current.operationBlocks[event.operation] = { owner: event.owner, reason: event.reason }; break;
    case 'operationUnblock':
      requireThat(current.operationBlocks?.[event.operation] && nonempty(event.reason), 'existing operation blocker and resolution required');
      delete current.operationBlocks[event.operation]; break;
    case 'dispatch': {
      requireThat(roles.includes(event.role), 'unknown role');
      const reason = dispatchReason(state, task, event.role, event.capabilities);
      requireThat(!reason, reason);
      requireThat(nonempty(event.session) && event.session !== state.context.coordinator && !state.sessions.includes(event.session), 'fresh independent unique session required');
      requireThat(event.context?.fresh === true && event.context?.inheritedHistory === false && nonempty(event.context.source), 'fresh bounded context provenance required');
      const purpose = event.role === 'executor' ? 'implementation' : current.status === 'delivered' ? 'candidate' : 'integration';
      current.active = { session: event.session, role: event.role, purpose, context: clone(event.context), claims: claimsFor(task, event.role), planRevision: state.plan.revision };
      state.sessions.push(event.session);
      if (event.role === 'executor') { current.executorSessions.push(event.session); current.status = 'executing'; }
      else current.status = 'reviewing';
      break;
    }
    case 'deliver':
      activeSession(current, event, 'executor');
      requireThat(current.status === 'executing', 'task not executing');
      requireThat(event.receipt?.status === 'delivered', 'executor may only deliver');
      receiptErrors(task, event.receipt);
      current.receipt = clone(event.receipt); current.active = null; current.status = 'delivered';
      break;
    case 'reviewResult': {
      activeSession(current, event, 'reviewer');
      requireThat(current.status === 'reviewing', 'review not active');
      const purpose = current.active.purpose;
      const revision = purpose === 'candidate' ? current.receipt.revision : current.receipt.integrationRevision;
      requireThat(event.revision === revision, 'stale review revision');
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
        receiptErrors(task, current.receipt);
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
        receiptErrors(task, current.receipt);
        requireThat(task.dependsOn.every(id => state.tasks[id].status === 'accepted'), 'dependencies no longer accepted');
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
      for (const id of affected) state.tasks[id] = initialTask();
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

export function replay(journal) {
  requireThat(journal?.version === 1 && Array.isArray(journal.events), 'unsupported journal version');
  const rebuilt = createJournal(journal.plan, journal.context);
  requireThat(rebuilt.digest === journal.digest, 'journal header digest mismatch');
  const state = { version: 1, plan: clone(journal.plan), context: clone(journal.context), sequence: 0, paused: null, sessions: [], tasks: Object.fromEntries(journal.plan.tasks.map(task => [task.id, initialTask()])) };
  Object.setPrototypeOf(state.tasks, null);
  let previous = journal.digest;
  for (const entry of journal.events) {
    requireThat(entry.sequence === state.sequence + 1 && entry.previous === previous && entry.digest === digest({ sequence: entry.sequence, previous: entry.previous, event: entry.event }), 'journal sequence/digest mismatch');
    apply(state, entry.event); state.sequence = entry.sequence; previous = entry.digest;
  }
  return state;
}

export function appendEvent(journal, event, expectedSequence) {
  const state = replay(journal);
  requireThat(expectedSequence === state.sequence, 'stale expected sequence');
  apply(state, event);
  const entry = { sequence: state.sequence + 1, previous: journal.events.at(-1)?.digest ?? journal.digest, event: clone(event) };
  return { ...clone(journal), events: [...clone(journal.events), { ...entry, digest: digest(entry) }] };
}

export function assertCurrentPlan(journal, tasks) {
  const state = replay(journal);
  requireThat(compilePlan(tasks, state.plan.profile, { allowUnready: state.plan.version === 2 }).revision === state.plan.revision, 'current contracts differ from accepted plan; replan required');
}

export function packetFor(journal, taskId) {
  const state = replay(journal), task = state.plan.tasks.find(task => task.id === taskId), current = state.tasks[taskId];
  requireThat(task && current.active && roles.includes(current.active.role), 'packet requires active executor/reviewer assignment');
  const role = current.active.role;
  return { version: 1, planRevision: state.plan.revision, sequence: state.sequence, task: clone(task), assignment: clone(current.active),
    selection: clone(state.plan.profile.tiers[task.tier][role]), coordinator: state.context.coordinator,
    authorizationReference: clone(state.context.authorization), coordinationContext: clone(state.context), executionAuthorized: false,
    readScope: clone(state.context.readScope), skills: clone(task.orchestration.skills), references: clone(task.orchestration.references),
    candidateRevision: role === 'reviewer' ? current.active.purpose === 'candidate' ? current.receipt.revision : current.receipt.integrationRevision : null,
    reviewInstruction: role === 'reviewer' ? 'First inspect the contract and frozen candidate independently. Request executor evidence only after recording initial findings. Verify host isolation; fresh context alone is not filesystem isolation.' : null };
}

// A host must consume this after transitions/status; this does not spawn or grant authority.
export function continuation(journal, capabilities) {
  const state = replay(journal);
  const result = { version: 1, sequence: state.sequence, planRevision: state.plan.revision,
    objectiveComplete: false, executionAuthorized: false, actions: [], blockers: {} };
  if (state.paused) return { ...result, disposition: 'paused', pause: state.paused };
  // Alternatives are re-evaluated after each action; do not dispatch both waves from this snapshot.
  for (const role of ['reviewer', 'executor']) {
    const wave = readyWave(journal, capabilities, role);
    for (const taskId of wave.selected) result.actions.push({ operation: role, taskId });
    result.blockers[role] = wave.blocked;
  }
  for (const [taskId, current] of Object.entries(state.tasks)) {
    const operation = current.status === 'reviewed' ? 'integration' : current.status === 'forensic_pending' ? 'acceptance' : null;
    if (operation && !current.operationBlocks?.[operation]) result.actions.push({ operation, taskId });
    if (current.operationBlocks) result.blockers[taskId] = clone(current.operationBlocks);
  }
  const active = Object.entries(state.tasks).filter(([, task]) => task.active).map(([id]) => id);
  const complete = Object.values(state.tasks).every(task => task.status === 'accepted');
  // Task coverage is necessary, not sufficient for the objective. Root checks the final outcome.
  return { ...result, active, disposition: complete ? 'verify_objective' : result.actions.length ? 'continue' : active.length ? 'await_workers' : 'blocked' };
}
