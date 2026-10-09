import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { receiveHandoff } from '../lib/handoff.mjs';
import { compilePlanningPlan, renderPlanningDag } from '../lib/planning-graph.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const base = 'examples/planning-delivery';
const load = variant => JSON.parse(read(`${base}/${variant}/planning-manifest.json`));
const sha = value => createHash('sha256').update(value).digest('hex');
const layers = Array.from({ length: 16 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`);

// Fixture integrity only: no text matcher or boolean certifies semantic quality.
function inspect(m, variant) {
  assert.equal(m.schemaVersion, 'asds.planning-delivery/1');
  assert.equal(m.returnVersion, 'asds.planning-return/1');
  assert.ok(['draft', 'reviewing', 'ready', 'delivered', 'partial', 'blocked', 'superseded'].includes(m.state));
  assert.equal(m.synthetic, true);
  assert.equal(m.planningContribution.product, 'reviewed-planning-package');
  assert.equal(m.planningContribution.executionPerformed, false);
  assert.deepEqual(Object.keys(m.layers).sort(), layers);
  for (const layer of Object.values(m.layers)) {
    assert.ok(['satisfied', 'reused', 'not_applicable', 'blocked'].includes(layer.status));
    assert.ok(layer.reason.length > 10);
    assert.ok(layer.references.length > 0);
    for (const ref of layer.references) assert.ok(m.references.some(item => item.id === ref));
  }
  const prefix = `${base}/${variant}/`;
  assert.equal(new Set(m.references.map(ref => ref.id)).size, m.references.length);
  for (const ref of m.references) assert.equal(sha(read(prefix + ref.path)), ref.sha256, ref.path);
  const files = readdirSync(resolve(root, prefix, 'tasks')).sort();
  const packageFiles = readdirSync(resolve(root, prefix)).filter(path => path !== 'tasks')
    .concat(files.map(path => `tasks/${path}`)).sort();
  assert.deepEqual(packageFiles, [...m.references.map(ref => ref.path), 'planning-manifest.json'].sort());
  assert.deepEqual(files, m.tasks.map(task => `task-${task.id}.md`).sort());
  const index = read(prefix + 'tasks.md');
  const linked = [...index.matchAll(/\[Task ([A-Za-z0-9]+)\]\(tasks\/task-([A-Za-z0-9]+)\.md\)/g)];
  assert.deepEqual(linked.map(match => match[1]).sort(), m.tasks.map(task => task.id).sort());
  assert.ok(linked.every(match => match[1] === match[2]));
  assert.doesNotMatch(index, /\[[xX]\]/);
  const ids = new Set(m.tasks.map(task => task.id));
  for (const task of m.tasks) {
    assert.ok(task.parentId === null || ids.has(task.parentId));
    assert.ok(task.dependsOn.every(id => ids.has(id) && id !== task.id && id !== task.parentId));
    assert.equal(task.implementationStatus, 'not_started');
    const body = read(prefix + `tasks/task-${task.id}.md`);
    const header = parse(body.split('---')[1]);
    assert.equal(header.id, task.id);
    assert.equal(header.nodeType, task.nodeType);
    assert.equal(header.parentId, task.parentId);
    assert.deepEqual(header.dependsOn, task.dependsOn);
    assert.deepEqual(header.dependencyDetails, task.dependencyDetails);
    assert.match(body, /## Outcome/);
    assert.match(body, /## Inputs/);
    assert.match(body, /## Scope and dependencies/);
    assert.match(body, /## Acceptance/);
    assert.match(body, /## Verification/);
    assert.match(body, /## Definition of done/);
    assert.doesNotMatch(body, /\[[xX]\]/);
    if (task.nodeType === 'task') {
      for (const category of ['Positive', 'Negative', 'Preservation']) assert.match(body, new RegExp(category));
      assert.ok(task.requirements.length > 0);
    }
  }
  const headers = m.tasks.map(task => parse(read(prefix + `tasks/task-${task.id}.md`).split('---')[1]));
  // Manifest tasks summarize identity/requirements; file inventories live in headers.
  const plan = compilePlanningPlan(m.tasks.map((task,i) => ({...headers[i], ...task})));
  assert.deepEqual(compilePlanningPlan(headers).dependencyRelations, plan.dependencyRelations);
  assert.match(renderPlanningDag(plan), /required output:/);
  // Graph and identity checks remain structural; they do not judge decomposition quality.
  for (const relation of ['composition', 'precedence']) {
    const visiting = new Set();
    const visited = new Set();
    const visit = id => {
      assert.ok(!visiting.has(id), `${relation} cycle at ${id}`);
      if (visited.has(id)) return;
      visiting.add(id);
      const task = m.tasks.find(item => item.id === id);
      const edges = relation === 'composition' ? (task.parentId ? [task.parentId] : []) : task.dependsOn;
      edges.forEach(visit);
      visiting.delete(id); visited.add(id);
    };
    m.tasks.forEach(task => visit(task.id));
  }
  const candidate = m.references.filter(ref => ref.role !== 'review')
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(ref => `${ref.path}\0${ref.sha256}\n`).join('');
  const fingerprint = sha(candidate);
  assert.deepEqual(m.reviews.map(review => review.kind), ['fidelity', 'quality']);
  for (const review of m.reviews) {
    assert.equal(review.candidateSha256, fingerprint);
    assert.equal(review.revision, m.revision);
    assert.equal(review.synthetic, true);
    assert.equal(review.liveEvidence, null);
    assert.ok(m.references.some(ref => ref.id === review.reference));
  }
  assert.equal(m.readback.executionEvidence, false);
  assert.equal(m.readback.revision, m.revision);
  assert.equal(m.readback.synthetic, true);
  assert.deepEqual(m.readback.referenceIds.sort(), m.references.map(ref => ref.id).sort());
  const highRisk = ['sensitive', 'auth', 'billing', 'destructive', 'high-risk'].includes(m.reviewPolicy.risk);
  if (highRisk) assert.equal(m.reviewPolicy.independentRequired, true);
  for (const id of layers.slice(6)) assert.notEqual(m.layers[id].status, 'not_applicable', id);
  if (m.state === 'delivered') {
    if (m.reviewPolicy.independentRequired) {
      assert.ok(m.reviews.every(review => review.mode === 'independent' && review.reviewer));
    } else {
      assert.equal(m.reviewPolicy.risk, 'ordinary-low');
      assert.equal(m.reviewPolicy.mode, 'self-review');
    }
    assert.equal(m.blockers.length, 0);
    assert.ok(Object.values(m.layers).every(layer => layer.status !== 'blocked'));
    assert.ok(m.reviews.every(review => review.verdict === 'pass'));
    assert.equal(m.readback.status, 'matched');
  } else {
    assert.ok(m.blockers.length > 0);
    assert.ok(m.blockers.every(blocker => blocker.owner && blocker.affectedTasks.length && blocker.resolution));
    assert.ok(Object.values(m.layers).some(layer => layer.status === 'blocked'));
  }
}

test('canonical product contract defines planning states, authority and compatibility', () => {
  const doc = read('docs/architecture/planning-delivery-contract.md');
  for (const phrase of ['draft', 'reviewing', 'ready', 'delivered', 'partial', 'blocked', 'superseded',
    'cancelled', 'tasks.md', 'tasks/task-ID.md', 'C01', 'C16', 'T09', 'independent', 'self-review',
    'objective', 'project', 'scope', 'constraints', 'risks', 'references', 'authorizations']) assert.ok(doc.includes(phrase), phrase);
});

for (const variant of ['complete', 'partial', 'blocked']) {
  test(`${variant} synthetic model has exact files, hashes, layers and current review references`, () => inspect(load(variant), variant));
  test(`${variant} task 0003 future command is shell-valid and excludes manual-check prose`, () => {
    const body = read(`${base}/${variant}/tasks/task-0003.md`);
    const verification = body.split('## Verification\n')[1].split('\n## Definition of done')[0];
    const commands = [...verification.matchAll(/`([^`]+)`/g)].map(match => match[1]);
    assert.equal(commands.length, 1);
    // Parse only: never execute the planned catalog tests or guide examples.
    const syntax = spawnSync('bash', ['-n', '-c', commands[0]], { encoding: 'utf8' });
    assert.ifError(syntax.error);
    assert.equal(syntax.status, 0, syntax.stderr);
    assert.equal(commands[0], 'node --test tests/catalog-list.test.js tests/catalog-export.test.js');
    assert.match(verification, /`\.\nEm seguida, conferir manualmente os exemplos do guia\./);
  });
}

test('complete model preserves original implementation request without claiming software completion', () => {
  const m = load('complete');
  assert.equal(m.originalRequestedProduct.kind, 'implementation');
  assert.equal(m.originalRequestedProduct.status, 'not_fulfilled');
  assert.equal(m.state, 'delivered');
  assert.equal(m.attendanceOutcome, 'planning_delivered');
  assert.equal(m.tasks.find(t => t.id === '0001').parentId, 'P01');
  assert.deepEqual(m.tasks.find(t => t.id === '0001').dependsOn, []);
  assert.deepEqual(m.tasks.find(t => t.id === '0002').dependsOn, []);
  assert.deepEqual(m.tasks.find(t => t.id === '0003').dependsOn, ['0001', '0002']);
  assert.deepEqual(m.parallelism.recommended, [['0001', '0002'], ['0003']]);
  assert.equal(m.reviewPolicy.mode, 'self-review');
  assert.equal(m.reviewPolicy.independentRequired, false);
  assert.equal(m.reviewPolicy.risk, 'ordinary-low');
});

test('missing review/readback and fake delivered blocker are rejected as structural inconsistencies', () => {
  for (const mutate of [
    m => { m.reviews[0].revision = 'stale'; },
    m => { m.references[0].sha256 = '0'.repeat(64); },
    m => { delete m.layers.C12; },
    m => { m.readback.executionEvidence = true; },
    m => { m.tasks[1].implementationStatus = 'completed'; },
    m => { m.blockers.push({ owner: 'owner', affectedTasks: ['0001'], resolution: 'pending' }); },
    m => { m.state = 'cancelled'; },
    m => { m.tasks.find(t => t.id === 'P01').parentId = '0001'; },
    m => { m.tasks.find(t => t.id === '0001').dependsOn = ['0003']; },
    m => { m.reviews[0].candidateSha256 = '0'.repeat(64); },
    m => { m.reviewPolicy.risk = 'auth'; },
    m => { m.reviewPolicy.independentRequired = true; },
    m => { m.layers.C13.status = 'not_applicable'; },
  ]) {
    const m = load('complete'); mutate(m);
    assert.throws(() => inspect(m, 'complete'));
  }
});

test('v1 input keeps seven keys and cannot absorb internal planning version', () => {
  const packet = { objective: 'Implementar catálogo', project: '/synthetic/catalog', scope: ['catálogo'],
    constraints: ['sem execução pelo ASDS'], risks: [], references: [], authorizations: [] };
  assert.deepEqual(receiveHandoff(packet).context, packet);
  assert.throws(() => receiveHandoff({ ...packet, schemaVersion: 'asds.planning-delivery/1' }), /v1/);
});
