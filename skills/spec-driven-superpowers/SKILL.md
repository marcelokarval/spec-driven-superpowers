---
name: spec-driven-superpowers
description: Coordinate approved, multi-step software changes using OpenSpec specifications, per-task microcontracts, Superpowers TDD and evidence-based reviews. Use for ASDS workflows, specification-driven features or refactors, and tasks.md plus task-*.md execution; not for simple questions or unrelated one-step edits.
---

# Autonomous Spec-Driven Superpowers

OpenSpec governs **what**; Superpowers guides **how**. This skill connects them,
not a replacement for either framework or a new inference engine.

## Decide whether to activate

Global installation makes this skill available, not mandatory for every message.
Read [the intake contract](references/intake.md): direct requests use local triage;
Accelerate handoffs reuse received context and preserve lifecycle continuity.
Apply [the activation gate](references/activation.md). General questions
receive a direct answer, without workflow loading, setup questions or artifacts.
For suitable project work, verify the selected project's `openspec/`; if absent,
ask before creation unless initialization was already explicitly authorized.

## Start with the actual session

Read [the protocol](references/protocol.md) and [capabilities](references/capabilities.md).
Select only the matching adapter:
[Warp/Oz](references/adapters/warp-oz.md),
[Codex](references/adapters/codex.md),
[OpenCode](references/adapters/opencode.md),
[Claude Code](references/adapters/claude-code.md),
[Gemini CLI](references/adapters/gemini.md), or
[Antigravity](references/adapters/antigravity.md).
For an unknown harness, use the sequential fallback in capabilities.

System/developer instructions, project scope and approvals remain authoritative.
A skill cannot grant permissions, override higher-priority instructions or
authorize commits, external actions or configuration changes.

Read [operational continuity](references/operational-continuity.md) for stage-scoped
blockers, dependency preflight, partial readiness, existing plans and host qualification.

## Workflow

1. Receive the request or handoff. Separate received, accepted and authorized actions.
   Reuse existing context; resolve only missing facts needed for the next step.
   Keep discovery within the selected project and necessary instruction/skill files.
   Apply the [read scope and reporting rules](references/planning.md#read-scope).
2. Follow [planning and readiness](references/planning.md). Inspect relevant sources,
   consolidate understanding, and resolve material decisions before generating tasks.
   Use brainstorming here when needed; its outputs belong to the OpenSpec change.
3. Prepare proposal, delta specs and design. Generate `tasks/task-ID.md` microcontracts
   then the sole `tasks.md` index. Writing-plans feeds these files, not a second plan.
4. Validate OpenSpec and ASDS separately, review semantic readiness and preserve
   applicable approvals. Read [contracts](references/contracts.md). No automatic
   permission reset, initialization, worktree installation or publication.
5. For repeatable multi-task scheduling, use the optional [coordination protocol](references/orchestration.md):
   canonical DAG, justified role profiles, ready waves, reservations and replayable state.
   Record baseline and accepted contract revisions. Execute ready tasks with suitable
   verification (TDD for behavioral code). Default to sequential; concurrency requires
   live capabilities, authorization, independent scopes/interfaces and resource isolation.
6. Verify scoped deliveries, final revision evidence and independent spec/quality
   reviews. Replan only affected work when decisions materially change.
7. Integrate and reverify; bind integration evidence/reviews to the combined revision.
   Reconcile integrated receipts before the coordinator checks off `tasks.md`.
8. Re-evaluate the next eligible authorized action after each task; a status question
   does not end the objective. Honor explicit pause before new work. Only after
   checking the original outcome, produce the evidence ledger and structured return: outcome, evidence, remaining
   work and limitations. Accelerate presents it without a second acceptance gate.
   Commit, archive and publication remain subject to actual authorization.

## Interrupted execution

Persist artifact paths, base/snapshot, command exit status and unresolved work
before handoff when possible. A tool cancellation or agent lifecycle failure is
not a test result. Check persisted evidence before rerunning commands.
Use at most three recovery attempts per blocker, retaining the same contract.
If still blocked, defer it visibly, skip its dependent tasks, and continue
independent tasks. Never mark deferred work complete. A replacement gets the
contract, constraints, partial artifacts and diagnostics in an isolated workspace.
