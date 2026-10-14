import fs, { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { planningCandidateSha256 } from './planning-lifecycle.mjs';
import { projectionSourceDigest } from './plan-projection.mjs';
import { safePath } from './planning-paths.mjs';

export const AGY_REVIEW_REQUEST_SCHEMA = 'asds.agy-review-request/1';
export const AGY_REVIEW_RESPONSE_SCHEMA = 'asds.agy-review-response/1';
export const AGY_REVIEW_REQUEST_HEADER = 'ASDS_REVIEW_REQUEST_V1\n';
export const AGY_REVIEW_RESPONSE_HEADER = 'ASDS_REVIEW_RESPONSE_V1\n';

// Source-release anchors for the two non-self-referential AGY agent payloads.
// The protocol cannot authenticate its own executable bytes; that requires the
// unavailable native host trust root and is why dispatch remains fail-closed.
const OFFICIAL_COORDINATOR_SHA256 = '74a402c6c49a759d634df289de715fe6909a86fab8fe2392d1fb53f2613665d5';
const OFFICIAL_REVIEWER_SHA256 = '4cdbb22a4a3e7474a388a275630895ce7a9c487ab1843ba427d0620d47a6728a';

const REQUEST_KEYS = Object.freeze(['candidateSha256', 'freshness', 'inventorySha256', 'packageInventory', 'packagePath',
  'priorFidelityOutput', 'priorFidelitySha256', 'reviewKind', 'revision', 'schema', 'sourceInventory']);
const RESPONSE_KEYS = Object.freeze(['candidateSha256', 'findings', 'freshness', 'inventorySha256', 'limitations',
  'packagePath', 'reviewKind', 'revision', 'schema', 'verdict']);
const DISPATCH_CONTRACT_KEYS = Object.freeze([
  'coordinatorRelativePath', 'coordinatorSha256', 'coordinatorTypeName', 'exactPromptRequired', 'hostApi',
  'hostAuthorityCapability', 'itemKeys', 'oneUseFreshnessRequired', 'planningOnly', 'protocolRelativePath',
  'protocolSha256', 'receiptSchema', 'receiptSource', 'receiptVisibility', 'requestHeader',
  'requiresArgumentRewrite', 'requiresHostEnforcement', 'responseHeader', 'reviewerRelativePath', 'reviewerSha256',
  'reviewerTypeName', 'reviewerWriteScope', 'role', 'runtimeHostStatus', 'schema', 'timeoutDisposition', 'tool',
]);
const INVENTORY_KEYS = Object.freeze(['path', 'role', 'sha256']);
const FINDING_KEYS = Object.freeze(['category', 'evidencePath', 'expectedCorrection', 'id', 'requirementId',
  'severity', 'status']);
// Canonical roles currently emitted by ASDS planning manifests. Review artifacts
// are integrity-checked below but intentionally excluded from reviewer inputs.
const REFERENCE_ROLES = new Set(['source', 'specification', 'index', 'contract', 'review']);
const hostRequests = new WeakMap();
const packageSnapshots = new WeakSet();
const indexPattern = /^\s*[-*] \[([ xX])\] \[Task ([A-Za-z0-9_-]+)\]\(tasks\/task-([A-Za-z0-9_-]+)\.md\): (.+)$/;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
};
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

export function safeReviewPath(value) {
  return safePath(value);
}

