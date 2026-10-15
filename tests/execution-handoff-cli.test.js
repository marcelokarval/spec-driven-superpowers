import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectTaskManager } from '../lib/planning-graph.mjs';
import { planningCandidateSha256, planningReadbackSha256 } from '../lib/planning-lifecycle.mjs';
import { inspectExecutionPackage } from '../lib/execution-handoff.mjs';

const cli = fileURLToPath(new URL('../scripts/create-execution-handoff.mjs', import.meta.url));
const now = '2026-10-09T12:00:00.000Z';
const sha = value => createHash('sha256').update(value).digest('hex');

function validInput(directory) {
  const packageRoot = join(directory, 'package');
  mkdirSync(join(packageRoot, 'tasks'), { recursive: true }); mkdirSync(join(packageRoot, '.git'));
  const task = { id: '0001', title: 'Leaf', nodeType: 'task', dependsOn: [], dependencyDetails: [], requirements: ['R1'], owner: 'owner', write: ['src/a.js'], resources: [], scenarios: [], verification: ['node --test'] };
  const index = '# Tasks\n- [ ] [Task 0001](tasks/task-0001.md): Leaf\n- Onda 1: 0001\n';
  const contract = `---\n${JSON.stringify(task)}\n---\n# Task 0001: Leaf\n\n## Scope and dependencies\nBounded leaf scope.\n`, review = '# Reviews\nCurrent evidence.\n';
  writeFileSync(join(packageRoot, 'tasks.md'), index); writeFileSync(join(packageRoot, 'tasks/task-0001.md'), contract); writeFileSync(join(packageRoot, 'reviews.md'), review);
  const references = [{ id: 'tasks.md', path: 'tasks.md', role: 'index', sha256: sha(index) }, { id: 'task-0001', path: 'tasks/task-0001.md', role: 'contract', sha256: sha(contract) }, { id: 'reviews.md', path: 'reviews.md', role: 'review', sha256: sha(review) }];
  const manifest = { schemaVersion: 'asds.planning-delivery/1', returnVersion: 'asds.planning-return/1', packageId: 'cli-package', revision: 'r1', state: 'delivered', attendanceOutcome: 'planning_delivered', synthetic: false, author: 'planner', originalRequestedProduct: { kind: 'implementation', text: 'Implement', source: 'user', status: 'not_fulfilled' }, planningContribution: { product: 'reviewed-planning-package', executionPerformed: false, usableTasks: ['0001'], limitations: [] }, authority: { preservedRefusals: [], authorization: 'planning delivery', destination: packageRoot }, references, tasks: [task], blockers: [], decisions: [], taskManager: projectTaskManager([task]), layers: Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`C${String(index + 1).padStart(2, '0')}`, { status: 'satisfied', reason: 'Current reviewed planning evidence', references: ['tasks.md'] }])), reviewPolicy: { risk: 'ordinary-low', independentRequired: false, mode: 'self-review', domains: ['general'] } };
  const candidateSha256 = planningCandidateSha256(manifest);
  manifest.reviews = ['fidelity', 'quality'].map(kind => ({ kind, revision: 'r1', candidateSha256, mode: 'self-review', reviewer: 'planner', synthetic: false, liveEvidence: `external-${kind}`, verdict: 'pass', reference: 'reviews.md', scopeTaskIds: ['0001'], findings: [] }));
  manifest.readback = { status: 'matched', revision: 'r1', candidateSha256: planningCandidateSha256(manifest), readbackSha256: planningReadbackSha256(manifest), destination: packageRoot, synthetic: false, executionEvidence: false, evidence: 'external-readback', verifiedBy: 'store-adapter', referenceIds: references.map(reference => reference.id), taskIds: ['0001'], checks: { bytes: true, files: true, ids: true, relations: true, decisions: true, reviews: true } };
  writeFileSync(join(packageRoot, 'planning-manifest.json'), `${JSON.stringify(manifest)}\n`);
  const projectRoot = realpathSync(packageRoot);
  const inspected = inspectExecutionPackage(packageRoot);
  const binding = { requestId: 'r', packageId: inspected.packageId, planningRevision: inspected.planningRevision, planningFingerprint: inspected.planningFingerprint, consumableTaskIds: inspected.executionScope.consumableTaskIds };
  return { packageRoot, requestContext: { requestId: 'r', objective: 'Implement', source: 'user', binding: structuredClone(binding), project: { root: projectRoot, readScope: ['.'], constraints: [], refusals: [], authorizations: ['execute'] } }, author: { actor: 'caller', adapter: 'test', source: 'test', observedAt: now }, selection: { consumer: 'asds-execution-consumer', selected: true, source: 'user', observedAt: now, binding: structuredClone(binding) }, grants: [{ kind: 'execution', granted: true, source: 'user', scope: { projectRoot, binding: structuredClone(binding) }, validFrom: '2026-10-09T11:00:00.000Z', validUntil: '2026-10-09T13:00:00.000Z' }, { kind: 'evidence-persistence', granted: true, source: 'user', scope: { journal: 'run/journal.jsonl', evidence: 'run/evidence' }, validFrom: '2026-10-09T11:00:00.000Z', validUntil: '2026-10-09T13:00:00.000Z' }], destination: { journal: 'run/journal.jsonl', evidence: 'run/evidence', source: 'user' }, workspace: { projectRoot, workspaceId: 'cli-workspace', repoIdentity: { vcs: 'git', rootRealpath: projectRoot, commonDirRealpath: join(projectRoot, '.git'), baseRevision: 'a'.repeat(40) }, baseline: { version: 1, baseRevision: 'a'.repeat(40), workspaceRevision: 'a'.repeat(40), committedSinceBase: [], staged: [], unstaged: [], untracked: [] }, source: 'test', observedAt: now }, coordinatorBoundary: { enforced: true, projectReadOnly: true, brokers: ['journal', 'evidence', 'progress'], source: 'test', observedAt: now }, now };
}

