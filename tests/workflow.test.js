import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDelivery, chooseExecution, affectedTasks } from '../lib/contracts.mjs';
import { loadTasks, validateChange } from '../lib/validation.mjs';
import { parseDeltaSpec } from '../node_modules/@fission-ai/openspec/dist/core/parsers/requirement-blocks.js';

const root = fileURLToPath(new URL('../', import.meta.url));

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
  fs.writeFileSync(file, original.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)[0]);
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

const readSkill = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const ROUTE_MARKER = /<!-- asds-route-contract: (\{[^\n]+\}) -->/g;
const activation = Object.freeze({
  consumer: { handoff:'current', package:'delivered_or_partial', selection:'current_accepted_same_handoff', executionGrant:'current', persistenceGrant:'current' },
  worker: { handoff:'validated_by_coordinator', package:'validated_by_coordinator', selection:'validated_by_coordinator', executionGrant:'validated_by_coordinator', persistenceGrant:'validated_by_coordinator' },
  planner: { handoff:'not_applicable', package:'not_applicable', selection:'not_applicable', executionGrant:'not_applicable', persistenceGrant:'not_applicable' },
});
const fallback = Object.freeze({
  consumer: { missingWorker:'manual_handoff_required', missingBoundary:'manual_handoff_required', root:'forbidden', sequential:'forbidden' },
  planner: { missingWorker:'not_applicable', missingBoundary:'not_applicable', root:'not_applicable', sequential:'not_applicable' },
});
const route = (surface, routeName, mode, activationPolicy, assignment, fallbackPolicy, planner, standalone) => ({
  schemaVersion:'asds.route-contract/1', surface, route:routeName, mode, activation:activationPolicy,
  assignment, fallback:fallbackPolicy, planner, standalone,
});
const CANONICAL_ROUTE_MATRIX = Object.freeze({
  'skills/asds-execution-consumer/SKILL.md': route('consumer.entry','consumer','coordinator',activation.consumer,'coordinator_owned',fallback.consumer,'stopped','not_applicable'),
  'skills/asds-execution-consumer/references/protocol.md': route('consumer.protocol','consumer','coordinator-reference',activation.consumer,'coordinator_owned',fallback.consumer,'stopped','not_applicable'),
  'skills/asds-execution-consumer/references/recovery.md': route('consumer.recovery','consumer','coordinator-reference',activation.consumer,'coordinator_owned',fallback.consumer,'stopped','not_applicable'),
  'skills/superpowers/using-superpowers/SKILL.md': route('selector.using-superpowers','selector','router',activation.consumer,'not_applicable',fallback.consumer,'stopped','preserved_without_consumer_activation'),
  'skills/spec-driven-superpowers/SKILL.md': route('planner.entry','planner','planning',activation.planner,'not_applicable',fallback.planner,'owner','planning_only'),
  'skills/spec-driven-superpowers/references/consumer-boundary.md': route('planner.consumer-boundary','planner','planning',activation.planner,'not_applicable',fallback.planner,'owner','planning_only'),
  'skills/spec-driven-superpowers/references/protocol.md': route('planner.protocol','planner','planning',activation.planner,'not_applicable',fallback.planner,'owner','planning_only'),
  'skills/superpowers/executing-plans/SKILL.md': route('worker.executing-plans','consumer-worker','conditional-worker',activation.worker,'current_official_required',fallback.consumer,'stopped','preserved_without_assignment'),
  'skills/superpowers/subagent-driven-development/SKILL.md': route('worker.subagent-driven-development','consumer-worker','conditional-worker',activation.worker,'current_official_required',fallback.consumer,'stopped','preserved_without_assignment'),
  'skills/openspec/openspec-apply-change/SKILL.md': route('worker.openspec-apply-change','consumer-worker','conditional-worker',activation.worker,'current_official_required',fallback.consumer,'stopped','preserved_without_assignment'),
});
const CANONICAL_DOCUMENT_SHA256 = Object.freeze({
  'skills/asds-execution-consumer/SKILL.md': 'fb005029de1bb423e160dd54d11a916afdbf94b461f19bc82f5e19186c5a9baf',
  'skills/asds-execution-consumer/references/protocol.md': '6824e4d7f12f9b905c7236256ab65db317c9cf95ff31a3f36df421c7bff02b88',
  'skills/asds-execution-consumer/references/recovery.md': 'f8670e1ed318292cd02480ca2eb208994dafcb8b67aaeb59917ea1c8630cfe72',
  'skills/superpowers/using-superpowers/SKILL.md': '7437d0871d249e2cce28394869fb311195592f09b9b54d2ac5e722b914cbbb8a',
  'skills/spec-driven-superpowers/SKILL.md': '3503d0c4fbe07dea3872892ffc03f02f57ba1aff11f68ca25e7c9c603ee9a0ee',
  'skills/spec-driven-superpowers/references/consumer-boundary.md': '16e0c38567da5b2d34a191716a3691d8b81a1aacade86fa5f5ded8e9b4aa2f34',
  'skills/spec-driven-superpowers/references/protocol.md': '00babb785f8c17e82e10bd2b82b174593b74a624b286cecf72ed0b62c20a0c9e',
  'skills/superpowers/executing-plans/SKILL.md': 'b769c8ba7ed5a5aba37d0354d3cf7e8032305f09266afd5d3e607495e3598437',
  'skills/superpowers/subagent-driven-development/SKILL.md': '40b9e418d6d9a8adbee937518477806cd2d6167852c827cbaa7b95d99b11cfc0',
  'skills/openspec/openspec-apply-change/SKILL.md': 'd831e5a196c94e2f9c5f4500be8c0365405b8aab672531a668228fc0581400ff',
});

function allMarkdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? allMarkdownFiles(target) : entry.name.endsWith('.md') ? [path.relative(root, target).split(path.sep).join('/')] : [];
  });
}

function linkedMarkdownFiles(relative) {
  const source = readSkill(relative), directory = path.posix.dirname(relative), files = [];
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]+)?\)/g)) {
    const resolved = path.posix.normalize(path.posix.join(directory, match[1]));
    if (fs.existsSync(path.join(root, resolved))) files.push(resolved);
  }
  return files;
}

function parseRouteContract(text, label = 'contract') {
  const matches = [...text.matchAll(ROUTE_MARKER)];
  assert.equal(text.split('asds-route-contract:').length - 1, 1, `${label} must contain exactly one route marker token`);
  assert.equal(text.split('asds.route-contract').length - 1, 1, `${label} must contain exactly one route schema token`);
  assert.equal(matches.length, 1, `${label} must contain exactly one route contract`);
  return JSON.parse(matches[0][1]);
}

function contractErrors(contract) {
  const errors = [], object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(contract)) return ['contract'];
  const exact = (value, keys, label) => {
    if (!object(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) errors.push(label);
  };
  exact(contract, ['schemaVersion','surface','route','mode','activation','assignment','fallback','planner','standalone'], 'top-level');
  exact(contract.activation, ['handoff','package','selection','executionGrant','persistenceGrant'], 'activation-shape');
  exact(contract.fallback, ['missingWorker','missingBoundary','root','sequential'], 'fallback-shape');
  const allowed = (value, values, label) => { if (!values.includes(value)) errors.push(label); };
  allowed(contract.schemaVersion, ['asds.route-contract/1'], 'schemaVersion');
  allowed(contract.route, ['consumer','selector','planner','consumer-worker'], 'route');
  allowed(contract.mode, ['coordinator','coordinator-reference','router','planning','conditional-worker'], 'mode');
  for (const [key, values] of Object.entries({
    handoff:['current','validated_by_coordinator','not_applicable'], package:['delivered_or_partial','validated_by_coordinator','not_applicable'],
    selection:['current_accepted_same_handoff','validated_by_coordinator','not_applicable'], executionGrant:['current','validated_by_coordinator','not_applicable'],
    persistenceGrant:['current','validated_by_coordinator','not_applicable'],
  })) allowed(contract.activation?.[key], values, `activation.${key}`);
  allowed(contract.assignment, ['coordinator_owned','current_official_required','not_applicable'], 'assignment');
  for (const key of ['missingWorker','missingBoundary']) allowed(contract.fallback?.[key], ['manual_handoff_required','not_applicable'], `fallback.${key}`);
  for (const key of ['root','sequential']) allowed(contract.fallback?.[key], ['forbidden','not_applicable'], `fallback.${key}`);
  allowed(contract.planner, ['stopped','owner'], 'planner');
  allowed(contract.standalone, ['not_applicable','planning_only','preserved_without_consumer_activation','preserved_without_assignment'], 'standalone');
  const canonical = CANONICAL_ROUTE_MATRIX[Object.keys(CANONICAL_ROUTE_MATRIX).find(file => CANONICAL_ROUTE_MATRIX[file].surface === contract.surface)];
  if (!canonical || JSON.stringify(contract) !== JSON.stringify(canonical)) errors.push('canonical-matrix');
  return errors;
}