function inventory(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a nonempty array`);
  const seen = new Set();
  let prior = '';
  for (const entry of value) {
    if (!exact(entry, INVENTORY_KEYS) || !safeReviewPath(entry.path) || !digest(entry.sha256) || !text(entry.role)) {
      throw new Error(`${label} entry has an invalid closed schema`);
    }
    if (entry.path <= prior || seen.has(entry.path)) throw new Error(`${label} must be path-sorted and unique`);
    seen.add(entry.path);
    prior = entry.path;
  }
  return seen;
}

function expectedInventorySha256(request) {
  return sha256(Buffer.from(JSON.stringify({
    sourceInventory: request.sourceInventory,
    packageInventory: request.packageInventory,
  })));
}

function validateResponseBinding(response, request) {
  if (!exact(response, RESPONSE_KEYS) || response.schema !== AGY_REVIEW_RESPONSE_SCHEMA ||
      response.packagePath !== request.packagePath || response.reviewKind !== request.reviewKind ||
      response.freshness !== request.freshness ||
      response.revision !== request.revision || response.candidateSha256 !== request.candidateSha256 ||
      response.inventorySha256 !== request.inventorySha256 || !['pass', 'fail'].includes(response.verdict) ||
      !Array.isArray(response.findings) || !Array.isArray(response.limitations) ||
      response.limitations.some(item => typeof item !== 'string')) {
    throw new Error('invalid or stale AGY review response envelope');
  }
  const allowedEvidence = new Set([...request.sourceInventory, ...request.packageInventory].map(entry => entry.path));
  const ids = new Set();
  for (const finding of response.findings) {
    if (!exact(finding, FINDING_KEYS) || !text(finding.id) || ids.has(finding.id) || !text(finding.category) ||
        !['material', 'minor'].includes(finding.severity) || finding.status !== 'open' ||
        !allowedEvidence.has(finding.evidencePath) ||
        !(finding.requirementId === null || text(finding.requirementId)) || !text(finding.expectedCorrection)) {
      throw new Error('invalid AGY review finding envelope');
    }
    ids.add(finding.id);
  }
  if (response.verdict === 'pass' && response.findings.some(finding => finding.severity === 'material')) {
    throw new Error('passing AGY review contains an open material finding');
  }
  if (response.verdict === 'pass' && response.limitations.length) {
    throw new Error('passing AGY review cannot retain unread, incomplete, zero-byte, or other limitations');
  }
  if (response.verdict === 'fail' && response.findings.length === 0) throw new Error('failed AGY review requires findings');
  return response;
}

function parseResponseBytes(output, request) {
  if (typeof output !== 'string' || !output.startsWith(AGY_REVIEW_RESPONSE_HEADER)) {
    throw new Error('invalid AGY review response header');
  }
  const bytes = output.slice(AGY_REVIEW_RESPONSE_HEADER.length);
  let response;
  try { response = JSON.parse(bytes); } catch { throw new Error('invalid AGY review response JSON'); }
  return validateResponseBinding(response, request);
}

function decodeResponseBytes(output) {
  if (typeof output !== 'string' || !output.startsWith(AGY_REVIEW_RESPONSE_HEADER)) {
    throw new Error('invalid AGY review response header');
  }
  try { return JSON.parse(output.slice(AGY_REVIEW_RESPONSE_HEADER.length)); }
  catch { throw new Error('invalid AGY review response JSON'); }
}

export function validateAgyReviewRequest(request) {
  if (!exact(request, REQUEST_KEYS) || request.schema !== AGY_REVIEW_REQUEST_SCHEMA ||
      !safeReviewPath(request.packagePath) || !text(request.revision) || !digest(request.candidateSha256) ||
      !digest(request.freshness) ||
      !digest(request.inventorySha256) || !['fidelity', 'quality'].includes(request.reviewKind)) {
    throw new Error('invalid AGY review request envelope');
  }
  const sourcePaths = inventory(request.sourceInventory, 'sourceInventory');
  const packagePaths = inventory(request.packageInventory, 'packageInventory');
  if (request.sourceInventory.some(entry => entry.role !== 'source') ||
      request.packageInventory.some(entry => !['manifest', 'specification', 'index', 'task'].includes(entry.role))) {
    throw new Error('review inventory has an invalid role');
  }
  if ([...sourcePaths].some(item => packagePaths.has(item))) throw new Error('review inventories overlap');
  if (request.inventorySha256 !== expectedInventorySha256(request)) throw new Error('AGY review inventory hash mismatch');
  const prefix = `${request.packagePath}/`;
  if ([...request.sourceInventory, ...request.packageInventory].some(entry => !entry.path.startsWith(prefix))) {
    throw new Error('review inventory escapes packagePath');
  }
  const roles = new Set(request.packageInventory.map(entry => entry.role));
  for (const role of ['manifest', 'index', 'task']) if (!roles.has(role)) throw new Error(`packageInventory missing ${role}`);
  if (request.reviewKind === 'fidelity') {
    if (request.priorFidelityOutput !== null || request.priorFidelitySha256 !== null) {
      throw new Error('fidelity request cannot carry prior fidelity evidence');
    }
  } else {
    if (!text(request.priorFidelityOutput) || !digest(request.priorFidelitySha256) ||
        sha256(Buffer.from(request.priorFidelityOutput)) !== request.priorFidelitySha256) {
      throw new Error('quality request requires the exact fidelity response bytes');
    }
    const priorEnvelope = decodeResponseBytes(request.priorFidelityOutput);
    const fidelityRequest = { ...request, freshness: priorEnvelope?.freshness, reviewKind: 'fidelity',
      priorFidelityOutput: null, priorFidelitySha256: null };
    const prior = validateResponseBinding(priorEnvelope, fidelityRequest);
    if (prior.verdict !== 'pass') throw new Error('quality request requires a passing fidelity response');
  }
  return request;
}

function canonicalRoot(root) {
  if (!text(root)) throw new Error('projectRoot is required');
  const resolved = path.resolve(root), real = fs.realpathSync(resolved);
  if (resolved !== real) throw new Error('projectRoot must be its canonical real path');
  const info = fs.lstatSync(real);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('projectRoot must be a real directory');
  return real;
}

function resolveNoSymlink(root, relative, directory = false) {
  if (!safeReviewPath(relative)) throw new Error(`unsafe review path: ${relative}`);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink()) throw new Error(`review symlink refused: ${relative}`);
  }
  const info = fs.lstatSync(current);
  if (directory ? !info.isDirectory() : !info.isFile()) throw new Error(`unexpected review path type: ${relative}`);
  return current;
}

function readCurrentFile(root, relative) {
  const file = resolveNoSymlink(root, relative);
  const before = fs.lstatSync(file);
  if (before.nlink !== 1) throw new Error(`review hardlink refused: ${relative}`);
  if (before.size === 0) throw new Error(`zero-byte review artifact refused: ${relative}`);
  const descriptor = fs.openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(`review file changed during open: ${relative}`);
    }
    const bytes = fs.readFileSync(descriptor), after = fs.fstatSync(descriptor);
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size ||
        after.mtimeMs !== opened.mtimeMs || bytes.length !== opened.size || bytes.length === 0) {
      throw new Error(`review file changed during read: ${relative}`);
    }
    return bytes;
  } finally { fs.closeSync(descriptor); }
}

export function inspectAgyReviewDispatchContract({ target }) {
  const root = canonicalRoot(target);
  const contractPath = '.asds/agy-review-dispatch-contract.json';
  const contractBytes = readCurrentFile(root, contractPath);
  let contract;
  try { contract = JSON.parse(contractBytes); } catch { throw new Error('AGY review dispatch contract is not valid JSON'); }
  if (!exact(contract, DISPATCH_CONTRACT_KEYS) || contract.schema !== 'asds.agy-review-dispatch-contract/1' ||
      contract.coordinatorTypeName !== 'spec-driven-superpowers' ||
      contract.reviewerTypeName !== 'spec-driven-superpowers-reviewer' || contract.role !== 'planning-reviewer' ||
      contract.tool !== 'invoke_subagent' || JSON.stringify(contract.itemKeys) !== JSON.stringify(['TypeName', 'Role', 'Prompt']) ||
      contract.requestHeader !== 'ASDS_REVIEW_REQUEST_V1' || contract.responseHeader !== 'ASDS_REVIEW_RESPONSE_V1' ||
      contract.receiptSchema !== 'asds.agy-review-dispatch-receipt/1' || contract.receiptSource !== 'agy-host-hook' ||
      contract.hostAuthorityCapability !== 'agy-review-dispatch' ||
      JSON.stringify(contract.hostApi) !== JSON.stringify(['createAgyReviewDispatchAuthority', 'attestAgyReviewDispatch', 'parseAgyReviewResponse']) ||
      contract.receiptVisibility !== 'host-private' || contract.timeoutDisposition !== 'blocked' ||
      contract.runtimeHostStatus !== 'unavailable' ||
      contract.requiresArgumentRewrite !== false || contract.exactPromptRequired !== true ||
      contract.oneUseFreshnessRequired !== true || contract.requiresHostEnforcement !== true ||
      contract.planningOnly !== true || !Array.isArray(contract.reviewerWriteScope) || contract.reviewerWriteScope.length !== 0) {
    throw new Error('invalid closed AGY review dispatch contract');
  }
  for (const key of ['coordinatorRelativePath', 'reviewerRelativePath', 'protocolRelativePath']) {
    if (!safeReviewPath(contract[key])) throw new Error(`unsafe AGY review dispatch contract path: ${key}`);
  }
  const profiles = [
    { scope: 'project', skillsDir: '.agents/skills', manifestRelativePath: '.asds/install-manifest.json',
      coordinatorRelativePath: '.agents/agents/spec-driven-superpowers.md',
      reviewerRelativePath: '.agents/agents/spec-driven-superpowers-reviewer.md',
      protocolRelativePath: '.agents/skills/asds-execution-consumer/lib/agy-review-protocol.mjs' },
    { scope: 'user', skillsDir: '.gemini/config/skills',
      manifestRelativePath: `.asds/install-manifests/${sha256(Buffer.from('.gemini/config/skills'))}.json`,
      coordinatorRelativePath: '.gemini/config/agents/spec-driven-superpowers.md',
      reviewerRelativePath: '.gemini/config/agents/spec-driven-superpowers-reviewer.md',
      protocolRelativePath: '.gemini/config/skills/asds-execution-consumer/lib/agy-review-protocol.mjs' },
  ];
  const profile = profiles.find(candidate => ['coordinatorRelativePath', 'reviewerRelativePath', 'protocolRelativePath']
    .every(key => contract[key] === candidate[key]));
  if (!profile) throw new Error('AGY review dispatch contract does not use one exact official profile');
  if (contract.coordinatorSha256 !== OFFICIAL_COORDINATOR_SHA256 ||
      contract.reviewerSha256 !== OFFICIAL_REVIEWER_SHA256) {
    throw new Error('AGY review dispatch agent digests do not match this ASDS source release');
  }
  for (const [pathKey, hashKey] of [
    ['coordinatorRelativePath', 'coordinatorSha256'],
    ['reviewerRelativePath', 'reviewerSha256'],
    ['protocolRelativePath', 'protocolSha256'],
  ]) {
    if (!digest(contract[hashKey]) || sha256(readCurrentFile(root, contract[pathKey])) !== contract[hashKey]) {
      throw new Error(`AGY review dispatch installation drifted: ${contract[pathKey]}`);
    }
  }
  const manifestBytes = readCurrentFile(root, profile.manifestRelativePath);
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch { throw new Error('AGY install manifest is not valid JSON'); }
  const manifestKeys = ['features', 'files', 'format', 'schemaRoot', 'scope', 'skillsDir', 'target'];
  const featureKeys = ['activate', 'rules'];
  const entryKeys = ['mode', 'nlinkPolicy', 'path', 'sha256', 'type'];
  if (!exact(manifest, manifestKeys) || manifest.format !== 3 || manifest.scope !== profile.scope ||
      manifest.target !== root || manifest.skillsDir !== profile.skillsDir || !text(manifest.schemaRoot) ||
      !exact(manifest.features, featureKeys) || typeof manifest.features.activate !== 'boolean' ||
      typeof manifest.features.rules !== 'boolean' || !Array.isArray(manifest.files)) {
    throw new Error('AGY review dispatch requires its exact installation manifest v3');
  }
  const entries = new Map();
  for (const entry of manifest.files) {
    if (!exact(entry, entryKeys) || path.resolve(entry.path) !== entry.path || !digest(entry.sha256) ||
        entry.mode !== 0o644 || entry.type !== 'file' || entry.nlinkPolicy !== 'exactly-one' || entries.has(entry.path)) {
      throw new Error('AGY install manifest v3 has an invalid owned entry');
    }
    entries.set(entry.path, entry);
  }
  const required = [
    ['.asds/agy-review-dispatch-contract.json', sha256(contractBytes)],
    [contract.coordinatorRelativePath, contract.coordinatorSha256],
    [contract.reviewerRelativePath, contract.reviewerSha256],
    [contract.protocolRelativePath, contract.protocolSha256],
  ];
  for (const [relative, expected] of required) {
    const absolute = path.join(root, ...relative.split('/'));
    if (entries.get(absolute)?.sha256 !== expected) {
      throw new Error(`AGY install manifest v3 does not own the exact dispatch payload: ${relative}`);
    }
  }
  return deepFreeze({ target: root, contract, contractSha256: sha256(contractBytes),
    manifestRelativePath: profile.manifestRelativePath, manifestSha256: sha256(manifestBytes) });
}

function indexedContracts(indexBytes) {
  const entries = [];
  for (const line of indexBytes.toString('utf8').split(/\r?\n/)) {
    if (!/^\s*[-*] \[[ xX]\]/.test(line)) continue;
    const match = line.match(indexPattern);
    if (!match || match[2] !== match[3]) throw new Error(`invalid task index entry: ${line}`);
    entries.push({ completed: match[1].toLowerCase() === 'x', id: match[2], path: `tasks/task-${match[2]}.md` });
  }
  if (!entries.length) throw new Error('tasks.md contains no task contracts');
  const ids = new Set(), paths = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id) || paths.has(entry.path)) throw new Error('tasks.md contains duplicate task contracts');
    ids.add(entry.id); paths.add(entry.path);
  }
  return entries;
}

function listTaskMarkdown(packageRoot) {
  const tasksRoot = resolveNoSymlink(packageRoot, 'tasks', true), paths = [];
  function visit(directory, relative) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const childRelative = `${relative}/${entry.name}`, child = path.join(directory, entry.name);
      const info = fs.lstatSync(child);
      if (entry.isSymbolicLink() || info.isSymbolicLink()) throw new Error(`review symlink refused: ${childRelative}`);
      if (entry.isDirectory()) visit(child, childRelative);
      else if (entry.isFile() && entry.name.endsWith('.md')) paths.push(childRelative);
    }
  }
  visit(tasksRoot, 'tasks');
  return paths.sort();
}

export function inspectAgyReviewPackage({ projectRoot, packagePath }) {
  const root = canonicalRoot(projectRoot);
  if (!safeReviewPath(packagePath)) throw new Error('packagePath must be a safe project-relative path');
  const packageRoot = resolveNoSymlink(root, packagePath, true);
  const manifestBytes = readCurrentFile(packageRoot, 'planning-manifest.json');
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch { throw new Error('planning-manifest.json is not valid JSON'); }
  if (manifest?.schemaVersion !== 'asds.planning-delivery/1' || !text(manifest.revision)) {
    throw new Error('planning manifest has an invalid canonical identity');
  }
  if (!Array.isArray(manifest.references) || !manifest.references.length) throw new Error('planning manifest has no references');
  const referenceIds = new Set(), referencePaths = new Set(), references = [];
  for (const reference of manifest.references) {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference) ||
        !text(reference.id) || referenceIds.has(reference.id) || !safeReviewPath(reference.path) ||
        referencePaths.has(reference.path) || reference.path === 'planning-manifest.json' ||
        !REFERENCE_ROLES.has(reference.role) || !digest(reference.sha256)) {
      throw new Error('planning manifest contains an invalid or duplicate reference');
    }
    const bytes = readCurrentFile(packageRoot, reference.path);
    const declaredHash = reference.role === 'index' && path.posix.basename(reference.path).toLowerCase() === 'tasks.md'
      ? projectionSourceDigest(bytes.toString('utf8'), true) : sha256(bytes);
    if (declaredHash !== reference.sha256) throw new Error(`planning reference bytes drifted: ${reference.path}`);
    referenceIds.add(reference.id); referencePaths.add(reference.path);
    references.push({ reference, bytes,
      inventorySha256: reference.role === 'index' && path.posix.basename(reference.path).toLowerCase() === 'tasks.md'
        ? declaredHash : sha256(bytes) });
  }
  const indexes = references.filter(entry => entry.reference.role === 'index');
  if (indexes.length !== 1 || indexes[0].reference.path !== 'tasks.md') throw new Error('manifest must bind exactly one tasks.md index');
  const indexed = indexedContracts(indexes[0].bytes), expectedContracts = indexed.map(entry => entry.path).sort();
  const declaredContracts = references.filter(entry => entry.reference.role === 'contract')
    .map(entry => entry.reference.path).sort();
  if (JSON.stringify(declaredContracts) !== JSON.stringify(expectedContracts)) {
    throw new Error('manifest contract inventory differs from tasks.md');
  }
  if (JSON.stringify(listTaskMarkdown(packageRoot)) !== JSON.stringify(expectedContracts)) {
    throw new Error('tasks directory differs from tasks.md authority');
  }
  const manifestTaskIds = Array.isArray(manifest.tasks) ? manifest.tasks.map(task => task?.id) : [];
  if (JSON.stringify(manifestTaskIds) !== JSON.stringify(indexed.map(entry => entry.id))) {
    throw new Error('manifest task inventory differs from tasks.md authority');
  }
  const completedTaskIds = indexed.filter(entry => entry.completed).map(entry => entry.id);
  const toEntry = ({ reference, inventorySha256 }) => ({
    path: `${packagePath}/${reference.path}`,
    sha256: inventorySha256,
    role: reference.role === 'contract' ? 'task' : reference.role,
  });
  const sourceInventory = references.filter(entry => entry.reference.role === 'source').map(toEntry)
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!sourceInventory.length) throw new Error('manifest must bind at least one source');
  const packageInventory = [
    { path: `${packagePath}/planning-manifest.json`, sha256: sha256(manifestBytes), role: 'manifest' },
    ...references.filter(entry => !['source', 'review'].includes(entry.reference.role)).map(toEntry),
  ].sort((a, b) => a.path.localeCompare(b.path));
  const readbackInventory = [
    { path: `${packagePath}/planning-manifest.json`, sha256: sha256(manifestBytes), role: 'manifest' },
    ...references.map(({ reference, bytes }) => ({
      path: `${packagePath}/${reference.path}`,
      sha256: sha256(bytes),
      role: reference.role === 'contract' ? 'task' : reference.role,
    })),
  ].sort((a, b) => a.path.localeCompare(b.path));
  const declaredDeliveryStatus = text(manifest.state) ? manifest.state : 'not-established';
  const snapshot = { packagePath, revision: manifest.revision, completedTaskIds, declaredDeliveryStatus,
    candidateSha256: planningCandidateSha256(manifest), sourceInventory, packageInventory,
    readbackSha256: sha256(Buffer.from(JSON.stringify(readbackInventory))) };
  const result = deepFreeze({ ...snapshot, inventorySha256: expectedInventorySha256(snapshot) });
  packageSnapshots.add(result);
  return result;
}

/** Locate one existing canonical OpenSpec planning package without writing.
 * Discovery is intentionally bounded to direct children of openspec/changes and
 * never follows symlinks. Missing lineage is not permission to create a package.
 */
export function discoverAgyReviewPackage({ projectRoot, packagePath = null, reuseExisting = false }) {
  const canonicalProjectRoot = canonicalRoot(projectRoot);
  if (packagePath !== null) {
    if (!safeReviewPath(packagePath)) throw new Error('packagePath must be a safe relative path');
    resolveNoSymlink(canonicalProjectRoot, packagePath, true);
    return deepFreeze({ status: 'located', packagePath,
      snapshot: inspectAgyReviewPackage({ projectRoot: canonicalProjectRoot, packagePath }) });
  }
  if (reuseExisting !== true) return deepFreeze({ status: 'locator-required', candidates: [],
    reason: 'locator-required: handoff did not identify a package or authorize reuse discovery' });
  const changesRelative = 'openspec/changes', changesRoot = path.join(canonicalProjectRoot, changesRelative);
  if (!fs.existsSync(changesRoot)) return deepFreeze({ status: 'locator-required', candidates: [],
    reason: 'locator-required: no canonical planning package found under openspec/changes' });
  resolveNoSymlink(canonicalProjectRoot, changesRelative, true);
  const candidates = [];
  for (const entry of fs.readdirSync(changesRoot, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`review symlink refused: ${changesRelative}/${entry.name}`);
    if (!entry.isDirectory()) continue;
    const relative = `${changesRelative}/${entry.name}`;
    resolveNoSymlink(canonicalProjectRoot, relative, true);
    const required = ['planning-manifest.json', 'tasks.md'];
    if (!required.every(name => fs.existsSync(path.join(canonicalProjectRoot, relative, name)))) continue;
    for (const name of required) resolveNoSymlink(canonicalProjectRoot, `${relative}/${name}`);
    candidates.push(relative);
  }
  candidates.sort();
  if (candidates.length !== 1) return deepFreeze({ status: 'locator-required', candidates,
    reason: candidates.length === 0
      ? 'locator-required: no canonical planning package found under openspec/changes'
      : 'locator-required: multiple canonical planning packages found; provide one exact safe relative locator' });
  const located = candidates[0];
  return deepFreeze({ status: 'located', packagePath: located,
    snapshot: inspectAgyReviewPackage({ projectRoot: canonicalProjectRoot, packagePath: located }) });
}

/** Compare two filesystem-derived snapshots without manufacturing delivery or review authority.
 * Exact equality/progress alone proves only package state: a qualified delivery and
 * corruption receipt is still required before a coordinator may report restoration.
 * A changed candidate requires fresh fidelity and quality. Canonical progress may only
 * advance here; reopening belongs to the execution-consumer receipt/journal protocol.
 */
export function compareAgyReviewPackageReadback(baseline, current) {
  if (!packageSnapshots.has(baseline) || !packageSnapshots.has(current)) {
    throw new Error('readback comparison requires filesystem-derived package snapshots');
  }
  const sameBinding = ['packagePath', 'revision', 'candidateSha256', 'inventorySha256', 'readbackSha256']
    .every(key => baseline[key] === current[key]) &&
    JSON.stringify(baseline.completedTaskIds) === JSON.stringify(current.completedTaskIds);
  if (sameBinding) return deepFreeze({
    status: 'existing package bytes unchanged', freshReviewRequired: null,
    proofLevel: 'byte-exact-snapshot-comparison', authorityClaim: false,
  });
  if (baseline.candidateSha256 !== current.candidateSha256 || baseline.revision !== current.revision) {
    return deepFreeze({ status: 'new candidate requires fresh review', freshReviewRequired: true,
      proofLevel: 'byte-exact-snapshot-comparison', authorityClaim: false });
  }
  if (baseline.inventorySha256 === current.inventorySha256) {
    const before = new Set(baseline.completedTaskIds), after = new Set(current.completedTaskIds);
    if ([...before].some(id => !after.has(id))) return deepFreeze({
      status: 'invalid progress regression requires reopen receipt', freshReviewRequired: null,
      proofLevel: 'canonical-progress-regression-detected', authorityClaim: false,
    });
    if (after.size > before.size) return deepFreeze({
      status: 'existing package state with updated progress', freshReviewRequired: null,
      proofLevel: 'canonical-progress-normalized-comparison', authorityClaim: false,
    });
  }
  return deepFreeze({ status: 'existing candidate bytes differ from baseline package state', freshReviewRequired: null,
    proofLevel: 'byte-exact-snapshot-comparison', authorityClaim: false });
}

export function createAgyReviewRequestFromPackage({ projectRoot, packagePath, reviewKind, fidelityRequest = null }) {
  if (!['fidelity', 'quality'].includes(reviewKind)) throw new Error('reviewKind must be fidelity or quality');
  const canonicalProjectRoot = canonicalRoot(projectRoot);
  const snapshot = inspectAgyReviewPackage({ projectRoot: canonicalProjectRoot, packagePath });
  let prior = null;
  if (reviewKind === 'quality') {
    const observed = hostRequests.get(fidelityRequest);
    if (!observed || observed.consumed !== true || observed.response?.verdict !== 'pass' || observed.usedByQuality) {
      throw new Error('quality request requires one consumed fresh fidelity response from this host process');
    }
    for (const key of ['packagePath', 'revision', 'candidateSha256', 'inventorySha256']) {
      if (fidelityRequest[key] !== snapshot[key]) throw new Error(`fidelity response is stale for current ${key}`);
    }
    prior = observed.output;
  }
  const request = {
    schema: AGY_REVIEW_REQUEST_SCHEMA,
    packagePath: snapshot.packagePath,
    revision: snapshot.revision,
    candidateSha256: snapshot.candidateSha256,
    inventorySha256: snapshot.inventorySha256,
    sourceInventory: snapshot.sourceInventory,
    packageInventory: snapshot.packageInventory,
    freshness: randomBytes(32).toString('hex'),
    priorFidelityOutput: prior,
    priorFidelitySha256: prior ? sha256(Buffer.from(prior)) : null,
    reviewKind,
  };
  validateAgyReviewRequest(request);
  const frozen = Object.freeze(structuredClone(request));
  hostRequests.set(frozen, { attempted: false, consumed: false, output: null, response: null, usedByQuality: false,
    projectRoot: canonicalProjectRoot });
  if (reviewKind === 'quality') hostRequests.get(fidelityRequest).usedByQuality = true;
  return frozen;
}

export function encodeAgyReviewRequest(request) {
  validateAgyReviewRequest(request);
  return `${AGY_REVIEW_REQUEST_HEADER}${JSON.stringify(request)}`;
}

export function parseAgyReviewRequest(prompt) {
  if (typeof prompt !== 'string' || !prompt.startsWith(AGY_REVIEW_REQUEST_HEADER)) {
    throw new Error('invalid AGY review request header');
  }
  const bytes = prompt.slice(AGY_REVIEW_REQUEST_HEADER.length);
  let request;
  try { request = JSON.parse(bytes); } catch { throw new Error('invalid AGY review request JSON'); }
  return validateAgyReviewRequest(request);
}

/**
 * AGY 1.3.3 exposes no durable private host authority or parent identity. Observed
 * PostToolUse data includes toolCall metadata, but not nested output or a bindable
 * reviewer result. Accepting a JavaScript object supplied by the caller would merely
 * let that caller self-attest. This public source adapter must therefore remain
 * fail-closed until a future native host integration owns an unforgeable capability
 * outside the model/workspace process.
 */
export async function createAgyReviewDispatchAuthority() {
  throw new Error('AGY reviewer dispatch unavailable: no qualified native-private durable host authority');
}

export async function attestAgyReviewDispatch({ dispatchAuthority, dispatchReceipt, request }) {
  validateAgyReviewRequest(request);
  void dispatchAuthority; void dispatchReceipt;
  throw new Error('AGY reviewer dispatch unavailable: no qualified native-private durable host authority');
}

export function parseAgyReviewResponse(output, request, { dispatchReceipt } = {}) {
  validateAgyReviewRequest(request);
  const host = hostRequests.get(request);
  if (!host) throw new Error('response requires the original host-built AGY review request');
  void output; void dispatchReceipt;
  throw new Error('AGY review response cannot be trusted: no qualified native-private durable host authority');
}

/** Pure envelope validation for fixtures and future host adapters. This function
 * does not establish independence, consume fidelity, mint a receipt or authorize
 * planning delivery. */
export function validateAgyReviewResponseEnvelope(output, request) {
  validateAgyReviewRequest(request);
  return parseResponseBytes(output, request);
}
