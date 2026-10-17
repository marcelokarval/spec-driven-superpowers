import test from 'node:test';
import assert from 'node:assert/strict';
import { receiveHandoff, acceptWork, declineWork, continueWork, createReturn, createPlanningReturn } from '../lib/handoff.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { planningCandidateSha256, planningReadbackSha256 } from '../lib/planning-lifecycle.mjs';
import { publishPlanningBundle, verifyPlanningReceipt, REVIEW_RECEIPT_VERSION, createPlanningReviewAuthority, hostCompletePlanningReview } from '../lib/planning-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const packet = () => ({
  objective: 'Adicionar exportação', project: '/project', scope: ['exportação'],
  constraints: ['sem publicação'], risks: ['formato indefinido'], references: [],
  authorizations: [{ action: 'openspec.init', scope: '/project', decision: 'denied', source: 'user turn 2' }],
});

test('legacy Accelerate packet is received without granting execution or losing refusal', () => {
  const input = packet();
  const received = receiveHandoff(input);
  assert.equal(received.state, 'received');
  assert.equal(received.executionAuthorized, false);
  assert.deepEqual(received.context, input);
  input.authorizations[0].decision = 'granted';
  assert.equal(received.context.authorizations[0].decision, 'denied');
});

test('acceptance can retain a blocker; resumption retains ownership and context', () => {
  const accepted = acceptWork(receiveHandoff(packet()), { gaps: ['Qual formato?'] });
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.owner, 'asds');
  assert.equal(accepted.executionAuthorized, false);
  assert.deepEqual(continueWork(accepted), accepted);
  assert.deepEqual(acceptWork(accepted).gaps, accepted.gaps);
  const changed = continueWork(accepted, { affectedTasks: ['0002'], reason: 'Formato mudou' });
  assert.equal(changed.state, 'needs-reassessment');
  assert.deepEqual(changed.affectedTasks, ['0002']);
  assert.deepEqual(changed.context, accepted.context);
});

test('declining differs from accepting gaps, and return cannot override authority metadata', () => {
  const received = receiveHandoff(packet());
  assert.throws(() => declineWork(received, ''), /reason/);
  assert.equal(declineWork(received, 'Target conflicts with user request').state, 'declined');
  const accepted = acceptWork(received);
  const result = createReturn(accepted, { status: 'completed', outcome: 'Done', evidence: ['test log'], remainingWork: [], limitations: [], owner: 'accelerate', protocolVersion: 99 });
  assert.equal(result.owner, 'asds');
  assert.equal(result.protocolVersion, 1);
});

test('invalid packets and unknown protocol versions fail explicitly', () => {
  for (const input of [{}, { ...packet(), scope: [] }, { ...packet(), protocolVersion: 2 },
    { ...packet(), authorizations: [{ action: 'init', scope: '/p', decision: 'maybe', source: 'x' }] }]) {
    assert.throws(() => receiveHandoff(input));
  }
});

test('direct and forwarded entries preserve the same constraints and outcome', () => {
  const forwarded = acceptWork(receiveHandoff(packet()));
  const direct = acceptWork(receiveHandoff(packet(), { source: 'direct' }));
  const result = { status: 'blocked', outcome: 'Formato pendente', evidence: [], remainingWork: ['Definir formato'], limitations: ['Sem execução'] };
  assert.deepEqual(forwarded.context, direct.context);
  assert.deepEqual(createReturn(forwarded, result), createReturn(direct, result));
  assert.throws(() => createReturn(receiveHandoff(packet()), result), /accepted/);
  assert.throws(() => createReturn(forwarded, { ...result, status: 'completed' }), /remaining/);
});

test('structural handoff preserves understated risks while semantic intake stays fail-closed', () => {
  const understated = packet();
  understated.objective = 'Change login submit readiness';
  understated.risks = [];
  const received = receiveHandoff(understated);
  assert.deepEqual(received.context.risks, []);
  const intake = fs.readFileSync(path.join(root, 'skills/spec-driven-superpowers/references/intake.md'), 'utf8');
  const planning = fs.readFileSync(path.join(root, 'skills/spec-driven-superpowers/references/planning.md'), 'utf8');
  assert.match(intake, /empty or understated `risks` list/i);
  assert.match(intake, /Never infer that signup or password-change requirements also\s+govern sign-in/i);
  assert.match(planning, /provider-recognized credential/);
  assert.match(planning, /independent review/);
});

