# Operational continuity and qualification

## Coordinator loop

An accepted objective survives task completion, status questions and tool returns.
After a task transition, consult current sources and `orchestrate next`, then take
the next eligible action within the existing grant. Do not end merely because a
foundation commit or one review passed. Re-evaluate after each action; `next`
lists alternatives, not a combined safe parallel wave. `wave` remains the
reservation-aware dispatch selection for one role. Every integration still needs
`beginIntegration` and its capability/reservation checks before mutation.

`continue` means there is a next candidate operation; `await_workers` means active
work remains; `blocked` must identify affected work, owner, missing evidence and
independent work considered. `verify_objective` means every task was accepted,
not that the user outcome was proved. Root checks the original request, approvals,
integrated behavior and remaining limitations before returning a result.

A status question is read-only and does not replace the objective. An explicit
pause is recorded with `pause` plus source/reason; no new dispatch, integration or
acceptance follows. Existing processes are not killed by a journal event: stop
and confirm each separately. Only a new applicable user authorization allows
`resume` (authorization.source/scope and reason). Time passing is not consent.

Use `operationBlock` with taskId, operation (`executor`, `reviewer`, `integration`,
`acceptance`), owner and reason when only one stage is blocked. Resolve with
`operationUnblock` and reason. Missing validation proof blocks the stage that needs
that proof; it does not invent a global implementation block. A generic `block`
remains a whole-task blocker. Never mark either blocked state as Done.

## Runtime preflight

Global skill availability, executable discovery, compatible runtime, project
initialization and proven harness capability are separate facts. Diagnose only
the operation about to consume the dependency. Ordinary questions need no check.

Use the existing toolkit's `node scripts/orchestrate.mjs preflight --request FILE`.
The trusted host request identifies `tool: openspec|node`,
`operation: validate|orchestrate|inspect`, optional `required`, `project`,
`expectedVersions` (exact versions), `knownPaths` (documented absolute binaries),
and `installationDecision` (source and granted/denied decision).
Discovery checks PATH and those known paths only. It runs `--version` without a
shell, with bounded output/time; trusted executable code still runs. Never point
it at an untrusted program. Do not search the whole home directory or use an npx
command that could download software. The toolkit cannot diagnose itself if Node
is unavailable; the host checks its known Node executable first.

Report every discovered candidate, origin, effective path and observed version;
reuse a compatible documented installation outside PATH by its exact path.
Do not modify PATH, launchers or symlinks to hide an alternate installation.
If the toolkit path is unknown, consult the existing installation provenance or
ask for that missing path; do not assume the current project is the toolkit.
`available` is a version observation, and `capability: unverified` deliberately
requires a separate read-only operation probe. Project configuration observation
is structural and does not prove schema resolution or validation success.

Absent/incompatible/inaccessible tools get a bounded official remediation
proposal. Preserve install refusals and grants and their scope; grants do not
prove installation success. No install or project initialization is executed by
preflight. A real authorized installer failure remains failed, never available;
record its exit evidence and continue independent work. Recheck after environment
changes; do not reuse an observation from another session as current proof.

## Partial plans and existing canonical plans

Strict library callers still get v1 plans. `compilePlan(...,{allowUnready:true})`
and CLI `init` use v2: the graph must be structurally valid, but unresolved task
readiness/classification is retained as dispatch blockers. A task still needs its
source contract revision. Replan with current authorization after resolving the
missing decisions; affected dependents lose old acceptance. Validation defaults
remain strict; `validateChange(...,{allowUnready:true})` never relaxes readiness of
checked/completed tasks.

For an existing TASKS.md/SDD plan, use `--projection FILE` instead of `--change DIR`.
Projection JSON contains `version:1`, absolute `root`, relative `canonicalIndex`,
`sources:[{path,sha256}]`, and `tasks` with the normal contracts plus
`source:{path,anchor}`. The anchor must occur exactly once in the bound source.
Compute source.sha256 with `projectionSourceDigest(text, isCanonicalIndex)` from
lib/plan-projection.mjs. For the canonical index only, Markdown task checkbox
state is normalized to unchecked; descriptions, IDs and ordering remain material.
Use anchors without mutable checkbox state. This prevents checking off an accepted
task from invalidating every contract. Supported progress markers are top-level
`-`, `*`, `+`, numbered `1.`/`1)` lists with up to three spaces indentation outside
fenced code. Indented code and quoted lines remain material. An index
containing HTML block starts, YAML frontmatter or a list-prefixed code fence
is conservatively hashed exactly: its checkbox changes
need explicit reconciliation, not automatic progress normalization. This is a
bounded Markdown subset, not a complete CommonMark parser. Other sources are hashed exactly.
All supplied sources and extracted contracts determine contractRevision.
This is an explicit extraction, independently compared against the original;
it cannot automatically prove no task or approval was omitted. Declare missing
requirements as openDecisions instead of inventing them. Do not copy completion
checkboxes into an unverified journal or maintain another progress authority.
Source drift refuses admission; reconcile the projection, review and replan.

## Approval fidelity

Extract concrete received approvals before implementing: visual properties,
exceptions, permissions and rejected alternatives must not disappear between
conversation, design and task. Where applicable add `approvalCriteria` entries
with `id`, `source`, `criterion`, `verification`. Reviewers receive these as part
of the contract and inspect the original reference independently.
Forensic acceptance must provide `approvalEvidence` matching each id/source,
contractRevision, integration revision, verdict pass and evidence reference.
The core rejects missing/stale evidence for declared criteria. Root still checks
completeness against the user's actual approvals; strings cannot prove a screenshot
comparison occurred or discover an omitted requirement.

## Host bridge and qualification

`lib/host-bridge.mjs` exports `hostDispatch`. Supply trusted store read/append,
current source loader, and host capabilities/authorize/prepare/start methods.
Prepare creates at most a standby session without project work. Recheck grants,
source, readiness and live capacities after preparation; then journal reservation
precedes start. Count the prepared session as the dispatch being admitted, not
also as an unrelated external actor. The host must cancel unused standby sessions
on admission failure. Uncertain start retains the reservation until stopped proof.
Start returns the matching session and concrete toolCall evidence. A host assertion
is not self-authenticating. There is no automatic provider CLI invocation here.

Codex can prepare a fresh agent instructed to remain in standby, then persist its
session assignment before sending the generated packet. Agy needs an adapter with
equivalent standby/start semantics or an explicit sequential/manual path. Never
claim the generic bridge proves either provider. Use installed, authenticated
subscription capabilities; do not substitute another CLI or billing mechanism.

Qualification levels must be recorded separately:
1. Deterministic core and CLI fixtures.
2. Controlled host invocation with actual tool-call/session observations.
3. New-session natural entry, without naming the skill or corrective override,
   proving selection, source loading, journal transitions and authorized continuation.
4. Independent combined-result review and original objective verification.

A guided review in this maintenance session can prove level 2 only for that
bounded path. It cannot prove spontaneous activation in all sessions. Preserve
failed/contaminated probes and their limits. Never resume paused observed projects
to manufacture qualification. Trackers and visual integrations remain phase 2,
optional projections of the same contracts and lifecycle.

## Granularity during continuation
Before each new assignment, apply the decomposition review in planning.md. Continuing
an objective does not mean keeping an oversized assignment alive. Split separable
results, keep the original outcome covered and resume only affected ready leaves.
Do not interpret a longer task list as scope expansion or a completed investigation
as proof that its parent implementation is complete. Record blocked package outcomes
without inventing unrelated preparatory work to keep workers busy.
