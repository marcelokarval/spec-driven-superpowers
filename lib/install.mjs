import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { safePath } from './contracts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const OWNED_FILE_MODE = 0o644;
const OWNED_FILE_TYPE = 'file';
const OWNED_NLINK_POLICY = 'exactly-one';
const MANIFEST_V1_KEYS = Object.freeze(['files', 'format', 'schemaRoot', 'scope', 'target']);
const MANIFEST_V1_ENTRY_KEYS = Object.freeze(['path', 'sha256']);
const MANIFEST_V2_KEYS = Object.freeze(['files', 'format', 'schemaRoot', 'scope', 'skillsDir', 'target']);
const MANIFEST_V3_KEYS = Object.freeze(['features', 'files', 'format', 'schemaRoot', 'scope', 'skillsDir', 'target']);
const MANIFEST_FEATURE_KEYS = Object.freeze(['activate', 'rules']);
const AGY_COORDINATOR_NAME = 'spec-driven-superpowers.md';
const AGY_REVIEWER_NAME = 'spec-driven-superpowers-reviewer.md';
const AGY_PRIMARY_REVIEWER_NAME = 'spec-driven-superpowers-reviewer-primary.md';
const AGY_EXECUTION_AGENT_NAMES = Object.freeze([
  'asds-coordinator.md',
  'asds-executor.md',
  'asds-explore.md',
  'asds-frontend-executor.md',
  'asds-integrator.md',
  'asds-librarian.md',
  'asds-reviewer.md',
  'asds-verifier.md',
]);
const AGY_AGENT_NAMES = Object.freeze([
  AGY_COORDINATOR_NAME,
  AGY_REVIEWER_NAME,
  AGY_PRIMARY_REVIEWER_NAME,
  ...AGY_EXECUTION_AGENT_NAMES,
]);
const HARNESS_AGENT_NAMES = Object.freeze({
  agy: AGY_AGENT_NAMES,
  opencode: Object.freeze([
    AGY_COORDINATOR_NAME,
    AGY_REVIEWER_NAME,
    ...AGY_EXECUTION_AGENT_NAMES,
  ]),
  codex: Object.freeze([
    AGY_COORDINATOR_NAME,
    AGY_REVIEWER_NAME,
    'asds-coordinator.md',
    'asds-executor.md',
    'asds-explore.md',
    'asds-integrator.md',
    'asds-reviewer.md',
    'asds-verifier.md',
  ]),
  claude: Object.freeze([
    AGY_COORDINATOR_NAME,
    AGY_REVIEWER_NAME,
    ...AGY_EXECUTION_AGENT_NAMES,
  ]),
});
const CAPABILITY_MARKER_NAME = 'accelerate-handoff-capability.json';
const REVIEW_DISPATCH_CONTRACT_NAME = 'agy-review-dispatch-contract.json';
const REVIEW_SUPERVISOR_CONTRACT_NAME = 'agy-review-supervisor-transport.json';
const LEGACY_MIGRATION_JOURNAL = 'install-migration.json';
const STALE_TOMBSTONES = Object.freeze({
  registryVersion: 1,
  entries: Object.freeze([
    Object.freeze({
      skillRelativePath: 'asds-execution-consumer/legacy/obsolete.mjs',
      sha256: '3faa010c2794215f6f101165fff2050c58266264dbbf66f9ec4e02eb05d7e069',
      mode: 0o644,
      type: OWNED_FILE_TYPE,
      nlinkPolicy: OWNED_NLINK_POLICY,
      lastOwnedVersion: 'ec09-pre-tombstone-v1',
      retiredInVersion: 'ec09-tombstones-v1',
    }),
  ]),
});
const hash = data => createHash('sha256').update(data).digest('hex');
const stat = file => {
  try { return fs.lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

function manifestRelativePath(skillsDir) {
  return skillsDir === '.agents/skills'
    ? '.asds/install-manifest.json'
    : `.asds/install-manifests/${hash(Buffer.from(skillsDir))}.json`;
}

function harnessAgentProfile(scope, target, skillsDir) {
  if (scope === 'project' && skillsDir === '.agents/skills') {
    return { harness: 'agy', sourceDir: path.join(root, 'adapters/agy/agents'), destDir: path.join(target, '.agents/agents') };
  }
  if (scope === 'user' && skillsDir === '.gemini/config/skills') {
    return { harness: 'agy', sourceDir: path.join(root, 'adapters/agy/agents'), destDir: path.join(target, '.gemini/config/agents') };
  }
  if (scope === 'project' && skillsDir === '.opencode/skills') {
    return { harness: 'opencode', sourceDir: path.join(root, 'adapters/opencode/agents'), destDir: path.join(target, '.opencode/agents') };
  }
  if (scope === 'user' && skillsDir === '.config/opencode/skills') {
    return { harness: 'opencode', sourceDir: path.join(root, 'adapters/opencode/agents'), destDir: path.join(target, '.config/opencode/agents') };
  }
  if (skillsDir === '.codex/skills') {
    return { harness: 'codex', sourceDir: path.join(root, 'adapters/codex/agents'), destDir: path.join(target, '.codex/agents') };
  }
  if (skillsDir === '.claude/skills') {
    return { harness: 'claude', sourceDir: path.join(root, 'adapters/claude/agents'), destDir: path.join(target, '.claude/agents') };
  }
  return null;
}

function harnessAgentEntries(scope, target, skillsDir) {
  const profile = harnessAgentProfile(scope, target, skillsDir);
  if (!profile) return [];
  return HARNESS_AGENT_NAMES[profile.harness].map(name => ({
    name,
    source: path.join(profile.sourceDir, name),
    destination: path.join(profile.destDir, name),
  }));
}

function agyAgentRoot(scope, target, skillsDir) {
  const profile = harnessAgentProfile(scope, target, skillsDir);
  return profile?.harness === 'agy' ? profile.destDir : null;
}

function agyAgentDestinations(scope, target, skillsDir) {
  const destination = agyAgentRoot(scope, target, skillsDir);
  return destination ? AGY_AGENT_NAMES.map(name => path.join(destination, name)) : [];
}

function agyCoordinatorDestination(scope, target, skillsDir) {
  const destination = agyAgentRoot(scope, target, skillsDir);
  return destination ? path.join(destination, AGY_COORDINATOR_NAME) : null;
}

function capabilityMarkerDestination(scope, target, skillsDir) {
  return agyCoordinatorDestination(scope, target, skillsDir)
    ? path.join(target, '.asds', CAPABILITY_MARKER_NAME)
    : null;
}

function reviewDispatchContractDestination(scope, target, skillsDir) {
  return agyCoordinatorDestination(scope, target, skillsDir)
    ? path.join(target, '.asds', REVIEW_DISPATCH_CONTRACT_NAME)
    : null;
}

function reviewSupervisorContractDestination(scope, target, skillsDir) {
  return agyCoordinatorDestination(scope, target, skillsDir)
    ? path.join(target, '.asds', REVIEW_SUPERVISOR_CONTRACT_NAME)
    : null;
}

function assertPath(file, leafIsFile = true) {
  const chain = [];
  for (let part = file; ; part = path.dirname(part)) {
    chain.unshift(part);
    if (part === path.dirname(part)) break;
  }
  for (const part of chain) {
    const info = stat(part);
    if (info?.isSymbolicLink()) throw new Error(`symlink refused: ${part}`);
    if (info && !(part === file && leafIsFile ? info.isFile() : info.isDirectory())) {
      throw new Error(`conflict: unexpected file type at ${part}`);
    }
  }
}

function tree(source, destination) {
  const files = [];
  for (const entry of fs.readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) files.push(...tree(from, to));
    else if (entry.isFile()) files.push({ path: to, data: fs.readFileSync(from) });
    else throw new Error(`Unsupported source entry: ${from}`);
  }
  return files;
}

function within(rootPath, candidate) {
  const relative = path.relative(rootPath, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function payloadInventoryIdentity(file, target, schemaRoot) {
  if (file === target || file === schemaRoot) throw new Error(`payload file cannot equal an inventory root: ${file}`);
  if (within(target, file)) return `target:${path.relative(target, file).split(path.sep).join('/')}`;
  if (within(schemaRoot, file)) return `schema:${path.relative(schemaRoot, file).split(path.sep).join('/')}`;
  throw new Error(`payload file is outside target and schema roots: ${file}`);
}

function validOwnedEntry(entry) {
  const keys = ['mode', 'nlinkPolicy', 'path', 'sha256', 'type'];
  return entry && typeof entry.path === 'string' && path.resolve(entry.path) === entry.path && path.normalize(entry.path) === entry.path &&
    /^[a-f0-9]{64}$/.test(entry.sha256) && Number.isInteger(entry.mode) && entry.mode >= 0 && entry.mode <= 0o777 &&
    entry.type === OWNED_FILE_TYPE && entry.nlinkPolicy === OWNED_NLINK_POLICY &&
    Object.keys(entry).sort().every((key, index) => key === keys[index]) && Object.keys(entry).length === keys.length;
}

function validLegacyEntry(entry) {
  return hasExactKeys(entry, MANIFEST_V1_ENTRY_KEYS) && typeof entry.path === 'string' &&
    path.resolve(entry.path) === entry.path && path.normalize(entry.path) === entry.path &&
    /^[a-f0-9]{64}$/.test(entry.sha256);
}

function hasExactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function validManifestV2(manifest) {
  return hasExactKeys(manifest, MANIFEST_V2_KEYS) && manifest.format === 2 &&
    typeof manifest.scope === 'string' && typeof manifest.target === 'string' &&
    typeof manifest.schemaRoot === 'string' && typeof manifest.skillsDir === 'string' &&
    Array.isArray(manifest.files) && manifest.files.every(validOwnedEntry);
}

function validManifestV1(manifest) {
  return hasExactKeys(manifest, MANIFEST_V1_KEYS) && manifest.format === 1 &&
    typeof manifest.scope === 'string' && typeof manifest.target === 'string' &&
    typeof manifest.schemaRoot === 'string' && Array.isArray(manifest.files) &&
    manifest.files.length > 0 && manifest.files.every(validLegacyEntry);
}

function validManifestV3(manifest) {
  return hasExactKeys(manifest, MANIFEST_V3_KEYS) && manifest.format === 3 &&
    hasExactKeys(manifest.features, MANIFEST_FEATURE_KEYS) &&
    typeof manifest.features.activate === 'boolean' && typeof manifest.features.rules === 'boolean' &&
    typeof manifest.scope === 'string' && typeof manifest.target === 'string' &&
    typeof manifest.schemaRoot === 'string' && typeof manifest.skillsDir === 'string' &&
    Array.isArray(manifest.files) && manifest.files.every(validOwnedEntry);
}

const validManifest = manifest => validManifestV2(manifest) || validManifestV3(manifest);

function tombstoneFor(relative, entry) {
  return STALE_TOMBSTONES.entries.find(tombstone => tombstone.skillRelativePath === relative &&
    tombstone.sha256 === entry.sha256 && tombstone.mode === entry.mode &&
    tombstone.type === entry.type && tombstone.nlinkPolicy === entry.nlinkPolicy);
}

function assertOwnedCurrent(entry, label = 'owned file') {
  assertPath(entry.path);
  const info = stat(entry.path);
  if (!info) throw new Error(`modified or missing ${label}: ${entry.path}`);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`modified file type for ${label}: ${entry.path}`);
  if (info.nlink !== 1) throw new Error(`hardlink refused for ${label}: ${entry.path}`);
  if ((info.mode & 0o777) !== entry.mode) throw new Error(`modified mode for ${label}: ${entry.path}`);
  if (hash(fs.readFileSync(entry.path)) !== entry.sha256) throw new Error(`modified bytes for ${label}: ${entry.path}`);
  return info;
}

export function discoverSkills(collection, names = new Set()) {
  assertPath(collection, false);
  const sources = [];
  for (const entry of fs.readdirSync(collection, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const source = path.join(collection, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symlink refused: ${source}`);
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(source, 'SKILL.md');
    const info = stat(skillFile);
    if (!info) continue;
    if (info.isSymbolicLink()) throw new Error(`symlink refused: ${skillFile}`);
    if (!info.isFile() || !fs.readFileSync(skillFile, 'utf8').trim()) {
      throw new Error(`Invalid skill source: ${skillFile}`);
    }
    if (names.has(entry.name)) throw new Error(`Duplicate skill source: ${entry.name}`);
    names.add(entry.name);
    sources.push(source);
  }
  return sources;
}

function sourcePayload({ scope, target, schemaRoot, skillsDir, activate = false, rules = false }) {
  const skillRoot = path.join(target, skillsDir);
  const files = tree(path.join(root, 'skills/spec-driven-superpowers'), path.join(skillRoot, 'spec-driven-superpowers'));
  const harnessAgents = harnessAgentEntries(scope, target, skillsDir);
  for (const agent of harnessAgents) {
    files.push({ path: agent.destination, data: fs.readFileSync(agent.source) });
  }
  const agyAgents = agyAgentDestinations(scope, target, skillsDir);
  const capabilityMarker = capabilityMarkerDestination(scope, target, skillsDir);
  const reviewDispatchContract = reviewDispatchContractDestination(scope, target, skillsDir);
  const reviewSupervisorContract = reviewSupervisorContractDestination(scope, target, skillsDir);
  const consumerRoot = path.join(skillRoot, 'asds-execution-consumer');
  let supervisorContract = null;
  if (agyAgents.length) {
    const asdsVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const coordinator = agyCoordinatorDestination(scope, target, skillsDir);
    const coordinatorData = fs.readFileSync(path.join(root, 'adapters/agy/agents', AGY_COORDINATOR_NAME));
    const reviewer = agyAgents.find(file => path.basename(file) === AGY_REVIEWER_NAME);
    const reviewerData = fs.readFileSync(path.join(root, 'adapters/agy/agents', AGY_REVIEWER_NAME));
    const primaryReviewer = agyAgents.find(file => path.basename(file) === AGY_PRIMARY_REVIEWER_NAME);
    const primaryReviewerData = fs.readFileSync(path.join(root, 'adapters/agy/agents', AGY_PRIMARY_REVIEWER_NAME));
    const protocol = path.join(consumerRoot, 'lib/agy-review-protocol.mjs');
    const protocolData = fs.readFileSync(path.join(root, 'lib/agy-review-protocol.mjs'));
    const supervisor = path.join(consumerRoot, 'lib/agy-review-supervisor.mjs');
    const supervisorData = fs.readFileSync(path.join(root, 'lib/agy-review-supervisor.mjs'));
    files.push({ path: capabilityMarker, data: Buffer.from(`${JSON.stringify({
      schema: 'asds.accelerate-handoff-capability/1',
      typeName: 'spec-driven-superpowers',
      agentRelativePath: path.relative(target, coordinator).split(path.sep).join('/'),
      agentSha256: hash(coordinatorData),
      asdsVersion,
      planningOnly: true,
      writesApplicationCode: false,
      futureTaskExecution: false,
    }, null, 2)}\n`) });
    files.push({ path: reviewDispatchContract, data: Buffer.from(`${JSON.stringify({
      schema: 'asds.agy-review-dispatch-contract/1',
      coordinatorTypeName: 'spec-driven-superpowers',
      coordinatorRelativePath: path.relative(target, coordinator).split(path.sep).join('/'),
      coordinatorSha256: hash(coordinatorData),
      reviewerTypeName: 'spec-driven-superpowers-reviewer',
      reviewerRelativePath: path.relative(target, reviewer).split(path.sep).join('/'),
      reviewerSha256: hash(reviewerData),
      protocolRelativePath: path.relative(target, protocol).split(path.sep).join('/'),
      protocolSha256: hash(protocolData),
      role: 'planning-reviewer',
      tool: 'invoke_subagent',
      itemKeys: ['TypeName', 'Role', 'Prompt'],
      requestHeader: 'ASDS_REVIEW_REQUEST_V1',
      responseHeader: 'ASDS_REVIEW_RESPONSE_V1',
      receiptSchema: 'asds.agy-review-dispatch-receipt/1',
      receiptSource: 'agy-host-hook',
      hostAuthorityCapability: 'agy-review-dispatch',
      hostApi: ['createAgyReviewDispatchAuthority', 'attestAgyReviewDispatch', 'parseAgyReviewResponse'],
      receiptVisibility: 'host-private',
      runtimeHostStatus: 'unavailable',
      timeoutDisposition: 'blocked',
      requiresArgumentRewrite: false,
      exactPromptRequired: true,
      oneUseFreshnessRequired: true,
      requiresHostEnforcement: true,
      planningOnly: true,
      reviewerWriteScope: [],
    }, null, 2)}\n`) });
    supervisorContract = {
      schema: 'asds.agy-review-supervisor-transport/1',
      transport: 'headless-stream-json',
      reviewerTypeName: 'spec-driven-superpowers-reviewer-primary',
      reviewerRelativePath: path.relative(target, primaryReviewer).split(path.sep).join('/'),
      reviewerSha256: hash(primaryReviewerData),
      protocolRelativePath: path.relative(target, protocol).split(path.sep).join('/'),
      protocolSha256: hash(protocolData),
      supervisorRelativePath: path.relative(target, supervisor).split(path.sep).join('/'),
      supervisorSha256: hash(supervisorData),
      inputFormat: 'stream-json',
      outputFormat: 'stream-json',
      freshProcessPerReview: true,
      nativeNestedRuntimeHostStatus: 'unavailable',
      qualificationStatus: 'source-tested',
      authorityStatus: 'unavailable',
      completionStatus: 'unavailable',
      outputTrust: 'untrusted-capture-only',
      planningOnly: true,
      reviewerWriteScope: [],
    };
  }
  const plannerRoot = path.join(skillRoot, 'spec-driven-superpowers');
  files.push(...tree(path.join(root, 'skills/asds-execution-consumer'), consumerRoot));
  const consumerModules = ['agy-review-protocol', 'agy-review-supervisor', 'contracts', 'dag-status-view', 'decomposition', 'execution-consumer', 'execution-handoff', 'git-scope', 'handoff', 'host-bridge', 'install', 'orchestration',
    'orchestration-store', 'package-builder', 'plan-projection', 'planning-coverage', 'planning-graph', 'planning-lifecycle', 'planning-paths', 'planning-store',
    'receipt-reconciliation', 'task-index-progress', 'validation'];
  for (const name of consumerModules) {
    const data = fs.readFileSync(path.join(root, 'lib', `${name}.mjs`));
    files.push({ path: path.join(consumerRoot, 'lib', `${name}.mjs`), data });
    files.push({ path: path.join(plannerRoot, 'lib', `${name}.mjs`), data });
  }
  files.push(...tree(path.join(root, 'node_modules/yaml'), path.join(consumerRoot, 'node_modules/yaml')));
  files.push(...tree(path.join(root, 'node_modules/yaml'), path.join(plannerRoot, 'node_modules/yaml')));
  for (const name of ['consume.mjs', 'create-execution-handoff.mjs', 'validate.mjs', 'build-package.mjs']) {
    files.push({ path: path.join(consumerRoot, 'scripts', name), data: fs.readFileSync(path.join(root, 'scripts', name)) });
  }
  for (const name of ['validate.mjs', 'build-package.mjs']) {
    files.push({ path: path.join(plannerRoot, 'scripts', name), data: fs.readFileSync(path.join(root, 'scripts', name)) });
  }
  files.push(...tree(path.join(root, 'examples/execution-consumer'), path.join(consumerRoot, 'examples')));
  const names = new Set(['spec-driven-superpowers', 'asds-execution-consumer']);
  for (const collection of ['openspec', 'superpowers']) {
    for (const source of discoverSkills(path.join(root, 'skills', collection), names)) {
      files.push(...tree(source, path.join(skillRoot, path.basename(source))));
    }
  }
  files.push(...tree(path.join(root, 'schemas/superpowers-bridge'), path.join(schemaRoot, 'openspec/schemas/superpowers-bridge')));
  for (const name of ['LICENSE', 'vendor-provenance.json']) {
    files.push({ path: path.join(target, '.asds', name), data: fs.readFileSync(path.join(root, name)) });
  }
  if (activate) files.push({ path: path.join(target, 'openspec/config.yaml'), data: Buffer.from('schema: superpowers-bridge\n') });
  if (rules) files.push({ path: path.join(target, 'AGENTS.md'), data: fs.readFileSync(path.join(root, 'rules/AGENTS.md')) });
  if (supervisorContract) {
    const identities = [...files.map(file => file.path), reviewSupervisorContract]
      .map(file => payloadInventoryIdentity(file, target, schemaRoot)).sort();
    supervisorContract.manifestInventorySha256 = hash(Buffer.from(JSON.stringify(identities)));
    files.push({ path: reviewSupervisorContract,
      data: Buffer.from(`${JSON.stringify(supervisorContract, null, 2)}\n`) });
  }
  return files;
}

function validateManifestInventory(manifest, { scope, target, schemaRoot, skillsDir }, label) {
  if (manifest.format === 2 && manifest.files.some(entry =>
    entry.path === path.join(target, 'AGENTS.md') || entry.path === path.join(target, 'openspec/config.yaml'))) {
    throw new Error(`legacy ${label} cannot prove optional rule or activation ownership`);
  }
  const features = manifest.format === 3 ? manifest.features : { activate: false, rules: false };
  const official = new Map(sourcePayload({ scope, target, schemaRoot, skillsDir, ...features }).map(file => [file.path, {
    path: file.path, sha256: hash(file.data), mode: OWNED_FILE_MODE,
    type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY,
  }]));
  const declared = new Set();
  const skillRoot = path.join(target, skillsDir);
  for (const entry of manifest.files) {
    if (declared.has(entry.path)) throw new Error(`invalid or duplicate ${label} entry`);
    declared.add(entry.path);
    const expected = official.get(entry.path);
    if (expected) {
      if (entry.sha256 !== expected.sha256 || entry.mode !== expected.mode || entry.type !== expected.type ||
          entry.nlinkPolicy !== expected.nlinkPolicy) {
        throw new Error(`${label} metadata does not match the current official payload: ${entry.path}`);
      }
      continue;
    }
    const relative = within(skillRoot, entry.path) ? path.relative(skillRoot, entry.path).split(path.sep).join('/') : null;
    if (!relative || !tombstoneFor(relative, entry)) {
      throw new Error(`${label} entry is not in the exact official profile inventory or tombstone registry: ${entry.path}`);
    }
  }
  for (const expected of official.keys()) {
    if (!declared.has(expected)) throw new Error(`${label} is missing official profile payload: ${expected}`);
  }
}

function adoptLegacyInventory(previous, previousBytes, expectedReceiptSha256,
  { scope, target, schemaRoot, skillsDir, planned, desired, owned, legacyModes, resuming }) {
  if (skillsDir !== '.agents/skills') {
    throw new Error('legacy manifest does not bind a skills directory; adoption is limited to the historical default .agents/skills profile');
  }
  if (hash(previousBytes) !== expectedReceiptSha256) {
    throw new Error('legacy manifest SHA-256 does not match the exact receipt bytes');
  }
  if (!validManifestV1(previous) || previous.scope !== scope || previous.target !== target || previous.schemaRoot !== schemaRoot) {
    throw new Error('invalid legacy manifest identity or schema');
  }
  const skillRoot = path.join(target, skillsDir);
  const stale = [];
  for (const entry of previous.files) {
    if (owned.has(entry.path)) throw new Error('invalid or duplicate legacy manifest entry');
    if ((entry.path === path.join(target, 'AGENTS.md') || entry.path === path.join(target, 'openspec/config.yaml')) &&
        !planned.has(entry.path)) {
      throw new Error(`legacy manifest optional ownership requires the matching explicit --rules or --activate flag: ${entry.path}`);
    }
    const relative = !planned.has(entry.path) && within(skillRoot, entry.path)
      ? path.relative(skillRoot, entry.path).split(path.sep).join('/') : null;
    const tombstone = relative && STALE_TOMBSTONES.entries.find(candidate =>
      candidate.skillRelativePath === relative && candidate.sha256 === entry.sha256);
    if (!planned.has(entry.path) && !tombstone) {
      throw new Error(`legacy manifest entry is not current official payload or an exact source-controlled tombstone: ${entry.path}`);
    }
    assertPath(entry.path);
    const info = stat(entry.path);
    const expected = desired.get(entry.path);
    const currentHash = info?.isFile() && !info.isSymbolicLink() && info.nlink === 1
      ? hash(fs.readFileSync(entry.path)) : null;
    const alreadyMigrated = resuming && expected && currentHash === expected.sha256 &&
      (info.mode & 0o777) === expected.mode;
    if (!info || !info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
        (currentHash !== entry.sha256 && !alreadyMigrated)) {
      if (resuming && tombstone && !info) continue;
      throw new Error(`modified, missing, linked, or non-file legacy manifest entry: ${entry.path}`);
    }
    owned.set(entry.path, entry.sha256);
    if (!alreadyMigrated) legacyModes.set(entry.path, info.mode & 0o777);
    if (!planned.has(entry.path)) {
      if (tombstone.mode !== (info.mode & 0o777) || tombstone.type !== OWNED_FILE_TYPE ||
          tombstone.nlinkPolicy !== OWNED_NLINK_POLICY) {
        throw new Error(`legacy manifest entry is not current official payload or an exact source-controlled tombstone: ${entry.path}`);
      }
      stale.push({ path: entry.path, remove: true, previous: fs.readFileSync(entry.path),
        mode: info.mode & 0o777, type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY,
        pruneRoot: skillRoot });
    }
  }
  return stale;
}

function siblingReceiptInventory({ scope, target, schemaRoot, receiptPath }) {
  return installedManifestPaths(target).filter(file => file !== receiptPath).map(file => {
    const before = fs.readFileSync(file), sibling = JSON.parse(before);
    if (!validManifest(sibling) || sibling.scope !== scope || sibling.target !== target ||
        sibling.schemaRoot !== schemaRoot || !safePath(sibling.skillsDir) ||
        path.join(target, manifestRelativePath(sibling.skillsDir)) !== file) {
      throw new Error(`invalid legacy migration sibling receipt: ${file}`);
    }
    const features = sibling.format === 3 ? sibling.features : { activate: false, rules: false };
    const afterManifest = { ...sibling, files: sourcePayload({ scope, target, schemaRoot,
      skillsDir: sibling.skillsDir, ...features }).map(payload => ({
      path: payload.path, sha256: hash(payload.data), mode: OWNED_FILE_MODE,
      type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY,
    })).sort((a, b) => a.path.localeCompare(b.path)) };
    const after = Buffer.from(`${JSON.stringify(afterManifest, null, 2)}\n`);
    return { path: file, beforeSha256: hash(before), afterSha256: hash(after) };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function legacyMigrationJournal({ previous, previousBytes, receiptSha256, scope, target, schemaRoot, skillsDir, features, desired,
  reconcileShared, siblings }) {
  const skillRoot = path.join(target, skillsDir);
  const stale = [];
  for (const entry of previous.files) {
    if (desired.has(entry.path)) continue;
    const relative = within(skillRoot, entry.path) ? path.relative(skillRoot, entry.path).split(path.sep).join('/') : null;
    const tombstone = relative && STALE_TOMBSTONES.entries.find(candidate =>
      candidate.skillRelativePath === relative && candidate.sha256 === entry.sha256);
    if (!tombstone) continue;
    stale.push({ path: entry.path, sha256: entry.sha256, mode: tombstone.mode,
      type: tombstone.type, nlinkPolicy: tombstone.nlinkPolicy });
  }
  return {
    schema: 'asds.install-migration/1', legacyReceiptSha256: receiptSha256,
    legacyReceiptBase64: previousBytes.toString('base64'),
    legacyModes: [...previous.files.map(entry => ({ path: entry.path, sha256: entry.sha256,
      mode: stat(entry.path).mode & 0o777 })), { path: path.join(target, manifestRelativePath(skillsDir)),
      sha256: receiptSha256, mode: stat(path.join(target, manifestRelativePath(skillsDir))).mode & 0o777 }]
      .sort((a, b) => a.path.localeCompare(b.path)),
    scope, target, schemaRoot, skillsDir, features, reconcileShared,
    desired: [...desired.values()].sort((a, b) => a.path.localeCompare(b.path)),
    siblings,
    stale: stale.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function validateCompletedMigrationJournal(data, expectedReceiptSha256,
  { scope, target, schemaRoot, skillsDir, features, desired, reconcileShared, receiptPath }) {
  const keys = ['desired', 'features', 'legacyModes', 'legacyReceiptBase64', 'legacyReceiptSha256', 'reconcileShared', 'schema', 'schemaRoot', 'scope', 'siblings', 'skillsDir', 'stale', 'target'];
  const journal = JSON.parse(data);
  const legacyReceiptBytes = typeof journal.legacyReceiptBase64 === 'string' ? Buffer.from(journal.legacyReceiptBase64, 'base64') : Buffer.alloc(0);
  const legacyReceipt = (() => { try { return JSON.parse(legacyReceiptBytes); } catch { return null; } })();
  if (!hasExactKeys(journal, keys) || journal.schema !== 'asds.install-migration/1' ||
      journal.legacyReceiptSha256 !== expectedReceiptSha256 || journal.scope !== scope ||
      journal.target !== target || journal.schemaRoot !== schemaRoot || journal.skillsDir !== skillsDir ||
      !hasExactKeys(journal.features, MANIFEST_FEATURE_KEYS) ||
      journal.features.activate !== features.activate || journal.features.rules !== features.rules ||
      journal.reconcileShared !== reconcileShared ||
      JSON.stringify(journal.desired) !== JSON.stringify([...desired.values()].sort((a, b) => a.path.localeCompare(b.path))) ||
      hash(legacyReceiptBytes) !== expectedReceiptSha256 ||
      Buffer.from(legacyReceiptBytes.toString('base64'), 'base64').toString('base64') !== journal.legacyReceiptBase64 ||
      !validManifestV1(legacyReceipt) || legacyReceipt.scope !== scope || legacyReceipt.target !== target ||
      legacyReceipt.schemaRoot !== schemaRoot || !Array.isArray(journal.legacyModes) ||
      !Array.isArray(journal.stale) || !Array.isArray(journal.siblings)) {
    throw new Error('completed legacy migration journal identity, options, or payload mismatch');
  }
  const legacyEntries = new Map(legacyReceipt.files.map(entry => [entry.path, entry]));
  legacyEntries.set(receiptPath, { path: receiptPath, sha256: expectedReceiptSha256 });
  const legacyModeSeen = new Set();
  for (const entry of journal.legacyModes) {
    if (!hasExactKeys(entry, ['mode', 'path', 'sha256']) || !legacyEntries.has(entry.path) ||
        legacyEntries.get(entry.path).sha256 !== entry.sha256 || !Number.isInteger(entry.mode) ||
        entry.mode < 0 || entry.mode > 0o777 || legacyModeSeen.has(entry.path)) {
      throw new Error('completed legacy migration journal has invalid legacy mode inventory');
    }
    legacyModeSeen.add(entry.path);
  }
  if (legacyModeSeen.size !== legacyEntries.size) throw new Error('completed legacy migration journal has incomplete legacy mode inventory');
  const actualSiblingPaths = installedManifestPaths(target).filter(file => file !== receiptPath).sort();
  const declaredSiblingPaths = [], siblingSeen = new Set();
  for (const entry of journal.siblings) {
    if (!hasExactKeys(entry, ['afterSha256', 'beforeSha256', 'path']) || typeof entry.path !== 'string' ||
        path.resolve(entry.path) !== entry.path || !/^[a-f0-9]{64}$/.test(entry.beforeSha256) ||
        !/^[a-f0-9]{64}$/.test(entry.afterSha256) || siblingSeen.has(entry.path)) {
      throw new Error('completed legacy migration journal has invalid sibling receipt inventory');
    }
    siblingSeen.add(entry.path); declaredSiblingPaths.push(entry.path);
    assertPath(entry.path);
    const info = stat(entry.path);
    if (!info || !info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
      throw new Error(`completed legacy migration sibling receipt is missing or linked: ${entry.path}`);
    }
    const currentSha256 = hash(fs.readFileSync(entry.path));
    if (currentSha256 !== entry.beforeSha256 && currentSha256 !== entry.afterSha256) {
      throw new Error(`completed legacy migration sibling receipt drift: ${entry.path}`);
    }
  }
  if (JSON.stringify(declaredSiblingPaths.sort()) !== JSON.stringify(actualSiblingPaths)) {
    throw new Error('completed legacy migration journal sibling receipt inventory mismatch');
  }
  const skillRoot = path.join(target, skillsDir), seen = new Set();
  for (const entry of journal.stale) {
    if (!validOwnedEntry(entry) || seen.has(entry.path)) throw new Error('completed legacy migration journal has invalid stale inventory');
    seen.add(entry.path);
    const relative = within(skillRoot, entry.path) ? path.relative(skillRoot, entry.path).split(path.sep).join('/') : null;
    if (!relative || !tombstoneFor(relative, entry)) throw new Error('completed legacy migration journal has unregistered stale inventory');
  }
  return journal;
}

export function installPlanSha256(files) {
  if (!Array.isArray(files) || !files.installOptions) throw new Error('install plan metadata missing');
  const actions = files.map(file => {
    const before = file.previous ?? file.observed?.data ?? null;
    return {
      path: file.path,
      operation: file.cleanupAfterSuccess ? 'journal' : file.remove ? 'remove' : before ? 'replace-or-verify' : 'create',
      beforeSha256: before ? hash(before) : null,
      beforeMode: file.previousMode ?? file.observed?.mode ?? null,
      afterSha256: file.remove ? null : hash(file.data),
      afterMode: file.remove ? null : file.mode,
      temporaryIdentity: file.temporaryIdentity ?? null,
      cleanupAfterSuccess: Boolean(file.cleanupAfterSuccess),
    };
  });
  return hash(Buffer.from(JSON.stringify({ schema: 'asds.install-plan/1', options: files.installOptions, actions })));
}

export function planInstall({ scope, target, dataHome, activate = false, rules = false, update = false, reconcileShared = false,
  adoptLegacyManifestSha256, skillsDir = '.agents/skills' }) {
  if (!['project', 'user'].includes(scope) || !target) throw new Error('Explicit --scope project|user and --target required');
  if (scope === 'user' && !dataHome) throw new Error('User scope requires explicit --data-home (OpenSpec uses XDG_DATA_HOME)');
  if (scope === 'user' && (activate || rules)) throw new Error('--activate and --rules require project scope');
  if (scope === 'project' && dataHome) throw new Error('--data-home is only valid for user scope');
  if (reconcileShared && (!update || scope !== 'user')) throw new Error('--reconcile-shared requires --update with user scope');
  if (adoptLegacyManifestSha256 !== undefined && !update) {
    throw new Error('--adopt-legacy-manifest-sha256 requires --update');
  }
  if (adoptLegacyManifestSha256 !== undefined && !/^[a-f0-9]{64}$/.test(adoptLegacyManifestSha256)) {
    throw new Error('--adopt-legacy-manifest-sha256 requires an exact lowercase SHA-256');
  }
  target = path.resolve(target);
  assertPath(target, false);
  const schemaRoot = scope === 'project' ? target : path.resolve(dataHome);
  assertPath(schemaRoot, false);
  const activeJournalPath = path.join(target, '.asds', LEGACY_MIGRATION_JOURNAL);
  if (stat(activeJournalPath) && adoptLegacyManifestSha256 === undefined) {
    throw new Error(`active legacy migration journal requires exact adoption resume options: ${activeJournalPath}`);
  }
  if (!safePath(skillsDir)) throw new Error('Invalid --skills-dir: expected a relative directory');
  const skillRoot = path.join(target, skillsDir);
  const harnessAgents = new Set(harnessAgentEntries(scope, target, skillsDir).map(entry => entry.destination));
  const capabilityMarker = capabilityMarkerDestination(scope, target, skillsDir);
  const reviewDispatchContract = reviewDispatchContractDestination(scope, target, skillsDir);
  const reviewSupervisorContract = reviewSupervisorContractDestination(scope, target, skillsDir);
  const files = sourcePayload({ scope, target, schemaRoot, skillsDir, activate, rules });
  for (const file of files) Object.assign(file, { mode: OWNED_FILE_MODE, type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY });
  files.sort((a, b) => a.path.localeCompare(b.path));
  const plannedPayload = files.map(file => ({ ...file }));
  const desired = new Map(files.map(file => [file.path, { path: file.path, sha256: hash(file.data),
    mode: file.mode, type: file.type, nlinkPolicy: file.nlinkPolicy }]));
  const manifest = {
    format: 3, scope, target, schemaRoot, skillsDir, features: { activate, rules },
    files: files.map(file => ({ path: file.path, sha256: hash(file.data), mode: file.mode, type: file.type, nlinkPolicy: file.nlinkPolicy })),
  };
  // Keep the existing default manifest path compatible. Other native skill
  // roots get independent receipts, so selecting a second harness cannot
  // overwrite or conflict with the first harness's ownership record.
  const manifestPath = manifestRelativePath(skillsDir);
  files.push({ path: path.join(target, manifestPath), data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), mode: OWNED_FILE_MODE, type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY });
  const receipt = files.at(-1);
  const receiptPaths = new Set([receipt.path]);
  const owned = new Map();
  const legacyModes = new Map();
  let legacyAdoptionWithoutSiblings = false;
  let migrationJournalFile = null;
  let migrationJournal = null;
  if (update) {
    assertPath(receipt.path);
    if (!stat(receipt.path)) throw new Error(`update requires existing manifest: ${receipt.path}`);
    const previousBytes = fs.readFileSync(receipt.path);
    const previous = JSON.parse(previousBytes);
    const planned = new Set(files.slice(0, -1).map(file => file.path));
    let stale = [];
    if (previous.format === 1) {
      if (adoptLegacyManifestSha256 === undefined) {
        throw new Error('legacy update manifest lacks ownership metadata; pass the exact receipt SHA-256 with --adopt-legacy-manifest-sha256 to preview migration');
      }
      const journalPath = path.join(target, '.asds', LEGACY_MIGRATION_JOURNAL);
      assertPath(journalPath);
      const journalInfo = stat(journalPath);
      if (journalInfo && (!journalInfo.isFile() || journalInfo.isSymbolicLink() || journalInfo.nlink !== 1 ||
          (journalInfo.mode & 0o777) !== OWNED_FILE_MODE)) throw new Error(`legacy migration journal mismatch: ${journalPath}`);
      const siblings = siblingReceiptInventory({ scope, target, schemaRoot, receiptPath: receipt.path });
      if (scope === 'user' && siblings.length && !reconcileShared) {
        throw new Error('user legacy adoption found sibling manifests; retry with --reconcile-shared so every sibling receipt is validated and updated atomically');
      }
      const journal = journalInfo
        ? validateCompletedMigrationJournal(fs.readFileSync(journalPath), adoptLegacyManifestSha256,
          { scope, target, schemaRoot, skillsDir, features: { activate, rules }, desired, reconcileShared, receiptPath: receipt.path })
        : legacyMigrationJournal({ previous, previousBytes, receiptSha256: adoptLegacyManifestSha256,
          scope, target, schemaRoot, skillsDir, features: { activate, rules }, desired, reconcileShared, siblings });
      migrationJournal = journal;
      const journalData = Buffer.from(`${JSON.stringify(journal, null, 2)}\n`);
      const resuming = Boolean(journalInfo);
      stale = adoptLegacyInventory(previous, previousBytes, adoptLegacyManifestSha256,
        { scope, target, schemaRoot, skillsDir, planned, desired, owned, legacyModes, resuming });
      legacyModes.set(receipt.path, stat(receipt.path).mode & 0o777);
      migrationJournalFile = { path: journalPath, data: journalData, mode: OWNED_FILE_MODE,
        type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY, cleanupAfterSuccess: true };
      if (scope === 'user') {
        legacyAdoptionWithoutSiblings = siblings.length === 0;
      }
    } else {
      if (adoptLegacyManifestSha256 !== undefined) {
        if (!validManifestV3(previous) || !previousBytes.equals(receipt.data)) {
          throw new Error('completed legacy migration receipt does not match the current official manifest');
        }
        const journalPath = path.join(target, '.asds', LEGACY_MIGRATION_JOURNAL);
        assertPath(journalPath);
        const info = stat(journalPath);
        if (!info || !info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
            (info.mode & 0o777) !== OWNED_FILE_MODE) throw new Error('legacy adoption flag requires a matching resumable migration journal');
        const journalData = fs.readFileSync(journalPath);
        const journal = validateCompletedMigrationJournal(journalData, adoptLegacyManifestSha256,
          { scope, target, schemaRoot, skillsDir, features: { activate, rules }, desired, reconcileShared, receiptPath: receipt.path });
        migrationJournal = journal;
        for (const expected of desired.values()) assertOwnedCurrent(expected, 'completed legacy migration payload');
        for (const entry of journal.stale) {
          if (stat(entry.path)) throw new Error(`completed legacy migration retained stale payload: ${entry.path}`);
        }
        for (const expected of desired.values()) owned.set(expected.path, expected.sha256);
        migrationJournalFile = { path: journalPath, data: journalData, mode: OWNED_FILE_MODE,
          type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY, cleanupAfterSuccess: true };
      } else {
        if (!validManifest(previous) || previous.scope !== scope || previous.target !== target || previous.schemaRoot !== schemaRoot || previous.skillsDir !== skillsDir) throw new Error('invalid update manifest identity or schema');
        if (previous.format === 3 && (previous.features.activate !== activate || previous.features.rules !== rules)) throw new Error('update manifest feature identity mismatch');
        if (previous.format === 2 && previous.files.some(entry => entry.path === path.join(target, 'AGENTS.md') || entry.path === path.join(target, 'openspec/config.yaml'))) {
          throw new Error('legacy update manifest cannot prove optional rule or activation ownership');
        }
        for (const entry of previous.files) {
          if (owned.has(entry.path)) throw new Error('invalid or duplicate update manifest entry');
          if (planned.has(entry.path)) {
            assertOwnedCurrent(entry);
            owned.set(entry.path, entry.sha256);
          }
          else {
            const relative = within(skillRoot, entry.path) ? path.relative(skillRoot, entry.path).split(path.sep).join('/') : null;
            if (!relative || !tombstoneFor(relative, entry)) throw new Error(`stale_unverified: manifest entry does not match source-controlled tombstone registry v${STALE_TOMBSTONES.registryVersion}: ${entry.path}`);
            assertOwnedCurrent(entry, 'tombstoned owned file');
            stale.push({ path: entry.path, remove: true, previous: fs.readFileSync(entry.path), mode: entry.mode, type: entry.type, nlinkPolicy: entry.nlinkPolicy, pruneRoot: skillRoot });
            owned.set(entry.path, entry.sha256);
          }
        }
      }
    }
    for (const plannedPath of planned) {
      if (!owned.has(plannedPath) && stat(plannedPath)) {
        const expected = desired.get(plannedPath), info = stat(plannedPath);
        if (migrationJournalFile && info.isFile() && !info.isSymbolicLink() && info.nlink === 1 &&
            (info.mode & 0o777) === expected.mode && hash(fs.readFileSync(plannedPath)) === expected.sha256) {
          owned.set(plannedPath, expected.sha256);
          continue;
        }
        throw new Error(`missing primary manifest entry; update cannot reclaim unreceipted payload: ${plannedPath}`);
      }
    }
    files.splice(files.indexOf(receipt), 0, ...stale);
    if (migrationJournalFile) files.unshift(migrationJournalFile);
    if (reconcileShared) {
      const shared = new Map(plannedPayload
        .filter(file => !harnessAgents.has(file.path) && file.path !== capabilityMarker &&
          file.path !== reviewDispatchContract && file.path !== reviewSupervisorContract &&
          !file.path.startsWith(skillRoot + path.sep))
        .map(file => [file.path, { path:file.path, sha256:hash(file.data), mode:file.mode, type:file.type, nlinkPolicy:file.nlinkPolicy }]));
      const manifests = [path.join(target, '.asds/install-manifest.json')];
      const profiles = path.join(target, '.asds/install-manifests');
      if (stat(profiles)) {
        assertPath(profiles, false);
        for (const entry of fs.readdirSync(profiles, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (!entry.isFile() || !entry.name.endsWith('.json')) throw new Error(`invalid shared reconciliation manifest: ${path.join(profiles, entry.name)}`);
          manifests.push(path.join(profiles, entry.name));
        }
      }
      for (const otherPath of manifests) {
        if (otherPath === receipt.path || !stat(otherPath)) continue;
        assertPath(otherPath);
        if (stat(otherPath).nlink !== 1) throw new Error(`hardlink refused: ${otherPath}`);
        const previousBytes = fs.readFileSync(otherPath);
        const other = JSON.parse(previousBytes);
        if (other.format === 1) throw new Error(`legacy shared reconciliation manifest lacks ownership metadata: ${otherPath}`);
        if (!validManifest(other) || other.scope !== scope || other.target !== target || other.schemaRoot !== schemaRoot || !safePath(other.skillsDir)) throw new Error(`invalid shared reconciliation manifest identity or schema: ${otherPath}`);
        const expectedOtherPath = path.join(target, manifestRelativePath(other.skillsDir));
        if (expectedOtherPath !== otherPath) throw new Error(`shared reconciliation manifest profile mismatch: ${otherPath}`);
        const otherSkillRoot = path.join(target, other.skillsDir);
        const otherHarnessAgents = harnessAgentEntries(scope, target, other.skillsDir);
        const otherCapabilityMarker = capabilityMarkerDestination(scope, target, other.skillsDir);
        const otherReviewDispatchContract = reviewDispatchContractDestination(scope, target, other.skillsDir);
        const otherReviewSupervisorContract = reviewSupervisorContractDestination(scope, target, other.skillsDir);
        const otherPayload = plannedPayload.filter(file => !harnessAgents.has(file.path) && file.path !== capabilityMarker &&
          file.path !== reviewDispatchContract && file.path !== reviewSupervisorContract).map(file => {
          const expectedPath = within(skillRoot, file.path)
            ? path.join(otherSkillRoot, path.relative(skillRoot, file.path))
            : file.path;
          return { path:expectedPath, sha256:hash(file.data), mode:file.mode, type:file.type, nlinkPolicy:file.nlinkPolicy };
        });
        for (const otherAgent of otherHarnessAgents) otherPayload.push({ path: otherAgent.destination,
          sha256: hash(fs.readFileSync(otherAgent.source)),
          mode: OWNED_FILE_MODE, type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY });
        if (otherCapabilityMarker) {
          const expected = sourcePayload({ scope, target, schemaRoot, skillsDir: other.skillsDir,
            activate: other.format === 3 && other.features.activate, rules: other.format === 3 && other.features.rules })
            .find(file => file.path === otherCapabilityMarker);
          otherPayload.push({ path: expected.path, sha256: hash(expected.data), mode: OWNED_FILE_MODE,
            type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY });
        }
        if (otherReviewDispatchContract) {
          const expected = sourcePayload({ scope, target, schemaRoot, skillsDir: other.skillsDir,
            activate: other.format === 3 && other.features.activate, rules: other.format === 3 && other.features.rules })
            .find(file => file.path === otherReviewDispatchContract);
          otherPayload.push({ path: expected.path, sha256: hash(expected.data), mode: OWNED_FILE_MODE,
            type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY });
        }
        if (otherReviewSupervisorContract) {
          const expected = sourcePayload({ scope, target, schemaRoot, skillsDir: other.skillsDir,
            activate: other.format === 3 && other.features.activate, rules: other.format === 3 && other.features.rules })
            .find(file => file.path === otherReviewSupervisorContract);
          otherPayload.push({ path: expected.path, sha256: hash(expected.data), mode: OWNED_FILE_MODE,
            type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY });
        }
        const expectedProfile = new Map(otherPayload.map(entry => [entry.path, entry]));
        const seen = new Set();
        for (const entry of other.files) {
          if (seen.has(entry.path)) throw new Error(`invalid shared reconciliation manifest entry: ${otherPath}`);
          seen.add(entry.path);
          const expected = expectedProfile.get(entry.path);
          if (!expected) throw new Error(`foreign or extra shared reconciliation profile entry: ${entry.path}`);
          try {
            assertOwnedCurrent(entry, 'owned file during shared reconciliation');
          } catch (error) {
            // A crash may publish the shared payload and primary receipt before
            // its sibling receipt. The journal binds the sibling's exact old
            // receipt, so only the exact new shared bytes are resumable here.
            if (!migrationJournalFile || !shared.has(entry.path)) throw error;
            assertOwnedCurrent(expected, 'resumed shared file during legacy migration');
          }
          Object.assign(entry, expected);
        }
        for (const [expectedPath, expected] of expectedProfile) {
          if (seen.has(expectedPath)) continue;
          if (within(otherSkillRoot, expectedPath)) throw new Error(`missing profile-specific shared reconciliation manifest entry: ${expectedPath}`);
          if (!shared.has(expectedPath)) throw new Error(`missing non-shared reconciliation manifest entry: ${expectedPath}`);
          assertOwnedCurrent(expected, 'shared file missing from profile manifest');
          other.files.push({ ...expected });
        }
        other.files.sort((a, b) => a.path.localeCompare(b.path));
        const data = Buffer.from(`${JSON.stringify(other, null, 2)}\n`);
        if (!data.equals(previousBytes)) {
          receiptPaths.add(otherPath);
          files.push({ path: otherPath, data, previous: previousBytes, mode: stat(otherPath).mode & 0o777, type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY });
        }
      }
    }
  }
  for (const file of files) {
    assertPath(file.path);
    if (stat(file.path) && (stat(file.path).nlink !== 1 || !stat(file.path).isFile() ||
        (!legacyModes.has(file.path) && (stat(file.path).mode & 0o777) !== file.mode))) {
      throw new Error(`conflict: modified file ownership metadata at ${file.path}`);
    }
    if (file.remove) continue;
    const existing = stat(file.path) ? fs.readFileSync(file.path) : null;
    if (existing) file.observed = { data: existing, mode: stat(file.path).mode & 0o777, nlink: stat(file.path).nlink };
    if (existing && (!existing.equals(file.data) || (legacyModes.has(file.path) && legacyModes.get(file.path) !== file.mode))) {
      if (!update || (file !== receipt && !owned.has(file.path) && !receiptPaths.has(file.path))) throw new Error(`conflict: ${file.path}`);
      if (scope === 'user' && !reconcileShared && !legacyAdoptionWithoutSiblings &&
          file !== receipt && !file.path.startsWith(skillRoot + path.sep) &&
          !harnessAgents.has(file.path) && file.path !== capabilityMarker &&
          file.path !== reviewDispatchContract && file.path !== reviewSupervisorContract) {
        throw new Error(`shared payload update requires explicit reconciliation: ${file.path}`);
      }
      file.previous = existing;
      if (legacyModes.has(file.path)) file.previousMode = legacyModes.get(file.path);
      else file.mode = stat(file.path).mode & 0o777;
    }
  }
  if (migrationJournalFile) {
    const expectedTemporaries = new Map();
    const legacyByPath = new Map(migrationJournal.legacyModes.map(entry => [entry.path, entry]));
    for (const file of files.filter(candidate => !candidate.remove && legacyByPath.has(candidate.path))) {
      file.temporaryIdentity = hash(Buffer.from(`${adoptLegacyManifestSha256}\0${file.path}`));
      expectedTemporaries.set(updateTemporaryPath(file), file);
    }
    const directories = new Set([...expectedTemporaries.keys()].map(file => path.dirname(file)));
    const cleanup = [];
    for (const directory of directories) {
      if (!stat(directory)) continue;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.name.startsWith('.asds-update-')) continue;
        const temporary = path.join(directory, entry.name), owner = expectedTemporaries.get(temporary);
        if (!owner || !entry.isFile()) throw new Error(`unknown legacy migration temporary refused: ${temporary}`);
        assertPath(temporary);
        const info = stat(temporary);
        const data = fs.readFileSync(temporary), mode = info.mode & 0o777;
        const forward = mode === owner.mode && data.equals(owner.data);
        const legacy = legacyByPath.get(owner.path);
        const reverse = mode === legacy.mode && hash(data) === legacy.sha256;
        if (info.isSymbolicLink() || info.nlink !== 1 || (!forward && !reverse)) {
          throw new Error(`legacy migration temporary drift: ${temporary}`);
        }
        cleanup.push({ path: temporary, remove: true, previous: data, mode,
          type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY, pruneRoot: directory, migrationTemporary: true });
      }
    }
    files.unshift(...cleanup.sort((a, b) => a.path.localeCompare(b.path)));
  }
  Object.defineProperty(files, 'installOptions', { value: {
    scope, target, schemaRoot, skillsDir, activate, rules, update, reconcileShared,
    adoptLegacyManifestSha256: adoptLegacyManifestSha256 ?? null,
  }, enumerable: false });
  return files;
}

function installedManifestPaths(target) {
  const manifests = [path.join(target, '.asds/install-manifest.json')];
  const profiles = path.join(target, '.asds/install-manifests');
  if (stat(profiles)) {
    assertPath(profiles, false);
    for (const entry of fs.readdirSync(profiles, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        throw new Error(`invalid installation manifest entry: ${path.join(profiles, entry.name)}`);
      }
      manifests.push(path.join(profiles, entry.name));
    }
  }
  return manifests.filter(file => stat(file));
}

function uninstallPruneRoot({ target, schemaRoot, skillsDir }, file) {
  const roots = [
    path.join(target, skillsDir),
    path.join(target, '.agents/agents'),
    path.join(target, '.gemini/config/agents'),
    path.join(target, '.opencode/agents'),
    path.join(target, '.config/opencode/agents'),
    path.join(target, '.codex/agents'),
    path.join(target, '.claude/agents'),
    path.join(schemaRoot, 'openspec/schemas/superpowers-bridge'),
    path.join(target, '.asds'),
  ].filter(candidate => file === candidate || within(candidate, file));
  return roots.sort((a, b) => b.length - a.length)[0] ?? path.dirname(file);
}

export function planUninstall({ scope, target, dataHome, skillsDir = '.agents/skills' }) {
  if (!['project', 'user'].includes(scope) || !target) throw new Error('Explicit --scope project|user and --target required');
  if (scope === 'user' && !dataHome) throw new Error('User scope requires explicit --data-home (OpenSpec uses XDG_DATA_HOME)');
  if (scope === 'project' && dataHome) throw new Error('--data-home is only valid for user scope');
  if (!safePath(skillsDir)) throw new Error('Invalid --skills-dir: expected a relative directory');
  target = path.resolve(target);
  assertPath(target, false);
  const activeJournalPath = path.join(target, '.asds', LEGACY_MIGRATION_JOURNAL);
  if (stat(activeJournalPath)) {
    throw new Error(`active legacy migration journal requires exact adoption resume before uninstall: ${activeJournalPath}`);
  }
  const schemaRoot = scope === 'project' ? target : path.resolve(dataHome);
  assertPath(schemaRoot, false);
  const receiptPath = path.join(target, manifestRelativePath(skillsDir));
  assertPath(receiptPath);
  if (!stat(receiptPath)) throw new Error(`uninstall requires existing manifest: ${receiptPath}`);
  if (stat(receiptPath).nlink !== 1) throw new Error(`hardlink refused: ${receiptPath}`);
  const receiptBytes = fs.readFileSync(receiptPath);
  const manifest = JSON.parse(receiptBytes);
  if (!validManifest(manifest) || manifest.scope !== scope || manifest.target !== target ||
      manifest.schemaRoot !== schemaRoot || manifest.skillsDir !== skillsDir) {
    throw new Error('invalid uninstall manifest identity or schema');
  }
  validateManifestInventory(manifest, { scope, target, schemaRoot, skillsDir }, 'uninstall manifest');

  const retained = new Set();
  for (const otherPath of installedManifestPaths(target)) {
    if (otherPath === receiptPath) continue;
    assertPath(otherPath);
    if (stat(otherPath).nlink !== 1) throw new Error(`hardlink refused: ${otherPath}`);
    const other = JSON.parse(fs.readFileSync(otherPath));
    if (!validManifest(other) || other.scope !== scope || other.target !== target || other.schemaRoot !== schemaRoot ||
        !safePath(other.skillsDir) || path.join(target, manifestRelativePath(other.skillsDir)) !== otherPath) {
      throw new Error(`invalid sibling installation manifest identity or schema: ${otherPath}`);
    }
    validateManifestInventory(other, { scope, target, schemaRoot, skillsDir: other.skillsDir }, 'sibling installation manifest');
    for (const entry of other.files) retained.add(entry.path);
  }

  const files = [];
  const seen = new Set();
  for (const entry of manifest.files) {
    if (seen.has(entry.path)) throw new Error('invalid or duplicate uninstall manifest entry');
    seen.add(entry.path);
    assertOwnedCurrent(entry, 'owned file during uninstall');
    if (!retained.has(entry.path)) {
      files.push({ path: entry.path, remove: true, previous: fs.readFileSync(entry.path), mode: entry.mode,
        type: entry.type, nlinkPolicy: entry.nlinkPolicy,
        pruneRoot: uninstallPruneRoot({ target, schemaRoot, skillsDir }, entry.path) });
    }
  }
  files.sort((a, b) => b.path.localeCompare(a.path));
  files.push({ path: receiptPath, remove: true, previous: receiptBytes,
    mode: stat(receiptPath).mode & 0o777, type: OWNED_FILE_TYPE, nlinkPolicy: OWNED_NLINK_POLICY,
    pruneRoot: path.join(target, '.asds') });
  return files;
}

function updateTemporaryPath(file) {
  const identity = file.temporaryIdentity ??
    hash(Buffer.concat([Buffer.from(file.path), Buffer.from('\0'), file.previous, Buffer.from('\0'), file.data]));
  return path.join(path.dirname(file.path), `.asds-update-${identity}`);
}

function replaceFile(file, data, beforeWrite) {
  const temporary = updateTemporaryPath(file);
  try {
    fs.writeFileSync(temporary, data, { flag: 'wx', mode: file.mode });
    fs.chmodSync(temporary, file.mode);
    beforeWrite(temporary);
    fs.renameSync(temporary, file.path);
  } finally { if (stat(temporary)) fs.unlinkSync(temporary); }
}

// Ordinary failures restore replaced bytes from memory and remove newly created
// files/directories. No disk backup, crash recovery, or hostile-race guarantee.
export function applyInstall(files, { beforeWrite = () => {}, beforeRollbackWrite = () => {} } = {}) {
  const createdFiles = [], createdDirs = [], replacedFiles = [], removedFiles = [], removedDirs = [];
  function mkdir(directory) {
    assertPath(directory, false);
    if (stat(directory)) return;
    mkdir(path.dirname(directory));
    fs.mkdirSync(directory);
    createdDirs.push(directory);
  }
  try {
    // Validate every observed target, including idempotent files, before the
    // first mutation so preview-to-apply chmod/link/content drift fails closed.
    for (const file of files.filter(file => file.observed)) {
      assertPath(file.path);
      if (stat(file.path)?.nlink !== file.observed.nlink || (stat(file.path).mode & 0o777) !== file.observed.mode || !fs.readFileSync(file.path).equals(file.observed.data)) throw new Error(`changed since update preview: ${file.path}`);
    }
    for (const file of files.filter(file => file.remove)) {
      assertPath(file.path);
      if (stat(file.path)?.nlink !== 1 || (stat(file.path).mode & 0o777) !== file.mode || !fs.readFileSync(file.path).equals(file.previous)) throw new Error(`changed since update preview: ${file.path}`);
    }
    for (const file of files) {
      assertPath(file.path);
      if (file.remove) {
        beforeWrite(file.path);
        assertPath(file.path);
        if (stat(file.path)?.nlink !== 1 || (stat(file.path).mode & 0o777) !== file.mode || !fs.readFileSync(file.path).equals(file.previous)) throw new Error(`changed since update preview: ${file.path}`);
        fs.unlinkSync(file.path);
        removedFiles.push(file);
        for (let directory = path.dirname(file.path); directory !== file.pruneRoot && within(file.pruneRoot, directory); directory = path.dirname(directory)) {
          try { const mode = stat(directory).mode & 0o777; fs.rmdirSync(directory); removedDirs.push({ path: directory, mode }); }
          catch (failure) { if (!['ENOTEMPTY', 'EEXIST'].includes(failure.code)) throw failure; break; }
        }
        continue;
      }
      if (file.previous) {
        beforeWrite(file.path);
        assertPath(file.path);
        if (stat(file.path)?.nlink !== 1 || (stat(file.path).mode & 0o777) !== (file.previousMode ?? file.mode) || !fs.readFileSync(file.path).equals(file.previous)) throw new Error(`changed since update preview: ${file.path}`);
        replaceFile(file, file.data, beforeWrite);
        replacedFiles.push(file);
        continue;
      }
      if (stat(file.path)) {
        if (!fs.readFileSync(file.path).equals(file.data)) throw new Error(`conflict: ${file.path}`);
        continue;
      }
      mkdir(path.dirname(file.path));
      beforeWrite(file.path);
      assertPath(file.path);
      const fd = fs.openSync(file.path, 'wx', file.mode);
      createdFiles.push(file.path);
      try { fs.writeFileSync(fd, file.data); }
      finally { fs.closeSync(fd); }
      fs.chmodSync(file.path, file.mode);
    }
    for (const file of files) {
      if (file.remove) {
        if (stat(file.path)) throw new Error(`uninstall readback found retained file: ${file.path}`);
        continue;
      }
      const info = stat(file.path);
      if (!info || !info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
          (info.mode & 0o777) !== file.mode || !fs.readFileSync(file.path).equals(file.data)) {
        throw new Error(`install readback mismatch: ${file.path}`);
      }
    }
    for (const file of files.filter(file => file.cleanupAfterSuccess)) {
      beforeWrite(file.path);
      assertPath(file.path);
      if (stat(file.path)?.nlink !== 1 || (stat(file.path).mode & 0o777) !== file.mode ||
          !fs.readFileSync(file.path).equals(file.data)) throw new Error(`changed before migration journal cleanup: ${file.path}`);
      fs.unlinkSync(file.path);
      const createdIndex = createdFiles.indexOf(file.path);
      if (createdIndex !== -1) createdFiles.splice(createdIndex, 1);
      if (stat(file.path)) throw new Error(`migration journal cleanup retained file: ${file.path}`);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const directory of [...removedDirs].reverse()) {
      try { if (!stat(directory.path)) fs.mkdirSync(directory.path, { mode: directory.mode }); fs.chmodSync(directory.path, directory.mode); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const file of removedFiles.reverse()) {
      try {
        assertPath(file.path);
        const fd = fs.openSync(file.path, 'wx', file.mode);
        try { fs.writeFileSync(fd, file.previous); } finally { fs.closeSync(fd); }
        fs.chmodSync(file.path, file.mode);
      } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const file of replacedFiles.reverse()) {
      try {
        assertPath(file.path);
        if (stat(file.path)?.nlink !== 1 || (stat(file.path).mode & 0o777) !== file.mode ||
            !fs.readFileSync(file.path).equals(file.data)) throw new Error(`concurrent change retained: ${file.path}`);
        replaceFile({ ...file, mode: file.previousMode ?? file.mode, previous: file.data, data: file.previous }, file.previous, beforeRollbackWrite);
      } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const file of createdFiles.reverse()) {
      try { fs.unlinkSync(file); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const directory of createdDirs.reverse()) {
      try { fs.rmdirSync(directory); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    throw new Error(`${error.message}${rollbackErrors.length ? `; rollback incomplete: ${rollbackErrors.join('; ')}` : '; newly created files rolled back'}`);
  }
}
