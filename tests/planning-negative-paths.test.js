import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateTasks } from '../lib/contracts.mjs';
import { validateDecomposition, validateRefinement } from '../lib/decomposition.mjs';
import { compilePlanningPlan, recommendParallelism } from '../lib/planning-graph.mjs';
import { loadTasks } from '../lib/validation.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const node = (id, extra = {}) => ({ id, nodeType: 'task', dependsOn: [], write: [`${id}.js`], resources: [], scenarios: ['s'], requirements: ['r'], verification: ['future check'], ...extra });
const has = (errors, message) => assert.ok(errors.some(error => error.includes(message)), JSON.stringify(errors));
const temporary = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-negative-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const cli = (...args) => spawnSync(process.execPath, [path.join(repo, 'scripts/plan.mjs'), ...args], { cwd: repo, encoding: 'utf8' });
const rejected = (run, message) => {
  assert.ifError(run.error);
  assert.equal(run.signal, null);
  assert.equal(run.status, 1, run.stderr);
  assert.equal(run.stdout, '', 'fail-closed must not emit a plan');
  assert.match(run.stderr, message);
};

test('inventory rejects nonarrays, empty arrays and nonobject task entries without throwing', () => {
  for (const tasks of [null, {}, [], 'tasks']) has(validateTasks(tasks), 'tasks must be a nonempty array');
  for (const value of [null, 42, 'task', []]) has(validateTasks([value]), 'task must be an object');
  has(validateTasks([node('invalid/id')]), 'invalid task id');
  has(validateTasks([node('A'), node('A')]), 'duplicate task A');
});
for (const [field, message] of [['parentId', 'invalid parentId'], ['requirements', 'requirements must be a string array']]) {
  test(`inventory rejects malformed ${field}`, () => {
    for (const value of [42, {}, [' ']]) has(validateTasks([node('A', { [field]: value })]), message);
  });
}
for (const field of ['dependsOn', 'write', 'resources', 'scenarios', 'verification']) {
  test(`inventory rejects invalid and duplicate ${field} arrays`, () => {
    for (const value of [undefined, null, {}, [' '], [42]]) has(validateTasks([node('A', { [field]: value })]), `${field} must be a string array`);
    has(validateTasks([node('A', { [field]: ['same', 'same'] })]), `duplicate ${field}`);
  });
}
test('composition rejects invalid nodeType and child with omitted type', () => {
  has(validateTasks([node('A', { nodeType: 'unknown' })]), 'invalid nodeType');
  const parent = node('P', { nodeType: 'package', write: ['A.js'] });
  has(validateTasks([parent, node('A', { parentId: 'P', nodeType: undefined })]), 'child must have explicit nodeType');
  // Legacy optional inventories are legitimate defaults, not malformed probes.
  assert.deepEqual(validateDecomposition([{ id: 'P', nodeType: 'package', dependsOn: [] }, { id: 'A', nodeType: 'task', parentId: 'P', dependsOn: [] }]), []);
});

test('refinement requires original leaf, retained identity and actual replacements', () => {
  const before = [node('A')];
  for (const [prior, after, id] of [[before, before, 'A'], [before, [node('C')], 'A'], [before, [node('A'), node('C')], 'absent'], [[node('A', { nodeType: 'package' }), node('B', { parentId: 'A', write: ['A.js'] })], [node('A'), node('C')], 'A']]) {
    has(validateRefinement(prior, after, id), 'refine requires an existing leaf');
  }
});
test('flat refinement preserves parent and stays within original subtree', () => {
  const parent = node('P', { nodeType: 'package', write: ['A.js'] });
  const old = node('A', { parentId: 'P' });
  const before = [parent, old];
  const after = [parent, old, node('C', { parentId: 'P', write: ['A.js'] })];
  assert.deepEqual(validateRefinement(before, after, 'A'), []);
  has(validateRefinement(before, after.map(t => t.id === 'A' ? { ...t, parentId: undefined } : t), 'A'), 'preserve original parent identity');
  has(validateRefinement(before, after.map(t => t.id === 'C' ? { ...t, parentId: undefined } : t), 'A'), 'same package or recursive subtree');
});
test('flat refinement cannot drop original prerequisites', () => {
  const before = [node('D'), node('A', { dependsOn: ['D'] })];
  const after = [...before, node('C', { dependsOn: ['D'], write: ['A.js'] })];
  assert.deepEqual(validateRefinement(before, after, 'A'), []);
  has(validateRefinement(before, after.map(t => t.id === 'C' ? { ...t, dependsOn: [] } : t), 'A'), 'drops prerequisites');
});
for (const field of ['write', 'resources', 'scenarios', 'requirements']) {
  test(`refinement preserves ${field} coverage and cannot expand ${field}`, () => {
    const old = node('A', { resources: ['db'] });
    const replacement = node('C', { write: ['A.js'], resources: ['db'] });
    assert.deepEqual(validateRefinement([old], [old, replacement], 'A'), []);
    has(validateRefinement([old], [old, { ...replacement, [field]: ['escape'] }], 'A'), `refinement expands ${field}`);
    const missing = validateRefinement([old], [{ ...old, [field]: [] }, { ...replacement, [field]: [] }], 'A');
    has(missing, `refinement drops ${field} coverage`);
    if (field === 'scenarios') has(missing, 'refinement drops scenario coverage');
  });
}

