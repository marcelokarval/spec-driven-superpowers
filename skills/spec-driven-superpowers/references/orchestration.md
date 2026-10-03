# Portable coordination, compatible versions 1 and 2

See [operational continuity](operational-continuity.md) for v2 partial readiness,
`next`, operation blockers, preflight, source projections and host qualification.
Existing v1 plans/journals remain readable; v1 strict compilation stays the default.

Use this extension when multi-task execution needs reproducible dispatch and
recovery. It is optional; ordinary questions and small direct work still follow
activation.md. Accelerate's seven-field v1 handoff remains unchanged. Receiving,
accepting coordination and permission to execute remain different operations.

## One graph, one completion index

Microcontracts are the canonical graph. Numbered stable IDs identify work;
`dependsOn` determines execution order, not numbering or Markdown order. Every
edge means the predecessor must have an integrated receipt, independent review
and coordinator acceptance before the successor starts. Generate the Mermaid
view from the graph; do not maintain a second graph or progress checklist.

When some work may start earlier than its integration, split it: preparation,
implementation and integration get distinct outcomes and IDs. Version 1 does
not implement start/finish edge types. An investigation can unblock only the
contracts that require its answer. A cycle or missing predecessor is an error,
not permission to execute sequentially.

`tasks.md` remains the sole completion index. A journal records execution events,
not a second planning authority. Only the coordinator reconciles accepted task
IDs and their integrated receipts into the index. Existing validators remain
usable without this opt-in protocol; legacy receipts do not automatically become
accepted journal state. Existing completed work needs explicit reconciliation.

## Classification and role profile

Add this optional frontmatter to each participating microcontract:

```yaml
orchestration:
  complexity: bounded
  uncertainty: bounded
  risk: medium
  rationale: Known local code, but a shared persisted interface needs review.
  skills: [test-driven-development, requesting-code-review]
  references: [specs/example/spec.md, design.md]
  claims:
    - name: test-database
      mode: write
      roles: [executor, reviewer]
```

Dimensions accept `bounded`, `medium`, `high`; the greatest selects the tier.
Rationale must describe the actual task. Small patches can have high risk; an
unresolved interface can have high uncertainty. Reclassify material changes
before redispatch. The core validates structure; coordinator/reviewer challenge
classification meaning. A model name never proves suitability.

A profile has `version: 1` and `tiers.bounded/medium/high`, each containing
`executor` and `reviewer` with exact `model` and `effort` strings. The toolkit's
`examples/orchestration-profile.json` captures the owner's requested pair matrix.
It is an example policy, not a universal catalog or subscription entitlement.
No automatic substitution is permitted: revise the profile with an applicable
user decision if the requested selection is unavailable. Skills/references are
bounded task inputs, not permission to activate every installed skill.

## Ready waves and reservations

The core evaluates the entire graph and accepted state. It returns selected IDs
and a reason for every excluded ID: dependency, lifecycle state, unavailable
model/effort, budget, isolation or reservation conflict. Ready means eligible
under supplied observations, not already dispatched or authorized by a document.
Stable ordering is deterministic, not a claim of optimal scheduling.

Capabilities are host observations:

```json
{"spawn":true,"isolatedWrites":true,"maxAgents":4,"externalActive":0,
 "models":[{"model":"gpt-6-luna","efforts":["high"]},
           {"model":"gpt-6.1-sol","efforts":["medium"]}]}
```

The coordinator, active executors, active reviewers and external active agents
all consume the total budget. When `externalActive` is nonzero, supply exactly
that many `externalReservations` records, each with `claims` containing
`type: path|resource`, `name` and `mode: read|write|exclusive`. An empty claims
array explicitly declares a noninterfering external actor; the host must verify it.
Absent or conflicting external reservations block dispatch. `beginIntegration`
also requires current capabilities and rejects parallel work without isolation. A dispatch reserves resources until the host
confirms that session stopped. No spawn capability leaves the automated dispatch
blocked; the pre-existing sequential/manual workflow remains available without
pretending independent review occurred.

Exact write paths reserve overlapping paths and ancestors exclusively for both
roles. Existing `resources` are exclusive. Additional `claims` distinguish
read/write/exclusive and roles; read/read may overlap. Reviewer commands that
write databases, caches or ports need write claims. Declare reads of mutable
shared inputs as resources too. Undeclared conflicts cannot be detected. The host
must account for external actors and verify actual isolation before dispatch;
`isolatedWrites: true` does not create a sandbox, worktree or database.

## Delivery, clean review and forensic decision

1. The host records an assignment with a unique session identity and fresh bounded
   context provenance, then passes the generated packet to that session. Reserve
   before allowing it to execute. The host supplies actual available models and
   validates applicable user authorization; `executionAuthorized: false` in the
   packet explicitly prevents treating this library as an authority issuer.
2. Executor delivery includes the existing revision-bound receipt and stopped
   confirmation. It cannot self-promote to reviewed or integrated.
3. A new reviewer session receives the contract, candidate revision, read boundary,
   relevant sources and skills. It does not receive executor narrative/evidence
   in the first packet. Inspect independently and record findings before requesting
   that evidence from the coordinator. Fresh context is not clean filesystem or
   environment; host/tool observations must establish those separately.
4. Passing candidate review allows `beginIntegration`, which reserves the union
   of declared executor/reviewer resources for the coordinator before mutation.
   `integrate` records `integrationRevision` and passing `integrationEvidence`,
   preserving the candidate and releasing that reservation. It asserts no future
   review. Another fresh reviewer examines the integrated revision; only its passing
   result produces the final integrated receipt. A prior candidate review
   is never silently relabeled as integration review.
