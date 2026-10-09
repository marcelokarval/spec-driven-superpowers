import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlanningCoverage, renderPlanningCoverage } from '../lib/planning-coverage.mjs';

// Explicit source inventory includes the exception separately; a scenario ID alone
// cannot silently discharge an exception, prohibition or preservation requirement.
function fixture() {
  return {
    requirements: [
      { id: 'R-positive', kind: 'obligation', source: 'brief.md#S01', text: 'Accept nonnegative values.' },
      { id: 'R-zero', kind: 'exception', source: 'brief.md#S01', text: 'Zero is valid, exactly; do not reject it.' },
      { id: 'R-no-write', kind: 'negative', source: 'brief.md#S02', text: 'Never write the source.' },
      { id: 'R-id', kind: 'preservation', source: 'brief.md#S02', text: 'Preserve identifiers exactly.' },
    ],
    decisions: [{ id: 'D-read', source: 'brief.md#D01', owner: 'owner', reason: 'Given rule', material: true,
      status: 'resolved', requirementIds: ['R-no-write'], rejectsRequirementIds: [], alternatives: [] }],
    scenarios: [{ id: 'S-values' }, { id: 'S-read' }],
    tasks: [
      { id: 'P', nodeType: 'package', parentId: null, requirements: ['R-positive', 'R-zero', 'R-no-write', 'R-id'] },
      { id: 'P-child', nodeType: 'package', parentId: 'P', requirements: ['R-positive', 'R-zero'] },
      { id: '0001', nodeType: 'task', parentId: 'P-child', requirements: ['R-positive', 'R-zero'] },
      { id: '0002', nodeType: 'task', parentId: 'P', requirements: ['R-no-write', 'R-id'] },
    ],
    acceptances: [
      { id: 'A-values', taskId: '0001', text: 'Nonnegative values including exactly zero are valid.' },
      { id: 'A-read', taskId: '0002', text: 'No writes and exact identifier preservation.' },
    ],
    mappings: [
      { requirementId: 'R-positive', decisionIds: [], scenarioId: 'S-values', taskId: '0001', acceptanceId: 'A-values' },
      { requirementId: 'R-zero', decisionIds: [], scenarioId: 'S-values', taskId: '0001', acceptanceId: 'A-values' },
      { requirementId: 'R-no-write', decisionIds: ['D-read'], scenarioId: 'S-read', taskId: '0002', acceptanceId: 'A-read' },
      { requirementId: 'R-id', decisionIds: [], scenarioId: 'S-read', taskId: '0002', acceptanceId: 'A-read' },
    ],
  };
}
const errors = input => validatePlanningCoverage(input).errors.join('\n');

test('complete structural coverage remains need-review; pure and deterministic', () => {
  const input = fixture(), before = structuredClone(input);
  const result = validatePlanningCoverage(input);
  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.semanticStatus, 'need-review');
  assert.equal(result.executionPerformed, false);
  assert.deepEqual(result.errors, []);
  assert.equal(result.map.length, 4);
  assert.deepEqual(input, before);
  assert.deepEqual(validatePlanningCoverage(input), result);
  const text = renderPlanningCoverage(input);
  for (const token of ['R-zero', 'brief.md#S01', 'D-read', 'S-read', '0002', 'A-read', 'need-review']) assert.ok(text.includes(token));
});

test('correct scenario IDs without explicit exception mapping fail', () => {
  const input = fixture(); input.mappings.splice(1, 1);
  assert.match(errors(input), /Unmapped requirement: R-zero/);
  assert.match(errors(input), /0001: missing coverage for requirement R-zero/);
});

test('semantically wrong linked acceptance does not become machine certification', () => {
  const input = fixture(); input.acceptances[0].text = 'Reject zero and accept only positive values.';
  const result = validatePlanningCoverage(input);
  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.semanticStatus, 'need-review');
  assert.ok(!JSON.stringify(result).includes('PASS'));
  assert.equal(result.map[1].text, 'Zero is valid, exactly; do not reject it.');
  assert.equal(result.map[1].routes[0].acceptanceText, input.acceptances[0].text);
});

test('no prose classifier: negative requirements and arbitrary acceptance wording need review', () => {
  const input = fixture(); input.acceptances[1].text = 'x';
  assert.equal(validatePlanningCoverage(input).structuralStatus, 'valid');
  assert.equal(validatePlanningCoverage(input).semanticStatus, 'need-review');
});

