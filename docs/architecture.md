# ASDS architecture

## Three layers
1. **Core planning protocol**: OpenSpec intent, neutral planning manifest,
   `tasks.md` plus microcontracts, Superpowers planning/review practices and readback.
   It does not call a model provider or implement future tasks.
2. **Harness adapter**: discovery/loading paths, tool mapping, session capability
   checks, approvals, persistence, worker handoff and honest fallback.
3. **Project profile**: test commands, scope, resources, concurrency budget,
   evidence location and review/publication policy.

The [canonical skill](../skills/spec-driven-superpowers/SKILL.md) is the only
ASDS skill source. Collection directories group upstream skills in this repository;
installation flattens individual skill folders into the selected discovery path.
Internal ASDS references stay with its skill directory.

## Installation and activation
Skills normally live at user scope. Reusable schemas live in the OpenSpec user
data directory; project configuration, specifications and changes live in the
selected project's `openspec/`. Global installation is not workflow activation.
The [activation contract](../skills/spec-driven-superpowers/references/activation.md)
keeps ordinary questions free of engineering workflows and setup prompts. Suitable
ASDS project work checks existing state and asks before creating a missing root,
unless that exact initialization was already authorized. This gate is conversational
skill behavior; the explicit installer remains preview/apply, not interactive.

## Intake and readiness
Direct requests and Accelerate handoffs converge on one lifecycle. The latter reuse
classification/context while ASDS resolves remaining requirements. Receipt is not
acceptance; acceptance is not permission. The receiver never issues tool authority.
ASDS retains ownership only through planning revisions and returns planning outcome,
evidence, remaining planning work and limitations, then releases ownership.

Planning order is understanding/decisions -> proposal/specs/design as useful ->
microcontracts -> tasks index -> fidelity review -> quality review -> persistence/readback.
Upstream skills have an explicit ASDS mode for this order and one artifact home.
Future execution belongs to a separately selected consumer.

## Deterministic components
- `lib/handoff.mjs`: compatible intake, acceptance/decline, continuity and return data contracts.
- `lib/install.mjs`: build/preflight a complete additive file plan; apply with
  exclusive file creation and rollback on ordinary failures.
- `lib/contracts.mjs`: shared task validation and legacy consumer receipt checks.
- `lib/planning-graph.mjs`: pure composition/precedence graph, decision routing,
  initial execution frontier and task-manager projection.
- `lib/planning-coverage.mjs`: explicit requirement-to-leaf traceability.
- `lib/planning-lifecycle.mjs`: planning layers, readiness and delivery state.
- `lib/planning-review.mjs`: revision-bound fidelity/quality review envelopes.
- `lib/planning-store.mjs`: bounded publication, rollback and readback.
- `lib/validation.mjs`: real YAML parsing, schema/templates, linked contracts and
  scenario coverage; a present planning manifest is also lifecycle-, hash-,
  decision-route- and task-manager-validated.
- `lib/git-scope.mjs`: base-to-HEAD scope plus staged, unstaged and untracked state.
- `scripts/validate.mjs`: package/change validation and optional Git-backed receipts.

No validator executes user-provided verification command strings. Consistency
checks are not proof of review independence, test authenticity or sandboxing.
Dirty fingerprints require quiescent files and exclude ignored untracked content.
The supplied base must come from the coordinator, not an untrusted receipt.

## Consumer compatibility
Planning states are draft, reviewing, ready, delivered, partial, blocked and
superseded. New future-work checkboxes stay open. Snapshot changes invalidate
planning reviews/readback. Parallelism is only a recommendation in the plan.
Task-manager state is a separate consumer projection: `ready` means executable at
the initial frontier, `waiting` names incomplete prerequisites, `blocked` names
decision/policy blockers, and `completed` is supplied only by a later consumer.

Legacy orchestration, TDD, code-review and integration modules remain optional
consumer utilities. They are not part of the ASDS planning lifecycle.

## Recovery and durable handoff
Record process result, tool return, agent lifecycle and file delivery separately.
Replacements receive the contract, context, base, partial files and diagnostics;
they must not overwrite a possibly live worker. After three unsuccessful recovery
attempts, defer the blocker and its dependent work without marking either complete.
Long-running checks may persist logs/exit status outside the inspected tree so a
lost tool response does not destroy evidence or force blind re-execution.

## Compatibility boundary
OpenSpec 1.14.0 is fixed and exercised as a real CLI in isolated fixtures. Its
project schema location is `openspec/schemas`; user schemas use the global **data**
directory, not configuration storage. Adapters are documentation with explicit
runtime verification limits. CLI availability does not prove discovery, delegation,
model access or billing. No global config migration or inference service is added.
