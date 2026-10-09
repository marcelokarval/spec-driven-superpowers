---
name: spec-driven-superpowers
description: Produce reviewed and persisted implementation planning by combining OpenSpec traceability with Superpowers planning and review practices. ASDS plans; a caller-selected consumer implements.
---
# Autonomous Spec-Driven Superpowers

ASDS is a self-contained planning product. OpenSpec organizes requirements,
decisions and traceability; adapted Superpowers skills help understand, decompose,
write and review the plan. ASDS does not implement the future tasks it produces.

## Activation and intake

Read [intake](references/intake.md), [activation](references/activation.md),
[planning](references/planning.md), [contracts](references/contracts.md) and the
matching harness adapter. Conversation bypasses planning. Bounded direct execution
belongs to the caller, not ASDS. Suitable planning work reuses received Accelerate
context and preserves grants, refusals, scope and read boundaries.

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
8. return delivered, partial, blocked or cancelled planning and release ownership.

The delivered manifest also includes a deterministic task-manager projection. It
must distinguish all reviewed contracts from the initial executable frontier and
make owners, decision resolvers, blockers, prerequisite outputs, reverse dependents,
waves, safe parallel peers and conflict exclusions machine-readable. Directory
projection reads the exact ordered inventory in `tasks.md`; it does not discover
extra task files or renumber identities to match execution order.

A new delivered plan keeps future implementation checkboxes open. If the original
request asked for implementation, the return explicitly says it remains unfulfilled
and the caller selects a consumer. An instruction to implement does not make ASDS
that consumer. A concrete plan defect may return to ASDS as bounded revision work.

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
