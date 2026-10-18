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

## Passive planning review

ASDS is deterministic and passive. The authorized harness owns reasoning, native
reviewer dispatch and operational provenance. ASDS never launches an LLM, daemon,
socket or provider. No ASDS service, private signing key or extra account is required.
It does not authenticate a malicious harness or certify semantic quality from hashes.

Review is required in the planning flow and gate, linked to the relevant tasks,
sources and candidate content, with fidelity before quality. The harness chooses
how to provide and ensure reviewers; no subagent tool or session topology is a
universal ASDS requirement. A coordinator may coordinate or review when not the
author and when applicable independence is met. Authorial PASS is not independent
review. No name-only approval, fabricated evidence or implicit verdict is permitted.

See [planning review and semantic checks](references/planning.md#reviews-and-convergence)
and the [optional current toolkit adapter](references/adapters/opencode.md). The
adapter requires explicit actor/session evidence and records one envelope at a time,
F then Q. Its narrower identity checks are not a universal harness architecture.
Recording does not rewrite pending task boundaries or publish planning; `ready`
accepts complete pending boundaries only in the current F/Q-verified package context,
without changing task bytes. It still rejects incomplete boundaries and planning
layers. Well-contracted future decisions block execution consumers, not full planning
delivery; manifest/readback/receipt expose usable and blocked tasks, with at least
one usable leaf required. Partial describes incomplete planning. `publish` requires
`ready` plus destination authorization. Do not edit reviewed contracts and reuse
the old binding.

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
