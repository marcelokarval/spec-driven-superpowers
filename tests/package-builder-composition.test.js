// Synthetic unit fixtures; no native review sessions or operational delivery claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { buildPlanningPackage, syncPlanningPackage, reconcilePackageHierarchy, renderTaskContractMarkdown } from '../lib/package-builder.mjs';

function readContract(root, id) {
  const source = fs.readFileSync(path.join(root, `tasks/task-${id}.md`), 'utf8');
  return { source, fm: parse(source.match(/^---\n([\s\S]*?)\n---/)[1]) };
}

test('synthetic nested packages keep aggregated prose and YAML coherent through build and resync', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-composition-'));
  try {
    const result = buildPlanningPackage(root, { packageId: 'synthetic-composition', tasks: [
      { id: '1', title: 'Root composition', nodeType: 'package', verification: ['npm test'] },
      { id: '2', title: 'Nested composition', nodeType: 'package', parentId: '1', sections: { acceptance: '- Custom acceptance: preserve this exact prose.' } },
      { id: '3', title: 'Leaf', nodeType: 'task', parentId: '2', write: ['src/old.js'], resources: ['db:old'], scenarios: ['demo/Old'], requirements: ['Old'], verification: ['node --test'] },
    ] });
    const leafBefore = readContract(root, '3').source;
    for (const id of ['1', '2']) {
      const { source, fm } = readContract(root, id);
      assert.deepEqual(fm.write, ['src/old.js']);
      assert.match(source, /non-executable composition/);
      assert.match(source, /Aggregated files[^\n]*`src\/old.js`/);
      assert.match(source, /Aggregated resources[^\n]*`db:old`/);
      assert.doesNotMatch(source, /none \(read-only\)|exit code 0/);
      assert.doesNotMatch(source, /- `npm test`/);
    }
    assert.match(readContract(root, '2').source, /Custom acceptance: preserve this exact prose/);
    assert.match(leafBefore, /All verification commands pass with exit code 0/);
    assert.deepEqual(reconcilePackageHierarchy(root), []);
    const noOp = syncPlanningPackage(root).manifest;
    assert.equal(noOp.candidateSha256, result.manifest.candidateSha256);
    const leaf = readContract(root, '3');
    leaf.fm.write = ['src/new.js']; leaf.fm.resources = ['db:new'];
    leaf.fm.scenarios = ['demo/New']; leaf.fm.requirements = ['New'];
    fs.writeFileSync(path.join(root, 'tasks/task-3.md'), leaf.source.replace(/^---\n[\s\S]*?\n---/, `---\n${stringify(leaf.fm).trimEnd()}\n---`));
    const changed = syncPlanningPackage(root, { revision: 'r2' }).manifest;
    assert.equal(changed.revision, 'r2');
    assert.notEqual(changed.candidateSha256, noOp.candidateSha256);
    for (const id of ['1', '2']) {
      const { source, fm } = readContract(root, id);
      assert.deepEqual(fm.write, ['src/new.js']);
      assert.match(source, /Aggregated files[^\n]*`src\/new.js`/);
      assert.doesNotMatch(source, /src\/old.js|db:old|demo\/Old/);
      const reference = changed.references.find(r => r.id === `task:${id}`);
      assert.equal(reference?.sha256, createHash('sha256').update(source).digest('hex'));
    }
    assert.match(readContract(root, '2').source, /Custom acceptance: preserve this exact prose/);
    assert.equal(syncPlanningPackage(root).manifest.candidateSha256, changed.candidateSha256);
    assert.deepEqual(reconcilePackageHierarchy(root), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('legacy generated package defaults migrate while custom sections and leaf bytes survive', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-composition-legacy-'));
  try {
    fs.mkdirSync(path.join(root, 'tasks'));
    const legacy = renderTaskContractMarkdown({ id: '1', title: 'Legacy parent', nodeType: 'task' })
      .replace('nodeType: task', 'nodeType: package');
    const custom = renderTaskContractMarkdown({ id: '2', title: 'Custom parent', nodeType: 'package', parentId: '1',
      sections: {
        outcome: 'Custom outcome.', scopeAndDependencies: 'Custom scope caveat.', inputs: 'Custom inputs.',
        acceptance: 'Custom acceptance.', verification: 'Custom verification.', definitionOfDone: 'Custom aggregation DoD.',
      },
      boundary: { change: 'Custom boundary', target: 'Custom target' },
    }) + '\n## Author notes\nPreserve exact notes.\n';
    const leaf = renderTaskContractMarkdown({ id: '3', title: 'Leaf', nodeType: 'task', parentId: '2',
      write: ['src/a.js'], resources: ['service:a'], scenarios: ['demo/A'], requirements: ['A'], verification: ['node --test'],
    });
    fs.writeFileSync(path.join(root, 'tasks/task-1.md'), legacy);
    fs.writeFileSync(path.join(root, 'tasks/task-2.md'), custom);
    fs.writeFileSync(path.join(root, 'tasks/task-3.md'), leaf);
    syncPlanningPackage(root);
    const migrated = readContract(root, '1');
    assert.match(migrated.source, /non-executable composition/);
    assert.doesNotMatch(migrated.source, /none \(read-only\)|exit code 0|Execute bounded change/);
    assert.match(migrated.source, /Aggregated files: `src\/a.js`/);
    const preserved = readContract(root, '2');
    for (const text of ['Custom outcome.', 'Custom scope caveat.', 'Custom inputs.', 'Custom acceptance.', 'Custom verification.', 'Custom aggregation DoD.', '## Author notes\nPreserve exact notes.']) {
      assert.ok(preserved.source.includes(text), text);
    }
    assert.deepEqual(preserved.fm.boundary, { change: 'Custom boundary', target: 'Custom target' });
    assert.equal(readContract(root, '3').source, leaf);
    assert.deepEqual(reconcilePackageHierarchy(root), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('existing reconciler compatibility promotes a parent with children, not unrelated leaves', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-composition-compat-'));
  try {
    const result = buildPlanningPackage(root, { tasks: [
      { id: '1', title: 'Legacy implicit parent' },
      { id: '2', title: 'Child', nodeType: 'task', parentId: '1', write: ['src/a.js'] },
      { id: '3', title: 'Unrelated leaf', nodeType: 'task', write: [] },
    ] });
    assert.equal(result.manifest.tasks.find(task => task.id === '1').nodeType, 'package');
    assert.match(readContract(root, '1').source, /non-executable composition/);
    assert.equal(result.manifest.tasks.find(task => task.id === '3').nodeType, 'task');
    assert.match(readContract(root, '3').source, /none \(read-only\)/);
    assert.deepEqual(reconcilePackageHierarchy(root), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('leaf rendering retains executable contract semantics', () => {
  const text = renderTaskContractMarkdown({ id: 'leaf', title: 'Leaf', write: ['src/a.js'], verification: ['node --test'] });
  assert.match(text, /Write scope: `src\/a.js`/);
  assert.match(text, /exit code 0/);
  assert.doesNotMatch(text, /non-executable composition/);
});

for (const fence of ['```', '~~~~']) {
  test(`custom fenced markers and headings stay byte-exact (${fence})`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-composition-fence-'));
    try {
      const custom = ['Custom verification example:', `${fence}html`,
        '<!-- asds:package-composition -->', 'KEEP CUSTOM EXAMPLE',
        '## Inputs', '- Scenarios: inherited from child contracts.',
        '<!-- /asds:package-composition -->', fence, 'End custom verification.'].join('\n');
      buildPlanningPackage(root, { tasks: [
        { id: '1', title: 'Parent', nodeType: 'package', sections: { verification: custom } },
        { id: '2', title: 'Leaf', nodeType: 'task', parentId: '1', write: ['src/a.js'] },
      ] });
      const assertBody = file => {
        const source = readContract(root, '1').source;
        assert.ok(source.includes(`## Verification\n${custom}\n\n## Definition of done`));
        assert.ok(source.slice(source.lastIndexOf('<!-- asds:package-composition -->')).includes('Aggregated files: `' + file + '`'));
      };
      assertBody('src/a.js');
      const leaf = readContract(root, '2');
      leaf.fm.write = ['src/b.js'];
      fs.writeFileSync(path.join(root, 'tasks/task-2.md'), leaf.source.replace(/^---\n[\s\S]*?\n---/, `---\n${stringify(leaf.fm).trimEnd()}\n---`));
      syncPlanningPackage(root);
      assertBody('src/b.js');
      const before = readContract(root, '1').source;
      assert.deepEqual(reconcilePackageHierarchy(root), []);
      assert.equal(readContract(root, '1').source, before);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('ambiguous unfenced regions fail closed without rewriting custom prose or persisted state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-composition-ambiguous-'));
  try {
    buildPlanningPackage(root, { tasks: [
      { id: '1', title: 'Parent', nodeType: 'package' },
      { id: '2', title: 'Leaf', nodeType: 'task', parentId: '1', write: ['src/a.js'] },
    ] });
    const original = readContract(root, '1').source;
    const manifestPath = path.join(root, 'planning-manifest.json');
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const leaf = readContract(root, '2').source;
    const variants = [
      original + '\n<!-- asds:package-composition -->\nKEEP CUSTOM EXAMPLE\n<!-- /asds:package-composition -->\n',
      original.replace('<!-- /asds:package-composition -->', ''),
      original.replace('## Package composition', '## Package composition\nKEEP CUSTOM EXAMPLE'),
      original + '\n## Inputs\nKEEP CUSTOM EXAMPLE\n',
      original + '\n```html\nKEEP CUSTOM EXAMPLE\n',
    ];
    for (const source of variants) {
      fs.writeFileSync(path.join(root, 'tasks/task-1.md'), source);
      assert.throws(() => syncPlanningPackage(root), /ambiguous package/);
      assert.equal(readContract(root, '1').source, source);
      assert.equal(readContract(root, '2').source, leaf);
      assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifest);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
