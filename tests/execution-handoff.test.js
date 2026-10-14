import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { projectTaskManager } from '../lib/planning-graph.mjs';
import { planningCandidateSha256, planningReadbackSha256 } from '../lib/planning-lifecycle.mjs';
import { projectRuntimeProjection } from '../lib/plan-projection.mjs';
import { validateExecutionProjections } from '../lib/validation.mjs';
import { ExecutionHandoffError, createExecutionHandoff, inspectExecutionPackage, validateExecutionHandoff } from '../lib/execution-handoff.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const now = '2026-10-09T12:00:00.000Z';
const task = (id, dependsOn = []) => ({
  id, title: `Task ${id}`, nodeType: 'task', parentId: 'P01', dependsOn,
  dependencyDetails: dependsOn.map(dependency => ({ id: dependency, reason: 'required', requiredOutput: 'accepted output' })),
  requirements: [`R-${id}`], owner: `owner-${id}`, write: [`src/${id}.js`], resources: [], scenarios: [], verification: [`node --test ${id}`],
});

function makePackage(options = {}) {
  const { partial = false, blockers } = options;
  const usableTasks = Object.hasOwn(options, 'usableTasks') ? options.usableTasks : partial ? ['0001'] : ['0001', '0002', '0003'];
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'asds-handoff-')));
  mkdirSync(join(root, 'tasks'));
  mkdirSync(join(root, '.git'));
  const tasks = [
    task('0001'), task('0002'), task('0003', ['0002']),
    { id: 'P01', title: 'Package', nodeType: 'package', parentId: null, dependsOn: [], dependencyDetails: [], requirements: ['R-0001', 'R-0002', 'R-0003'], owner: null, verification: [] },
  ];
  if (options.waveGap) {
    tasks[0].write = ['src/shared.js']; tasks[1].write = ['src/shared.js'];
    tasks[2].dependsOn = []; tasks[2].dependencyDetails = [];
  }
  const selectedBlockers = blockers ?? (partial ? [{ id: 'B01', owner: 'owner', question: 'resolve?', consequence: '0002 and dependent 0003 excluded', resolution: 'new planning revision', affectedTasks: ['0002', '0003'] }] : []);
  const manager = projectTaskManager(tasks, { blockers: selectedBlockers });
  const waves = manager.plannedWaves.map((wave, index) => `- Onda ${index + 1}: ${wave.join(', ')}`).join('\n');
  const index = `# Tasks\n- [ ] [Task P01](tasks/task-P01.md): Package\n  - [ ] [Task 0001](tasks/task-0001.md): Task 0001\n  - [ ] [Task 0002](tasks/task-0002.md): Task 0002\n  - [ ] [Task 0003](tasks/task-0003.md): Task 0003\n\n${waves}\n`;
  writeFileSync(join(root, 'tasks.md'), index);
  const contracts = new Map(tasks.map(item => [item.id, `---\n${JSON.stringify(item)}\n---\n# Task ${item.id}: ${item.title}\n\n## Scope and dependencies\nBounded scope for ${item.id}.\n`]));
  for (const item of tasks) writeFileSync(join(root, 'tasks', `task-${item.id}.md`), contracts.get(item.id));
  const review = '# Reviews\nCurrent external review evidence.\n';
  writeFileSync(join(root, 'reviews.md'), review);
  const references = [
    { id: 'tasks.md', path: 'tasks.md', role: 'index', sha256: sha(index) },
    ...tasks.map(item => ({ id: `task-${item.id}`, path: `tasks/task-${item.id}.md`, role: 'contract', sha256: sha(contracts.get(item.id)) })),
    { id: 'reviews.md', path: 'reviews.md', role: 'review', sha256: sha(review) },
  ];
  const manifest = {
    schemaVersion: 'asds.planning-delivery/1', returnVersion: 'asds.planning-return/1',
    packageId: partial ? 'partial-package' : 'full-package', revision: partial ? 'partial-r1' : 'full-r1',
    state: partial ? 'partial' : 'delivered', attendanceOutcome: partial ? 'planning_partial' : 'planning_delivered',
    originalRequestedProduct: { kind: 'implementation', text: 'Implement the package', source: 'request#1', status: 'not_fulfilled' },
    planningContribution: { product: 'reviewed-planning-package', executionPerformed: false, usableTasks, limitations: partial ? ['B01 remains unresolved'] : [] },
    synthetic: false, author: 'planner',
    authority: { preservedRefusals: ['no installation'], authorization: 'planning delivery authorized', destination: root },
    references, tasks, blockers: selectedBlockers, decisions: [],
    taskManager: manager,
    remainingWork: Object.hasOwn(options, 'remainingWork') ? options.remainingWork : partial ? [{ taskIds: ['0002', '0003'], reason: 'Resolve B01', owner: 'owner' }] : [],
    layers: Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`C${String(index + 1).padStart(2, '0')}`, { status: 'satisfied', reason: 'Current reviewed planning evidence', references: ['tasks.md'] }])),
    reviewPolicy: { risk: 'ordinary-low', independentRequired: false, mode: 'self-review', domains: ['general'] },
  };
  const candidateSha256 = planningCandidateSha256(manifest);
  manifest.reviews = ['fidelity', 'quality'].map(kind => ({ kind, revision: manifest.revision, candidateSha256, mode: 'self-review', reviewer: 'planner', synthetic: false, liveEvidence: `external-${kind}-review`, verdict: 'pass', reference: 'reviews.md', scopeTaskIds: usableTasks, findings: [] }));
  manifest.readback = { status: 'matched', revision: manifest.revision, candidateSha256: planningCandidateSha256(manifest), readbackSha256: planningReadbackSha256(manifest), destination: root, synthetic: false, executionEvidence: false, evidence: 'external-store-readback', verifiedBy: 'store-adapter', referenceIds: references.map(reference => reference.id), taskIds: usableTasks, checks: { bytes: true, files: true, ids: true, relations: true, decisions: true, reviews: true } };
  writeFileSync(join(root, 'planning-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, manifest };
}

function input(root, overrides = {}) {
  const projectRoot = realpathSync(root);
  const inspected = inspectExecutionPackage(root);
  const binding = { requestId: 'request-1', packageId: inspected.packageId, planningRevision: inspected.planningRevision, planningFingerprint: inspected.planningFingerprint, consumableTaskIds: inspected.executionScope.consumableTaskIds };
  return {
    packageRoot: root,
    requestContext: { requestId: 'request-1', objective: 'Implement the package', source: 'request#1', binding: structuredClone(binding), project: { root: projectRoot, readScope: ['.'], constraints: ['no installation'], refusals: ['no release'], authorizations: ['implement package'] } },
    author: { actor: 'caller-1', adapter: 'codex', source: 'session', observedAt: now },
    selection: { consumer: 'asds-execution-consumer', selected: true, source: 'user:turn-1', observedAt: now, binding: structuredClone(binding) },
    grants: [
      { kind: 'execution', granted: true, source: 'user:turn-1', scope: { projectRoot: projectRoot, binding: structuredClone(binding) }, validFrom: '2026-10-09T11:00:00.000Z', validUntil: '2026-10-09T13:00:00.000Z' },
      { kind: 'evidence-persistence', granted: true, source: 'user:turn-1', scope: { journal: '.asds/run-1/journal.jsonl', evidence: '.asds/run-1/evidence' }, validFrom: '2026-10-09T11:00:00.000Z', validUntil: '2026-10-09T13:00:00.000Z' },
    ],
    destination: { journal: '.asds/run-1/journal.jsonl', evidence: '.asds/run-1/evidence', source: 'user:turn-1' },
    workspace: { projectRoot, workspaceId: 'workspace-1', repoIdentity: { vcs: 'git', rootRealpath: projectRoot, commonDirRealpath: join(projectRoot, '.git'), baseRevision: 'a'.repeat(40) }, baseline: { version: 1, baseRevision: 'a'.repeat(40), workspaceRevision: `a${'a'.repeat(39)}+worktree:${'b'.repeat(64)}`, committedSinceBase: [], staged: [], unstaged: [{ path: 'preexisting.txt', sha256: 'c'.repeat(64) }], untracked: [] }, observedAt: now, source: 'workspace-observer' },
    coordinatorBoundary: { enforced: true, projectReadOnly: true, brokers: ['journal', 'evidence', 'progress'], source: 'host-adapter', observedAt: now },
    now,
    ...overrides,
  };
}

test('creates a valid full handoff from package bytes and caller-owned authority', () => {
  const { root } = makePackage();
  const before = readFileSync(join(root, 'planning-manifest.json'));
  const envelope = createExecutionHandoff(input(root));
  assert.equal(envelope.schemaVersion, 'asds.execution-handoff/1');
  assert.equal(envelope.packageId, 'full-package');
  assert.equal(envelope.planningRevision, 'full-r1');
  assert.equal(envelope.packageRootRealpath, realpathSync(root));
  assert.equal(envelope.canonicalIndex.path, 'tasks.md');
  assert.deepEqual(envelope.executionScope.consumableTaskIds, ['0001', '0002', '0003']);
  assert.deepEqual(envelope.executionScope.excludedTaskIds, []);
  assert.equal(envelope.authorization.executionAuthorized, true);
  assert.match(envelope.authorization.authorityBindingSha256, /^[a-f0-9]{64}$/);
  assert.equal(envelope.authorization.evidencePersistenceAuthorized, true);
  assert.equal(validateExecutionHandoff(envelope, { packageRoot: root, workspace: input(root).workspace, now }).valid, true);
  assert.deepEqual(readFileSync(join(root, 'planning-manifest.json')), before);
  assert.equal('capabilities' in envelope, false);
});

test('normalizes a v1 partial package without changing excluded IDs or remaining work', () => {
  const { root } = makePackage({ partial: true });
  const envelope = createExecutionHandoff(input(root));
  assert.deepEqual(envelope.partialScope.consumableTaskIds, ['0001']);
  assert.deepEqual(envelope.partialScope.excludedTaskIds, ['0002', '0003']);
  assert.deepEqual(envelope.partialScope.remainingWork, [{ taskIds: ['0002', '0003'], reason: 'Resolve B01', owner: 'owner' }]);
  assert.deepEqual(envelope.taskManager.tasks.map(item => [item.id, item.status]), [['0001', 'ready'], ['0002', 'excluded'], ['0003', 'excluded']]);
});

test('partial creation rejects missing, duplicate, incomplete and dependency-invalid usable scope', () => {
  for (const usableTasks of [undefined, ['0001', '0001'], ['0001', 'missing'], ['0002']]) {
    const { root } = makePackage({ partial: true, usableTasks });
    assert.throws(() => createExecutionHandoff(input(root)), ExecutionHandoffError);
  }
  const { root } = makePackage({ partial: true, usableTasks: ['0001'], remainingWork: [], blockers: [{ id: 'B01', owner: 'o', question: 'q', consequence: 'c', resolution: 'r', affectedTasks: ['0002'] }] });
  assert.throws(() => createExecutionHandoff(input(root)), /excluded task 0003 lacks planning provenance/);
  const overlap = makePackage({ partial: true, usableTasks: ['0001'], blockers: [{ id: 'B01', owner: 'o', question: 'q', consequence: 'c', resolution: 'r', affectedTasks: ['0001', '0002', '0003'] }] });
  assert.throws(() => createExecutionHandoff(input(overlap.root)), /canonical planning delivery gate|overlaps an excluded planning blocker/);
});

test('caller cannot provide derived fields or capabilities', () => {
  const { root } = makePackage();
  for (const override of [{ packageId: 'forged' }, { planningRevision: 'forged' }, { taskManager: {} }, { planningFingerprint: 'd'.repeat(64) }, { workspaceBaselineFingerprint: 'e'.repeat(64) }, { capabilities: { spawn: true } }, { spawn: true }]) {
    assert.throws(() => createExecutionHandoff(input(root, override)), /caller cannot provide derived field|capabilities|unknown execution handoff input field/);
  }
});

test('legacy authorities without package binding fail explicitly instead of receiving retroactive authority', () => {
  const { root } = makePackage(), value = input(root);
  delete value.requestContext.binding;
  delete value.selection.binding;
  delete value.grants[0].scope.binding;
  assert.throws(() => createExecutionHandoff(value), error => {
    assert.equal(error.code, 'ASDS_EXECUTION_HANDOFF_UNBOUND');
    assert.match(error.message, /legacy or unbound authorities cannot authorize execution/);
    return true;
  });
});

test('request context, selection and execution grant must bind the same request, package revision, fingerprint and consumable set', () => {
  const { root } = makePackage();
  const mutations = [
    binding => { binding.requestId = 'another-request'; },
    binding => { binding.packageId = 'another-package'; },
    binding => { binding.planningRevision = 'another-revision'; },
    binding => { binding.planningFingerprint = 'f'.repeat(64); },
    binding => { binding.consumableTaskIds = ['0001']; },
  ];
  for (const authority of ['requestContext', 'selection', 'executionGrant']) {
    for (const mutate of mutations) {
      const value = input(root);
      const binding = authority === 'requestContext' ? value.requestContext.binding
        : authority === 'selection' ? value.selection.binding : value.grants[0].scope.binding;
      mutate(binding);
      assert.throws(() => createExecutionHandoff(value), /does not bind the current request and planning package/);
    }
  }
});

test('current objective must match the persisted original implementation intake', () => {
  const { root } = makePackage(), value = input(root);
  value.requestContext.objective = 'Implement a different package';
  assert.throws(() => createExecutionHandoff(value), /differs from persisted original implementation intake/);
});

test('missing or stale caller-owned author, selection, grants, destination and boundary fail closed', () => {
  const { root } = makePackage();
  const base = input(root);
  for (const mutate of [
    value => { delete value.author; }, value => { value.selection.selected = false; },
    value => { value.grants = value.grants.filter(grant => grant.kind !== 'execution'); },
    value => { value.grants.push(structuredClone(value.grants[0])); },
    value => { value.grants[0].validUntil = '2026-10-09T11:30:00.000Z'; },
    value => { delete value.destination.evidence; }, value => { delete value.coordinatorBoundary; },
    value => { value.workspace.observedAt = '2026-10-09T10:00:00.000Z'; },
  ]) { const value = structuredClone(base); mutate(value); assert.throws(() => createExecutionHandoff(value), ExecutionHandoffError); }
});

test('validator detects package, realpath, repository, workspace and baseline drift', () => {
  const { root } = makePackage();
  const value = input(root), envelope = createExecutionHandoff(value);
  for (const mutate of [
    workspace => { workspace.workspaceId = 'other'; }, workspace => { workspace.repoIdentity.baseRevision = 'f'.repeat(40); },
    workspace => { workspace.baseline.untracked.push({ path: 'drift.txt', sha256: 'd'.repeat(64) }); }, workspace => { workspace.projectRoot = tmpdir(); },
  ]) { const workspace = structuredClone(value.workspace); mutate(workspace); assert.equal(validateExecutionHandoff(envelope, { packageRoot: root, workspace, now }).valid, false); }
  writeFileSync(join(root, 'tasks.md'), '# drift\n');
  assert.equal(validateExecutionHandoff(envelope, { packageRoot: root, workspace: value.workspace, now }).valid, false);
});

test('creator rejects stale readback and delivery attendance before an envelope exists', () => {
  for (const mutate of [
    manifest => { manifest.readback.revision = 'old'; },
    manifest => { manifest.readback.checks.bytes = false; },
    manifest => { manifest.attendanceOutcome = 'planning_partial'; },
  ]) {
    const { root, manifest } = makePackage(); mutate(manifest);
    writeFileSync(join(root, 'planning-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(() => createExecutionHandoff(input(root)), ExecutionHandoffError);
  }
});

test('creator reuses canonical delivery gates for synthetic, reviews, layers and task inventory', () => {
  for (const mutate of [
    manifest => { manifest.synthetic = true; },
    manifest => { manifest.reviews[0].liveEvidence = null; },
    manifest => { delete manifest.layers.C12; },
    manifest => { manifest.tasks[0].title = 'Different title'; },
  ]) {
    const { root, manifest } = makePackage(); mutate(manifest);
    writeFileSync(join(root, 'planning-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(() => createExecutionHandoff(input(root)), /canonical planning delivery gate/);
  }
});

test('grants must bind the current project realpath and exact evidence destination', () => {
  const { root } = makePackage();
  for (const mutate of [
    value => { value.grants[0].scope.projectRoot = tmpdir(); },
    value => { value.grants[1].scope.journal = 'another/journal.jsonl'; },
    value => { value.grants[1].scope.evidence = 'another/evidence'; },
  ]) { const value = input(root); mutate(value); assert.throws(() => createExecutionHandoff(value), /grant scope/); }
});

test('validator requires current workspace and rejects unknown or malformed stored envelope fields', () => {
  const { root } = makePackage(), value = input(root), envelope = createExecutionHandoff(value);
  assert.equal(validateExecutionHandoff(envelope, { packageRoot: root, now }).valid, false);
  assert.equal(validateExecutionHandoff({ ...envelope, futureExecutionSwitch: true }, { packageRoot: root, workspace: value.workspace, now }).valid, false);
  assert.equal(validateExecutionHandoff({ ...envelope, planningFingerprint: 'not-a-hash' }, { packageRoot: root, workspace: value.workspace, now }).valid, false);
  assert.equal(validateExecutionHandoff({ ...envelope, authorization: { ...envelope.authorization, evidenceDestinationSha256: '0'.repeat(64) } }, { packageRoot: root, workspace: value.workspace, now }).valid, false);
});

test('validator reports legacy persisted envelopes without authority binding as non-operational', () => {
  const { root } = makePackage(), value = input(root), envelope = createExecutionHandoff(value);
  const legacy = structuredClone(envelope);
  delete legacy.requestContext.binding;
  delete legacy.selection.binding;
  delete legacy.grants[0].scope.binding;
  delete legacy.authorization.authorityBindingSha256;
  const validation = validateExecutionHandoff(legacy, { packageRoot: root, workspace: value.workspace, now });
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('; '), /legacy or unbound authorities cannot authorize execution/);
});

test('caller-owned nested schemas reject unknown fields and hidden capabilities', () => {
  const { root } = makePackage();
  for (const mutate of [
    value => { value.requestContext.capabilities = { spawn: true }; },
    value => { value.requestContext.project.spawn = true; },
    value => { value.author.capabilities = ['shell']; },
    value => { value.selection.model = 'hidden'; },
    value => { value.selection.binding.extra = true; },
    value => { value.destination.overwrite = true; },
    value => { value.coordinatorBoundary.spawn = true; },
    value => { value.grants[0].capabilities = { write: true }; },
    value => { value.workspace.repoIdentity.capabilities = { spawn: true }; },
  ]) {
    const value = input(root); mutate(value);
    assert.throws(() => createExecutionHandoff(value), /unknown fields/);
  }
});

test('validator rejects nested persisted capabilities, authorization extras and project-root tamper', () => {
  const { root } = makePackage(), value = input(root), envelope = createExecutionHandoff(value);
  const cases = [
    { ...envelope, coordinatorBoundary: { ...envelope.coordinatorBoundary, spawn: true } },
    { ...envelope, grants: envelope.grants.map((grant, index) => index ? grant : { ...grant, model: 'hidden' }) },
    { ...envelope, authorization: { ...envelope.authorization, capabilities: ['spawn'] } },
    { ...envelope, selection: { ...envelope.selection, binding: { ...envelope.selection.binding, planningRevision: 'stale' } } },
    { ...envelope, requestContext: { ...envelope.requestContext, project: { ...envelope.requestContext.project, root: tmpdir() } } },
  ];
  for (const candidate of cases) assert.equal(validateExecutionHandoff(candidate, { packageRoot: root, workspace: value.workspace, now }).valid, false);
});

test('validator cannot let current packageRoot hide a tampered persisted packageRoot', () => {
  const { root } = makePackage(), other = makePackage().root, value = input(root), envelope = createExecutionHandoff(value);
  assert.equal(validateExecutionHandoff({ ...envelope, packageRoot: other }, { packageRoot: root, workspace: value.workspace, now }).valid, false);
  assert.equal(validateExecutionHandoff(envelope, { workspace: value.workspace, now }).valid, false);
});

test('partial handoff canonically compacts an excluded first wave for EC-02 runtime validation', () => {
  const blockers = [{ id: 'B-wave-1', owner: 'owner', question: 'resolve?', consequence: 'first wave excluded', resolution: 'new planning revision', affectedTasks: ['0001', '0003'] }];
  const remainingWork = [{ taskIds: ['0001', '0003'], reason: 'Resolve first-wave planning blocker', owner: 'owner' }];
  const { root, manifest } = makePackage({ partial: true, waveGap: true, usableTasks: ['0002'], blockers, remainingWork });
  assert.deepEqual(manifest.taskManager.plannedWaves, [['0001', '0003'], ['0002']]);
  const envelope = createExecutionHandoff(input(root));
  assert.deepEqual(envelope.taskManager.plannedWaves, [['0002']]);
  assert.equal(envelope.taskManager.tasks.find(item => item.id === '0002').wave, 1);
  const journal = { version: 3, events: [] };
  const runtimeProjection = projectRuntimeProjection(envelope.taskManager, journal, envelope.executionScope);
  assert.deepEqual(validateExecutionProjections({ tasks: manifest.tasks, blockers: manifest.blockers, planningProjection: envelope.taskManager, runtimeProjection, journal, executionScope: envelope.executionScope }), []);
});
