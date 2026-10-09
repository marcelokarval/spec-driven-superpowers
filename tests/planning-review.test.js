import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanningReview, reviewSequence, validatePlanningReview } from '../lib/planning-review.mjs';

const candidate = { revision: 'r1', candidateSha256: 'a'.repeat(64), sourceReferenceIds: ['brief'], taskIds: ['T1'] };
const review = (kind, extra = {}) => createPlanningReview({ kind, priorReviewKind: kind === 'quality' ? 'fidelity' : undefined,
  revision: 'r1', candidateSha256: 'a'.repeat(64), reviewer: 'reviewer', mode: 'independent', evidence: 'session-1',
  reference: 'reviews.md', sourceReferenceIds: ['brief'], taskIds: ['T1'], verdict: 'pass', findings: [], ...extra });

test('fidelity then quality reviews bind the same candidate and sources', () => {
  assert.deepEqual(reviewSequence(candidate, [review('fidelity'), review('quality')], { independentRequired: true }), { status: 'passed', errors: [] });
});
test('stale, incomplete and self-contradictory reviews fail closed', () => {
  for (const value of [review('fidelity', { revision: 'old' }), review('fidelity', { sourceReferenceIds: ['other'] }),
    review('fidelity', { verdict: 'pass', findings: [{ id: 'F1', kind: 'missing-requirement', severity: 'material', status: 'open', evidence: 'brief', expectedCorrection: 'restore', disposition: 'pending', requirementId: 'R1' }] })]) {
    assert.ok(validatePlanningReview(value, candidate, { requiredKind: 'fidelity' }).length);
  }
});
