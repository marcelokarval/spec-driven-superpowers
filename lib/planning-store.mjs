import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { safePath } from './planning-paths.mjs';
import { evaluatePlanningLifecycle, inspectPlanningReviewPolicy, planningCandidateSha256 } from './planning-lifecycle.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const PLANNING_RECEIPT_VERSION = 'asds.planning-store-receipt/1';
export const REVIEW_RECEIPT_VERSION = 'asds.independent-review-receipt/1';


function destinationPath(root, relative) {
  if (!safePath(relative)) throw new Error(`unsafe planning path: ${relative}`);
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`planning symlink refused: ${relative}`);
  }
  return current;
}

export function validatePlanningBundle(bundle) {
  const errors = [];
  if (!object(bundle) || !text(bundle.revision) || !Array.isArray(bundle.files) || !bundle.files.length) return ['bundle requires revision and files'];
  const seen = new Set();
  for (const file of bundle.files) {
    if (!object(file) || !safePath(file.path) || typeof file.content !== 'string') { errors.push('invalid bundle file'); continue; }
    if (seen.has(file.path)) errors.push(`duplicate bundle file: ${file.path}`);
    seen.add(file.path);
    if (file.sha256 !== undefined && file.sha256 !== hash(Buffer.from(file.content))) errors.push(`bundle hash mismatch: ${file.path}`);
  }
  for (const required of ['planning-manifest.json', 'tasks.md']) if (!seen.has(required)) errors.push(`missing bundle file: ${required}`);
  return errors;
}

export function readPlanningBundle(root, expectedPaths) {
  const files = expectedPaths.map(relative => {
    const file = destinationPath(root, relative);
    const content = fs.readFileSync(file, 'utf8');
    return { path: relative, content, sha256: hash(Buffer.from(content)) };
  });
  const manifest = JSON.parse(files.find(file => file.path === 'planning-manifest.json').content);
  return { revision: manifest.revision, files };
}

function receiptFileMap(receipt, errors) {
  if (!Array.isArray(receipt?.files) || !receipt.files.length) {
    errors.push('planning receipt requires files');
    return new Map();
  }
  const files = new Map();
  for (const file of receipt.files) {
    if (!object(file) || !safePath(file.path) || !digest(file.sha256) || files.has(file.path)) {
      errors.push('planning receipt has invalid or duplicate file identity');
      continue;
    }
    files.set(file.path, file.sha256);
  }
  return files;
}

const receiptFilesSha256 = files => hash(Buffer.from(JSON.stringify([...files.entries()].sort(([left], [right]) => left.localeCompare(right)))));

function inspectPlanningReceipt(receipt, { revision, manifest = 'planning-manifest.json', status } = {}) {
  const errors = [];
  if (!object(receipt) || receipt.schemaVersion !== PLANNING_RECEIPT_VERSION || receipt.status !== 'matched' ||
      !text(receipt.revision) || !text(receipt.destination) || path.resolve(receipt.destination) !== receipt.destination ||
      !object(receipt.manifest) || receipt.manifest.path !== manifest || !digest(receipt.manifest.sha256) ||
      !object(receipt.index) || receipt.index.path !== 'tasks.md' || !digest(receipt.index.sha256)) {
    return { matched: false, errors: ['invalid planning store receipt'], manifest: null, lifecycle: null, files: new Map() };
  }
  if (revision !== undefined && receipt.revision !== revision) errors.push('planning receipt revision differs from return');
  const files = receiptFileMap(receipt, errors);
  if (files.get(receipt.manifest.path) !== receipt.manifest.sha256) errors.push('manifest identity differs from receipt inventory');
  if (files.get(receipt.index.path) !== receipt.index.sha256) errors.push('index identity differs from receipt inventory');
  let current, planningManifest = null;
  try {
    current = readPlanningBundle(receipt.destination, [...files.keys()]);
    for (const file of current.files) if (files.get(file.path) !== file.sha256) errors.push(`planning store drift: ${file.path}`);
    planningManifest = JSON.parse(current.files.find(file => file.path === receipt.manifest.path)?.content ?? 'null');
  } catch (error) {
    errors.push(`planning store readback failed: ${error.message}`);
  }
  let lifecycle = null;
  if (object(planningManifest)) {
    const references = Array.isArray(planningManifest.references) ? planningManifest.references : [];
    const expected = new Set([receipt.manifest.path, ...references.map(reference => reference?.path)]);
    if (expected.size !== files.size || [...expected].some(file => !files.has(file))) errors.push('planning receipt inventory differs from manifest');
    if (planningManifest.revision !== receipt.revision) errors.push('manifest revision differs from planning receipt');
    if (status !== undefined && planningManifest.state !== status) errors.push('manifest state differs from planning return');
    if (path.resolve(planningManifest.authority?.destination ?? '') !== receipt.destination) errors.push('manifest destination differs from planning receipt');
    for (const reference of references) if (!object(reference) || files.get(reference.path) !== reference.sha256) {
      errors.push(`manifest reference hash differs from planning receipt: ${reference?.path ?? 'unknown'}`);
    }
    if (planningManifest.readback?.revision !== receipt.revision ||
        path.resolve(planningManifest.readback?.destination ?? '') !== receipt.destination ||
        planningManifest.readback?.status !== 'matched') errors.push('manifest readback differs from planning receipt');
    lifecycle = evaluatePlanningLifecycle(planningManifest);
    const gate = planningManifest.state === 'partial' ? lifecycle.canPartial : lifecycle.canDeliver;
    if (!gate) errors.push(`planning lifecycle is not deliverable${lifecycle.errors.length ? `: ${lifecycle.errors.join('; ')}` : ''}`);
  } else if (!errors.some(error => error.startsWith('planning store readback failed'))) errors.push('planning manifest is not an object');
  return { matched: errors.length === 0, errors, manifest: planningManifest, lifecycle, files };
}

