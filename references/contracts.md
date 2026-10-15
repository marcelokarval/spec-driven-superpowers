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
Sensitive packages additionally require an `asds.independent-review-receipt/1`
from a qualified host-private or signed durable trust root. No such root exists in
this public source payload: `createPlanningReviewAuthority` and
`hostCompletePlanningReview` therefore fail closed, and a JavaScript adapter cannot
mint or revalidate delivery authority. Fake adapters validate shapes only. Sensitive
returns remain non-delivered with ASDS ownership until a separately deployed host
can bind reviewer identity/session, current manifest and the complete file inventory
without exposing its authority to model-visible code.

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
