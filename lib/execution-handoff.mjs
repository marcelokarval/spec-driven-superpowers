import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compilePlanningPlan, projectTaskManager } from './planning-graph.mjs';
import { projectionSourceDigest, scopePlanningProjection } from './plan-projection.mjs';
import { validatePlanningDelivery } from './validation.mjs';
import { HARNESS_REVIEW_VERSION, verifyHarnessReviewFiles } from './harness-planning-review.mjs';

export const EXECUTION_HANDOFF_VERSION = 'asds.execution-handoff/1';
const MAX_OBSERVATION_AGE_MS = 5 * 60 * 1000;
const INPUT_FIELDS = new Set(['packageRoot', 'requestContext', 'author', 'selection', 'grants', 'destination', 'workspace', 'coordinatorBoundary', 'now']);
const ENVELOPE_FIELDS = new Set([
  'schemaVersion', 'packageRoot', 'packageRootRealpath', 'packageId', 'planningRevision',
  'planningManifest', 'canonicalIndex', 'planningFingerprint', 'taskManager',
  'executionScope', 'partialScope', 'planningReturn', 'requestContext', 'author',
  'selection', 'grants', 'destination', 'coordinatorBoundary', 'authorization',
  'projectRootRealpath', 'workspaceId', 'repoIdentity', 'workspaceBaselineFingerprint',
  'roleProfile', 'createdAt',
]);
const DERIVED_FIELDS = new Set([
  'schemaVersion', 'packageId', 'planningRevision', 'planningManifest', 'canonicalIndex',
  'packageRootRealpath', 'projectRootRealpath', 'workspaceId', 'repoIdentity',
  'planningFingerprint', 'workspaceBaselineFingerprint', 'taskManager', 'executionScope',
  'partialScope', 'planningReturn', 'authorization', 'roleProfile', 'createdAt',
]);
const AUTHORITY_BINDING_FIELDS = new Set([
  'requestId', 'packageId', 'planningRevision', 'planningFingerprint', 'consumableTaskIds',
]);

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const texts = value => Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const clone = value => structuredClone(value);
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const serialized = value => JSON.stringify(canonical(value));
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : serialized(value)).digest('hex');
const equal = (left, right) => serialized(left) === serialized(right);
const ROLE_PROFILE = Object.freeze({ coordinator: 'read-only-orchestration', executor: 'one-leaf-implementation', reviewer: 'independent-read-only-review', integrator: 'delegated-integration', verifier: 'independent-objective-verification', coordinatorMayImplement: false, selfReviewAllowed: false });

function exactKeys(value, allowed, label) {
  if (!object(value) || !equal(Object.keys(value).sort(), [...allowed].sort())) fail(`${label} has unknown fields or missing required fields`);
}

export class ExecutionHandoffError extends Error {
  constructor(message, code = 'ASDS_EXECUTION_HANDOFF_INVALID', options) {
    super(message, options);
    this.name = 'ExecutionHandoffError';
    this.code = code;
  }
}

function fail(message, code, cause) {
  throw new ExecutionHandoffError(message, code, cause ? { cause } : undefined);
}

function instant(value, label) {
  if (!text(value) || !Number.isFinite(Date.parse(value))) fail(`${label} must be an ISO timestamp`);
  return Date.parse(value);
}

function currentObservation(value, label, nowMs) {
  const observed = instant(value, `${label}.observedAt`);
  if (observed > nowMs || nowMs - observed > MAX_OBSERVATION_AGE_MS) fail(`${label} observation is stale`);
}

function safeRelative(value, label) {
  if (!text(value) || path.isAbsolute(value) || value.includes('\0') || value.includes('\\')) fail(`${label} must be a safe relative path`);
  const normalized = value.replaceAll('\\', '/');
  if (normalized.split('/').some(part => !part || part === '.' || part === '..')) fail(`${label} must be a safe relative path`);
  return normalized;
}

function realDirectory(value, label) {
  try {
    const resolved = fs.realpathSync.native(value);
    if (!fs.statSync(resolved).isDirectory()) fail(`${label} must be a directory`);
    return resolved;
  } catch (cause) {
    if (cause instanceof ExecutionHandoffError) throw cause;
    fail(`${label} is not an accessible directory`, undefined, cause);
  }
}