test('compiler rejects invalid shape and duplicate identities', () => {
  for (const tasks of [null, {}, [], [null], [42], [[]], [node('A', { dependsOn: 42 })], [node('A', { requirements: 42 })], [node('A', { parentId: 42 })]]) assert.throws(() => compilePlanningPlan(tasks), /Invalid planning tasks/);
  assert.throws(() => compilePlanningPlan([node('A'), node('A')]), /duplicate task id/);
});
test('compiler and public recommendation reject real graph errors before emitting waves', () => {
  const cyclic = [node('A', { dependsOn: ['B'], dependencyDetails: [{ id: 'B', reason: 'Needs B', requiredOutput: 'B result' }] }), node('B', { dependsOn: ['A'], dependencyDetails: [{ id: 'A', reason: 'Needs A', requiredOutput: 'A result' }] })];
  for (const tasks of [cyclic, [node('A', { parentId: 'missing' })]]) {
    assert.throws(() => compilePlanningPlan(tasks), /effective dependency cycle|orphan composition parent/);
    assert.throws(() => recommendParallelism(tasks), /effective dependency cycle|orphan composition parent/);
  }
});
test('shared resources serialize independent write scopes without fusing outcomes', () => {
  const plan = compilePlanningPlan([node('B', { resources: ['DATABASE'] }), node('A', { resources: ['database'] })]);
  assert.deepEqual(plan.parallelism.waves, [['A'], ['B']]);
  assert.deepEqual(plan.parallelism.conflicts, [{ tasks: ['A', 'B'], reason: 'Shared resource; sequential recommendation, not fusion' }]);
  assert.equal(plan.parallelism.recommendationOnly, true);
  assert.deepEqual(plan.tasks.map(t => t.id), ['A', 'B']);
});

for (const args of [[], ['bad'], ['validate'], ['validate', 'unused', 'extra']]) {
  test(`CLI rejects usage ${JSON.stringify(args)}`, () => rejected(cli(...args), /Usage: plan\.mjs/));
}
for (const [name, source, message] of [
  ['missing frontmatter', 'no frontmatter\n', /Missing YAML frontmatter/],
  ['duplicate YAML keys', '---\nid: A\nid: B\n---\n', /Map keys must be unique/],
  ['nonmapping YAML', '---\n- A\n---\n', /Task YAML must be a mapping/],
  ['scalar YAML', '---\n42\n---\n', /Task YAML must be a mapping/],
  ['null YAML', '---\nnull\n---\n', /Task YAML must be a mapping/],
  ['id filename mismatch', '---\nid: B\n---\n', /Task id\/filename mismatch/]
]) {
  test(`CLI fails closed for ${name} across all commands`, t => {
    const dir = temporary(t); fs.mkdirSync(path.join(dir, 'tasks'));
    fs.writeFileSync(path.join(dir, 'tasks/task-A.md'), source);
    for (const command of ['validate', 'dag', 'recommend', 'manager']) rejected(cli(command, dir), message);
    assert.deepEqual(fs.readdirSync(dir), ['tasks']);
    assert.equal(fs.readFileSync(path.join(dir, 'tasks/task-A.md'), 'utf8'), source);
  });
}
test('CLI refuses task symlink without reading or changing its target', t => {
  const dir = temporary(t); fs.mkdirSync(path.join(dir, 'tasks'));
  const target = path.join(dir, 'original.md'); fs.writeFileSync(target, 'must remain unchanged');
  fs.symlinkSync(target, path.join(dir, 'tasks/task-A.md'));
  for (const command of ['validate', 'dag', 'recommend', 'manager']) rejected(cli(command, dir), /Task symlink refused/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'must remain unchanged');
  assert.ok(fs.lstatSync(path.join(dir, 'tasks/task-A.md')).isSymbolicLink());
});
test('JSON wrapper tasks uses the same validated compiler and fails closed on malformed inventory', t => {
  const dir = temporary(t), file = path.join(dir, 'tasks.json');
  const tasks = [node('A')]; fs.writeFileSync(file, JSON.stringify({ tasks }));
  for (const command of ['validate', 'dag', 'recommend', 'manager']) {
    const run = cli(command, file); assert.ifError(run.error); assert.equal(run.status, 0, run.stderr);
    if (command === 'validate') assert.deepEqual(JSON.parse(run.stdout), compilePlanningPlan(tasks));
    else if (command === 'recommend') assert.deepEqual(JSON.parse(run.stdout), compilePlanningPlan(tasks).parallelism);
    else if (command === 'manager') assert.equal(JSON.parse(run.stdout).readyTaskIds[0], 'A');
    else assert.match(run.stdout, /^flowchart TD/);
  }
  for (const value of [{}, { tasks: [] }, { tasks: [null] }, { tasks: [node('A'), node('A')] }]) {
    fs.writeFileSync(file, JSON.stringify(value));
    for (const command of ['validate', 'dag', 'recommend', 'manager']) rejected(cli(command, file), /Invalid planning tasks|duplicate task id/);
  }
  assert.deepEqual(fs.readdirSync(dir), ['tasks.json']);
});
test('compiler rejects a leaf with omitted write instead of deriving package scope', () => {
  const leaf = node('A');
  assert.deepEqual(compilePlanningPlan([leaf]).parallelism.waves, [['A']]);
  const { write, ...missingWrite } = leaf;
  assert.equal(Object.hasOwn(missingWrite, 'write'), false);
  assert.throws(() => compilePlanningPlan([missingWrite]), /^Error: Invalid planning tasks$/);
});

