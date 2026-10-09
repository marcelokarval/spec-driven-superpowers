# Planning package and task contracts

`tasks.md` is the sole task index and the only inventory read by directory-based
task-manager projection. Numeric task IDs appear in strictly increasing order,
assigned IDs survive revisions, and index titles exactly equal contract titles.
Its `Wave N: ID, ID` declarations exactly match the manifest projection.
`planning-manifest.json` identifies the package
revision, sources, layers, decisions, reviews, destination and readback; it does not
duplicate task content or track future implementation progress.

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
candidate, sources and task inventory. New delivered plans keep checkboxes open.

Planning persistence uses `lib/planning-store.mjs`; ordinary errors roll back bytes
in memory and clean operation temporaries. Delivery requires a matching readback.
`createPlanningReturn` emits protocol v2 and releases ASDS ownership. The legacy v1
return and code delivery receipts remain readable compatibility APIs, not proof of
planning delivery.

When `planning-manifest.json` exists, `npm run validate -- --change <root>` validates
its lifecycle gate, exact contract inventory, reference hashes, review policy and
task-manager projection. OpenSpec validation alone is insufficient.