for (const [label, change, pattern] of [
  ['unknown requirement', x => x.mappings[0].requirementId = 'missing', /Unknown requirement: missing/],
  ['unknown decision', x => x.mappings[2].decisionIds = ['missing'], /Unknown decision: missing/],
  ['unknown scenario', x => x.mappings[0].scenarioId = 'missing', /Unknown scenario: missing/],
  ['unknown task', x => x.mappings[0].taskId = 'missing', /Unknown task: missing/],
  ['unknown acceptance', x => x.mappings[0].acceptanceId = 'missing', /Unknown acceptance: missing/],
  ['orphan scenario', x => x.scenarios.push({ id: 'orphan' }), /Orphan scenario: orphan/],
  ['orphan acceptance', x => x.acceptances.push({ id: 'orphan', taskId: '0001', text: 'criterion' }), /Orphan acceptance: orphan/],
  ['orphan leaf', x => x.tasks.push({ id: 'orphan', nodeType: 'task', parentId: null, requirements: ['R-zero'] }), /Orphan task: orphan/],
  ['unmapped decision', x => x.mappings[2].decisionIds = [], /D-read: missing coverage for requirement R-no-write/],
  ['material owner', x => delete x.decisions[0].owner, /D-read: material decision requires owner/],
  ['decision source', x => delete x.decisions[0].source, /decisions\[0\]: source must be nonempty text/],
  ['decision reason', x => delete x.decisions[0].reason, /decisions\[0\]: reason must be nonempty text/],
  ['duplicate map', x => x.mappings.push(structuredClone(x.mappings[0])), /Duplicate mapping/],
  ['duplicate decision refs', x => x.mappings[2].decisionIds.push('D-read'), /duplicate decisionIds/],
  ['acceptance wrong task', x => x.mappings[0].acceptanceId = 'A-read', /acceptance A-read belongs to 0002, not 0001/],
  ['task wrong requirement', x => x.tasks[2].requirements = ['R-positive'], /0001: mapping for undeclared requirement R-zero/],
  ['decision wrong requirement', x => x.mappings[0].decisionIds = ['D-read'], /D-read: mapping for undeclared requirement R-positive/],
  ['given rule rejected', x => x.decisions[0].rejectsRequirementIds = ['R-no-write'], /D-read: cannot reject given requirement R-no-write/],
  ['chosen contrary alternative', x => x.decisions[0].alternatives = [{ id: 'write', status: 'selected', contradictsRequirementIds: ['R-no-write'] }], /selected alternative write contradicts given requirement R-no-write/],
  ['unknown parent', x => x.tasks[1].parentId = 'missing', /P-child: unknown parent missing/],
  ['leaf parent', x => x.tasks[1].parentId = '0002', /P-child: parent 0002 is not a package/],
  ['composition cycle', x => x.tasks[0].parentId = 'P-child', /Composition cycle/],
  ['aggregate no descendants', x => x.tasks.push({ id: 'empty', nodeType: 'package', parentId: null, requirements: ['R-zero'] }), /empty: no descendant leaf covers requirement R-zero/],
  ['aggregate unrelated descendant', x => x.tasks[1].requirements.push('R-no-write'), /P-child: no descendant leaf covers requirement R-no-write/],
  ['package mapped as leaf', x => x.mappings[0].taskId = 'P', /P: mapping target must be a leaf task/],
]) test(`reject ${label}`, () => { const input = fixture(); change(input); assert.match(errors(input), pattern); });

for (const table of ['requirements', 'decisions', 'scenarios', 'tasks', 'acceptances']) {
  test(`duplicate ${table} IDs fail`, () => {
    const input = fixture(); input[table].push(structuredClone(input[table][0]));
    assert.match(errors(input), new RegExp(`Duplicate ${table} id`));
  });
}

test('a rejected contradictory alternative preserves an already-given rule', () => {
  const input = fixture(); input.decisions[0].alternatives = [{ id: 'write', status: 'rejected', contradictsRequirementIds: ['R-no-write'] }];
  assert.equal(validatePlanningCoverage(input).structuralStatus, 'valid');
});

test('all decision/requirement pairs require routes, not just one decision ID occurrence', () => {
  const input = fixture(); input.decisions[0].requirementIds.push('R-id');
  assert.match(errors(input), /D-read: missing coverage for requirement R-id/);
  input.mappings[3].decisionIds.push('D-read');
  assert.equal(validatePlanningCoverage(input).structuralStatus, 'valid');
});

