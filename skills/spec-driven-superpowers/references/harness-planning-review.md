# Passive planning review

ASDS is deterministic and passive. The authorized harness owns reasoning, native
reviewer dispatch and operational provenance. ASDS never launches an LLM, daemon,
socket or provider. No ASDS service, private signing key or extra account is required.
It does not authenticate a malicious harness or certify semantic quality from hashes.

1. Coordinator freezes sources, contracts, boundaries, author actor/session and policy.
   Compile with `scripts/build-package.mjs --change DIR --spec SPEC.json`.
2. Inspect binding with `scripts/planning-review.mjs inspect --change DIR`.
3. Harness dispatches a read-only fidelity reviewer, reads its actual terminal session
   and messages, and saves the observed result bytes inside the package.
4. Record ONE explicit `asds.harness-planning-review/1` JSON using
   `scripts/planning-review.mjs record --change DIR --input F.json`.
5. Only after registered fidelity PASS, dispatch quality in a different reviewer
   actor/session, using the exact fidelity `envelopeDigest`. Parent coordinator is
   allowed; agent role is not execution identity. Both sessions differ from author.
6. Save quality evidence and record Q.json. No name-only approval, fabricated session,
   implicit verdict, fabricated grant or auto-edit of task boundaries is permitted.
7. `scripts/planning-review.mjs ready --change DIR` checks both reviews and bytes.
8. Inspect again for manifest CAS, then `publish --change DIR --observer SESSION_ID
   --expected-manifest-sha256 HASH --output RECEIPT.json`. This requires the received
   destination persistence grant. It reopens inventory, publishes final delivered
   state and reopens again. `verify --receipt RECEIPT.json` works in a fresh Node.

The envelope explicitly supplies package/revision/material/inventory/policy digests,
author, reviewer, assignment, kind, exact priorReviewDigest (null for fidelity),
verdict pass|fail|blocked, findings, limitations, task/source inventories and evidence
{harness, sessionId, messageIds, requestDigest, resultDigest, persistedResultPath,
observedBySessionId}. `envelopeDigest` hashes the JSON object without that field.
Inputs are observed by the harness, not invented by the registrar. Evidence paths
are safe relative files inside DIR; resultDigest hashes their exact bytes.

### Author versus harness coordinator

`author` identifies the actual preparer, unchanged by review. The actual requesting
harness coordinator supplies nonempty `assignment.requestedBySessionId`; its actual
readback supplies the SAME `evidence.observedBySessionId`. That coordinator may differ
from the author and must stay consistent across F and Q. Reviewers' actor/session
identities are distinct from author and coordinator, and F/Q are distinct from each
other; reusing an agent role is not reusing an actor. A native coordinator parent is
allowed. The existing author=coordinator case is also valid. Never substitute an
author ID for a different observed requester/observer to satisfy a validator. The
coordinator is represented by its session identity in this version; the authorized
harness owns the actual actor/session mapping, not an ASDS identity service.

### Updating review/convergence/delivery layers after actual observations

`record` stores ONE supplied review and its evidence references, resets readback and
keeps `reviewing`. It does NOT set C12–C16 satisfied. Layers are excluded from
`planningCandidateSha256` and the material `inventoryDigest`; they ARE included in
`planningReadbackSha256`. This avoids a review-output hash cycle without excluding
source/author/policy/task material. Native F/Q still bind the exact unchanged candidate.

Safe sequence for a package initially blocked in C12/C13/C14/C15/C16:

1. Actual native F dispatch/readback -> explicit F registration. Only a registered
   F PASS permits native Q dispatch, bound to that exact envelopeDigest.
2. Actual independent Q/readback -> explicit Q registration. If any material finding
   requires changing source/contracts/decisions, stop: revise, recompile, fresh F/Q.
   Do not relabel layers or discard findings to evade that gate.
3. Only after BOTH actual PASS results and actual convergence, the coordinator writes
   `observed-layer-assessments.json` OUTSIDE the material package. It contains exactly
   C12, C13, C14, C16, each with explicit status `satisfied`, a specific observed reason
   and existing reference IDs (such as `review:fidelity`, `review:quality` and their
   evidence references). C14 states how findings were resolved or that the observed
   reviews reported none; not a prewritten success default. C16 reconciles the current
   READY-for-delivery state, references, limitations and remaining work; it must NOT
   claim publication/delivery already happened. C15 is intentionally left blocked.
4. Apply these observations using the existing deterministic API, not `build --spec`
   against a stale author spec. Example below requires actual F/Q files and the exact
   expected candidate from the reviewed binding. This is a recipe, NOT an instruction
   to create successful assessments before review:

