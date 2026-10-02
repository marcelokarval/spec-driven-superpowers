import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateDelivery, chooseExecution, affectedTasks } from '../lib/contracts.mjs';
import { loadTasks, validateChange } from '../lib/validation.mjs';
import { parseDeltaSpec } from '../node_modules/@fission-ai/openspec/dist/core/parsers/requirement-blocks.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-workflow-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(new URL('../examples/basic-change/', import.meta.url), dir, { recursive: true });
  return dir;
}
function receipt(task) {
  return { status: 'integrated', baseRevision: 'base', revision: 'delivery',
    contractRevision: task.contractRevision, changedFiles: ['src/count.js'],
    evidence: task.verification.map(command => ({ command, exitCode: 0, revision: 'delivery' })),
    reviews: { spec: 'delivery', quality: 'delivery', independent: true },
    integrationRevision: 'integration',
    integrationEvidence: task.verification.map(command => ({ command, exitCode: 0, revision: 'integration' })),
    integrationReviews: { spec: 'integration', quality: 'integration', independent: true },
  };
}
test('microcontract body and material decisions are readiness gates', t => {
  const dir = fixture(t);
  const file = path.join(dir, 'tasks/task-0001.md');
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.match(/^---\n[\s\S]*?\n---\n/)[0]);
  assert.ok(validateChange(dir).some(error => /readiness/.test(error)));
  fs.writeFileSync(file, original.replace('openDecisions: []', 'openDecisions: ["Unresolved API"]'));
  assert.ok(validateChange(dir).some(error => /decisions/.test(error)));
});
test('dependency edits invalidate descendants but preserve unrelated contract identity', t => {
  const dir = fixture(t);
  const one = path.join(dir, 'tasks/task-0001.md');
  const source = fs.readFileSync(one, 'utf8');
  fs.writeFileSync(path.join(dir, 'tasks/task-0002.md'), source.replace('id: "0001"', 'id: "0002"').replace('dependsOn: []', 'dependsOn: ["0001"]'));
  fs.writeFileSync(path.join(dir, 'tasks/task-0003.md'), source.replace('id: "0001"', 'id: "0003"'));
  const before = loadTasks(dir);
  assert.deepEqual(affectedTasks(before, ['0001']), ['0001', '0002']);
  fs.appendFileSync(one, '\nNew interface decision.\n');
  const after = loadTasks(dir);
  assert.notEqual(before[0].contractRevision, after[0].contractRevision);
  assert.notEqual(before[1].contractRevision, after[1].contractRevision);
  assert.equal(before[2].contractRevision, after[2].contractRevision);
});
test('completion requires integration evidence and current contract identity', t => {
  const dir = fixture(t);
  const task = loadTasks(dir)[0];
  const good = receipt(task);
  assert.deepEqual(validateDelivery(task, good), []);
  assert.ok(validateDelivery(task, { ...good, integrationEvidence: [] }).length);
  assert.ok(validateDelivery(task, { ...good, integrationReviews: good.reviews }).length);
  const index = path.join(dir, 'tasks.md');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('[ ]', '[x]'));
  assert.ok(validateChange(dir).some(error => /receipt/.test(error)));
  assert.deepEqual(validateChange(dir, { receipts: { '0001': good } }), []);
  fs.appendFileSync(path.join(dir, 'design.md'), '\nMaterial decision changed.\n');
  assert.ok(validateChange(dir, { receipts: { '0001': good } }).some(error => /contract/.test(error)));
});
test('invalid graph is blocked, not suggested for sequential execution', () => {
  assert.equal(chooseExecution([]).mode, 'blocked');
});
test('filled bridge template produces a real OpenSpec delta', () => {
  const template = fs.readFileSync(new URL('../schemas/superpowers-bridge/templates/spec.md', import.meta.url), 'utf8');
  const filled = template.replace('<!-- Capability Name -->', 'counts').replace('<!-- Requirement Name -->', 'Counts')
    .replace('<!-- Description using normative RFC 2119 keywords (SHALL, MUST). Keep under 500 characters. -->', 'The system SHALL accept positive counts.')
    .replace('<!-- Scenario Name -->', 'Accept input').replace('<!-- action or event occurs -->', 'input is positive')
    .replace('<!-- expected observable outcome -->', 'it is accepted');
  const delta = parseDeltaSpec(filled);
  assert.equal(delta.added.length, 1);
  assert.deepEqual(delta.orphanedRequirements, []);
});
