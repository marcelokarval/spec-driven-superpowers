import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  AGY_REVIEW_RESPONSE_HEADER, createAgyReviewRequestFromPackage, encodeAgyReviewRequest,
  compareAgyReviewPackageReadback, discoverAgyReviewPackage, inspectAgyReviewDispatchContract,
  inspectAgyReviewPackage, parseAgyReviewRequest,
  parseAgyReviewResponse, createAgyReviewDispatchAuthority, attestAgyReviewDispatch,
  validateAgyReviewRequest, validateAgyReviewResponseEnvelope,
} from '../lib/agy-review-protocol.mjs';
import { applyInstall, planInstall } from '../lib/install.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');

function tempRoot(t, prefix) {
  const target = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  return target;
}

function fixture(t) {
  const projectRoot = tempRoot(t, 'asds-agy-review-');
  fs.cpSync(path.join(root, 'examples/planning-delivery/complete'), path.join(projectRoot, 'change'), { recursive: true });
  return { projectRoot, packagePath: 'change', packageRoot: path.join(projectRoot, 'change') };
}

function prop4youFixture(t) {
  const projectRoot = tempRoot(t, 'asds-agy-prop4you-');
  fs.cpSync(path.join(root, 'tests/fixtures/agy-review/prop4you-real-shaped'), path.join(projectRoot, 'change'),
    { recursive: true });
  return { projectRoot, packagePath: 'change', packageRoot: path.join(projectRoot, 'change') };
}

function installedProfile(t) {
  const target = tempRoot(t, 'asds-agy-runtime-');
  applyInstall(planInstall({ scope: 'project', target }));
  return target;
}

function response(request, extra = {}) {
  return { schema: 'asds.agy-review-response/1', packagePath: request.packagePath,
    reviewKind: request.reviewKind, revision: request.revision, candidateSha256: request.candidateSha256,
    freshness: request.freshness, inventorySha256: request.inventorySha256,
    verdict: 'pass', findings: [], limitations: [], ...extra };
}

const output = (request, extra) => `${AGY_REVIEW_RESPONSE_HEADER}${JSON.stringify(response(request, extra))}`;
const unavailable = /no qualified native-private durable host authority/;

test('host builder derives canonical revision, candidate and exact current bytes from a real package', t => {
  const files = fixture(t), snapshot = inspectAgyReviewPackage(files);
  const manifest = fs.readFileSync(path.join(files.packageRoot, 'planning-manifest.json'));
  assert.equal(snapshot.revision, 'complete-r1');
  assert.equal(snapshot.packageInventory.find(entry => entry.role === 'manifest').sha256, sha256(manifest));
  assert.deepEqual(snapshot.packageInventory.filter(entry => entry.role === 'task').map(entry => entry.path), [
    'change/tasks/task-0001.md', 'change/tasks/task-0002.md', 'change/tasks/task-0003.md', 'change/tasks/task-P01.md',
  ]);
  assert.deepEqual(snapshot.sourceInventory.map(entry => entry.path), ['change/brief.md']);
  const request = createAgyReviewRequestFromPackage({ ...files, reviewKind: 'fidelity' });
  assert.deepEqual(parseAgyReviewRequest(encodeAgyReviewRequest(request)), request);
  assert.equal(request.priorFidelityOutput, null);
  assert.match(request.freshness, /^[a-f0-9]{64}$/);
});

test('read-only package discovery requires exactly one bounded canonical locator', t => {
  const projectRoot = tempRoot(t, 'asds-agy-discovery-');
  assert.deepEqual(discoverAgyReviewPackage({ projectRoot, reuseExisting: true }), {
    status: 'locator-required', candidates: [],
    reason: 'locator-required: no canonical planning package found under openspec/changes',
  });
  assert.deepEqual(discoverAgyReviewPackage({ projectRoot }), {
    status: 'locator-required', candidates: [],
    reason: 'locator-required: handoff did not identify a package or authorize reuse discovery',
  });

  const changes = path.join(projectRoot, 'openspec/changes');
  fs.mkdirSync(changes, { recursive: true });
  fs.cpSync(path.join(root, 'examples/planning-delivery/complete'), path.join(changes, 'existing'), { recursive: true });
  const tasksPath = path.join(changes, 'existing/tasks.md'), before = fs.readFileSync(tasksPath);
  const located = discoverAgyReviewPackage({ projectRoot, reuseExisting: true });
  assert.equal(located.status, 'located');
  assert.equal(located.packagePath, 'openspec/changes/existing');
  assert.equal(located.snapshot.declaredDeliveryStatus, 'delivered');
  assert.deepEqual(fs.readFileSync(tasksPath), before, 'discovery must not rewrite the existing package');
  assert.equal(discoverAgyReviewPackage({ projectRoot,
    packagePath: 'openspec/changes/existing' }).snapshot.declaredDeliveryStatus, 'delivered');

  fs.cpSync(path.join(root, 'examples/planning-delivery/complete'), path.join(changes, 'other'), { recursive: true });
  assert.deepEqual(discoverAgyReviewPackage({ projectRoot, reuseExisting: true }), {
    status: 'locator-required', candidates: ['openspec/changes/existing', 'openspec/changes/other'],
    reason: 'locator-required: multiple canonical planning packages found; provide one exact safe relative locator',
  });
  fs.symlinkSync(path.join(changes, 'existing'), path.join(changes, 'linked'));
  assert.throws(() => discoverAgyReviewPackage({ projectRoot, reuseExisting: true }), /review symlink refused/);
});

