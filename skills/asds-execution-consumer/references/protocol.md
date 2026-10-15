# Execution consumer protocol
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"consumer.protocol","route":"consumer","mode":"coordinator-reference","activation":{"handoff":"current","package":"delivered_or_partial","selection":"current_accepted_same_handoff","executionGrant":"current","persistenceGrant":"current"},"assignment":"coordinator_owned","fallback":{"missingWorker":"manual_handoff_required","missingBoundary":"manual_handoff_required","root":"forbidden","sequential":"forbidden"},"planner":"stopped","standalone":"not_applicable"} -->
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `consumer.protocol`
- Route: `consumer`
- Mode: `coordinator-reference`
- Activation: handoff=`current`; package=`delivered_or_partial`; selection=`current_accepted_same_handoff`; executionGrant=`current`; persistenceGrant=`current`
- Assignment: `coordinator_owned`
- Fallback: missingWorker=`manual_handoff_required`; missingBoundary=`manual_handoff_required`; root=`forbidden`; sequential=`forbidden`
- Planner behavior: `stopped`
- Standalone behavior: `not_applicable`
<!-- asds-mode:end -->

## Authorities and ordering

The package, request context, selection, execution grant, persistence grant,
destination, workspace observation and coordinator boundary are separate authorities.
The request context, selection and execution grant must independently repeat the
same request ID, package ID, planning revision, planning fingerprint and exact
consumable leaf set. The request objective must match the original intake
persisted in the package. A package without a current grant, a grant without a
delivered package, a disagreement between authorities, or a legacy authority without
this binding fails before journal bootstrap; no validator upgrades it retroactively.
The handoff carries no capability claims; the host observes capabilities at use time.

The lifecycle order is strict:

1. validate `asds.execution-handoff/1`, reopen its delivered package and compare the
   current source/workspace bindings;
2. call `initExecutionConsumer` to create and persist the bound journal v3;
3. observe the host-owned coordinator boundary and current capabilities;
4. the journal and coordinator boundary must exist before any product implementation;
   only then request worker preparation;
5. drive `next → packet → externally observed events → reconcile → progress` until
   objective verification is eligible;
6. request a distinct external verifier, then complete it only through
   `hostCompleteVerifier`: observe its stop, obtain a session/revision-bound result
   through `observeVerifierResult`, reobserve workspace and objective snapshot,
    persist a closed host-owned receipt, derive the structural `verifyObjective`
    record inside the bridge, persist those bytes without exposing a derivation
    callback, and derive terminal disposition only from live host authority.

Without observed worker preparation/start (spawn or an equivalent host operation),
or without the enforced boundary, return `manual_handoff_required`. The root/
coordinator must not implement, integrate, review or verify to bypass the missing
capability. Sequential execution is never a consumer fallback. Do not invoke or
resume the planner during this loop.

## Official assignments

The coordinator issues an official assignment only from a current packet and host
reservation. It binds run/journal and handoff digests, planning and contract
revisions, task ID, role, actor/session reservation, project realpath, read scope,
exact write scope, base/candidate target, acceptance, verification commands,
canonical references and the expected evidence return. An assignment is role- and
revision-specific; it cannot be inferred from a plan file, chat instruction or the
presence of a generic execution skill.

The objective-verifier packet carries the immutable intake snapshot and digest:
original request text/source, complete request project constraints/refusals,
explicit coverage requirements (including negative and preservation rules),
planning and execution authority references, and hashed canonical package sources.
Its `objectiveRevision` binds that complete journal context as well as accepted task
state. Changing or omitting one of those inputs requires a fresh verifier revision;
task receipts alone cannot stand in for the original objective.

Executors and integrators may mutate only their assigned product scope. Reviewers and
verifiers receive an empty write scope and a host-owned snapshot. Workers return
evidence to the coordinator but never append the journal, accept their own result or
change `tasks.md`. The coordinator alone requests the narrow brokers and never gains
a generic project-write primitive.

## API and CLI boundary

`lib/execution-consumer.mjs` exposes initialization, next-operation selection,
packets, event validation, receipt reconciliation, progress, objective verification
and read-only status. `scripts/consume.mjs` is its file-store adapter. Both are pure
with respect to implementation: they do not call a planner, worker/spawn provider or
task shell. The host bridge performs only currently observed operations under the
contract in `harness-contract.md`.

The consumer `verify` facade is read-only when called without an event (it returns
the objective packet). It does not accept a caller-authored completion event;
`verifyObjective` is reserved for the event derived by `hostCompleteVerifier` from
the host receipt.
File-backed adapters can expose `persistHostJournal` with
`orchestration-store.updateHostStore`; this performs exact-sequence/readback
persistence and accepts no derivation callback.

Replay distinguishes structural history from authoritative status. A serialized
`verifyObjective` record is always `structural_only`; pure replay returns
`await_host_reobservation`, never `complete`. The bridge holds no serializable
capability: its authority is process-local and keyed to the concrete host adapter
and exact journal. After restart `hostReobserveObjectiveCompletion` must obtain the
exact durable receipt through the harness trust root before completion is restored.
Synthetic adapters test protocol shape but do not qualify a production trust root.

The planning package remains immutable. Runtime projection comes from journal replay;
materialized checkbox progress follows accepted and reconciled evidence. These three
representations never substitute for one another.