function expectedReviewBinding(receipt, inspected) {
  return {
    revision: receipt.revision,
    candidateSha256: planningCandidateSha256(inspected.manifest),
    manifestSha256: receipt.manifest.sha256,
    filesSha256: receiptFilesSha256(inspected.files),
  };
}

/** Public source code cannot authenticate an arbitrary JavaScript adapter as a
 * harness trust root. Shape-valid fake adapters are useful only in isolated
 * conformance tests and never receive completion authority.
 */
export async function createPlanningReviewAuthority(host) {
  for (const operation of ['observePlanningReviewAuthority', 'observePlanningReview', 'persistPlanningReview', 'observePlanningReviewReceipt', 'verifyHostObservation']) {
    if (typeof host?.[operation] !== 'function') throw new Error(`${operation} host capability is required`);
  }
  throw new Error('planning review authority unavailable: no qualified host-private or signed durable trust root');
}

/** Complete and durably attest an independent planning review.
 * The returned receipt is serializable. Its persisted token must be reobserved
 * through a process-local adapter capability before delivery, including after
 * process restart. Production trust in that adapter is established by the harness.
 */
export async function hostCompletePlanningReview({ reviewAuthority, assignment, persistenceReceipt }) {
  void reviewAuthority; void assignment; void persistenceReceipt;
  throw new Error('planning review completion unavailable: no qualified host-private or signed durable trust root');
}

async function verifyHostReviewReceipt(reviewAuthority, reviewReceipt, expected) {
  void reviewAuthority; void reviewReceipt; void expected;
  return { matched: false,
    error: 'sensitive planning review authority unavailable: no qualified host-private or signed durable trust root' };
}

/** Reopen the receipt destination and bind the receipt to the current package.
 * This verifies bytes and lifecycle structure. It does not authenticate authors,
 * reviewers, authorization prose or semantic quality.
 */
