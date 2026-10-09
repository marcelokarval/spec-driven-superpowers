import { createHash } from 'node:crypto';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const ids = value => Array.isArray(value) && value.length > 0 && value.every(text) && new Set(value).size === value.length;
const findingKinds = new Set(['missing-requirement', 'invented-requirement', 'authorization-drift',
  'boundary-defect', 'dependency-defect', 'acceptance-defect', 'feasibility-defect', 'optional-improvement']);

export function reviewEnvelopeSha256(review) {
  const copy = structuredClone(review);
  delete copy.envelopeSha256;
  return createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

/** Validate a recorded human/agent review without pretending to evaluate semantics. */
export function validatePlanningReview(review, candidate, { requiredKind, priorKind } = {}) {
  const errors = [];
  if (!object(review) || !object(candidate)) return ['review and candidate must be objects'];
  if (!['fidelity', 'quality'].includes(review.kind) || (requiredKind && review.kind !== requiredKind)) errors.push('invalid review kind');
  if (priorKind && review.priorReviewKind !== priorKind) errors.push(`review must follow ${priorKind}`);
  if (!text(review.revision) || review.revision !== candidate.revision) errors.push('stale review revision');
  if (!text(review.candidateSha256) || review.candidateSha256 !== candidate.candidateSha256) errors.push('stale review candidate');
  if (!text(review.reviewer) || !text(review.mode) || !text(review.evidence) || !text(review.reference)) errors.push('review provenance is incomplete');
  if (!ids(review.sourceReferenceIds) || !candidate.sourceReferenceIds?.every(id => review.sourceReferenceIds.includes(id)) ||
      review.sourceReferenceIds.some(id => !candidate.sourceReferenceIds?.includes(id))) errors.push('review source inventory differs from candidate');
  if (!ids(review.taskIds) || !candidate.taskIds?.every(id => review.taskIds.includes(id)) ||
      review.taskIds.some(id => !candidate.taskIds?.includes(id))) errors.push('review task inventory differs from candidate');
  if (!['pass', 'fail'].includes(review.verdict)) errors.push('invalid review verdict');
  if (!Array.isArray(review.findings)) errors.push('findings must be an array');
  else for (const [index, finding] of review.findings.entries()) {
    if (!object(finding) || !text(finding.id) || !findingKinds.has(finding.kind) ||
        !['material', 'non-material'].includes(finding.severity) || !['open', 'resolved', 'rejected'].includes(finding.status) ||
        !text(finding.evidence) || !text(finding.expectedCorrection) || !text(finding.disposition) ||
        (!text(finding.requirementId) && !text(finding.taskId))) errors.push(`invalid finding ${index}`);
  }
  const openMaterial = Array.isArray(review.findings) && review.findings.some(f => f?.severity === 'material' && f.status === 'open');
  if ((review.verdict === 'pass') === openMaterial) errors.push('review verdict conflicts with material findings');
  if (!/^[a-f0-9]{64}$/.test(review.envelopeSha256 ?? '') || review.envelopeSha256 !== reviewEnvelopeSha256(review)) errors.push('review envelope hash mismatch');
  return errors;
}

export function createPlanningReview(input) {
  if (!object(input)) throw new Error('review input must be an object');
  const review = structuredClone(input);
  review.envelopeSha256 = reviewEnvelopeSha256(review);
  return review;
}

export function reviewSequence(candidate, reviews, policy = {}) {
  const errors = [];
  if (!Array.isArray(reviews) || reviews.length !== 2) return { status: 'blocked', errors: ['fidelity and quality reviews required'] };
  errors.push(...validatePlanningReview(reviews[0], candidate, { requiredKind: 'fidelity' }).map(e => `fidelity: ${e}`));
  errors.push(...validatePlanningReview(reviews[1], candidate, { requiredKind: 'quality', priorKind: 'fidelity' }).map(e => `quality: ${e}`));
  if (policy.independentRequired === true && reviews.some(review => review.mode !== 'independent')) errors.push('independent review required');
  if (!errors.length && reviews.some(review => review.verdict !== 'pass')) errors.push('review sequence did not pass');
  return { status: errors.length ? 'blocked' : 'passed', errors };
}