test('identifier/source preservation and decision-set order-independent duplicate detection', () => {
  const input = fixture(); input.requirements[0].source = 'given/exact#ZERO';
  input.decisions.push({ ...structuredClone(input.decisions[0]), id: 'D-second' });
  input.mappings[2].decisionIds.push('D-second');
  const result = validatePlanningCoverage(input);
  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.map[0].source, 'given/exact#ZERO');
  input.mappings.push({ ...input.mappings[2], decisionIds: ['D-second', 'D-read'] });
  assert.match(errors(input), /Duplicate mapping/);
});

for (const malformed of [null, [], {}, { requirements: null }, { requirements: [null] }]) {
  test(`malformed input fails closed: ${JSON.stringify(malformed)}`, () => {
    const result = validatePlanningCoverage(malformed);
    assert.equal(result.structuralStatus, 'invalid');
    assert.equal(result.semanticStatus, 'need-review');
    assert.ok(result.errors.length);
    assert.doesNotThrow(() => renderPlanningCoverage(malformed));
  });
}

test('malformed nested values never accidentally throw', () => {
  for (const table of ['requirements', 'decisions', 'scenarios', 'tasks', 'acceptances', 'mappings']) {
    for (const bad of [null, 7, [], {}, { id: 'bad', requirementIds: null, decisionIds: 0 }]) {
      const input = fixture(); input[table].push(bad);
      assert.equal(validatePlanningCoverage(input).structuralStatus, 'invalid');
    }
  }
});

test('empty inventories and unknown requirement declarations fail closed', () => {
  const input = fixture(); input.requirements = [];
  assert.match(errors(input), /requirements must be a nonempty array/);
  const wrong = fixture(); wrong.tasks[0].requirements.push('unknown');
  assert.match(errors(wrong), /P: unknown requirement unknown/);
});

test('malformed mapping identifiers including non-JSON values fail closed', () => {
  const circular = {}; circular.self = circular;
  for (const value of [1n, Symbol('bad'), circular, null, []]) {
    const input = fixture(); input.mappings[0].requirementId = value;
    assert.equal(validatePlanningCoverage(input).structuralStatus, 'invalid');
    assert.doesNotThrow(() => renderPlanningCoverage(input));
  }
});

test('invalid decision IDs cannot crash ownership/alternative diagnostics', () => {
  for (const id of [Symbol('invalid'), 1n, null, {}]) {
    const input = fixture(); input.decisions[0].id = id; delete input.decisions[0].owner;
    assert.equal(validatePlanningCoverage(input).structuralStatus, 'invalid');
  }
});

test('pending decisions retain manifest status and never imply approval', () => {
  const input = fixture(); input.decisions[0].status = 'pending';
  const result = validatePlanningCoverage(input);
  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.semanticStatus, 'need-review');
  assert.equal(result.map[2].routes[0].decisions[0].status, 'pending');
});

test('a simple leaf needs neither artificial packages nor decisions', () => {
  const input = fixture(); input.decisions = [];
  input.mappings[2].decisionIds = [];
  input.tasks = input.tasks.filter(x => x.nodeType === 'task').map(x => ({ ...x, parentId: null }));
  assert.equal(validatePlanningCoverage(input).structuralStatus, 'valid');
});

test('malformed and duplicate decision alternative declarations fail closed', () => {
  const input = fixture(); input.decisions[0].alternatives = [{ id: 'x', status: 'rejected', contradictsRequirementIds: [] }, { id: 'x', status: 'rejected', contradictsRequirementIds: [] }];
  assert.match(errors(input), /duplicate alternative x/);
  input.decisions[0].alternatives = [null];
  assert.match(errors(input), /alternatives\[0\] must be an object/);
  input.decisions[0].alternatives = [{ id: 'x', status: 'rejected', contradictsRequirementIds: ['unknown'] }];
  assert.match(errors(input), /alternative x has unknown requirement unknown/);
});

test('nonmaterial decisions still require explicit provenance and declared materiality', () => {
  const input = fixture(); input.decisions[0].material = false; delete input.decisions[0].owner;
  assert.equal(validatePlanningCoverage(input).structuralStatus, 'valid');
  delete input.decisions[0].material;
  assert.match(errors(input), /material must be boolean/);
});
