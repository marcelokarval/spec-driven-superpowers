# Portable execution protocol

## Authority and project profile
The project supplies test/build commands, scope, approval requirements, evidence
storage and concurrency budget. ASDS supplies method, not permission. Keep the
normal system/developer/user instruction hierarchy. Local rules govern only their
declared tree. Installation is not activation of global governance.

## Activation
Follow [the activation gate](activation.md) before planning. Skills are available
at user scope; project state stays in the selected project's `openspec/`.
Ordinary questions do not activate ASDS or Superpowers. Missing project state
requires a creation question for suitable ASDS work, unless already authorized;
refusal continues the task without OpenSpec and silence never authorizes writes.

## Planning
Follow [incremental planning and readiness](planning.md) and [intake continuity](intake.md).
Use OpenSpec proposal → specs/design → task index and microcontracts. Reference
scenarios by capability/name and connect them to tests. A scenario can require
several checks; do not claim a mathematical one-test/one-scenario guarantee.
Run the project's existing checks before implementation. Schema validation is
not code verification.

## Task ownership
Only the coordinator writes the shared `tasks.md` progress index. Workers receive
their contract plus relevant specs, project rules, base revision and context.
Workers can read needed context; scoped writes are not a security sandbox.
Needed context follows the read scope in planning.md; a worker must not search
unrelated projects or earlier evaluation evidence merely because it can read them.
Do not give workers only a bare task file if that hides required instructions.

Superpowers subagent-driven-development remains sequential within one workstream.
ASDS may schedule separate independent workstreams concurrently only when the
capability and resource checks permit it. A shared directory is not isolation.
Use distinct worktrees/branches; give shared databases, caches, ports and external
services explicit resource ownership or execute sequentially.

## Delivery and review
Record an immutable base before work. Inspect committed diffs, staged/unstaged
changes and untracked files; a clean `git status` alone cannot prove scope.
For uncommitted delivery, use the Git collector's fingerprint and preserve the
patch/files. Do not create a commit merely to obtain a revision unless authorized.
Store receipts/logs outside the audited worktree (or in an ignored evidence
location), so writing evidence does not invalidate the snapshot it describes.

Run verification against the final snapshot. Have independent reviewers assess
spec compliance and code quality. Any change invalidates prior review/evidence.
If independent review is unavailable, label self-review and leave the delivery
unreviewed; request human/external review rather than fabricating independence.
After integration, rerun checks on the combined tree and record its revision.
Only then can the coordinator check off the task. No automatic commit or archive.

## Recovery
Distinguish process exit, tool return, agent completion and artifact delivery.
Preserve all four when available. Resume from artifacts, not optimistic lifecycle
labels. Three failed recovery attempts defer a blocker; continue unrelated work
and report deferred items at the end. Do not retry denied actions or bypass
permissions to satisfy the retry budget. Never overwrite a failed worker's
workspace when giving work to its replacement.