test('Prop4You-shaped package accepts every current manifest role while review artifacts stay out of reviewer input', t => {
  const files = prop4youFixture(t), manifest = JSON.parse(fs.readFileSync(path.join(files.packageRoot, 'planning-manifest.json')));
  assert.deepEqual([...new Set(manifest.references.map(reference => reference.role))].sort(),
    ['contract', 'index', 'review', 'source', 'specification']);
  const snapshot = inspectAgyReviewPackage(files);
  assert.deepEqual(snapshot.sourceInventory.map(entry => entry.role), ['source', 'source', 'source']);
  assert.deepEqual(snapshot.packageInventory.map(entry => entry.role).sort(),
    ['index', 'manifest', 'specification', 'task']);
  assert.equal(snapshot.packageInventory.some(entry => entry.path.includes('/reviews/')), false);
  assert.equal(snapshot.sourceInventory.some(entry => entry.path.includes('/reviews/')), false);
  assert.equal(snapshot.packageInventory.find(entry => entry.role === 'specification').path,
    'change/specs/identity/login-submission-readiness/spec.md');
  assert.doesNotThrow(() => createAgyReviewRequestFromPackage({ ...files, reviewKind: 'fidelity' }));

  fs.appendFileSync(path.join(files.packageRoot, 'reviews/independent-review.md'), '\nreview drift\n');
  assert.throws(() => inspectAgyReviewPackage(files), /reference bytes drifted/);
});

test('post-handoff progress preserves review binding; unchanged bytes and material changes classify separately', t => {
  const files = prop4youFixture(t), manifestPath = path.join(files.packageRoot, 'planning-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const baseline = inspectAgyReviewPackage(files);
  assert.equal(baseline.declaredDeliveryStatus, 'not-established', 'absent state is not delivery evidence');
  const indexPath = path.join(files.packageRoot, 'tasks.md'), deliveredIndex = fs.readFileSync(indexPath, 'utf8');

  fs.writeFileSync(indexPath, deliveredIndex.replace('[ ]', '[x]'));
  const progressed = inspectAgyReviewPackage(files);
  assert.equal(progressed.candidateSha256, baseline.candidateSha256, 'progress is not a new planning candidate');
  assert.equal(progressed.inventorySha256, baseline.inventorySha256, 'review inventory normalizes canonical progress');
  assert.notEqual(progressed.readbackSha256, baseline.readbackSha256, 'readback identity remains byte-exact');
  assert.deepEqual(compareAgyReviewPackageReadback(baseline, progressed), {
    status: 'existing package state with updated progress', freshReviewRequired: null,
    proofLevel: 'canonical-progress-normalized-comparison', authorityClaim: false,
  });

  fs.writeFileSync(indexPath, deliveredIndex);
  const restored = inspectAgyReviewPackage(files);
  assert.deepEqual(compareAgyReviewPackageReadback(baseline, restored), {
    status: 'existing package bytes unchanged', freshReviewRequired: null,
    proofLevel: 'byte-exact-snapshot-comparison', authorityClaim: false,
  });
  assert.deepEqual(compareAgyReviewPackageReadback(progressed, restored), {
    status: 'invalid progress regression requires reopen receipt', freshReviewRequired: null,
    proofLevel: 'canonical-progress-regression-detected', authorityClaim: false,
  });

  const taskPath = path.join(files.packageRoot, 'tasks/task-0001.md');
  fs.appendFileSync(taskPath, '\nMaterial contract change.\n');
  manifest.references.find(reference => reference.path === 'tasks/task-0001.md').sha256 =
    sha256(fs.readFileSync(taskPath));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const changed = inspectAgyReviewPackage(files);
  assert.deepEqual(compareAgyReviewPackageReadback(baseline, changed), {
    status: 'new candidate requires fresh review', freshReviewRequired: true,
    proofLevel: 'byte-exact-snapshot-comparison', authorityClaim: false,
  });
  assert.throws(() => compareAgyReviewPackageReadback(structuredClone(baseline), changed),
    /filesystem-derived package snapshots/);
});

test('draft or merely declared-delivered snapshots cannot promote progress or equality to delivered', t => {
  const files = prop4youFixture(t), manifestPath = path.join(files.packageRoot, 'planning-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.state = 'draft';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const draft = inspectAgyReviewPackage(files);
  assert.equal(draft.declaredDeliveryStatus, 'draft');
  const indexPath = path.join(files.packageRoot, 'tasks.md');
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace('[ ]', '[x]'));
  assert.deepEqual(compareAgyReviewPackageReadback(draft, inspectAgyReviewPackage(files)), {
    status: 'existing package state with updated progress', freshReviewRequired: null,
    proofLevel: 'canonical-progress-normalized-comparison', authorityClaim: false,
  });

  fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace('[x]', '[ ]'));
  manifest.state = 'delivered';
  manifest.attendanceOutcome = 'planning_delivered';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const unverifiedClaim = inspectAgyReviewPackage(files);
  assert.equal(unverifiedClaim.declaredDeliveryStatus, 'delivered');
  assert.equal(manifest.readback, undefined, 'fixture intentionally has no delivery readback receipt');
  assert.deepEqual(compareAgyReviewPackageReadback(unverifiedClaim, unverifiedClaim), {
    status: 'existing package bytes unchanged', freshReviewRequired: null,
    proofLevel: 'byte-exact-snapshot-comparison', authorityClaim: false,
  });
});