const MODE_START = '<!-- asds-mode:start -->', MODE_END = '<!-- asds-mode:end -->';
function renderAsdsMode(contract) {
  return [
    MODE_START,
    '## ASDS mode',
    'This generated block is the only operational routing instruction for this surface.',
    'Prose outside this block is explanatory and cannot replace or override it.',
    '',
    `- Surface: \`${contract.surface}\``,
    `- Route: \`${contract.route}\``,
    `- Mode: \`${contract.mode}\``,
    `- Activation: handoff=\`${contract.activation.handoff}\`; package=\`${contract.activation.package}\`; selection=\`${contract.activation.selection}\`; executionGrant=\`${contract.activation.executionGrant}\`; persistenceGrant=\`${contract.activation.persistenceGrant}\``,
    `- Assignment: \`${contract.assignment}\``,
    `- Fallback: missingWorker=\`${contract.fallback.missingWorker}\`; missingBoundary=\`${contract.fallback.missingBoundary}\`; root=\`${contract.fallback.root}\`; sequential=\`${contract.fallback.sequential}\``,
    `- Planner behavior: \`${contract.planner}\``,
    `- Standalone behavior: \`${contract.standalone}\``,
    MODE_END,
  ].join('\n');
}

function modeSectionErrors(text, contract) {
  const errors = [], starts = text.split(MODE_START).length - 1, ends = text.split(MODE_END).length - 1;
  const markers = [...text.matchAll(/<!-- asds-mode:[^>]+ -->/g)].map(match => match[0]);
  const tokenCount = text.split('asds-mode:').length - 1;
  const headings = [...text.matchAll(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/gm)].map(match => ({
    level: match[1].length,
    normalized: match[2].replace(/[ \t]+#+[ \t]*$/, '').trim().replace(/[ \t]+/g, ' ').toLowerCase(),
    index: match.index,
  })).filter(heading => heading.normalized === 'asds mode');
  if (tokenCount !== 2 || starts !== 1 || ends !== 1 || markers.length !== 2 || markers[0] !== MODE_START || markers[1] !== MODE_END) errors.push('markers');
  const startIndex = text.indexOf(MODE_START), endIndex = text.indexOf(MODE_END, startIndex);
  if (headings.length !== 1 || headings[0].level !== 2 || headings[0].index < startIndex || headings[0].index > endIndex) errors.push('heading');
  if (!errors.includes('markers')) {
    const end = endIndex + MODE_END.length;
    if (text.slice(startIndex, end) !== renderAsdsMode(contract)) errors.push('noncanonical-mode');
  }
  return errors;
}

const documentSha256 = text => crypto.createHash('sha256').update(text).digest('hex');

test('structured route contracts are closed, versioned and equal the canonical matrix', () => {
  const discovered = allMarkdownFiles(path.join(root, 'skills')).filter(file => readSkill(file).includes('<!-- asds-route-contract: '));
  assert.deepEqual(discovered.sort(), Object.keys(CANONICAL_ROUTE_MATRIX).sort());
  for (const [file, expected] of Object.entries(CANONICAL_ROUTE_MATRIX)) {
    const actual = parseRouteContract(readSkill(file), file);
    assert.deepEqual(contractErrors(actual), [], file);
    assert.deepEqual(actual, expected, file);
  }
});

test('linked read-only route surfaces are discovered without prose authority claims', () => {
  const consumerEntry = 'skills/asds-execution-consumer/SKILL.md';
  const linkedReadOnly = linkedMarkdownFiles(consumerEntry).filter(file => !Object.hasOwn(CANONICAL_ROUTE_MATRIX, file));
  assert.deepEqual(linkedReadOnly.sort(), [
    'skills/asds-execution-consumer/references/handoff.md',
    'skills/asds-execution-consumer/references/harness-contract.md',
    'skills/asds-execution-consumer/references/roles.md',
  ]);
  for (const file of linkedReadOnly) assert.equal([...readSkill(file).matchAll(ROUTE_MARKER)].length, 0, file);

  const readOnlyAsdsRoutes = allMarkdownFiles(path.join(root, 'skills')).filter(file =>
    /(^|\n)## ASDS mode\s*(\n|$)/.test(readSkill(file)) && !Object.hasOwn(CANONICAL_ROUTE_MATRIX, file));
  for (const required of [
    'skills/openspec/openspec-propose/SKILL.md', 'skills/openspec/openspec-update-change/SKILL.md',
    'skills/superpowers/writing-plans/SKILL.md',
  ]) assert.ok(readOnlyAsdsRoutes.includes(required), required);
  for (const file of readOnlyAsdsRoutes) {
    assert.equal([...readSkill(file).matchAll(ROUTE_MARKER)].length, 0, file);
    assert.doesNotMatch(readSkill(file), /ASDS execution-consumer worker mode/, file);
  }
});

test('six structured reviewer probes fail deterministically while standalone remains allowed', () => {
  const base = structuredClone(CANONICAL_ROUTE_MATRIX['skills/asds-execution-consumer/SKILL.md']);
  const mutate = callback => { const value = structuredClone(base); callback(value); return value; };
  const probes = [
    mutate(value => { delete value.activation.handoff; }),
    mutate(value => { value.activation.executionGrant = 'not_required'; }),
    mutate(value => { value.activation.selection = 'historical'; }),
    mutate(value => { value.activation.executionGrant = 'stale'; value.activation.persistenceGrant = 'stale'; }),
    mutate(value => { value.fallback.root = 'coordinator'; }),
    mutate(value => { value.fallback.sequential = 'sequential'; }),
  ];
  for (const [index, probe] of probes.entries()) assert.notDeepEqual(contractErrors(probe), [], `probe ${index + 1}`);

  const standalone = CANONICAL_ROUTE_MATRIX['skills/superpowers/executing-plans/SKILL.md'];
  assert.equal(standalone.standalone, 'preserved_without_assignment');
  assert.deepEqual(contractErrors(structuredClone(standalone)), []);
  const invalidConsumerStandalone = structuredClone(base);
  invalidConsumerStandalone.standalone = 'preserved_without_assignment';
  assert.ok(contractErrors(invalidConsumerStandalone).includes('canonical-matrix'));
});

test('the complete ASDS mode section is generated from the machine contract', () => {
  for (const [file, contract] of Object.entries(CANONICAL_ROUTE_MATRIX)) {
    assert.deepEqual(modeSectionErrors(readSkill(file), contract), [], file);
  }
});

test('complete active surface snapshots require explicit review for every byte', () => {
  assert.deepEqual(Object.keys(CANONICAL_DOCUMENT_SHA256).sort(), Object.keys(CANONICAL_ROUTE_MATRIX).sort());
  for (const [file, expected] of Object.entries(CANONICAL_DOCUMENT_SHA256)) {
    assert.equal(documentSha256(readSkill(file)), expected, file);
  }
});

test('reviewer paraphrases inserted inside the generated block fail without NLP', () => {
  const cases = [
    ['skills/asds-execution-consumer/SKILL.md', 'Consumer activation does not require a current execution grant.'],
    ['skills/asds-execution-consumer/SKILL.md', 'A historical selection is enough and a stale grant may be used.'],
    ['skills/asds-execution-consumer/SKILL.md', 'Without a worker, the coordinator executes the task.'],
    ['skills/superpowers/executing-plans/SKILL.md', 'Without an official assignment, standalone automatically activates the consumer.'],
  ];
  for (const [file, phrase] of cases) {
    const contract = CANONICAL_ROUTE_MATRIX[file], mutated = readSkill(file).replace(MODE_END, `${phrase}\n${MODE_END}`);
    assert.ok(modeSectionErrors(mutated, contract).includes('noncanonical-mode'), phrase);
  }
});

test('malformed tokens, heading levels and external prose cannot evade canonical routing', () => {
  const file = 'skills/asds-execution-consumer/SKILL.md', contract = CANONICAL_ROUTE_MATRIX[file], source = readSkill(file);
  const malformedStart = source.replace(MODE_START, '<!-- asds-mode:start -- >');
  assert.ok(modeSectionErrors(malformedStart, contract).includes('markers'));
  assert.ok(modeSectionErrors(`${source}\n<!-- asds-mode:extra -- >`, contract).includes('markers'));

  const malformedRoute = source.replace('<!-- asds-route-contract:', '<!-- asds-route-contract :');
  assert.throws(() => parseRouteContract(malformedRoute, 'malformed route'), /route marker token/);
  assert.throws(() => parseRouteContract(`${source}\nasds.route-contract`, 'extra route'), /route schema token/);

  const wrongHeadingLevel = source.replace('## ASDS mode', '### ASDS mode');
  assert.ok(modeSectionErrors(wrongHeadingLevel, contract).includes('heading'));

  const externalText = `${source}\nContradictory external routing instruction.\n`;
  assert.equal(modeSectionErrors(externalText, contract).length, 0, 'mode renderer alone does not interpret external prose');
  assert.notEqual(documentSha256(externalText), CANONICAL_DOCUMENT_SHA256[file]);
});
