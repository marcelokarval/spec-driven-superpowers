# ASDS architecture

## Three layers
1. **Core protocol**: OpenSpec intent, `tasks.md` plus microcontracts, Superpowers
   TDD, scoped delivery, reviews and evidence. It does not call a model provider.
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
ASDS retains ownership through subtasks and resumptions and returns outcome, evidence,
remaining work and limitations without a second Accelerate closure gate.

Planning order is understanding/decisions -> proposal -> specs/design -> microcontracts
-> tasks index -> readiness -> authorized execution. Upstream skills have an explicit
ASDS mode for this order and one artifact home. Completion receipts bind contracts,
prerequisites and shared planning; integrated evidence/reviews bind the final revision.

## Deterministic components
- `lib/handoff.mjs`: compatible intake, acceptance/decline, continuity and return data contracts.
- `lib/install.mjs`: build/preflight a complete additive file plan; apply with
  exclusive file creation and rollback on ordinary failures.
- `lib/contracts.mjs`: task DAG, conservative wave selection and receipt checks.
- `lib/validation.mjs`: real YAML parsing, schema/templates, linked contracts and
  scenario coverage.
- `lib/git-scope.mjs`: base-to-HEAD scope plus staged, unstaged and untracked state.
- `scripts/validate.mjs`: package/change validation and optional Git-backed receipts.

No validator executes user-provided verification command strings. Consistency
checks are not proof of review independence, test authenticity or sandboxing.
Dirty fingerprints require quiescent files and exclude ignored untracked content.
The supplied base must come from the coordinator, not an untrusted receipt.

## State and concurrency
Planned → delivered → reviewed → integrated. Only integrated and reverified work
is checked off. Snapshot changes invalidate prior tests/reviews. Self-review does
not satisfy independent review. Sequential execution preserves the full method.

Parallelism is a scheduling decision, not a universal directive. The existing
Superpowers sequential subagent workflow remains valid within each workstream.
Independent concurrent workstreams need distinct worktrees and shared-resource
ownership; identical cache/database/port resources defeat filesystem isolation.

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