function readBoundFile(root, relative) {
  const safe = safeRelative(relative, 'planning reference path');
  let current = root;
  for (const part of safe.split('/')) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (cause) { fail(`planning reference is unavailable: ${safe}`, undefined, cause); }
    if (stat.isSymbolicLink()) fail(`planning reference symlink refused: ${safe}`);
  }
  try { return fs.readFileSync(current); }
  catch (cause) { fail(`planning reference is unreadable: ${safe}`, undefined, cause); }
}

function expandAffected(tasks, affected) {
  const selected = new Set(affected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) if (selected.has(task.parentId) && !selected.has(task.id)) { selected.add(task.id); changed = true; }
  }
  return selected;
}

function partialScope(manifest, plan, fullManager) {
  const usable = manifest.planningContribution?.usableTasks;
  if (!texts(usable) || !usable.length) fail('partial package requires nonempty unambiguous usableTasks');
  const leaves = plan.leaves, known = new Set(leaves);
  if (usable.some(id => !known.has(id))) fail('partial usableTasks contains a missing or aggregate task');
  const consumable = leaves.filter(id => usable.includes(id));
  const excluded = leaves.filter(id => !usable.includes(id));
  if (!excluded.length) fail('partial package must exclude at least one leaf task');
  const blockers = Array.isArray(manifest.blockers) ? manifest.blockers : [];
  const provenance = {};
  for (const blocker of blockers) {
    if (!object(blocker) || !text(blocker.id) || !texts(blocker.affectedTasks) || !text(blocker.owner) || !text(blocker.resolution)) continue;
    const affected = expandAffected(manifest.tasks, blocker.affectedTasks);
    for (const id of excluded) if (affected.has(id)) (provenance[id] ??= []).push({ kind: 'blocker', id: blocker.id, owner: blocker.owner, resolution: blocker.resolution });
  }
  const remainingWork = Array.isArray(manifest.remainingWork) ? clone(manifest.remainingWork)
    : Array.isArray(manifest.planningContribution?.remainingWork) ? clone(manifest.planningContribution.remainingWork) : [];
  for (const item of remainingWork) {
    const itemIds = object(item) && texts(item.taskIds) ? item.taskIds : [];
    if (!text(item?.reason) || !text(item?.owner)) continue;
    for (const id of excluded) if (itemIds.includes(id)) (provenance[id] ??= []).push({ kind: 'remainingWork', reason: item.reason, owner: item.owner });
  }
  for (const id of excluded) if (!provenance[id]?.length) fail(`excluded task ${id} lacks planning provenance`);
  for (const id of consumable) {
    if (fullManager.tasks.find(item => item.id === id)?.status === 'blocked') fail(`consumable task ${id} overlaps an excluded planning blocker`);
    const excludedDependencies = (plan.dependencies[id] ?? []).filter(dependency => excluded.includes(dependency));
    if (excludedDependencies.length) fail(`consumable task ${id} depends on excluded task ${excludedDependencies.join(', ')}`);
  }
  let scopedManager;
  try { scopedManager = scopePlanningProjection(fullManager, { consumableTaskIds: consumable, excludedTaskIds: excluded }, provenance); }
  catch (cause) { fail(`canonical partial planning projection: ${cause.message}`, undefined, cause); }
  return { consumableTaskIds: consumable, excludedTaskIds: excluded, provenance, remainingWork, taskManager: scopedManager };
}

// Full planning delivery can exclude future decision consumers without becoming
// partial planning. Derive exclusion provenance from the canonical blocker graph.
export function scopeDeliveredDecisionProjection(manager, blockers) {
  if (!manager.blockedTaskIds.length) return clone(manager);
  const excluded=new Set(manager.blockedTaskIds), provenance={};
  for (const task of manager.tasks.filter(task=>excluded.has(task.id))) {
    provenance[task.id]=task.blockedBy.map(id=>{
      const blocker=blockers.find(b=>b.id===id);
      if (!blocker?.decisionId || !text(blocker.owner) || !text(blocker.resolution)) fail('future decision exclusion lacks responsible blocker provenance');
      return {kind:'blocker',id,owner:blocker.owner,resolution:blocker.resolution};
    });
  }
  return scopePlanningProjection(manager,{
    consumableTaskIds:manager.tasks.filter(task=>!excluded.has(task.id)).map(task=>task.id),
    excludedTaskIds:manager.tasks.filter(task=>excluded.has(task.id)).map(task=>task.id),
  },provenance);
}