```sh
export SOURCE=/absolute/asds/source
export PACKAGE=/absolute/authorized/package
export ASSESSMENTS=/absolute/observed-layer-assessments.json
export EXPECTED_CANDIDATE=actual_reviewed_candidate_sha256
node --input-type=module <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const {SOURCE,PACKAGE,ASSESSMENTS,EXPECTED_CANDIDATE}=process.env;
const {syncPlanningPackage}=await import(pathToFileURL(path.join(SOURCE,'lib/package-builder.mjs')));
const {harnessCandidate,verifyHarnessReviewFiles}=await import(pathToFileURL(path.join(SOURCE,'lib/harness-planning-review.mjs')));
const before=JSON.parse(fs.readFileSync(path.join(PACKAGE,'planning-manifest.json')));
assert.equal(before.state,'reviewing');
assert.equal(before.candidateSha256,EXPECTED_CANDIDATE);
assert.deepEqual(verifyHarnessReviewFiles(PACKAGE,before),[]);
const observed=JSON.parse(fs.readFileSync(ASSESSMENTS));
assert.deepEqual(Object.keys(observed).sort(),['C12','C13','C14','C16']);
for(const assessment of Object.values(observed)) {
  assert.equal(assessment.status,'satisfied');
  assert.ok(typeof assessment.reason==='string' && assessment.reason.trim());
  assert.ok(Array.isArray(assessment.references) && assessment.references.length);
  assert.ok(assessment.references.every(id=>before.references.some(r=>r.id===id)));
}
const layers={...before.layers,...observed};
// The ready gate is deliberate: if recompilation changes material/reviews,
// readiness fails and the compilation transaction restores the previous package.
const after=syncPlanningPackage(PACKAGE,{state:'ready',layers,
  reconcilePackages:false,writeDagMermaid:false,writeDagStatus:false}).manifest;
assert.equal(after.candidateSha256,before.candidateSha256);
assert.equal(harnessCandidate(after).inventoryDigest,harnessCandidate(before).inventoryDigest);
assert.deepEqual(after.reviews,before.reviews);
assert.equal(after.state,'ready');
assert.equal(after.layers.C15.status,'blocked');
assert.equal(after.readback,null);
console.log('Observed layers applied; ready, material/reviews unchanged; not delivered.');
JS
node "$SOURCE/scripts/planning-review.mjs" ready --change "$PACKAGE"
node "$SOURCE/scripts/planning-review.mjs" inspect --change "$PACKAGE"
```

For the current C10 kit, SOURCE is the source checkout, PACKAGE is
`/tmp/opencode/asds-passive-c10-native/package`, EXPECTED_CANDIDATE is the value in
its frozen binding. This implementation does NOT create ASSESSMENTS or change the
kit. The current kit still has no F/Q, so step 4 intentionally cannot pass now.
On nonstandard custom generated index formats, inspect a planned recompilation first:
material drift must block readiness, not be accepted as a layer-only change.

5. After ready, use the NEW manifestSha256 from inspect (layer output changed the
   manifest/CAS even though the material candidate did not). Under the actual grant,
   `publish --change "$PACKAGE" --observer ACTUAL_COORDINATOR_SESSION
   --expected-manifest-sha256 ACTUAL_READY_MANIFEST_HASH --output NEW_RECEIPT.json`.
   Store reopens the bound inventory, sets C15/readback and delivered through its
   own gate, then reopens final bytes. Reverify with a fresh Node `verify --receipt`.
   Do not set delivered or fabricate C15/readback manually. Updating layers after
   delivery changes final identity and requires a new valid readback, not reuse of
   an old receipt. No hash cycle was observed in the synthetic transition regression.

Material changes invalidate both reviews. Only recognized canonical index checkbox
progress is normalized; recompilation preserves `[x]`, not implementation proof.
Review/evidence bytes remain bound in delivery readback. Findings and coverage-blocking
limitations cannot become PASS. Fail/blocked need not invent a finding.

Historical `/1` and `/2` authority receipts are not this schema: retain them as history
and reconcile/review explicitly, never infer missing IDs. The Stage-3 consumer is a
separate deterministic state machine. Handoff requires separate current selection,
workspace observations and execution/persistence grants; planning delivery runs no task.
Native/legacy host drivers in repository `lib/host-bridge.mjs` are isolated from the
distributed planner/consumer payload and are not a planner runtime.

Plane export is project-neutral JSON only. The harness may apply it to an existing
authorized project and read it back; no project or issue is invented by ASDS.
