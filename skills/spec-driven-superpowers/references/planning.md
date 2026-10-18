# Planning method and readiness

## Read scope and understanding

Reuse received context. Read the selected project and necessary instruction/skill
references only. Before an outside-project read, name the missing fact and exact
source. Never search sibling projects or old evaluation evidence merely because it
is accessible. Report reads, executable version checks, tests and writes distinctly.

Ask only material questions whose answers change behavior, acceptance, interfaces,
security, scope or authority. Reuse resolved decisions. A bounded investigation is
valid only when evidence cannot be obtained during planning or future execution is
intrinsic to the question.

For authentication work, distinguish presentation, client-side readiness, server
admission and provider credential acceptance. Preserve existing credentials unless
an authoritative requirement explicitly changes that compatibility. A creation or
password-update policy is not automatically a sign-in rule. If requested UX would
prevent a provider-recognized credential from being attempted, represent the
authentication and compatibility decision explicitly, include affected existing
users in acceptance, and require independent review. `risks: []`, a small diff or
the word `frontend` cannot downgrade that planning boundary.

## One planning home

OpenSpec may organize proposal/spec/design, but ASDS always emits the same neutral
planning product: manifest, index and task contracts. There is no second plan.
OpenSpec absent/refused or a different configured schema does not change the contract
and must not trigger configuration replacement.

## Layers and readiness

Evaluate C01-C16: request product, context, understanding, gaps, research,
alternatives, specification, design, decomposition, relations, microcontracts,
fidelity review, quality review, correction, persistence/readback and delivery.
Each layer is satisfied, reused, not applicable with reason, or blocked with affected
tasks. Required product layers cannot be skipped.

Split independently verifiable results, not files or command steps. Keep atomic work
flat; use recursive packages only for meaningful composition. Preserve IDs and source
requirements during refinement. A package is ready when descendant coverage and its
aggregate acceptance are coherent, never because children were implemented.
Allocate numeric task IDs monotonically and never reorder or renumber existing
identities merely to make execution waves look sequential. `tasks.md` remains the
ordered authority; wave declarations are a separate projection of the DAG.
Split different decision owners, evidence families and independently usable outputs
into separate leaves even when they contribute to one feature. Group them under a
package and allow parallel investigation; consolidate only through an explicit
dependent output. A task that mixes UI, server policy and credential compatibility
needs a concrete inseparability reason, not merely a shared feature name.
Every precedence edge states the exact upstream artifact/state consumed and why the
dependent outcome cannot start without it. Shared feature names, file proximity or
an aesthetically preferred sequence are not dependency reasons.

## Reviews and convergence

Fidelity review checks loss, invention, authorization drift and source obligations.
Quality review checks boundaries, feasibility, interfaces, dependency outputs and
acceptance demonstrability. Both receive source material and artifacts, not the
author's narrative alone. Correct material findings and review the changed revision.
Use the following semantic checks, not just schema validity:

- **Fidelity:** preserve negative and compatibility obligations; identify invented
  exceptions or exemptions and their missing authority. Map scenarios to the actual
  leaf behavior, not merely a broad requirement label. Material decisions must appear
  in the decision/resolver/consumer relations, not only in prose.
- **Quality:** every required output has an identified producer and consumer; interface
  seams have a write owner for the connecting change. Integrated acceptance must wait
  for its prerequisites. A valid transitive dependency need not become a direct edge;
  development against agreed ports/contracts can precede integrated acceptance.
  If an input or edge was omitted, report that planning omission rather than claiming
  the scheduling algorithm failed to infer it.

Authentication, authorization, credentials, security, financial, destructive and
sensitive-data domains are never `ordinary-low`; they require an independent
planning reviewer. The manifest declares its risk domains explicitly. Review is a
required part of the planning flow and its gate, bound to the relevant tasks, sources
and candidate content, with fidelity before quality. The harness decides how to
provide and ensure the reviewer: a subagent, new or dedicated session, coordinator,
or another supported arrangement. No particular tool or session topology is a
universal product requirement. A coordinator may coordinate or review when not the
author and when applicable independence is met; authorial PASS is not independent
review. Preserve actual review evidence, not invented identities or receipts.
The optional [current toolkit adapter](adapters/opencode.md) has narrower identity,
session and evidence fields; these are compatibility limits, not a host-owned
capability or proof of semantic quality from hashes.
After three non-progressing correction rounds, return partial/blocked; the limit
never grants approval.