function derivePackage(packageRoot) {
  const root = realDirectory(packageRoot, 'packageRoot');
  const manifestBytes = readBoundFile(root, 'planning-manifest.json');
  let manifest;
  try { manifest = JSON.parse(manifestBytes); }
  catch (cause) { fail('planning manifest is not valid JSON', undefined, cause); }
  const deliveryErrors = validatePlanningDelivery(root);
  if (deliveryErrors.length) fail(`canonical planning delivery gate: ${deliveryErrors.join('; ')}`);
  if (manifest.schemaVersion !== 'asds.planning-delivery/1' || !['asds.planning-return/1','asds.planning-return/2'].includes(manifest.returnVersion)) fail('unsupported planning delivery version');
  if (manifest.reviews?.some(r=>r.schemaVersion===HARNESS_REVIEW_VERSION)) {
    const errors=verifyHarnessReviewFiles(root,manifest);if(errors.length)fail(errors.join('; '));
  }
  if (!text(manifest.packageId) || !text(manifest.revision) || !['delivered', 'partial'].includes(manifest.state)) fail('planning package is not delivered or consumable partial');
  const expectedAttendance = manifest.state === 'delivered' ? 'planning_delivered' : 'planning_partial';
  if (manifest.attendanceOutcome !== expectedAttendance) fail('planning attendance outcome differs from delivery state');
  if (!object(manifest.originalRequestedProduct) || manifest.originalRequestedProduct.kind !== 'implementation' || manifest.originalRequestedProduct.status !== 'not_fulfilled' || manifest.planningContribution?.executionPerformed !== false) {
    fail('original implementation request is absent or already fulfilled');
  }
  if (!Array.isArray(manifest.references) || !manifest.references.length) fail('planning references are absent');
  const references = manifest.references;
  const seenIds = new Set(), seenPaths = new Set();
  for (const reference of references) {
    if (!object(reference) || !text(reference.id) || seenIds.has(reference.id) || seenPaths.has(reference.path) || !/^[a-f0-9]{64}$/.test(reference.sha256 ?? '')) fail('invalid or duplicate planning reference');
    seenIds.add(reference.id); seenPaths.add(reference.path);
    const bytes = readBoundFile(root, reference.path);
    const actual = reference.role === 'index' && path.posix.basename(reference.path).toLowerCase() === 'tasks.md'
      ? projectionSourceDigest(bytes.toString('utf8'), true) : digest(bytes);
    if (actual !== reference.sha256) fail(`planning reference hash mismatch: ${reference.path}`);
  }
  const index = references.find(reference => reference.role === 'index' && reference.path === 'tasks.md');
  if (!index) fail('canonical tasks.md reference is absent');
  let plan, manager;
  try {
    plan = compilePlanningPlan(manifest.tasks);
    manager = projectTaskManager(manifest.tasks, { blockers: manifest.blockers ?? [] });
  } catch (cause) { fail(`invalid planning graph: ${cause.message}`, undefined, cause); }
  if (!equal(manifest.taskManager, manager)) fail('planning taskManager is absent or stale');
  const executionScope = manifest.state === 'partial'
     ? partialScope(manifest, plan, manager)
     : { consumableTaskIds: plan.leaves.filter(id=>!manager.blockedTaskIds.includes(id)), excludedTaskIds: [...manager.blockedTaskIds], provenance: {}, remainingWork: [], taskManager: scopeDeliveredDecisionProjection(manager,manifest.blockers??[]) };
  if (manifest.state === 'delivered' && (!texts(manifest.planningContribution?.usableTasks) ||
       !equal([...manifest.planningContribution.usableTasks].sort(), [...executionScope.consumableTaskIds].sort()))) {
     fail('delivered package usableTasks must contain every unblocked leaf exactly once');
  }
  if (manifest.state === 'delivered' && !executionScope.consumableTaskIds.length) fail('delivered package has no usable task');
  const manifestSha256 = digest(manifestBytes);
  return {
    root, manifest, manifestSha256, index: clone(index), manager: executionScope.taskManager,
    executionScope: { consumableTaskIds: executionScope.consumableTaskIds, excludedTaskIds: executionScope.excludedTaskIds },
    partial: manifest.state === 'partial' ? executionScope : null,
    planningFingerprint: digest({ packageId: manifest.packageId, revision: manifest.revision, manifestSha256, references: references.map(({ id, path: referencePath, role, sha256 }) => ({ id, path: referencePath, role, sha256 })), taskManager: manager }),
  };
}