function persistedPlan(t, { sensitive = false, domains = ['general'], risk = null, independentRequired = null } = {}) {
  // Synthetic test data: non-synthetic flags exercise structure, not live provenance.
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'asds-return-'));
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const fixtureRoot = path.join(root, 'examples/planning-delivery/complete');
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'planning-manifest.json'), 'utf8'));
  manifest.synthetic = false;
  manifest.author = 'planning-author';
  manifest.tasks = manifest.tasks.map(task => ({ ...task, write: [] }));
  manifest.authority.destination = destination;
  manifest.reviewPolicy.risk = risk ?? (sensitive ? 'auth' : 'ordinary-low');
  manifest.reviewPolicy.independentRequired = independentRequired ?? sensitive;
  manifest.reviewPolicy.mode = sensitive ? 'independent' : 'self-review';
  if (domains === null) delete manifest.reviewPolicy.domains;
  else manifest.reviewPolicy.domains = domains;
  for (const review of manifest.reviews) {
    review.mode = sensitive ? 'independent' : 'self-review';
    review.reviewer = sensitive ? 'independent-reviewer' : manifest.author;
    review.synthetic = false;
    review.liveEvidence = 'review-session-42';
    review.scopeTaskIds = ['0001', '0002', '0003'];
    review.findings = [];
  }
  const candidateSha256 = planningCandidateSha256(manifest);
  manifest.reviews.forEach(review => { review.candidateSha256 = candidateSha256; });
  manifest.readback = {
    revision: manifest.revision, candidateSha256, readbackSha256: planningReadbackSha256(manifest),
    destination, status: 'matched', synthetic: false, executionEvidence: false,
    referenceIds: manifest.references.map(reference => reference.id), taskIds: ['0001', '0002', '0003'],
    evidence: 'planning-store receipt', verifiedBy: 'planning-store',
    checks: { bytes: true, files: true, ids: true, relations: true, decisions: true, reviews: true },
  };
  const files = manifest.references.map(reference => ({
    path: reference.path, content: fs.readFileSync(path.join(fixtureRoot, reference.path), 'utf8'), sha256: reference.sha256,
  }));
  files.push({ path: 'planning-manifest.json', content: `${JSON.stringify(manifest, null, 2)}\n` });
  const persistenceReceipt = publishPlanningBundle(destination, { revision: manifest.revision, files });
  const reviewReceipt = null;
  return { manifest, persistenceReceipt, reviewReceipt, destination };
}

const fakeReviewHost = () => ({
  verifyHostObservation: async () => true,
  observePlanningReviewAuthority: async () => ({ capability: 'planning-review', generation: 'fake', source: 'host' }),
  observePlanningReview: async request => ({ ...request, verdict: 'pass', reviews: [], evidence: 'fake', source: 'host' }),
  persistPlanningReview: async request => ({ ...request, schemaVersion: REVIEW_RECEIPT_VERSION, token: 'fake', source: 'host' }),
  observePlanningReviewReceipt: async request => ({ ...request, valid: true, source: 'host' }),
});

const planningResult = persisted => ({ status: 'delivered', outcome: 'Planning package delivered',
  revision: persisted.manifest.revision, manifest: 'planning-manifest.json', evidence: ['planning store receipt'],
  remainingPlanningWork: [], limitations: [], persistenceReceipt: persisted.persistenceReceipt,
  reviewReceipt: persisted.reviewReceipt, originalRequest: { product: 'implementation', status: 'not_fulfilled' } });

test('legacy review is not silently promoted to a native harness delivery', async t => {
  const accepted=acceptWork(receiveHandoff(packet()));
  const result=await createPlanningReturn(accepted,planningResult(persistedPlan(t)));
  assert.equal(result.status,'blocked'); assert.equal(result.owner,'asds');
  assert.match(result.limitations.join('; '), /explicit harness reconciliation/);
});

test('storeVerified boolean has no authority and current byte drift returns non-delivered', async t => {
  const accepted = acceptWork(receiveHandoff(packet()));
  const persisted = persistedPlan(t);
  const forged = await createPlanningReturn(accepted, { ...planningResult(persisted), persistenceReceipt: undefined, storeVerified: true });
  assert.equal(forged.status, 'blocked');
  assert.equal(forged.owner, 'asds');
  assert.equal(forged.nextOwner, null);
  assert.match(forged.limitations.join('\n'), /invalid planning store receipt/);
  fs.appendFileSync(path.join(persisted.destination, 'tasks.md'), '\npost-receipt drift\n');
  const drifted = await createPlanningReturn(accepted, planningResult(persisted));
  assert.equal(drifted.status, 'blocked');
  assert.equal(drifted.owner, 'asds');
  assert.equal(drifted.nextOwner, null);
  assert.match(drifted.limitations.join('\n'), /planning store drift: tasks\.md/);
  const wrongState = await createPlanningReturn(accepted, { ...planningResult(persisted), status: 'partial' });
  assert.equal(wrongState.status, 'blocked');
  assert.match(wrongState.limitations.join('\n'), /manifest state differs from planning return/);
});