5. Root gives a finite disposition: accepted, rework or blocked. Acceptance records
   evidence references for scope, behavior, independence, integration and authority,
   plus limitations and rationale. Root verifies the claimed evidence; strings and
   green tests do not authenticate it. Rework clears current receipt/reviews but
   the journal preserves their history. Only acceptance releases dependents.

No universal additional human approval is inserted. Preserve prior authorization;
a new decision is needed only for a material scope/authority change. A person's
explicit request to approve a DAG is preserved, not inferred for all projects.

## Recovery and change

The journal records the original plan/context and ordered, hashed events. Replay
validates every transition and reconstructs candidates, reviews, blockers, owners,
active assignments and reservations. Hashes detect accidental alteration; anyone
who can rewrite the journal can recompute them. This is not authentication.

A stop request with `stopped: false` blocks the task but retains its reservation.
A confirmed stop releases it. Resume/rework requires a reason and a new session;
never reuse an executor as reviewer. No automatic lease expiry or takeover.
For unresolved failures retain the existing three-attempt recovery policy; the
journal does not itself retry processes or count external tool attempts.

Replan supplies a newly compiled plan, reason and applicable authorization source.
Changed tasks and transitive dependents reopen; unaffected acceptance survives.
Profile changes conservatively reopen all work. Affected active sessions must
stop first. IDs cannot disappear: preserve cancelled/deferred work as blocked with
an explicit disposition. History and session identities survive replanning. A new counterexample without
a contract change uses `reopen` with a concrete reason: it reopens that task and
its dependents, refusing while any affected session remains active. Never edit
requirements merely to invalidate an incorrect acceptance.

## Toolkit CLI and host responsibilities

Run from the existing toolkit checkout; installed skills do not include a second
Node runtime. Put journals/evidence in an authorized ignored evidence location,
outside the audited candidate where appropriate. The CLI does not create parent
directories, initialize OpenSpec, spawn agents or run task command strings.

```bash
node scripts/orchestrate.mjs init --change /project/openspec/changes/example \
  --profile /project/profile.json --context /evidence/context.json --state /evidence/run.json
node scripts/orchestrate.mjs dag --state /evidence/run.json
node scripts/orchestrate.mjs wave --state /evidence/run.json --change /project/openspec/changes/example \
  --capabilities /evidence/capabilities.json
node scripts/orchestrate.mjs event --state /evidence/run.json --change /project/openspec/changes/example \
  --event /evidence/event.json --expected-sequence 0
node scripts/orchestrate.mjs packet --state /evidence/run.json --change /project/openspec/changes/example --task 0001
node scripts/orchestrate.mjs status --state /evidence/run.json
```

Context JSON requires `coordinator`, `readScope` (string array) and `authorization`
with `source` and `scope`. The complete immutable intake context is carried in
`coordinationContext` in each packet; do not put executor narrative into it.
Preserve received constraints, decisions/refusals and
project references as additional context fields. They remain authoritative;
recording a source does not establish that a user granted it.

Event types: `dispatch`, `deliver`, `reviewResult`, `integrate`, `decide`, `block`,
`beginIntegration`, `unblock`, `stop`, `reopen`, `replan`. Every task event has `taskId`. See the executable tests
and exported `appendEvent` API for the complete examples. CLI dispatch/delivery/
review/integration/decision also requires current source contracts matching the
accepted plan. Hosts using the library call `assertCurrentPlan` before those
mutations. Source changes cannot be legitimized by editing receipt hashes alone.

The local store uses exclusive creation, a writer lock, expected sequence and
atomic replacement. It rejects symlink/hardlink state files. Normal failures clean
owned locks/temporaries; a process crash can leave them. Do not remove a lock based
on age alone: verify its process/consumers stopped and inspect recoverable data.
No distributed locking, hostile-writer defense or power-loss durability is claimed.
Library hosts may instead persist the JSON journal through their own storage.

## Next boundary

Read [optional integrations](integrations.md). UI projections, tracker status and
harness assignment are separate adapters; none is required to use this core.

CLI `next` requires current sources and capabilities, like `wave`. CLI `preflight`
uses `--request` without a journal. `--projection` is mutually exclusive with
`--change` on init and current-source checks. New global events are pause/resume;
operationBlock/operationUnblock remain task-scoped.

## Adaptive packages (plan protocol 3)
Explicit nodeType activates plan version 3; old v1/v2 journals remain replayable.
Do not silently relabel legacy work as granularity-reviewed. New leaf tasks declare
boundary change/target/exclusions and coordinator review provenance. nodeType package
cannot receive worker transitions; its children use parentId. Nesting is refused.
Child paths/resources/scenarios stay within the parent contract and inherit its
prerequisites. Coverage and effective cycles include package-to-child dependencies.

`decompose` carries taskId, newly compiled plan, reason and existing authorization.
It converts an unfinished, stopped root task into a package while preserving its
original contract and introducing only its children. Existing contracts cannot be
rewritten except refreshed computed identities. Ordinary replan handles material
scope changes. `refine` subdivides a stopped child into sibling leaves under the
same package, retaining its ID for one narrowed result and adding stable IDs for
others. Coordinator records semantic coverage; affected dependents await all results.

`acceptPackage` carries an integrated receipt, reason, limitations and applicable
approvalEvidence. Children and prerequisites must already be accepted. Verification,
independent reviews and explicit criteria bind to the integrated revision. `next`
returns packageAcceptance when child completion enables that check; it never marks
packages Done automatically. Package hashes and invalidation include their children.
These are consistency checks on evidence; no automatic host enforcement is claimed.