test('CLI prints a valid envelope to stdout without creating a default file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asds-handoff-cli-')), input = join(dir, 'input.json');
  const value = validInput(dir), before = readFileSync(join(value.packageRoot, 'planning-manifest.json'));
  writeFileSync(input, JSON.stringify(value));
  const result = spawnSync(process.execPath, [cli, '--input', input], { encoding: 'utf8' });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).schemaVersion, 'asds.execution-handoff/1');
  assert.equal(existsSync(join(dir, 'execution-handoff.json')), false);
  assert.deepEqual(readFileSync(join(value.packageRoot, 'planning-manifest.json')), before);
});

test('CLI creates only an explicitly selected new output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asds-handoff-cli-')), input = join(dir, 'input.json'), output = join(dir, 'handoff.json');
  writeFileSync(input, JSON.stringify(validInput(dir)));
  const result = spawnSync(process.execPath, [cli, '--input', input, '--output', output], { encoding: 'utf8' });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, '');
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).schemaVersion, 'asds.execution-handoff/1');
});

test('CLI is read-only without output and emits typed invalid-input errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asds-handoff-cli-'));
  const input = join(dir, 'input.json'); writeFileSync(input, '{}\n');
  const result = spawnSync(process.execPath, [cli, '--input', input], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ASDS_EXECUTION_HANDOFF_INVALID/);
  assert.equal(existsSync(join(dir, 'execution-handoff.json')), false);
});

test('CLI refuses an existing output before replacing any bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asds-handoff-cli-'));
  const input = join(dir, 'input.json'), output = join(dir, 'handoff.json');
  writeFileSync(input, '{}\n'); writeFileSync(output, 'preserve-me\n');
  const result = spawnSync(process.execPath, [cli, '--input', input, '--output', output], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ASDS_EXECUTION_HANDOFF_OUTPUT_EXISTS/);
  assert.equal(readFileSync(output, 'utf8'), 'preserve-me\n');
});

test('CLI rejects authority or capability inference flags', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asds-handoff-cli-'));
  const input = join(dir, 'input.json'); writeFileSync(input, '{}\n');
  for (const option of ['--authorize', '--spawn', '--capabilities']) {
    const result = spawnSync(process.execPath, [cli, '--input', input, option, 'true'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown option|capabilit|authorization/i);
  }
});
