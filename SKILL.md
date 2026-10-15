---
name: spec-driven-superpowers
description: Produce reviewed and persisted implementation planning by combining OpenSpec traceability with Superpowers planning and review practices. ASDS plans; a caller-selected consumer implements.
---
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"planner.entry","route":"planner","mode":"planning","activation":{"handoff":"not_applicable","package":"not_applicable","selection":"not_applicable","executionGrant":"not_applicable","persistenceGrant":"not_applicable"},"assignment":"not_applicable","fallback":{"missingWorker":"not_applicable","missingBoundary":"not_applicable","root":"not_applicable","sequential":"not_applicable"},"planner":"owner","standalone":"planning_only"} -->
# Autonomous Spec-Driven Superpowers
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `planner.entry`
- Route: `planner`
- Mode: `planning`
- Activation: handoff=`not_applicable`; package=`not_applicable`; selection=`not_applicable`; executionGrant=`not_applicable`; persistenceGrant=`not_applicable`
- Assignment: `not_applicable`
- Fallback: missingWorker=`not_applicable`; missingBoundary=`not_applicable`; root=`not_applicable`; sequential=`not_applicable`
- Planner behavior: `owner`
- Standalone behavior: `planning_only`
<!-- asds-mode:end -->

ASDS is a self-contained planning product. OpenSpec organizes requirements,
decisions and traceability; adapted Superpowers skills help understand, decompose,
write and review the plan. ASDS does not implement the future tasks it produces.

## Activation and intake

Read [intake](references/intake.md), [activation](references/activation.md),
[planning](references/planning.md), [contracts](references/contracts.md) and the
matching harness adapter. Conversation bypasses planning. Bounded direct execution
belongs to the caller, not ASDS. Suitable planning work reuses received Accelerate
context and preserves grants, refusals, scope and read boundaries.

Treat an empty or understated risk list as context, not proof of low risk. A
login-button request that changes which credentials reach the provider is
authentication and compatibility work; never infer sign-in policy from signup or
password-change rules. Record authority conflicts as gaps/material decisions and
keep future implementation stopped.

If the intended project lacks `openspec/`, ask once before creating that exact root.
Refusal continues with an equivalent neutral planning package at an authorized
destination; it never lowers output quality. Installation and activation are separate.

## Product boundary

ASDS owns only the planning contribution:

1. distinguish the original requested product from the planning contribution;
2. inspect authorized sources and resolve only material planning gaps;
3. record requirements, negative/preservation rules, decisions and design contracts;
4. produce a recursive composition tree plus a separate precedence DAG;
5. write `tasks.md`, every `tasks/task-ID.md`, and `planning-manifest.json`;
6. review fidelity before quality, correct material findings and re-review;
7. validate, persist and read back the same package revision;
8. return delivered, partial, blocked or cancelled planning; release ownership only
   for `delivered`, otherwise keep ASDS as owner and select no consumer.

The delivered manifest also includes a deterministic task-manager projection. It
must distinguish all reviewed contracts from the initial executable frontier and
make owners, decision resolvers, blockers, prerequisite outputs, reverse dependents,
waves, safe parallel peers and conflict exclusions machine-readable. Directory
projection reads the exact ordered inventory in `tasks.md`; it does not discover
extra task files or renumber identities to match execution order.

A new initial delivery keeps future implementation checkboxes open. After handoff,
checkboxes are consumer progress in the authoritative `tasks.md`; the delivered
manifest hash and its initial `taskManager.completedTaskIds` remain progress-normalized
planning identity, not contrary evidence and not a second progress ledger. Never
rewrite `[x]` to `[ ]` merely to restate that ASDS is planning-only. Reopening requires
the execution consumer's explicit reopen protocol and matching receipt/journal
evidence, or other concrete proof that the recorded completion is contradictory. If the original
request asked for implementation, the return explicitly says it remains unfulfilled
and the caller selects a consumer. The planning-only entry stops after delivery; an
instruction to implement does not make ASDS that consumer. When the caller later
selects the official consumer, ASDS contributes only the delivered package and the
caller-owned handoff envelope described by the protocol. It does not initialize a
journal, observe harness capabilities or dispatch a worker. A concrete plan defect
may return to ASDS as bounded revision work.

Resolve the planning package before review preflight. Use an exact safe relative locator
from the handoff when present. If lineage/locator is absent but the handoff explicitly
requires reuse of an existing plan, discover only direct children of
`openspec/changes` that contain regular `planning-manifest.json` and `tasks.md` files,
without following symlinks or scanning outside the workspace. Exactly one match may be
inspected; zero or multiple matches return a precise `locator-required` result. Missing
lineage never authorizes creating, revising, reopening or otherwise writing a package.

Read and evaluate the located `tasks.md`, manifest and bound references first. Read-only
discovery, inspection and structural validation are independent of reviewer availability.
Distinguish an unchanged delivered package, canonical checkbox progress, contradiction,
and a materially new candidate. An unchanged/progressed delivered package retains its
existing review and does not trigger reviewer preflight. Only a material candidate that
actually needs fresh fidelity/quality reaches the reviewer-availability gate.