function executionPlanningReturn(pkg) {
  return {
    state: pkg.manifest.state,
    attendanceOutcome: pkg.manifest.attendanceOutcome,
    originalRequestedProduct: clone(pkg.manifest.originalRequestedProduct),
    planningContribution: clone(pkg.manifest.planningContribution),
    planningAuthority: clone(pkg.manifest.authority ?? {}),
    blockers: clone(pkg.manifest.blockers ?? []),
    limitations: clone(pkg.manifest.planningContribution?.limitations ?? []),
    remainingWork: clone(pkg.manifest.remainingWork ?? pkg.manifest.planningContribution?.remainingWork ?? []),
    coverage: clone(pkg.manifest.coverage ?? null),
    references: clone(pkg.manifest.references),
  };
}

function validateWorkspace(workspace, nowMs) {
  exactKeys(workspace, ['projectRoot', 'workspaceId', 'repoIdentity', 'baseline', 'observedAt', 'source'], 'workspace');
  if (!object(workspace) || !text(workspace.workspaceId) || !text(workspace.source)) fail('workspace observation is required');
  currentObservation(workspace.observedAt, 'workspace', nowMs);
  const projectRootRealpath = realDirectory(workspace.projectRoot, 'workspace.projectRoot');
  const repo = workspace.repoIdentity;
  exactKeys(repo, ['vcs', 'rootRealpath', 'commonDirRealpath', 'baseRevision'], 'repoIdentity');
  if (!object(repo) || repo.vcs !== 'git' || !path.isAbsolute(repo.rootRealpath ?? '') || !path.isAbsolute(repo.commonDirRealpath ?? '') || !text(repo.baseRevision)) fail('repoIdentity is invalid');
  const repoRootRealpath = realDirectory(repo.rootRealpath, 'repoIdentity.rootRealpath');
  const commonDirRealpath = realDirectory(repo.commonDirRealpath, 'repoIdentity.commonDirRealpath');
  const relative = path.relative(repoRootRealpath, projectRootRealpath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('project root is outside repo identity');
  const baseline = workspace.baseline;
  exactKeys(baseline, ['version', 'baseRevision', 'workspaceRevision', 'committedSinceBase', 'staged', 'unstaged', 'untracked'], 'workspace baseline');
  const categories = ['committedSinceBase', 'staged', 'unstaged', 'untracked'];
  const validEntries = entries => Array.isArray(entries) && entries.every(entry => {
    exactKeys(entry, ['path', 'sha256'], 'workspace baseline entry');
    return text(entry.path) && !path.isAbsolute(entry.path) && !entry.path.split('/').includes('..') && /^[a-f0-9]{64}$/.test(entry.sha256 ?? '');
  }) && new Set(entries.map(entry => entry.path)).size === entries.length;
  if (!object(baseline) || baseline.version !== 1 || !text(baseline.baseRevision) || !text(baseline.workspaceRevision) || categories.some(category => !validEntries(baseline[category]))) fail('workspace baseline is invalid');
  if (baseline.baseRevision !== repo.baseRevision) fail('workspace baseline and repo base revision differ');
  return { projectRootRealpath, workspaceId: workspace.workspaceId, repoIdentity: { ...clone(repo), rootRealpath: repoRootRealpath, commonDirRealpath }, workspaceBaselineFingerprint: digest(baseline) };
}

function validateCaller(input, nowMs) {
  if (!object(input.requestContext) || !object(input.selection) || !Array.isArray(input.grants)) {
    fail('requestContext, selection and current grants are required');
  }
  if (!object(input.requestContext?.binding) || !object(input.selection?.binding) ||
      !object(input.grants?.find?.(grant => grant?.kind === 'execution')?.scope?.binding)) {
    fail('legacy or unbound authorities cannot authorize execution; requestContext, selection and execution grant require current package binding', 'ASDS_EXECUTION_HANDOFF_UNBOUND');
  }
  exactKeys(input.requestContext, ['requestId', 'objective', 'source', 'project', 'binding'], 'requestContext');
  exactKeys(input.requestContext.project, ['root', 'readScope', 'constraints', 'refusals', 'authorizations'], 'requestContext.project');
  exactKeys(input.author, ['actor', 'adapter', 'source', 'observedAt'], 'author');
  exactKeys(input.selection, ['consumer', 'selected', 'source', 'observedAt', 'binding'], 'selection');
  exactKeys(input.destination, ['journal', 'evidence', 'source'], 'destination');
  exactKeys(input.coordinatorBoundary, ['enforced', 'projectReadOnly', 'brokers', 'source', 'observedAt'], 'coordinatorBoundary');
  if (!object(input.requestContext) || !text(input.requestContext.requestId) || !text(input.requestContext.objective) || !text(input.requestContext.source) || !object(input.requestContext.project)) fail('requestContext is incomplete');
  const project = input.requestContext.project;
  if (!text(project.root) || !texts(project.readScope) || !texts(project.constraints) || !texts(project.refusals) || !texts(project.authorizations)) fail('requestContext.project is incomplete');
  if (!object(input.author) || !text(input.author.actor) || !text(input.author.adapter) || !text(input.author.source)) fail('caller author is required');
  currentObservation(input.author.observedAt, 'author', nowMs);
  if (!object(input.selection) || input.selection.consumer !== 'asds-execution-consumer' || input.selection.selected !== true || !text(input.selection.source)) fail('explicit consumer selection is required');
  currentObservation(input.selection.observedAt, 'selection', nowMs);
  if (!Array.isArray(input.grants)) fail('current grants are required');
  for (const grant of input.grants) {
    exactKeys(grant, ['kind', 'granted', 'source', 'scope', 'validFrom', 'validUntil'], 'grant');
    if (!object(grant) || !['execution', 'evidence-persistence'].includes(grant.kind) || grant.granted !== true || !text(grant.source) || !object(grant.scope)) fail('invalid execution/evidence grant');
    if (grant.kind === 'execution' && (!text(grant.scope.projectRoot) || !object(grant.scope.binding))) fail('execution grant scope requires projectRoot and current package binding');
    if (grant.kind === 'evidence-persistence' && (!text(grant.scope.journal) || !text(grant.scope.evidence))) fail('evidence grant scope requires journal and evidence');
    const scopeKeys = Object.keys(grant.scope).sort();
    if (grant.kind === 'execution' && !equal(scopeKeys, ['binding', 'projectRoot'])) fail('execution grant scope has unknown fields');
    if (grant.kind === 'evidence-persistence' && !equal(scopeKeys, ['evidence', 'journal'])) fail('evidence grant scope has unknown fields');
    if (instant(grant.validFrom, 'grant.validFrom') > nowMs || instant(grant.validUntil, 'grant.validUntil') <= nowMs) fail(`${grant.kind} grant is stale`);
  }
  for (const kind of ['execution', 'evidence-persistence']) if (input.grants.filter(grant => grant.kind === kind).length !== 1) fail(`exactly one ${kind} grant is required`);
  if (!object(input.destination) || !text(input.destination.source)) fail('authorized journal/evidence destination is required');
  safeRelative(input.destination.journal, 'destination.journal'); safeRelative(input.destination.evidence, 'destination.evidence');
  const boundary = input.coordinatorBoundary;
  if (!object(boundary) || typeof boundary.enforced !== 'boolean' || typeof boundary.projectReadOnly !== 'boolean' || !texts(boundary.brokers) || !text(boundary.source)) fail('coordinator boundary observation is required');
  if (!equal([...boundary.brokers].sort(), ['evidence', 'journal', 'progress'])) fail('coordinatorBoundary brokers must be exactly evidence, journal and progress');
  currentObservation(boundary.observedAt, 'coordinatorBoundary', nowMs);
}

function validateAuthorityBindingShape(binding, label) {
  exactKeys(binding, AUTHORITY_BINDING_FIELDS, label);
  if (!text(binding.requestId) || !text(binding.packageId) || !text(binding.planningRevision) ||
      !/^[a-f0-9]{64}$/.test(binding.planningFingerprint ?? '') || !texts(binding.consumableTaskIds)) {
    fail(`${label} is invalid`);
  }
}

function packageAuthorityBinding(pkg, requestId) {
  return {
    requestId,
    packageId: pkg.manifest.packageId,
    planningRevision: pkg.manifest.revision,
    planningFingerprint: pkg.planningFingerprint,
    consumableTaskIds: clone(pkg.executionScope.consumableTaskIds),
  };
}

function validateAuthorityBindings(input, pkg) {
  const execution = input.grants.find(grant => grant.kind === 'execution');
  const bindings = [
    ['requestContext.binding', input.requestContext.binding],
    ['selection.binding', input.selection.binding],
    ['execution grant scope.binding', execution.scope.binding],
  ];
  for (const [label, binding] of bindings) validateAuthorityBindingShape(binding, label);
  const expected = packageAuthorityBinding(pkg, input.requestContext.requestId);
  for (const [label, binding] of bindings) if (!equal(binding, expected)) fail(`${label} does not bind the current request and planning package`);
  const original = pkg.manifest.originalRequestedProduct;
  if (!text(original.text)) fail('persisted original implementation intake lacks objective');
  if (input.requestContext.objective !== original.text) fail('requestContext objective differs from persisted original implementation intake');
  return expected;
}

function validateGrantBindings(input, workspace, authorityBinding) {
  const execution = input.grants.find(grant => grant.kind === 'execution');
  const evidence = input.grants.find(grant => grant.kind === 'evidence-persistence');
  if (realDirectory(execution.scope.projectRoot, 'execution grant scope.projectRoot') !== workspace.projectRootRealpath) fail('execution grant scope does not bind current project realpath');
  const journal = safeRelative(input.destination.journal, 'destination.journal');
  const evidencePath = safeRelative(input.destination.evidence, 'destination.evidence');
  if (safeRelative(evidence.scope.journal, 'evidence grant scope.journal') !== journal ||
      safeRelative(evidence.scope.evidence, 'evidence grant scope.evidence') !== evidencePath) {
    fail('evidence grant scope does not cover the exact journal/evidence destination');
  }
  return {
    executionAuthorized: true,
    executionProjectRootRealpath: workspace.projectRootRealpath,
    evidencePersistenceAuthorized: true,
    evidenceDestinationSha256: digest({ journal, evidence: evidencePath }),
    authorityBindingSha256: digest(authorityBinding),
    revalidateAtInitAndStart: true,
  };
}

export function inspectExecutionPackage(packageRoot) {
  const pkg = derivePackage(packageRoot);
  return {
    packageId: pkg.manifest.packageId,
    planningRevision: pkg.manifest.revision,
    planningFingerprint: pkg.planningFingerprint,
    executionScope: clone(pkg.executionScope),
    originalRequest: {
      objective: pkg.manifest.originalRequestedProduct.text,
      source: pkg.manifest.originalRequestedProduct.source,
    },
  };
}

export function createExecutionHandoff(input) {
  if (!object(input)) fail('execution handoff input must be an object');
  for (const key of Object.keys(input)) if (!INPUT_FIELDS.has(key) && !DERIVED_FIELDS.has(key) && key !== 'capabilities') fail(`unknown execution handoff input field: ${key}`);
  for (const key of DERIVED_FIELDS) if (Object.hasOwn(input, key)) fail(`caller cannot provide derived field: ${key}`);
  if (Object.hasOwn(input, 'capabilities')) fail('capabilities are volatile host observations and cannot enter the handoff');
  const nowValue = input.now ?? new Date().toISOString(), nowMs = instant(nowValue, 'now');
  validateCaller(input, nowMs);
  const pkg = derivePackage(input.packageRoot), workspace = validateWorkspace(input.workspace, nowMs);
  if (realDirectory(input.requestContext.project.root, 'requestContext.project.root') !== workspace.projectRootRealpath) fail('request project and workspace identity differ');
  const authorityBinding = validateAuthorityBindings(input, pkg);
  const authorization = validateGrantBindings(input, workspace, authorityBinding);
  const envelope = {
    schemaVersion: EXECUTION_HANDOFF_VERSION,
    packageRoot: path.resolve(input.packageRoot), packageRootRealpath: pkg.root,
    packageId: pkg.manifest.packageId, planningRevision: pkg.manifest.revision,
    planningManifest: { path: 'planning-manifest.json', sha256: pkg.manifestSha256 },
    canonicalIndex: { path: 'tasks.md', referenceId: pkg.index.id, sha256: pkg.index.sha256, readbackRevision: pkg.manifest.readback.revision },
    planningFingerprint: pkg.planningFingerprint,
    taskManager: pkg.manager, executionScope: pkg.executionScope,
    ...(pkg.partial ? { partialScope: { consumableTaskIds: pkg.partial.consumableTaskIds, excludedTaskIds: pkg.partial.excludedTaskIds, provenance: pkg.partial.provenance, remainingWork: pkg.partial.remainingWork } } : {}),
    planningReturn: executionPlanningReturn(pkg),
    requestContext: clone(input.requestContext), author: clone(input.author), selection: clone(input.selection), grants: clone(input.grants), destination: clone(input.destination), coordinatorBoundary: clone(input.coordinatorBoundary),
    authorization,
    projectRootRealpath: workspace.projectRootRealpath, workspaceId: workspace.workspaceId,
    repoIdentity: workspace.repoIdentity, workspaceBaselineFingerprint: workspace.workspaceBaselineFingerprint,
    roleProfile: clone(ROLE_PROFILE),
    createdAt: new Date(nowMs).toISOString(),
  };
  const validation = validateExecutionHandoff(envelope, { packageRoot: input.packageRoot, workspace: input.workspace, now: nowValue });
  if (!validation.valid) fail(validation.errors.join('; '));
  return envelope;
}

export function validateExecutionHandoff(envelope, current = {}) {
  const errors = [];
  const capture = fn => { try { fn(); } catch (error) { errors.push(error.message); } };
  if (!object(envelope)) return { valid: false, errors: ['execution handoff must be an object'] };
  for (const key of Object.keys(envelope)) if (!ENVELOPE_FIELDS.has(key)) errors.push(`unknown execution handoff field: ${key}`);
  if (envelope.schemaVersion !== EXECUTION_HANDOFF_VERSION) errors.push('unsupported execution handoff version');
  if (Object.hasOwn(envelope, 'capabilities')) errors.push('capabilities must not be persisted in execution handoff');
  if (!path.isAbsolute(envelope.packageRoot ?? '') || !/^[a-f0-9]{64}$/.test(envelope.planningManifest?.sha256 ?? '') ||
      envelope.planningManifest?.path !== 'planning-manifest.json' || envelope.canonicalIndex?.path !== 'tasks.md' ||
      !/^[a-f0-9]{64}$/.test(envelope.canonicalIndex?.sha256 ?? '') || !/^[a-f0-9]{64}$/.test(envelope.planningFingerprint ?? '') ||
      !/^[a-f0-9]{64}$/.test(envelope.workspaceBaselineFingerprint ?? '') || !texts(envelope.executionScope?.consumableTaskIds) ||
      !Array.isArray(envelope.executionScope?.excludedTaskIds)) errors.push('stored execution handoff shape/fingerprints are invalid');
  capture(() => exactKeys(envelope.authorization, ['executionAuthorized', 'executionProjectRootRealpath', 'evidencePersistenceAuthorized', 'evidenceDestinationSha256', 'authorityBindingSha256', 'revalidateAtInitAndStart'], 'authorization'));
  const nowValue = current.now ?? new Date().toISOString(); let nowMs;
  capture(() => { nowMs = instant(nowValue, 'now'); });
  capture(() => instant(envelope.createdAt, 'createdAt'));
  if (nowMs !== undefined) capture(() => validateCaller(envelope, nowMs));
  const packageRoot = current.packageRoot;
  if (!text(packageRoot)) errors.push('current packageRoot is required for operational validation');
  if (text(packageRoot)) capture(() => {
    const persistedPackageRootRealpath = realDirectory(envelope.packageRoot, 'envelope.packageRoot');
    const currentPackageRootRealpath = realDirectory(packageRoot, 'current.packageRoot');
    if (persistedPackageRootRealpath !== envelope.packageRootRealpath) errors.push('persisted packageRoot differs from certified packageRootRealpath');
    if (currentPackageRootRealpath !== envelope.packageRootRealpath) errors.push('current packageRoot differs from certified packageRootRealpath');
    const pkg = derivePackage(packageRoot);
    const expected = {
      packageRootRealpath: pkg.root, packageId: pkg.manifest.packageId, planningRevision: pkg.manifest.revision,
      planningManifest: { path: 'planning-manifest.json', sha256: pkg.manifestSha256 },
      canonicalIndex: { path: 'tasks.md', referenceId: pkg.index.id, sha256: pkg.index.sha256, readbackRevision: pkg.manifest.readback.revision },
      planningFingerprint: pkg.planningFingerprint, taskManager: pkg.manager, executionScope: pkg.executionScope,
      planningReturn: executionPlanningReturn(pkg),
    };
    for (const [key, value] of Object.entries(expected)) if (!equal(envelope[key], value)) errors.push(`${key} differs from current planning package`);
    capture(() => {
      const authorityBinding = validateAuthorityBindings(envelope, pkg);
      if (envelope.authorization?.authorityBindingSha256 !== digest(authorityBinding)) errors.push('authorization binding digest differs from current authorities');
    });
    if (pkg.partial) {
      const expectedPartial = { consumableTaskIds: pkg.partial.consumableTaskIds, excludedTaskIds: pkg.partial.excludedTaskIds, provenance: pkg.partial.provenance, remainingWork: pkg.partial.remainingWork };
      if (!equal(envelope.partialScope, expectedPartial)) errors.push('partialScope differs from current planning package');
    } else if (Object.hasOwn(envelope, 'partialScope')) errors.push('full package cannot carry partialScope');
  });
  const workspaceInput = current.workspace;
  if (!workspaceInput) errors.push('current workspace observation is required for operational validation');
  if (workspaceInput && nowMs !== undefined) capture(() => {
    const workspace = validateWorkspace(workspaceInput, nowMs);
    for (const key of ['projectRootRealpath', 'workspaceId', 'repoIdentity', 'workspaceBaselineFingerprint']) if (!equal(envelope[key], workspace[key])) errors.push(`${key} differs from current workspace`);
    if (realDirectory(envelope.requestContext.project.root, 'requestContext.project.root') !== workspace.projectRootRealpath) errors.push('requestContext project root differs from current workspace realpath');
    const authorization = validateGrantBindings(envelope, workspace, packageAuthorityBinding(derivePackage(packageRoot), envelope.requestContext.requestId));
    if (!equal(envelope.authorization, authorization)) errors.push('authorization bindings differ from current project/destination');
  });
  if (envelope.authorization?.executionAuthorized !== true || envelope.authorization?.evidencePersistenceAuthorized !== true || envelope.authorization?.revalidateAtInitAndStart !== true ||
      !/^[a-f0-9]{64}$/.test(envelope.authorization?.evidenceDestinationSha256 ?? '') ||
      !/^[a-f0-9]{64}$/.test(envelope.authorization?.authorityBindingSha256 ?? '') ||
      !text(envelope.authorization?.executionProjectRootRealpath)) errors.push('authorization summary is invalid');
  if (!equal(envelope.roleProfile, ROLE_PROFILE)) errors.push('role separation profile is invalid');
  return { valid: errors.length === 0, errors };
}
