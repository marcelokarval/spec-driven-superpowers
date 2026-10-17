# Intake and continuity contract — v1

## Two entry paths, one lifecycle
Direct requests: classify the actual request and apply activation.md. Conversation
gets a direct answer; bounded reversible low-risk work can proceed with proportional
verification. Uncertainty, material risk, dependent steps or explicit ASDS selection
warrant the structured flow. Small diffs can still be high risk.

Accelerate requests: consume its existing context, do not repeat classification or
ask questions already answered. Check contradictions and only investigate missing
facts relevant to the next step. Correct an inconsistent classification with a
concrete explanation. ASDS remains independently usable without Accelerate.

An empty or understated `risks` list is received context, not proof of low risk.
Before acceptance, compare the requested behavior with the cited project/provider
authority. Login, credential acceptance, recovery, MFA and authorization remain
materially sensitive even when phrased as a button, frontend or one-line change.
A visual request does not authorize changing the credential policy accepted by the
server or provider. Never infer that signup or password-change requirements also
govern sign-in or legacy credentials. Record a contradiction as a material decision
or gap and keep implementation stopped; do not repair the packet by silently
choosing a policy.

## Compatible input
`lib/handoff.mjs:receiveHandoff` accepts Accelerate v1.0.0's seven fields unchanged:
`objective` and `project` are nonempty strings; `scope` is a nonempty string array;
`constraints`, `risks`, `references` are string arrays; `authorizations` is an array
of `{action, scope, decision, source}` where decision is `granted` or `denied`.
An optional `protocolVersion: 1` is accepted. Absence means v1. Unknown versions or
fields fail explicitly, rather than being discarded. Future formats need an explicit
adapter/version. No new input field is mandatory for existing Accelerate packets.

Preserve the user's language and values verbatim. A textual unknown project stays
unknown and becomes a clarification gap, never a guessed path. The direct-entry
adapter may build the same context in memory from the conversation; the user need
not provide JSON or another document. No packet file per task is required.

## Authority and lifecycle
Authorization records describe prior decisions; they do not prove permission and
ASDS never consumes implementation authorization.
Consult the actual conversation and harness/project policy before the relevant
operation. Conflicting records need scope/source reconciliation, not last-item-wins.
Never turn a missing record or silence into consent. Refusing OpenSpec initialization
allows accepted work to continue without OpenSpec. Do not repeat a refused setup
question or an already resolved approval for the same scope.

`received` means the input has valid structure. `acceptWork` makes ASDS the planning
lifecycle owner and returns `accepted`, possibly with clarification gaps. Neither state means
implementation is authorized, started, reviewed or completed. The helper always reports
`executionAuthorized: false`: it is not a permission issuer. The harness and the
user's actual instructions determine which actions may proceed. Independent read-only
work can continue while dependent actions wait for a necessary answer.

`declineWork` reports a concrete reason for refusing lifecycle ownership; distinguish
that from accepting work with gaps. Invalid packets fail before acceptance.
After acceptance, subtasks, reviews and normal resumption remain in ASDS; do not route
them through Accelerate again. `continueWork` preserves state; a material change
records a reason and affected task IDs as `needs-reassessment`. Preserve unaffected
work. Resolve the affected scope and approvals before reaccepting it.

Preserve read boundaries from scope, constraints and authorized references using
the existing v1 fields; no new mandatory packet field is needed. After acceptance,
ASDS applies planning.md's read-scope rules on every continuation and delegation.

## Return
`createReturn` remains the legacy v1 structural return. It produces `protocolVersion`, `owner: asds`, `status`, `outcome`,
`evidence` references, `remainingWork` and `limitations`. Status is `completed`,
`partial`, `blocked` or `cancelled`, never `received`. Completion requires no open
intake gaps/reassessment/remaining work and evidence references. This structural
check does not prove evidence authenticity, integration, deployment or runtime health.
Use the delivery/closure checks separately.

`createPlanningReturn` is the planning-only v2 return. Delivered status requires
a current `asds.planning-store-receipt/1` verified against destination bytes,
manifest, index, file inventory, hashes, readback and lifecycle. A caller-supplied
`storeVerified` boolean has no authority. Missing or invalid review domains fail
closed, and protected domains cannot be downgraded to `ordinary-low`. # Passive planning review

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


Recorded review is operational harness evidence, never cryptographic semantic certification. Only a delivered return releases ASDS ownership and distinguishes the
planning contribution from the original requested product. If implementation was
originally requested, it remains `not_fulfilled` for a caller-selected consumer.
Accelerate may present this return without adding another planning review.

## Verification
`node scripts/check-accelerate-handoff.mjs --accelerate /existing/accelerate`
loads the real producer's core/routing.py read-only with Python bytecode disabled,
then consumes its validated packets through this receiver. It checks grants,
refusals, missing context, resumption and direct-entry parity of limits/results.
It is a real producer/consumer data-path check, not proof that a model loaded skills
or followed the conversational protocol. Live harness evaluation remains separate.