export async function verifyPlanningReceipt(receipt, { revision, manifest = 'planning-manifest.json', status,
  reviewReceipt = null, reviewAuthority = null } = {}) {
  const inspected = inspectPlanningReceipt(receipt, { revision, manifest, status });
  const errors = [...inspected.errors], planningManifest = inspected.manifest, lifecycle = inspected.lifecycle, files = inspected.files;

  const policy = inspectPlanningReviewPolicy(planningManifest?.reviewPolicy);
  const sensitive = policy.sensitive;
  let reviewMatched = false;
  if (sensitive) {
    if (!object(reviewReceipt) || reviewReceipt.schemaVersion !== REVIEW_RECEIPT_VERSION || reviewReceipt.status !== 'closed' ||
        !text(reviewReceipt.token) || !text(reviewReceipt.authorityGeneration) || !text(reviewReceipt.actor) ||
        !text(reviewReceipt.session) || reviewReceipt.role !== 'reviewer' || !Array.isArray(reviewReceipt.writeScope) ||
        reviewReceipt.writeScope.length !== 0 || !text(reviewReceipt.source) || reviewReceipt.source === 'caller' ||
        reviewReceipt.revision !== receipt.revision || reviewReceipt.candidateSha256 !== planningCandidateSha256(planningManifest) ||
        reviewReceipt.manifestSha256 !== receipt.manifest.sha256 || reviewReceipt.filesSha256 !== receiptFilesSha256(files) ||
        reviewReceipt.verdict !== 'pass' || !text(reviewReceipt.evidence) || !Array.isArray(reviewReceipt.reviews) || reviewReceipt.reviews.length !== 2) {
      errors.push('sensitive planning requires a verifiable adapter-attested independent review receipt');
    } else {
      const declared = planningManifest.reviews ?? [];
      reviewMatched = declared.length === 2 && reviewReceipt.reviews.every((entry, index) => {
        const review = declared[index], reference = planningManifest.references.find(item => item.id === review?.reference);
        return object(entry) && entry.kind === review?.kind && entry.mode === 'independent' && review?.mode === 'independent' &&
          text(entry.reviewer) && entry.reviewer === review?.reviewer && entry.reviewer === reviewReceipt.actor &&
          reviewReceipt.actor !== planningManifest.author && reviewReceipt.author === planningManifest.author &&
          reviewReceipt.session === review?.liveEvidence &&
          entry.reference === review?.reference && entry.sha256 === reference?.sha256 && files.get(reference?.path) === entry.sha256;
      });
      if (!reviewMatched) errors.push('adapter-attested independent review receipt differs from assignment, manifest or stored review bytes');
      else {
        const provenance = await verifyHostReviewReceipt(reviewAuthority, reviewReceipt, expectedReviewBinding(receipt, inspected));
        reviewMatched = provenance.matched;
        if (!provenance.matched) errors.push(provenance.error);
      }
    }
  }
  return { matched: errors.length === 0, errors, manifest: planningManifest, lifecycle, reviewMatched, sensitive,
    proofLevel: sensitive ? 'unavailable-sensitive-review-authority' : 'store-bytes-and-manifest-structure',
    authorityLimit: sensitive
      ? 'Sensitive review cannot be delivered until a host-private or signed durable trust root is deployed and qualified.'
      : 'Persistence and manifest structure are verified; reviewer identity and semantic quality are not certified.' };
}

/** Publish a bounded bundle without persistent staging or backup copies. */
export function publishPlanningBundle(root, bundle, { expectedRevision = null, failAfter = null } = {}) {
  const errors = validatePlanningBundle(bundle);
  if (errors.length) throw new Error(errors.join('; '));
  fs.mkdirSync(root, { recursive: true });
  const manifestPath = destinationPath(root, 'planning-manifest.json');
  const currentRevision = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).revision : null;
  if (currentRevision !== expectedRevision) throw new Error(`planning revision conflict: expected ${expectedRevision}, observed ${currentRevision}`);
  const prior = new Map(), created = [], temporaries = [], written = [];
  try {
    for (const [index, entry] of bundle.files.entries()) {
      const file = destinationPath(root, entry.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file)) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.nlink !== 1) throw new Error(`unsafe existing planning file: ${entry.path}`);
        prior.set(file, { data: fs.readFileSync(file), mode: stat.mode & 0o777 });
      } else created.push(file);
      const temporary = path.join(path.dirname(file), `.asds-write-${randomBytes(12).toString('hex')}`);
      temporaries.push(temporary);
      fs.writeFileSync(temporary, entry.content, { flag: 'wx', mode: prior.get(file)?.mode ?? 0o600 });
      fs.renameSync(temporary, file); written.push(file);
      if (failAfter === index + 1) throw new Error('injected planning publication failure');
    }
    const readback = readPlanningBundle(root, bundle.files.map(file => file.path));
    if (readback.revision !== bundle.revision || readback.files.some((file, index) => file.sha256 !== hash(Buffer.from(bundle.files[index].content)))) throw new Error('planning readback mismatch');
    const files = readback.files.map(({ path, sha256 }) => ({ path, sha256 }));
    return { schemaVersion: PLANNING_RECEIPT_VERSION, status: 'matched', revision: bundle.revision,
      destination: path.resolve(root), manifest: files.find(file => file.path === 'planning-manifest.json'),
      index: files.find(file => file.path === 'tasks.md'), files };
  } catch (error) {
    const rollback = [];
    for (const file of written.reverse()) {
      try { if (prior.has(file)) fs.writeFileSync(file, prior.get(file).data, { mode: prior.get(file).mode }); else if (fs.existsSync(file)) fs.unlinkSync(file); }
      catch (failure) { rollback.push(failure.message); }
    }
    throw new Error(`${error.message}${rollback.length ? `; rollback incomplete: ${rollback.join('; ')}` : '; prior planning restored'}`);
  } finally {
    for (const temporary of temporaries) if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
