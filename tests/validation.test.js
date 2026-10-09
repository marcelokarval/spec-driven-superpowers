import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, validateSchema, validateChange, validateChangeSpecs, validateTaskIndex, loadTasks } from '../lib/validation.mjs';
import { collectGitScope } from '../lib/git-scope.mjs';
import { projectTaskManager } from '../lib/planning-graph.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-validation-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function write(root, file, content) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}
const contract = `---
id: "0001"
openDecisions: []
dependsOn: []
write: [src/example.js, tests/example.test.js]
resources: []
scenarios: [example/Accept input]
verification: [npm test]
---
# Task 0001: Example
## Outcome
Accept valid input.
## Inputs
The example specification.
## Scope and dependencies
Only the declared write paths are mutable. There are no prerequisite outputs.
## Acceptance
Valid input is accepted.
## Verification
Run npm test in the target project.
## Definition of done
Reviewed and integrated with evidence.
`;
function changeFixture(t) {
  const dir = fixture(t);
  write(dir, 'proposal.md', '# Proposal\nAccept input.');
  write(dir, 'design.md', '# Design\nPure validation.');
  write(dir, 'tasks.md', '# Tasks\n- [ ] [Task 0001](tasks/task-0001.md): Example\n');
  write(dir, 'tasks/task-0001.md', contract);
  write(dir, 'specs/example/spec.md', '## ADDED Requirements\n### Requirement: Input\nThe system SHALL accept input.\n#### Scenario: Accept input\n- **WHEN** input is valid\n- **THEN** it is accepted\n');
  return dir;
}