test('request validation rejects top-level and nested inventory extensions', t => {
  const files = fixture(t);
  const request = createAgyReviewRequestFromPackage({ ...files, reviewKind: 'fidelity' });
  assert.throws(() => validateAgyReviewRequest({ ...request, claimedAuthority: true }),
    /invalid AGY review request envelope/);
  const nested = structuredClone(request);
  nested.packageInventory[0].claimedSignature = 'not-evidence';
  assert.throws(() => validateAgyReviewRequest(nested), /invalid closed schema/);
});

test('pure response-envelope validation proves shape only and never operational review authority', t => {
  const files = fixture(t), request = createAgyReviewRequestFromPackage({ ...files, reviewKind: 'fidelity' });
  assert.equal(validateAgyReviewResponseEnvelope(output(request), request).verdict, 'pass');
  assert.throws(() => validateAgyReviewResponseEnvelope(output(request, { limitations: ['source unread'] }), request),
    /cannot retain.*limitations/);
  assert.throws(() => validateAgyReviewResponseEnvelope(output(request, { revision: 'stale' }), request),
    /invalid or stale/);
  assert.throws(() => validateAgyReviewResponseEnvelope(`${AGY_REVIEW_RESPONSE_HEADER}{`, request),
    /invalid AGY review response JSON/);
});

test('public dispatch APIs fail closed and cannot mint or accept caller-supplied authority and receipts', async t => {
  const files = fixture(t), request = createAgyReviewRequestFromPackage({ ...files, reviewKind: 'fidelity' });
  const forgedReceipt = { schema: 'asds.agy-review-dispatch-receipt/1', enforced: true };
  await assert.rejects(() => createAgyReviewDispatchAuthority(), unavailable);
  await assert.rejects(() => createAgyReviewDispatchAuthority({
    observeAgyReviewDispatchAuthority: async () => ({ capability: 'agy-review-dispatch' }),
    verifyHostObservation: async () => true,
  }, { target: installedProfile(t) }), unavailable);
  await assert.rejects(() => attestAgyReviewDispatch({
    dispatchAuthority: { capability: 'agy-review-dispatch' }, dispatchReceipt: forgedReceipt, request,
  }), unavailable);
  assert.throws(() => parseAgyReviewResponse(output(request), request), unavailable);
  assert.throws(() => parseAgyReviewResponse(output(request), request, { dispatchReceipt: forgedReceipt }), unavailable);
  assert.throws(() => parseAgyReviewResponse(output(request), structuredClone(request),
    { dispatchReceipt: forgedReceipt }), /original host-built/);
});

