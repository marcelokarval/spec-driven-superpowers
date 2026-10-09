import { createHash } from 'node:crypto';
import { compilePlanningPlan } from './planning-graph.mjs';
import { validatePlanningCoverage } from './planning-coverage.mjs';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const ids = x => Array.isArray(x) && x.every(text) && new Set(x).size === x.length;
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
export const PLANNING_LAYERS = Object.freeze(Array.from({ length: 16 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`));
const states = ['draft','reviewing','ready','delivered','partial','blocked','superseded'];
const complete = x => ['satisfied','reused'].includes(x.status);
// Deterministic identity of supplied metadata and declared artifact hashes, NOT a
// filesystem check. Reviews/manifest/readback are excluded to avoid circularity.
// T06/T09 may add stronger source inventory/store verification without execution.
export function planningCandidateSha256(m) {
  return createHash('sha256').update(JSON.stringify([m.packageId,m.revision,m.originalRequestedProduct,
    m.authority,m.tasks?.map(({ implementationStatus, ...task }) => task),m.decisions,m.blockers,m.coverage,
    m.references?.filter(r => r.role !== 'review')])).digest('hex');
}

// Readback identity binds every declared artifact (including review bytes/path)
// and delivery metadata. Excludes receipt and mutable transition bookkeeping,
// not reviews: this identity is recorded AFTER reviews, so no circularity.
// Hashes are supplied claims; computing this digest does NOT inspect a store.
export function planningReadbackSha256(m) {
  return createHash('sha256').update(JSON.stringify([planningCandidateSha256(m),
    m.schemaVersion,m.returnVersion,m.author,m.reviewPolicy,m.parallelism,m.layers,
    { ...m.planningContribution, usableTasks: undefined },m.references,m.reviews])).digest('hex');
}

/** Pure gates for planning-delivery/1. No persistence or semantic reviewer here.
 * Additive review envelope: existing T01 fields + liveEvidence (external evidence
 * reference), scopeTaskIds (leaf IDs), findings [{severity,status}]. Explicit
 * T05 values: severity material/non-material; status open/resolved (case-sensitive).
 * Material findings must be resolved; non-material open findings may remain.
 * Additive T05 decision marker material:true accepts only case-sensitive status
 * resolved/pending/unresolved/proposed. Missing/invalid status fails closed even
 * with a blocker; every valid non-resolved material choice requires a blocker.
 * This is not an enum imposed on T01 decisions or the separate T04 coverage table.
 * Absent/false material markers retain legacy/non-material behavior; no prose
 * classification, approval or automatic resolution is inferred by this gate.
 * These additive envelope values express the contract's material-defect boundary,
 * not a semantic classification inferred by this gate. The supplier
 * is responsible for actual review, actor authentication and complete inventory;
 * pass/fingerprint is consumed, never manufactured. Independent mode also needs
 * manifest.author and reviewer != author. Synthetic evidence never passes live gates.
 * Additive receipt: revision/candidateSha256/readbackSha256/destination, exact referenceIds,
 * taskIds, evidence, verifiedBy, checks {bytes,files,ids,relations,decisions,reviews},
 * matched, synthetic:false, executionEvidence:false. This validates a supplied
 * store-adapter assertion; storeVerified:false ALWAYS, not proof files exist.
 * layers.blocked may supply affectedTasks; absent scope is a global blocker.
 * C15 is evaluated but deferred for ready; mandatory C07–C16 cannot be N/A.
 * coverage is the explicit T04 document; absent reports not-evaluated, not invalid.
 * Intake received/accepted and destination authority are separate gates.
 */
export function evaluatePlanningLifecycle(m) {
  const errors = [], layers = [], questions = [];
  let coverage = { structuralStatus:'not-evaluated', semanticStatus:'need-review', executionPerformed:false };
  const result = (readyTaskIds = [], blockedTaskIds = [], draftableTaskIds = [], readbackMatched = false) => ({
    errors, layers, questions, coverage, readyTaskIds, blockedTaskIds, draftableTaskIds,
    canReady: errors.length === 0 && readyTaskIds.length > 0 && blockedTaskIds.length === 0,
    canDeliver: errors.length === 0 && readyTaskIds.length > 0 && blockedTaskIds.length === 0 && readbackMatched,
    canPartial: errors.length === 0 && readyTaskIds.length > 0 && blockedTaskIds.length > 0 && readbackMatched,
    executionPerformed:false, storeVerified:false,
    evidenceLimit:'Supplied review/readback envelopes only; no semantic certification, authentication or filesystem verification.',
  });
  if (!object(m)) { errors.push('planning package must be an object'); return result(); }
  if (!object(m.planningContribution) || m.planningContribution.executionPerformed !== false ||
      !object(m.originalRequestedProduct) ||
      (m.originalRequestedProduct.kind === 'implementation' && m.originalRequestedProduct.status !== 'not_fulfilled')) errors.push('planning contribution cannot certify implementation');
  if (m.coverage !== undefined) {
    coverage = validatePlanningCoverage(m.coverage);
    errors.push(...coverage.errors);
    // Prevent a valid coverage table for a DIFFERENT candidate from becoming a gate.
    if (coverage.structuralStatus === 'valid' && Array.isArray(m.tasks) && m.tasks.every(object) &&
        JSON.stringify(m.tasks.map(t=>[t.id,t.nodeType,t.parentId ?? null,t.requirements])) !==
        JSON.stringify(m.coverage.tasks.map(t=>[t.id,t.nodeType,t.parentId ?? null,t.requirements]))) errors.push('coverage task inventory differs from candidate');
  }
  if (m.schemaVersion !== 'asds.planning-delivery/1' || !text(m.packageId) || !text(m.revision) || !states.includes(m.state)) errors.push('invalid planning identity/state');
  if (!Array.isArray(m.tasks) || !m.tasks.length || !m.tasks.every(object) ||
      !Array.isArray(m.references) || !m.references.length || !m.references.every(object) ||
      !object(m.layers) || !Array.isArray(m.blockers) || !m.blockers.every(object) ||
      !Array.isArray(m.decisions) || !m.decisions.every(object) || !Array.isArray(m.reviews) || !m.reviews.every(object)) {
    errors.push('invalid planning tables'); return result();
  }
  const references = new Map(m.references.map(r=>[r.id,r]));
  if (references.size !== m.references.length || m.references.some(r=>!text(r.id)||!text(r.path)||!hash(r.sha256))) errors.push('invalid reference identity/hash');
  let graph;
  try { graph = compilePlanningPlan(m.tasks); } catch (error) { errors.push(error.message); return result(); }
  const all = new Set(m.tasks.map(t=>t.id)), blocked = new Set();
  const scope = (affected, label) => {
    if (affected === undefined) return graph.leaves;
    if (!ids(affected) || !affected.length || affected.some(id=>!all.has(id))) { errors.push(`${label}: invalid affectedTasks`); return graph.leaves; }
    const roots = new Set(affected);
    // Composition only expands DOWN; blocked child never contaminates siblings.
    let changed = true;
    while (changed) { changed=false; for (const t of m.tasks) if (roots.has(t.parentId) && !roots.has(t.id)) { roots.add(t.id); changed=true; } }
    return graph.leaves.filter(id=>roots.has(id));
  };
  for (const id of Object.keys(m.layers)) if (!PLANNING_LAYERS.includes(id)) errors.push(`unknown layer ${id}`);
  for (const id of PLANNING_LAYERS) {
    const layer = m.layers[id];
    layers.push({ id, status: layer?.status ?? 'not-evaluated', reason: layer?.reason ?? null });
    if (!object(layer) || !['satisfied','reused','not_applicable','blocked'].includes(layer.status) || !text(layer.reason) ||
        !ids(layer.references) || layer.references.some(ref=>!references.has(ref)) ||
        (layer.status !== 'blocked' && !layer.references.length)) { errors.push(`${id}: invalid layer evaluation/references/reason`); continue; }
    if (layer.status === 'not_applicable' && Number(id.slice(1)) >= 7) errors.push(`${id}: mandatory layer cannot be not_applicable`);
    if (layer.status === 'blocked' && id !== 'C15') for (const task of scope(layer.affectedTasks,id)) blocked.add(task);
  }
  const blockerIds = new Set();
  for (const b of m.blockers) {
    if (!['id','owner','question','consequence','resolution'].every(key=>text(b[key])) || blockerIds.has(b.id)) errors.push('invalid blocker responsibility/resolution/id');
    blockerIds.add(b.id);
    for (const task of scope(b.affectedTasks,b.id)) blocked.add(task);
    if (b.decisionId !== undefined) {
      const d=m.decisions.find(d=>d.id===b.decisionId);
      if (!d || d.status === 'resolved') errors.push(`${b.id}: unknown or already resolved decision`);
      else questions.push({decisionId:d.id,owner:b.owner,question:b.question,affectedTasks:b.affectedTasks});
    }
  }
  for (const d of m.decisions) if (d.material === true) {
    if (!['resolved','pending','unresolved','proposed'].includes(d.status)) errors.push(`${d.id}: invalid material decision status`);
    else if (d.status !== 'resolved' && !m.blockers.some(b=>b.decisionId===d.id)) errors.push(`${d.id}: unresolved material decision needs blocker`);
  }
  // Effective DAG includes aggregate dependencies. Propagate planning defects,
  // never wait for implementation completion or scheduler reservations.
  let changed = true;
  while (changed) { changed=false; for (const id of graph.leaves) if (!blocked.has(id) && graph.dependencies[id].some(dep=>blocked.has(dep))) { blocked.add(id); changed=true; } }
  const fingerprint = planningCandidateSha256(m), policy=m.reviewPolicy;
  if (!object(policy) || !text(policy.risk) || typeof policy.independentRequired !== 'boolean') errors.push('invalid review policy');
  const independent = policy?.independentRequired === true || policy?.risk !== 'ordinary-low';
  const usable=graph.leaves.filter(id=>!blocked.has(id));
  // Require exactly one current fidelity then one quality envelope. Historical
  // reviews belong outside current candidate; conservative fail-closed ordering.
  if (m.reviews.length !== 2 || m.reviews[0]?.kind !== 'fidelity' || m.reviews[1]?.kind !== 'quality') errors.push('current fidelity then quality reviews required');
  for (const r of m.reviews) {
    if (r.revision !== m.revision || r.candidateSha256 !== fingerprint || r.verdict !== 'pass' ||
        m.synthetic === true || r.synthetic !== false || !text(r.liveEvidence) || !text(r.reviewer) || !references.has(r.reference) ||
        !['self-review','independent'].includes(r.mode) || !ids(r.scopeTaskIds) || r.scopeTaskIds.some(id=>!graph.leaves.includes(id)) ||
        usable.some(id=>!r.scopeTaskIds.includes(id)) || !Array.isArray(r.findings) ||
        r.findings.some(f=>!object(f) || !['material','non-material'].includes(f.severity) ||
          !['open','resolved'].includes(f.status) || (f.severity==='material' && f.status!=='resolved')) ||
        (independent && (r.mode!=='independent' || !text(m.author) || r.reviewer===m.author))) errors.push(`${r.kind}: stale/insufficient review envelope`);
  }
  const rb=m.readback;
  // C15 is a claim that persistence/readback already happened. Keep that claim
  // fail-closed even before the package reaches ready/delivered: a reviewing
  // manifest may carry a draft receipt, but it may not call the layer satisfied
  // while leaving the receipt absent or structurally anonymous.
  if (complete(m.layers.C15) && (!object(rb) || rb.status !== 'matched' ||
      rb.revision !== m.revision || rb.destination !== m.authority?.destination ||
      !text(rb.evidence) || !text(rb.verifiedBy))) {
    errors.push('C15 satisfied requires a durable matching readback receipt');
  }
  const authorized=object(m.authority) && text(m.authority.destination) && text(m.authority.authorization);
  const readbackMatched=authorized && object(rb) && rb.status==='matched' && rb.revision===m.revision &&
    rb.candidateSha256===fingerprint && rb.readbackSha256===planningReadbackSha256(m) &&
    rb.destination===m.authority.destination && rb.synthetic===false &&
    m.synthetic!==true && rb.executionEvidence===false && text(rb.evidence) && text(rb.verifiedBy) &&
    ids(rb.referenceIds) && rb.referenceIds.length===references.size && rb.referenceIds.every(id=>references.has(id)) &&
    ids(rb.taskIds) && rb.taskIds.length===usable.length && usable.every(id=>rb.taskIds.includes(id)) &&
    object(rb.checks) && ['bytes','ids','relations','decisions','reviews','files'].every(key=>rb.checks[key]===true) &&
    object(m.layers.C15) && complete(m.layers.C15) && object(m.layers.C16) && complete(m.layers.C16);
  return result(errors.length ? [] : usable, [...blocked].sort(), graph.leaves, Boolean(readbackMatched));
}

const transitions = {
  draft:['reviewing','blocked'], reviewing:['draft','ready','partial','blocked'],
  ready:['draft','reviewing','delivered','partial','blocked'],
  partial:['draft','reviewing','blocked','superseded'], blocked:['draft','reviewing','superseded'],
  delivered:['superseded'], superseded:[],
};
export function transitionPlanning(m, state, { intake, successor } = {}) {
  if (m.attendanceOutcome === 'cancelled') throw new Error('cancelled attendance cannot reopen planning');
  if (!transitions[m.state]?.includes(state)) throw new Error(`invalid planning transition ${m.state} -> ${state}`);
  if (state==='reviewing' && (!intake || intake.received!==true || intake.planningAccepted!==true)) throw new Error('intake received and planning acceptance required');
  const e=evaluatePlanningLifecycle(m);
  if (state==='ready' && !e.canReady) throw new Error(`planning ready gate: ${e.errors.join('; ')}; blocked layers/tasks`);
  if ((state==='delivered' && !e.canDeliver) || (state==='partial' && !e.canPartial)) throw new Error(`planning readback/review gate: ${e.errors.join('; ')}`);
  if (state==='superseded' && (!object(successor) || successor.packageId!==m.packageId || !text(successor.revision) ||
      successor.revision===m.revision || !['ready','delivered','partial'].includes(successor.state) ||
      !evaluatePlanningLifecycle(successor)[{ready:'canReady',delivered:'canDeliver',partial:'canPartial'}[successor.state]])) throw new Error('coherent identified successor required');
  const next=structuredClone(m); next.state=state;
  if (state==='delivered' || state==='partial') {
    next.attendanceOutcome=state==='delivered' ? 'planning_delivered' : 'planning_partial';
    next.planningContribution={...next.planningContribution,executionPerformed:false,usableTasks:e.readyTaskIds};
  }
  if (state==='superseded') next.supersededBy=successor.revision;
  return next;
}
/** New revision invalidates evidence conservatively, not a storage transaction.
 * Caller retains previous revision; this function does not delete/edit it. */
export function revisePlanning(m, revision) {
  if (m.attendanceOutcome === 'cancelled') throw new Error('cancelled attendance cannot reopen planning');
  if (!text(revision) || revision===m.revision) throw new Error('new distinct revision required');
  const next=structuredClone(m); next.revision=revision; next.state='draft'; next.attendanceOutcome='planning_in_progress';
  next.reviews=[]; next.readback=null;
  for (const id of ['C12','C13','C14','C15','C16']) next.layers[id]={status:'blocked',reason:'New revision requires fresh evidence',references:[]};
  return next;
}
export function cancelPlanning(m, reason) {
  if (!text(reason)) throw new Error('cancellation reason required');
  const next=structuredClone(m); next.attendanceOutcome='cancelled';
  next.cancellation={reason,retainedRevision:m.revision,retainedState:m.state};
  return next;
}
