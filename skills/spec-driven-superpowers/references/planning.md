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
Authentication, authorization, credentials, security, financial, destructive and
sensitive-data domains are never `ordinary-low`; they require an independent
planning reviewer. The manifest declares its risk domains explicitly. Review
completion is accepted only through the host-owned capability, from a distinct
zero-write reviewer assignment whose live session, result and persisted receipt
bind the current candidate, manifest and complete byte inventory. Caller-authored
review objects and reconstructed receipts remain untrusted even when every digest
is syntactically correct.
After three non-progressing correction rounds, return partial/blocked; the limit
never grants approval.

## Completion

`ready` means the package can be persisted; `delivered` requires matching readback.
Partial planning preserves ready independent leaves and names blockers/dependents,
but ASDS retains ownership. Only a `delivered` return may select a later consumer.
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
- **Atomic post-review transition (`--record-review`):** Once independent `fidelity` and `quality` reviews pass, run `node <skill-dir>/scripts/build-package.mjs --change <change-dir> --record-review <reviewer-id-or-json>` to atomically flip leaf `boundary.review.verdict` to `"ready"`, bind `candidateSha256`, record both review envelopes, recompute `readbackSha256`, populate `usableTasks`, and transition `state` to `"partial"` (when active decision blockers remain) or `"ready"` / `"delivered"`.
- **Plane issue projection (`--export-plane`):** When projecting leaf tasks to Plane, run `node <skill-dir>/scripts/build-package.mjs --change <change-dir> --export-plane <out.json>` to generate ready-to-submit Plane issue payloads (`P4Y-I · ` title prefix, wave/status/blocker metadata, and Markdown/HTML bodies) in one step.
- **Visual DAG status (`dag-status.md` / `--print-dag`):** Present the generated `dag-status.md` visual dependency tree (or print it via `--print-dag`), fan-in groups, status table, and next executable frontier in the user-facing response whenever creating or evolving the task graph.