test('quality remains blocked because public parsing cannot consume a fidelity result', t => {
  const files = fixture(t), fidelity = createAgyReviewRequestFromPackage({ ...files, reviewKind: 'fidelity' });
  assert.throws(() => parseAgyReviewResponse(output(fidelity), fidelity), unavailable);
  assert.throws(() => createAgyReviewRequestFromPackage({ ...files, reviewKind: 'quality', fidelityRequest: fidelity }),
    /consumed fresh fidelity/);
});

test('builder rejects drift, zero bytes, orphan contracts and symlinked artifacts from real files',
  { skip: process.platform === 'win32' }, t => {
    const traversal = fixture(t);
    assert.throws(() => inspectAgyReviewPackage({ projectRoot: traversal.projectRoot, packagePath: '../change' }),
      /safe project-relative/);

    const drift = fixture(t);
    fs.appendFileSync(path.join(drift.packageRoot, 'tasks/task-0001.md'), '\ndrift\n');
    assert.throws(() => inspectAgyReviewPackage(drift), /reference bytes drifted/);

    const empty = fixture(t);
    fs.writeFileSync(path.join(empty.packageRoot, 'brief.md'), '');
    assert.throws(() => inspectAgyReviewPackage(empty), /zero-byte/);

    const orphan = fixture(t);
    fs.copyFileSync(path.join(orphan.packageRoot, 'tasks/task-0001.md'), path.join(orphan.packageRoot, 'tasks/task-orphan.md'));
    assert.throws(() => inspectAgyReviewPackage(orphan), /tasks directory differs/);

    const linked = fixture(t), source = path.join(linked.packageRoot, 'brief.md');
    fs.unlinkSync(source);
    fs.symlinkSync('/etc/hosts', source);
    assert.throws(() => inspectAgyReviewPackage(linked), /symlink refused/);

    const hardlinked = fixture(t), hardlinkSource = path.join(hardlinked.packageRoot, 'brief.md');
    fs.linkSync(hardlinkSource, path.join(hardlinked.packageRoot, 'brief-alias.md'));
    assert.throws(() => inspectAgyReviewPackage(hardlinked), /hardlink refused/);
  });

test('dispatch contract inspection requires the exact official profile, unavailable runtime and manifest v3 ownership', t => {
  const target = installedProfile(t);
  const inspected = inspectAgyReviewDispatchContract({ target });
  assert.equal(inspected.contract.runtimeHostStatus, 'unavailable');
  assert.equal(inspected.manifestRelativePath, '.asds/install-manifest.json');

  const contractPath = path.join(target, '.asds/agy-review-dispatch-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath));
  contract.runtimeHostStatus = 'qualified';
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  assert.throws(() => inspectAgyReviewDispatchContract({ target }), /invalid closed.*contract/);
});

test('dispatch contract inspection rejects non-official paths and missing manifest v3 ownership', t => {
  const wrongPath = installedProfile(t);
  const contractPath = path.join(wrongPath, '.asds/agy-review-dispatch-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath));
  contract.reviewerRelativePath = '.agents/agents/reviewer-copy.md';
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  assert.throws(() => inspectAgyReviewDispatchContract({ target: wrongPath }), /exact official profile/);

  const unowned = installedProfile(t);
  const manifestPath = path.join(unowned, '.asds/install-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files = manifest.files.filter(entry => entry.path !== path.join(unowned, '.asds/agy-review-dispatch-contract.json'));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => inspectAgyReviewDispatchContract({ target: unowned }), /manifest v3 does not own/);

  const legacy = installedProfile(t);
  const legacyManifestPath = path.join(legacy, '.asds/install-manifest.json');
  const legacyManifest = JSON.parse(fs.readFileSync(legacyManifestPath));
  legacyManifest.format = 2;
  delete legacyManifest.features;
  fs.writeFileSync(legacyManifestPath, `${JSON.stringify(legacyManifest, null, 2)}\n`);
  assert.throws(() => inspectAgyReviewDispatchContract({ target: legacy }), /exact installation manifest v3/);
});

test('dispatch contract inspection refuses symlinked installed payload', { skip: process.platform === 'win32' }, t => {
  const target = installedProfile(t);
  const reviewer = path.join(target, '.agents/agents/spec-driven-superpowers-reviewer.md');
  const replacement = path.join(target, '.asds/reviewer-copy.md');
  fs.copyFileSync(reviewer, replacement);
  fs.unlinkSync(reviewer);
  fs.symlinkSync(replacement, reviewer);
  assert.throws(() => inspectAgyReviewDispatchContract({ target }), /symlink refused/);
});