test('decomposition rejects child requirements escaping an omitted parent inventory', () => {
  const parent = node('P', { nodeType: 'package', write: ['A.js'] });
  const child = node('A', { parentId: 'P' });
  assert.deepEqual(validateDecomposition([parent, child]), []);
  const { requirements, ...missingRequirements } = parent;
  assert.deepEqual(validateDecomposition([missingRequirements, child]), ['A: requirements escapes parent contract']);
});

test('decomposition rejects package requirements uncovered by an omitted child inventory', () => {
  const parent = node('P', { nodeType: 'package', write: ['A.js'] });
  const child = node('A', { parentId: 'P' });
  assert.deepEqual(validateDecomposition([parent, child]), []);
  const { requirements, ...missingRequirements } = child;
  assert.deepEqual(validateDecomposition([parent, missingRequirements]), ['P: package requirements coverage missing']);
});

test('refinement cannot expand an omitted original requirements inventory', () => {
  const { requirements, ...original } = node('A');
  const { requirements: replacementRequirements, ...replacement } = node('C', { write: ['A.js'] });
  assert.deepEqual(validateRefinement([original], [original, replacement], 'A'), []);
  assert.deepEqual(validateRefinement([original], [original, { ...replacement, requirements: ['r'] }], 'A'), ['refinement expands requirements']);
});

test('refinement cannot drop requirements through omitted replacement inventories', () => {
  const original = node('A');
  const replacement = node('C', { write: ['A.js'] });
  assert.deepEqual(validateRefinement([original], [original, replacement], 'A'), []);
  const { requirements, ...next } = original;
  const { requirements: replacementRequirements, ...missingRequirements } = replacement;
  assert.deepEqual(validateRefinement([original], [next, missingRequirements], 'A'), ['refinement drops requirements coverage']);
});

test('real loader tolerates omitted parent and child dependsOn but validation rejects both', t => {
  const dir = temporary(t);
  fs.mkdirSync(path.join(dir, 'tasks')); fs.mkdirSync(path.join(dir, 'specs'));
  fs.writeFileSync(path.join(dir, 'proposal.md'), 'proposal');
  fs.writeFileSync(path.join(dir, 'design.md'), 'design');
  const tasks = [node('P', { nodeType: 'package', write: ['A.js'] }), node('A', { parentId: 'P' })];
  const persist = inventory => {
    for (const task of inventory) fs.writeFileSync(path.join(dir, `tasks/task-${task.id}.md`), `---\n${JSON.stringify(task)}\n---\ncontract body\n`);
  };
  persist(tasks);
  const valid = loadTasks(dir);
  assert.deepEqual(validateTasks(valid), []);
  const omitted = tasks.map(({ dependsOn, ...task }) => task);
  persist(omitted);
  const loaded = loadTasks(dir);
  assert.deepEqual(loaded.map(task => task.id).sort(), ['A', 'P']);
  for (const task of loaded) {
    assert.equal(Object.hasOwn(task, 'dependsOn'), false);
    assert.match(task.contractRevision, /^[a-f0-9]{64}$/);
    assert.notEqual(task.contractRevision, valid.find(prior => prior.id === task.id).contractRevision);
  }
  assert.deepEqual(validateTasks(loaded).sort(), ['A: dependsOn must be a string array', 'P: dependsOn must be a string array']);
});

test('loadTasks rejects mismatched identity through the real filesystem path', t => {
  const dir = temporary(t); fs.mkdirSync(path.join(dir, 'tasks')); fs.mkdirSync(path.join(dir, 'specs'));
  fs.writeFileSync(path.join(dir, 'proposal.md'), 'proposal'); fs.writeFileSync(path.join(dir, 'design.md'), 'design');
  fs.writeFileSync(path.join(dir, 'tasks/task-A.md'), '---\nid: B\n---\n');
  assert.throws(() => loadTasks(dir), /Task id\/filename mismatch: tasks\/task-A\.md/);
});
