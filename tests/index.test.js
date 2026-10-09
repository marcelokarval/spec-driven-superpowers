import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackage, validateLocalLinks, parseMapping } from '../lib/validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
test('package skills and workflow are semantically valid', () => {
  assert.deepEqual(validatePackage(root), []);
});
test('portable skill references resolve in the source tree', () => {
  const base = 'skills/spec-driven-superpowers';
  const files = [`${base}/SKILL.md`, ...fs.readdirSync(path.join(root, base, 'references'))
    .filter(name => name.endsWith('.md')).map(name => `${base}/references/${name}`)];
  assert.deepEqual(validateLocalLinks(root, files), []);
});
test('ASDS has a single source and portable wrappers exist', () => {
  assert.equal(fs.existsSync(path.join(root, 'skills/superpowers/spec-driven-superpowers/SKILL.md')), false);
  for (const file of ['scripts/install.sh', 'scripts/install.ps1', 'scripts/install.mjs', 'scripts/validate.mjs']) {
    assert.ok(fs.statSync(path.join(root, file)).size > 0);
  }
});
test('self-contained planning entry ships every required local reference and no sibling checkout dependency', () => {
  const skill = fs.readFileSync(path.join(root, 'skills/spec-driven-superpowers/SKILL.md'), 'utf8');
  assert.match(skill, /self-contained planning product/i);
  assert.doesNotMatch(skill, /Backup\/Projetos|\.\.\/\.\.\/accelerate/);
  for (const file of ['lib/planning-graph.mjs', 'lib/planning-coverage.mjs', 'lib/planning-lifecycle.mjs',
    'lib/planning-review.mjs', 'lib/planning-store.mjs', 'lib/handoff.mjs',
    'schemas/superpowers-bridge/schema.yaml', 'vendor-provenance.json']) {
    assert.ok(fs.statSync(path.join(root, file)).isFile(), file);
  }
});
test('schema apply gate tracks the master task index and requires its reviewed projection', () => {
  const schema = parseMapping(fs.readFileSync(path.join(root, 'schemas/superpowers-bridge/schema.yaml'), 'utf8'));
  assert.equal(schema.apply.tracks, 'tasks.md');
  assert.deepEqual(schema.apply.requires, ['tasks', 'planning-manifest']);
  assert.deepEqual(schema.artifacts.map(artifact => artifact.id), [
    'proposal', 'specs', 'design', 'microcontracts', 'tasks', 'summary', 'planning-manifest',
  ]);
});

test('project documentation links and prepared eval scenarios remain valid', () => {
  assert.deepEqual(validateLocalLinks(root, ['README.md', 'docs/architecture.md', 'docs/provenance.md']), []);
  const scenarios = JSON.parse(fs.readFileSync(path.join(root, 'skills/spec-driven-superpowers/evals/evals.json'), 'utf8'));
  assert.equal(scenarios.execution_status, 'prepared_not_run');
  assert.equal(new Set(scenarios.evals.map(item => item.id)).size, scenarios.evals.length);
  for (const item of scenarios.evals) {
    assert.ok(item.prompt && item.expected_output && item.assertions.length);
    for (const file of item.files) assert.ok(fs.existsSync(path.join(root, file)));
  }
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'vendor-provenance.json'), 'utf8'));
  assert.match(provenance.sourceRevision, /^[0-9a-f]{40}$/);
  assert.ok(provenance.files.length > 0);
  for (const entry of provenance.files) {
    if (entry.path === 'skills/superpowers/spec-driven-superpowers/SKILL.md') continue;
    assert.ok(fs.existsSync(path.join(root, entry.path)), `Missing captured resource: ${entry.path}`);
  }
});
