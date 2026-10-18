# Optional current toolkit adapter

## Scope of this adapter

The [product review requirement](../planning.md#reviews-and-convergence) is
transport-neutral: the harness supplies and ensures actual review, bound to content,
with fidelity before quality and applicable independence. It may use subagents,
new/dedicated sessions, a non-author coordinator or another supported arrangement;
ASDS does not universally mandate one tool or session topology. This document instead
describes the narrower compatibility contract of the current optional Node toolkit.
It does not claim that every product-level arrangement is supported by this adapter.

## Passive planning review

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
   actor/session, using the exact fidelity `envelopeDigest`. Both reviewer actors and
   sessions must differ from the author. A non-author assignment requester/coordinator
   may review; the same requester/observer remains bound across F/Q. A parent
   relationship or role name alone neither grants nor denies eligibility.
6. Save quality evidence and record Q.json. No name-only approval, fabricated session,
   implicit verdict, fabricated grant or auto-edit of task boundaries is permitted.
7. `scripts/planning-review.mjs ready --change DIR` recompiles and checks contract
   readiness, both reviews, their bytes and current lifecycle gates. Recording never
   flips leaf `boundary.review.verdict` from `pending` to `ready`. Complete pending
   boundaries are accepted in this verified package context, not by detached generic
   readiness. Missing boundary fields still fail. Valid future decision blockers
   restrict execution, not full planning delivery; incomplete planning layers or
   zero usable leaves still prevent `canReady`.
8. Inspect again for manifest CAS, then `publish --change DIR --observer SESSION_ID
   --expected-manifest-sha256 HASH --output RECEIPT.json`. This requires the received
   destination persistence grant and current `ready` state. It reopens inventory,
   publishes final delivered state and reopens again. `verify --receipt RECEIPT.json`
   works in a fresh Node.

Each invocation of `record` registers one envelope, not an F/Q pair, and leaves the
manifest `reviewing`; it does not publish partial, ready or delivered planning.
The equivalent builder option is `scripts/build-package.mjs --change DIR
--record-review REVIEW.json`, not a reviewer-name shortcut. `inspect` reports binding,
manifest SHA-256 and review-file errors; it does not perform semantic review or
establish readiness. `verify` compares the receipt with current persisted delivery;
it does not supply missing review or publication authority.

Freeze complete contract boundaries before review; verdict `pending` may remain in
the reviewed bytes. If boundaries or other material
content must change afterward, recompile and obtain fresh fidelity then quality for
the new binding; never edit contracts after PASS and claim the old review still
applies. An unmet gate is reported as a concrete blocker, not bypassed by manual
state/boundary edits. A well-contracted future decision needs a resolver, responsible
blocker and routed consumers/dependents. A complete reviewed plan can be delivered
while these consumers wait; partial is reserved for incomplete planning. New
manifest/readback/store receipts expose `usableTasks` and `blockedTaskIds`, and the
execution handoff excludes blocked leaves. Receipt verification recomputes this scope
and rejects disagreement. Existing receipts without the additive fields remain
readable for legacy scope; a delivered package with future blocked leaves requires
explicit scope in readback and receipt. No review field authenticates a hostile
harness or manufactures semantic approval.

The envelope explicitly supplies package/revision/material/inventory/policy digests,
author, reviewer, assignment, kind, exact priorReviewDigest (null for fidelity),
verdict pass|fail|blocked, findings, limitations, task/source inventories and evidence
{harness, sessionId, messageIds, requestDigest, resultDigest, persistedResultPath,
observedBySessionId}. `envelopeDigest` hashes the JSON object without that field.
Inputs are observed by the harness, not invented by the registrar. Evidence paths
are safe relative files inside DIR; resultDigest hashes their exact bytes.

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