## Required planning properties

- All applicable layers C01-C16 are evaluated; `not_applicable` needs a reason.
- Composition and precedence are distinct. Packages may nest but never execute.
- Every declared requirement reaches leaf acceptance through explicit traceability.
- Structural validity remains `need-review`; validators never invent semantic approval.
- Fidelity and quality reviews bind revision, source inventory, task inventory and findings.
- Delivery requires authorized persistence plus readback of bytes, IDs, relations,
  decisions, reviews and files. A textual evidence reference is insufficient.
- Existing project configuration and owner content are preserved. No implicit
  worktree, backup, commit, publication, installation or external write is allowed.

## Self-contained distribution

This repository contains the canonical ASDS skill, adapted OpenSpec and Superpowers
skills, bridge schema/templates, validators, installer and provenance. The Node
toolkit runs from this repository; installed prompt skills do not download another
runtime. Exact external executable dependencies are declared and verified separately.

Legacy orchestration, host bridge, TDD, code review and integration utilities remain
available for explicitly selected consumers. They are not imported by the planning
entry and cannot take ASDS lifecycle ownership. See [consumer boundary](references/consumer-boundary.md).

## Evidence and limitations

Use the pure planning graph/lifecycle/review APIs and the planning store. OpenSpec
validation is additional adapter evidence, not a prerequisite for a neutral package.
Before reporting the OpenSpec CLI unavailable, distinguish a missing PATH entry from
an unavailable dependency: when the active ASDS source checkout is supplied, inspect
and invoke its lockfile-pinned `node_modules/@fission-ai/openspec/bin/openspec.js`
directly. Never install, copy or substitute a runtime merely to satisfy this check.
Tests prove only what they execute. If independent review or authorized persistence
is unavailable, return partial/blocked planning instead of fabricating delivery.
When actual corruption has first been proved, restoring candidate, references,
manifest and review bytes exactly to a previously delivered snapshot preserves that
review and returns `restored existing delivered state`; it does not create a new
candidate or require a reflexive reviewer rerun. Do not use restoration to erase valid
post-handoff progress. A material alteration creates a new candidate and requires
fresh fidelity then quality review, fail-closed. Same-candidate non-progress drift is
neither restoration nor a review pass and must be reconciled before delivery claims.
The source snapshot comparator returns `existing package bytes unchanged` for equality;
that observation alone cannot prove prior delivery or corruption and cannot be relabeled
as restoration without separate qualified evidence for both. Its progress result is
`existing package state with updated progress`, not a delivery claim; review disposition
remains undetermined until lifecycle/readback evidence proves the baseline delivered.
On AGY, the installed planning coordinator may use only its native zero-write
`spec-driven-superpowers-reviewer` adapter for independent fidelity and quality
review. The host-side builder derives each fresh request from canonical current
package bytes and binds a safe package path, revision, candidate hash,
progress-normalized material inventories and one-use freshness. Quality requires the exact consumed fidelity
PASS over the same binding. Manifest review references are integrity-checked but
excluded from fresh reviewer inventories; quality receives only the exact
host-consumed fidelity output. The coordinator persists validated envelopes and
performs rework; the reviewer never writes or dispatches. The installed dispatch
contract is discovery only: the runtime must enforce exact TypeName, role and prompt
and privately attest the matching receipt through a process-local host capability.
The contract hash-binds the installed coordinator, reviewer and protocol; the hook
rechecks them before invocation and response and atomically rejects reused session
identities across review kinds and rework in the host-issued generation, even if the
adapter is rewrapped. Models never receive or reconstruct that
authority. Missing hook, timeout,
malformed/stale output, replay, limitations on PASS or non-independent invocation
remains partial/blocked.

Only after package assessment determines that a material candidate needs fresh review,
read the installed dispatch contract once immediately before the first reviewer attempt.
When `runtimeHostStatus` is `unavailable`, stop that fresh-review path immediately and
report that precise review-runtime block once; do not try the reviewer or another
transport. This does not block earlier read-only discovery, package inspection, or
structural validation and does not invalidate an unchanged delivered package. Never
claim a write, validation, readback, database
record, signature, receipt or reviewer result without direct evidence of that exact
operation. Byte comparison proves only the bytes compared, not database persistence,
signature authority or a new review.

An external headless supervisor is a separate future transport, never a way to
reinterpret the unavailable nested hook. Its non-model service must own the private
store and planning-store authority, run fresh primary-only fidelity and quality
sessions, and retain authority inside that boundary. The model and thin client
receive no capability. Source/fake-CLI tests do not authenticate a service; until a
separate OS identity/private endpoint or equivalent host signature is deployed and
qualified, the source transport is untrusted capture only: completion fails closed,
it mints no planning-store authority or receipt, and it cannot establish live delivery.