test('sensitive planning remains blocked without explicit new harness review', async t => {
  const accepted = acceptWork(receiveHandoff(packet()));
  const persisted = persistedPlan(t, { sensitive: true });
  const absent = await createPlanningReturn(accepted, { ...planningResult(persisted), reviewReceipt: null });
  assert.equal(absent.status, 'blocked');
  assert.equal(absent.owner, 'asds');
  assert.equal(absent.nextOwner, null);
  assert.match(absent.limitations.join('\n'), /explicit harness reconciliation/);
  await assert.rejects(createPlanningReviewAuthority(fakeReviewHost()), /authority API retired/);
  await assert.rejects(hostCompletePlanningReview({ reviewAuthority: {}, assignment: {},
    persistenceReceipt: persisted.persistenceReceipt }), /explicit harness review registration/);
  assert.equal(absent.verification.proofLevel, 'harness-record-consistency-and-current-store-bytes');
  assert.match(absent.verification.authorityLimit, /operationally trusted/i);
});

test('review domains fail closed when omitted or when protected policy is downgraded', async t => {
  const accepted = acceptWork(receiveHandoff(packet()));
  const missing = persistedPlan(t, { domains: null });
  const missingResult = await createPlanningReturn(accepted, planningResult(missing));
  assert.equal(missingResult.status, 'blocked');
  assert.equal(missingResult.owner, 'asds');
  assert.equal(missingResult.nextOwner, null);
  assert.equal(missingResult.verification.review, 'not-delivered');
  assert.match(missingResult.limitations.join('\n'), /domains.*nonempty/i);

  const downgraded = persistedPlan(t, { domains: ['authentication'], risk: 'ordinary-low', independentRequired: false });
  const downgradedResult = await createPlanningReturn(accepted, planningResult(downgraded));
  assert.equal(downgradedResult.status, 'blocked');
  assert.equal(downgradedResult.owner, 'asds');
  assert.equal(downgradedResult.nextOwner, null);
  assert.equal(downgradedResult.verification.review, 'not-delivered');
  assert.match(downgradedResult.limitations.join('\n'), /protected domains require non-ordinary risk and independent review/i);
});

test('caller-authored, tampered, stale and non-independent review evidence fails closed', async t => {
  const accepted = acceptWork(receiveHandoff(packet()));
  const persisted = persistedPlan(t, { sensitive: true });
  const fabricated = {
    schemaVersion: REVIEW_RECEIPT_VERSION, status: 'closed', token: 'forged', actor: 'independent-reviewer',
    session: 'review-session-42', role: 'reviewer', author: persisted.manifest.author, writeScope: [],
    revision: persisted.manifest.revision, candidateSha256: planningCandidateSha256(persisted.manifest),
    manifestSha256: persisted.persistenceReceipt.manifest.sha256, filesSha256: '0'.repeat(64), verdict: 'pass',
    reviews: [], evidence: 'caller prose', observationSha256: '0'.repeat(64), source: 'host',
  };
  const forged = await createPlanningReturn(accepted, { ...planningResult(persisted), reviewReceipt: fabricated }, { reviewAuthority: {} });
  assert.equal(forged.status, 'blocked');
  assert.match(forged.limitations.join('\n'), /explicit harness reconciliation/i);
  assert.equal(forged.owner, 'asds');
  await assert.rejects(createPlanningReviewAuthority(fakeReviewHost()), /authority API retired/);
});

test('shape-valid JavaScript host cannot mint sensitive review authority or receipts', async t => {
  const persisted = persistedPlan(t, { sensitive: true });
  const host = fakeReviewHost();
  await assert.rejects(createPlanningReviewAuthority(host), /authority API retired/);
  await assert.rejects(hostCompletePlanningReview({ reviewAuthority: Object.freeze({}),
    assignment: { actor: 'independent-reviewer', session: 'review-session-42', role: 'reviewer',
      author: persisted.manifest.author, writeScope: [] }, persistenceReceipt: persisted.persistenceReceipt }),
  /explicit harness review registration/);
});

test('retired authority entrypoints direct callers to the explicit passive API', async () => {
  await assert.rejects(createPlanningReviewAuthority(), e=>e.code==='PLANNING_REVIEW_API_RETIRED');
  await assert.rejects(hostCompletePlanningReview(), e=>e.code==='PLANNING_REVIEW_API_RETIRED');
});