## Completion

`ready` means the package can be persisted; `delivered` requires matching readback.
Partial planning preserves ready independent leaves and names blockers/dependents,
but ASDS retains ownership. Only a `delivered` return may select a later consumer.
Partial describes incomplete planning, not a complete plan's well-contracted future
decisions. Such decisions retain a resolver, accountable blocker and exact affected
consumers/dependents; they block execution, not `ready`/`delivered` planning after
current F/Q PASS. At least one usable leaf is required. Incomplete mandatory planning
layers still prevent full delivery. The manifest, readback and receipt expose
`usableTasks` and `blockedTaskIds`; consumers must exclude the latter from dispatch.
Planning-ready contracts are not the execution frontier: export which leaves are
ready now, which wait on prerequisite outputs, which are decision/policy blocked,
what each leaf unblocks, and the conflict-aware planned waves.
OpenSpec-backed packages pass strict delta syntax before delivery: level-two delta
headings, RFC 2119 requirement bodies and requirement-specific WHEN/THEN scenarios.
An executable absent from PATH is not evidence that OpenSpec is unavailable. When
the active ASDS source is known, check its lockfile-pinned Node entrypoint directly;
do not install or create a parallel runtime as a fallback.
The return distinguishes planning contribution from original requested product and
releases ASDS ownership. Future implementation progress is outside this lifecycle.

## Fast package compilation, candidate validation and visual DAG status

- **One-pass package compilation and sync (`scripts/build-package.mjs`):** Never hand-compute SHA-256 reference digests, `Planned Waves`, bottom-up `package` parent unions (`write`, `resources`, `scenarios`, `requirements`), or repetitive YAML boilerplate across `tasks/task-XXXX.md`, `tasks.md`, `dag.mmd`, `dag-status.md`, and `planning-manifest.json`. Define `package-spec.json` (or author/update `tasks/task-XXXX.md`) and run `node <skill-dir>/scripts/build-package.mjs --change <change-dir>` to reconcile `nodeType: "package"` hierarchies, compile, and synchronize all artifacts in a single deterministic pass.
- **Pre-review candidate validation (`scripts/validate.mjs --candidate`):** While a candidate is pre-review (`state: "draft" | "reviewing" | "blocked"`, `boundary.review.verdict: "pending"`, or routed `openDecisions`), validate structure and cross-links with `node <skill-dir>/scripts/validate.mjs --change <change-dir> --candidate`.
- **Review recording and delivery are separate:** `--record-review <review.json>` records ONE explicit harness envelope, fidelity first and then quality bound to the registered fidelity digest. It does not change leaf boundaries from `pending` to `ready`, record two reviews at once, or publish `partial`/`ready`/`delivered`. Use `planning-review.mjs inspect`, `record`, `ready`, `publish` and `verify` as described in the [toolkit adapter](adapters/opencode.md). Current F/Q PASS plus verified persisted evidence allows complete pending boundaries without editing task bytes; incomplete boundaries still fail. `ready` also checks planning layers and decision routing; a contracted future decision is not a planning defect. `publish` requires `ready` plus authorized destination persistence; `verify` checks the receipt and usable/blocked scope against current bytes. Material changes require recompilation and fresh fidelity then quality, never reuse of an old binding after contract edits.
- **Plane issue projection (`--export-plane`):** When projecting leaf tasks to Plane, run `node <skill-dir>/scripts/build-package.mjs --change <change-dir> --export-plane <out.json>` to generate ready-to-submit Plane issue payloads (`P4Y-I · ` title prefix, wave/status/blocker metadata, and Markdown/HTML bodies) in one step.
- **Visual DAG status (`dag-status.md` / `--print-dag`):** Present the generated `dag-status.md` visual dependency tree (or print it via `--print-dag`), fan-in groups, status table, and next executable frontier in the user-facing response whenever creating or evolving the task graph.
