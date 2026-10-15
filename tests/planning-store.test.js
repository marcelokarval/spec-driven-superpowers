import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishPlanningBundle, readPlanningBundle, PLANNING_RECEIPT_VERSION } from '../lib/planning-store.mjs';

const bundle = revision => ({ revision, files: [
  { path: 'planning-manifest.json', content: JSON.stringify({ revision }) },
  { path: 'tasks.md', content: `# ${revision}\n` },
] });
test('publication verifies revision, readback and idempotent explicit replacement', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-store-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const receipt = publishPlanningBundle(root, bundle('r1'));
  assert.equal(receipt.status, 'matched');
  assert.equal(receipt.schemaVersion, PLANNING_RECEIPT_VERSION);
  assert.equal(receipt.destination, path.resolve(root));
  assert.equal(receipt.manifest.path, 'planning-manifest.json');
  assert.equal(receipt.index.path, 'tasks.md');
  assert.equal(readPlanningBundle(root, ['planning-manifest.json', 'tasks.md']).revision, 'r1');
  assert.equal(publishPlanningBundle(root, bundle('r2'), { expectedRevision: 'r1' }).revision, 'r2');
  assert.throws(() => publishPlanningBundle(root, bundle('r3'), { expectedRevision: 'r1' }), /conflict/);
});
test('ordinary failure restores the previous coherent planning package and cleans temporaries', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-store-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  publishPlanningBundle(root, bundle('r1'));
  assert.throws(() => publishPlanningBundle(root, bundle('r2'), { expectedRevision: 'r1', failAfter: 1 }), /prior planning restored/);
  assert.equal(readPlanningBundle(root, ['planning-manifest.json', 'tasks.md']).revision, 'r1');
  assert.equal(fs.readdirSync(root).some(name => name.startsWith('.asds-write-')), false);
});
