# Native harness adapter

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
