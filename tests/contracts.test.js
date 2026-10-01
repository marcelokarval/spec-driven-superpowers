import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTasks, chooseExecution, validateDelivery } from '../lib/contracts.mjs';

const task = (id, overrides = {}) => ({
  id, dependsOn: [], write: [`src/${id}.js`, `tests/${id}.test.js`],
  resources: [], scenarios: [`feature/${id}`],
  verification: ['npm test'], ...overrides,
});
test('task graph rejects cycles, missing dependencies, duplicate IDs and path escape', () => {
  assert.deepEqual(validateTasks([task('1'), task('2', { dependsOn: ['1'] })]), []);
  for (const tasks of [
    [task('1', { dependsOn: ['1'] })],
    [task('1', { dependsOn: ['2'] }), task('2', { dependsOn: ['1'] })],
    [task('1', { dependsOn: ['missing'] })],
    [task('1'), task('1')],
    [task('1', { write: ['../outside'] })],
    [task('1', { write: ['/absolute'] })],
    [task('1', { scenarios: [] })],
  ]) assert.ok(validateTasks(tasks).length > 0);
});
test('parallelism requires live capabilities, budget, disjoint scope and resources', () => {
  const capabilities = { spawn: true, isolatedWrites: true, maxParallel: 2 };
  assert.equal(chooseExecution([task('1'), task('2')], capabilities).mode, 'parallel');
  assert.equal(chooseExecution([task('1'), task('2')], {}).mode, 'sequential');
  assert.equal(chooseExecution([task('1'), task('2', { dependsOn: ['1'] })], capabilities).mode, 'sequential');
  assert.equal(chooseExecution([task('1'), task('2', { write: ['src/1.js'] })], capabilities).mode, 'sequential');
  assert.equal(chooseExecution([
    task('1', { resources: ['db:test'] }), task('2', { resources: ['db:test'] }),
  ], capabilities).mode, 'sequential');
});
test('delivery requires reviewed revision, passing evidence and no scope escape', () => {
  const delivery = {
    status: 'reviewed', baseRevision: 'base', revision: 'head',
    changedFiles: ['src/1.js'], evidence: [{ command: 'npm test', exitCode: 0 }],
    reviews: { spec: 'head', quality: 'head', independent: true },
  };
  assert.deepEqual(validateDelivery(task('1'), delivery), []);
  for (const change of [
    { changedFiles: ['src/outside.js'] },
    { evidence: [] },
    { evidence: [{ command: 'npm test', exitCode: 1 }] },
    { reviews: { spec: 'old-head', quality: 'head', independent: true } },
    { reviews: { spec: 'head', quality: 'head', independent: false } },
  ]) assert.ok(validateDelivery(task('1'), { ...delivery, ...change }).length > 0);
});