test('frontmatter uses a YAML parser and rejects malformed or non-mapping data', () => {
  assert.equal(parseFrontmatter(contract).id, '0001');
  for (const value of ['---\nname: [unterminated\n---\n', '---\n- name\n---\n', 'no frontmatter']) {
    assert.throws(() => parseFrontmatter(value));
  }
});
test('schema validation checks dependency graph and template files', t => {
  const dir = fixture(t);
  const schema = 'name: test\nversion: 1\nartifacts:\n  - id: proposal\n    generates: proposal.md\n    template: proposal.md\n    requires: []\napply:\n  requires: [proposal]\n  tracks: tasks.md\n';
  write(dir, 'schema.yaml', schema);
  write(dir, 'templates/proposal.md', '# Proposal');
  assert.deepEqual(validateSchema(dir), []);
  write(dir, 'schema.yaml', schema.replace('requires: []', 'requires: [proposal]'));
  assert.ok(validateSchema(dir).some(error => /cycle/.test(error)));
  write(dir, 'schema.yaml', 'version: [unterminated');
  assert.ok(validateSchema(dir).length);
});
test('change validation connects index, contracts and real scenarios', t => {
  const dir = changeFixture(t);
  assert.deepEqual(validateChange(dir), []);
  write(dir, 'tasks/task-0001.md', contract.replace('example/Accept input', 'example/Missing'));
  assert.ok(validateChange(dir).some(error => /scenario/.test(error)));
  write(dir, 'tasks/task-0001.md', contract.replace('dependsOn: []', 'dependsOn: ["0001"]'));
  assert.ok(validateChange(dir).some(error => /cycle/.test(error)));
  write(dir, 'tasks/task-0001.md', contract);
  write(dir, 'tasks/task-0002.md', contract.replace('"0001"', '"0002"'));
  assert.ok(validateChange(dir).some(error => /orphan/.test(error)));
  write(dir, 'tasks.md', '- [ ] [Task 0001](../outside.md): Escape\n');
  assert.ok(validateChange(dir).length);
});
test('change specs enforce the OpenSpec delta contract before delivery', t => {
  const dir = changeFixture(t), file='specs/example/spec.md';
  assert.deepEqual(validateChangeSpecs(dir), []);
  write(dir,file,fs.readFileSync(path.join(dir,file),'utf8').replace('## ADDED Requirements','# ADDED Requirements'));
  assert.ok(validateChangeSpecs(dir).some(error=>error.includes('no OpenSpec delta section')));
  write(dir,file,'## ADDED Requirements\n### Requirement: Input\nAccept input.\n#### Scenario: Accept input\n- **WHEN** valid\n- **THEN** accepted\n');
  assert.ok(validateChangeSpecs(dir).some(error=>error.includes('SHALL/MUST')));
  write(dir,file,'## ADDED Requirements\n### Requirement: Input\nThe system SHALL accept input.\n#### Scenario: Accept input\n- **GIVEN** valid input\n');
  assert.ok(validateChangeSpecs(dir).some(error=>error.includes('WHEN/THEN')));
});
test('tasks.md is the canonical ordered inventory for projections', t => {
  const dir=changeFixture(t), tasks=loadTasks(dir);
  assert.deepEqual(validateTaskIndex(dir,tasks).errors,[]);
  write(dir,'tasks.md','# Tasks\n- [ ] [Task 0001](tasks/task-0001.md): Wrong title\n');
  assert.ok(validateTaskIndex(dir,tasks).errors.some(error=>error.includes('title differs')));
  write(dir,'tasks/task-0002.md',contract.replaceAll('0001','0002'));
  write(dir,'tasks.md','# Tasks\n- [ ] [Task 0002](tasks/task-0002.md): Example\n- [ ] [Task 0001](tasks/task-0001.md): Example\n');
  assert.ok(validateTaskIndex(dir,loadTasks(dir)).errors.some(error=>error.includes('strictly increasing')));
  write(dir,'tasks.md','# Tasks\n- [ ] [Task 0001](tasks/task-0001.md): Example\n- [ ] [Task 0002](tasks/task-0002.md): Example\n- Onda 1: 0001, 0002\n');
  assert.deepEqual(validateTaskIndex(dir,loadTasks(dir)).declaredWaves,[['0001','0002']]);
});
test('neutral planning package remains valid without OpenSpec artifacts', t => {
  const dir=fixture(t);
  write(dir,'tasks.md','# Tasks\n- [ ] [Task 0001](tasks/task-0001.md): Example\n');
  write(dir,'tasks/task-0001.md',contract);
  assert.deepEqual(validateChangeSpecs(dir),[]);
  assert.deepEqual(validateChange(dir),[]);
});
test('planning delivery compares tasks.md wave declarations with the deterministic projection', t => {
  const dir=changeFixture(t), loaded=loadTasks(dir);
  const fields=['id','title','owner','nodeType','parentId','requirements','dependsOn','dependencyDetails','decisionInputs','resolvesDecisions','decisionBundleReason','write','resources','scenarios','verification'];
  const tasks=loaded.map(task=>Object.fromEntries(fields.filter(field=>task[field]!==undefined).map(field=>[field,task[field]])));
  const manifest={state:'ready',tasks,decisions:[],blockers:[],taskManager:projectTaskManager(tasks),references:[],reviewPolicy:{domains:['frontend'],risk:'ordinary-low',independentRequired:false}};
  write(dir,'planning-manifest.json',JSON.stringify(manifest));
  assert.ok(validateChange(dir).some(error=>error.includes('must declare the projected waves')));
  write(dir,'tasks.md','# Tasks\n- [ ] [Task 0001](tasks/task-0001.md): Example\n- Wave 1: 0001\n');
  assert.ok(!validateChange(dir).some(error=>error.includes('tasks.md waves differ')||error.includes('must declare the projected waves')));
});
test('present planning manifest is part of change validation and fails closed', t => {
  const dir = changeFixture(t);
  write(dir, 'planning-manifest.json', JSON.stringify({ state:'delivered', tasks:[], reviewPolicy:{risk:'ordinary-low',independentRequired:false} }));
  const errors=validateChange(dir);
  assert.ok(errors.some(error=>error.includes('planning manifest')));
  assert.ok(errors.some(error=>error.includes('declared delivered')));
});
test('Git scope includes committed, staged, unstaged, deleted and untracked paths', t => {
  const dir = fixture(t);
  const git = (...args) => execFileSync('git', ['-c', `core.hooksPath=${process.platform === 'win32' ? 'NUL' : os.devNull}`, '-c', 'commit.gpgSign=false', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Test fixture');
  write(dir, 'tracked.txt', 'base');
  write(dir, 'deleted.txt', 'delete me');
  git('add', '.');
  // Commits exist only in disposable test repositories.
  git('commit', '-m', 'fixture base');
  const base = git('rev-parse', 'HEAD');
  write(dir, 'committed.txt', 'outside scope');
  git('add', '.');
  git('commit', '-m', 'fixture delivery');
  write(dir, 'tracked.txt', 'staged');
  git('add', 'tracked.txt');
  write(dir, 'tracked.txt', 'unstaged');
  fs.unlinkSync(path.join(dir, 'deleted.txt'));
  write(dir, 'new.txt', 'untracked');
  const scope = collectGitScope(dir, base);
  assert.deepEqual(scope.changedFiles, ['committed.txt', 'deleted.txt', 'new.txt', 'tracked.txt']);
  assert.match(scope.revision, /worktree:/);
  write(dir, 'new.txt', 'changed again');
  assert.notEqual(collectGitScope(dir, base).revision, scope.revision);
});

test('delivery CLI checks real scope and stale snapshots without executing contract commands', t => {
  const repo = fixture(t), change = changeFixture(t), evidence = fixture(t);
  const git = (...args) => execFileSync('git', [
    '-c', `core.hooksPath=${process.platform === 'win32' ? 'NUL' : os.devNull}`, '-c', 'commit.gpgSign=false',
    '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', ...args,
  ], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  write(repo, 'src/example.js', 'base');
  git('add', '.');
  git('commit', '-m', 'fixture baseline');
  const base = git('rev-parse', 'HEAD');
  write(repo, 'src/example.js', 'changed');
  const snapshot = collectGitScope(repo, base);
  const receipt = {
    ...snapshot, status: 'reviewed', contractRevision: loadTasks(change)[0].contractRevision,
    evidence: [{ command: 'npm test', exitCode: 0, revision: snapshot.revision }],
    reviews: { spec: snapshot.revision, quality: snapshot.revision, independent: true },
  };
  const receiptPath = path.join(evidence, 'receipt.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  const cli = fileURLToPath(new URL('../scripts/validate.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [cli, '--change', change, '--delivery', receiptPath,
    '--task', '0001', '--repo', repo, '--base', base], { encoding: 'utf8' });
  assert.equal(run().status, 0);
  write(repo, 'src/example.js', 'new snapshot');
  assert.match(run().stderr, /snapshot/);
  write(repo, 'outside.js', 'outside');
  git('add', '.');
  git('commit', '-m', 'fixture committed scope escape');
  const updated = collectGitScope(repo, base);
  fs.writeFileSync(receiptPath, JSON.stringify({
    ...receipt, ...updated, changedFiles: ['src/example.js'],
    evidence: [{ command: 'npm test', exitCode: 0, revision: updated.revision }],
    reviews: { spec: updated.revision, quality: updated.revision, independent: true },
  }));
  const rejected = run();
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /scope escape: outside.js/);
  assert.match(rejected.stderr, /omits or adds/);
});

test('CLI verifies distinct delivered and integrated revisions without widening task scope', t => {
  const repo = fixture(t), change = changeFixture(t), evidence = fixture(t);
  const git = (...args) => execFileSync('git', ['-c', `core.hooksPath=${process.platform === 'win32' ? 'NUL' : os.devNull}`,
    '-c', 'commit.gpgSign=false', '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', ...args],
    { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  write(repo, 'src/example.js', 'base'); git('add', '.'); git('commit', '-m', 'fixture baseline');
  const base = git('rev-parse', 'HEAD');
  write(repo, 'src/example.js', 'delivered'); git('add', '.'); git('commit', '-m', 'fixture delivery');
  const delivery = collectGitScope(repo, base);
  write(repo, 'other-task.js', 'integrated separately'); git('add', '.'); git('commit', '-m', 'fixture integration');
  const integration = collectGitScope(repo, base);
  const receipt = { ...delivery, status: 'integrated', contractRevision: loadTasks(change)[0].contractRevision,
    evidence: [{ command: 'npm test', exitCode: 0, revision: delivery.revision }],
    reviews: { spec: delivery.revision, quality: delivery.revision, independent: true },
    integrationRevision: integration.revision,
    integrationEvidence: [{ command: 'npm test', exitCode: 0, revision: integration.revision }],
    integrationReviews: { spec: integration.revision, quality: integration.revision, independent: true } };
  const receiptPath = path.join(evidence, 'receipt.json'), scopePath = path.join(evidence, 'scope.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  fs.writeFileSync(scopePath, JSON.stringify(integration.changedFiles));
  const cli = fileURLToPath(new URL('../scripts/validate.mjs', import.meta.url));
  const args = [cli, '--change', change, '--delivery', receiptPath, '--task', '0001', '--repo', repo,
    '--base', base, '--delivery-revision', delivery.revision, '--integration-base', base, '--integration-scope', scopePath];
  const run = () => spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(run().status, 0, run().stderr);
  fs.writeFileSync(scopePath, JSON.stringify(['src/example.js']));
  assert.match(run().stderr, /integration scope/i);
  fs.writeFileSync(scopePath, JSON.stringify(integration.changedFiles));
  write(repo, 'other-task.js', 'changed after integration');
  assert.match(run().stderr, /Integration does not match/);
});