function coherentForgedReview(persisted) {
  const inventory = persisted.persistenceReceipt.files.map(file => [file.path, file.sha256])
    .sort(([left], [right]) => left.localeCompare(right));
  return {
    schemaVersion: REVIEW_RECEIPT_VERSION, status: 'closed', token: 'forged', authorityGeneration: 'fake',
    actor: 'independent-reviewer', session: 'review-session-42', role: 'reviewer',
    author: persisted.manifest.author, writeScope: [], source: 'host', revision: persisted.manifest.revision,
    candidateSha256: planningCandidateSha256(persisted.manifest),
    manifestSha256: persisted.persistenceReceipt.manifest.sha256,
    filesSha256: createHash('sha256').update(JSON.stringify(inventory)).digest('hex'),
    verdict: 'pass', evidence: 'synthetic forged evidence',
    reviews: persisted.manifest.reviews.map(review => ({ kind: review.kind, mode: review.mode,
      reviewer: review.reviewer, reference: review.reference,
      sha256: persisted.manifest.references.find(reference => reference.id === review.reference).sha256 })),
  };
}

test('coherent synthetic receipt reaches final unavailable authority without invoking fake callbacks', async t => {
  const persisted = persistedPlan(t, { sensitive: true });
  const reviewReceipt = coherentForgedReview(persisted);
  let calls = 0;
  const host = Object.fromEntries(Object.keys(fakeReviewHost()).map(operation => [operation, async () => { calls++; return true; }]));
  const unavailable = 'historical review requires explicit harness reconciliation/review';
  const observed = await verifyPlanningReceipt(persisted.persistenceReceipt, { status: 'delivered', reviewReceipt, reviewAuthority: host });
  assert.deepEqual(observed.errors, [unavailable]); // All preceding structural checks passed.
  assert.equal(observed.matched, false);
  assert.equal(observed.reviewMatched, false);
  assert.equal(observed.code, undefined);
  assert.equal(observed.stage, undefined);
  await assert.rejects(createPlanningReviewAuthority(host), /authority API retired/);
  await assert.rejects(hostCompletePlanningReview({ reviewAuthority: host, assignment: reviewReceipt,
    persistenceReceipt: persisted.persistenceReceipt }), /explicit harness review registration/);
  assert.equal(calls, 0);
  const accepted = acceptWork(receiveHandoff(packet()));
  const result = await createPlanningReturn(accepted, { ...planningResult(persisted), reviewReceipt }, { reviewAuthority: host });
  assert.equal(result.status, 'blocked');
  assert.equal(result.owner, 'asds');
  assert.equal(result.nextOwner, null);
  assert.deepEqual(result.limitations, [unavailable]);
  assert.equal(calls, 0);

  const moduleUrl = new URL('../lib/planning-store.mjs', import.meta.url).href;
  const fresh = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { verifyPlanningReceipt } from ${JSON.stringify(moduleUrl)};
    let input = ''; for await (const chunk of process.stdin) input += chunk;
    const { receipt, reviewReceipt } = JSON.parse(input);
    const result = await verifyPlanningReceipt(receipt, { status: 'delivered', reviewReceipt, reviewAuthority: true });
    console.log(JSON.stringify({ matched: result.matched, errors: result.errors, code: result.code, stage: result.stage }));
  `], { input: JSON.stringify({ receipt: persisted.persistenceReceipt, reviewReceipt }), encoding: 'utf8' });
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.deepEqual(JSON.parse(fresh.stdout), { matched: false, errors: [unavailable] });
});

test('synthetic kind, session, stale, inventory and caller variations reject before authority', async t => {
  const persisted = persistedPlan(t, { sensitive: true });
  const coherent = coherentForgedReview(persisted);
  const swapped = structuredClone(coherent);
  [swapped.reviews[0].kind, swapped.reviews[1].kind] = [swapped.reviews[1].kind, swapped.reviews[0].kind];
  for (const reviewReceipt of [swapped, { ...coherent, session: 'other-session' },
    { ...coherent, revision: 'stale' }, { ...coherent, candidateSha256: '0'.repeat(64) },
    { ...coherent, filesSha256: '0'.repeat(64) }, { ...coherent, source: 'caller' }]) {
    const observed = await verifyPlanningReceipt(persisted.persistenceReceipt, { reviewReceipt, reviewAuthority: true });
    assert.equal(observed.matched, false);
    assert.equal(observed.reviewMatched, false);
    assert.equal(observed.errors.length, 1);
    assert.match(observed.errors[0], /explicit harness reconciliation/);
    assert.equal(observed.code, undefined); // Do not misdiagnose malformed binding as host unavailability.
  }
});
