# Planning package and task contracts

`tasks.md` is the sole task index and the only inventory read by directory-based
task-manager projection. Numeric task IDs appear in strictly increasing order,
assigned IDs survive revisions, and index titles exactly equal contract titles.
Its `Wave N: ID, ID` declarations exactly match the manifest projection.
`planning-manifest.json` identifies the package
revision, sources, layers, decisions, reviews, destination and readback; it does not
duplicate task content or become a second future-progress ledger. Its delivered
`taskManager.completedTaskIds` describes the planning snapshot. Later checkbox
progress in `tasks.md` is normalized out of planning/reference/review identity.

Each linked `tasks/task-ID.md` has YAML frontmatter with stable `id`, stable `title`, `nodeType`,
optional `parentId`, `requirements`, `dependsOn`, dependency explanations, exact
future write paths, resources, scenarios and verification commands. Paths are
repository-relative POSIX paths without globs or traversal. Quote leading-zero IDs.
Leaves also declare an accountable `owner`, `decisionInputs` and
`resolvesDecisions`. One leaf resolves one independently reviewable decision; a
multi-decision leaf needs `decisionBundleReason` proving the decisions share owner,
evidence boundary and inseparable output.

Packages may contain packages or leaves at any justified depth. Packages are not
executable. `parentId` is composition, not precedence. `dependsOn` is a separate DAG;
each edge names its reason and required output. Sharing a path/resource recommends
sequential consumption but does not merge independent outcomes.

Leaf bodies must let a consumer without conversation history understand the outcome,
inputs, inclusions/exclusions, positive/negative/preservation acceptance, future
verification with expected results and definition of future completion.
Every dependency names an exact required output in frontmatter and repeats it in the
body. The package exports a deterministic `taskManager` projection with `ready`,
`waiting`, `blocked` and `completed` states, `waitingOn`, `blockedBy`, reverse
`blocks`, conflict-aware waves and parallel peers. Delivered does not mean every
task is initially executable.
Each projected leaf also names `serializesWith`; this turns write/resource conflicts
into a usable exclusion relation for simple queues without inventing DAG precedence.

An unresolved material decision has exactly one resolver task and one localized
blocker. The blocker holds consumers and their dependents, never the resolver itself.
Every consumer lists the decision in `decisionInputs` and depends transitively on
the resolver. This makes decision ownership and unblock flow exportable without
requiring a task manager to interpret prose.

Open material decisions localize blockers. Structural validation cannot certify
semantic quality. Fidelity review precedes quality review and both bind the same
candidate, sources and task inventory. Checkboxes are open in the initial planning
delivery; after handoff they are mutable consumer progress, not an eternal prose claim.
The planner must not reset valid `[x]` entries. Reopening belongs to the consumer's
explicit reopen protocol and requires its matching receipt/journal evidence or other
concrete proof that completion is contradictory; a manifest hash of normalized-open
checkboxes is not that proof.

If actual corruption is proved, exact restoration of all candidate, reference,
manifest and review bytes to a previously delivered snapshot preserves the earlier
review and is reported as `restored existing delivered state`; it is not a new
candidate. This recovery rule never authorizes erasing valid post-handoff progress.
A material byte or contract change produces a new candidate and invalidates prior
review until fresh fidelity and quality pass. A closed filesystem snapshot comparison
may prove byte equality, but it does not authenticate a database, signature, reviewer
or host authority. Equality alone is reported as `existing package bytes unchanged`;
only separate qualified evidence of both prior delivery and intervening corruption can
support the restoration status.

Package lineage is an identifier, not write authority. When an accepted reuse handoff
lacks a locator, bounded read-only discovery may inspect direct children of
`openspec/changes`. Exactly one regular package may be selected; zero or multiple
matches return `locator-required`. The located index, manifest and references are read
before reviewer preflight. A currently delivered package whose material binding is
unchanged, including canonical checkbox progress, retains its existing review. Only a
materially new candidate requires fresh review availability. The filesystem comparator
reports progress only as `existing package state with updated progress` and leaves
`freshReviewRequired` null; declared state or caller naming is not delivery proof.

Planning persistence uses `lib/planning-store.mjs`; ordinary errors roll back bytes
in memory and clean operation temporaries. Delivery requires a matching readback.
The store returns an `asds.planning-store-receipt/1` inventory that binds revision,
absolute destination, manifest, index, every declared file and SHA-256. A planning
return reopens that destination and compares the current bytes, manifest references,
readback envelope and lifecycle gate. `storeVerified` is not an authority signal.
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


`createPlanningReturn` emits protocol v2 and releases ASDS ownership only after
those current checks produce `delivered`. Drift, missing sensitive review evidence
or any other downgrade keeps `owner: asds`, leaves `nextOwner` empty and returns
non-delivered planning with explicit remaining work. The legacy v1
return and code delivery receipts remain readable compatibility APIs, not proof of
planning delivery.

When `planning-manifest.json` exists, `npm run validate -- --change <root>` (or
`node <skill-dir>/scripts/validate.mjs --change <root>`) validates its lifecycle
gate, exact contract inventory, reference hashes, review policy and task-manager
projection. For pre-review candidates (`state: "draft" | "reviewing"`,
`boundary.review.verdict: "pending"`, and routed `openDecisions`), run
`node <skill-dir>/scripts/validate.mjs --change <root> --candidate` to validate
100% of structural, DAG, scenario, decision-routing, wave, and SHA-256 reference
parity before independent review.

To compile or synchronize `tasks.md` (with `Planned Waves`), `dag.mmd`,
`dag-status.md` (Live DAG Status View), and `planning-manifest.json` (with exact
15-field task projection, `taskManager`, and SHA-256 `references`) in one pass without
ad-hoc generator scripts, run:
`node <skill-dir>/scripts/build-package.mjs --change <root> [--spec <spec.json>] --candidate`.
The role:index tasks.md hash normalizes only supported checkbox state; all other
bytes and references remain exact. OpenSpec validation alone is insufficient.
