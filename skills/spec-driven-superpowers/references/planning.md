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
planning reviewer. The manifest declares its risk domains explicitly.
After three non-progressing correction rounds, return partial/blocked; the limit
never grants approval.

## Completion

`ready` means the package can be persisted; `delivered` requires matching readback.
Partial planning preserves ready independent leaves and names blockers/dependents.
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
