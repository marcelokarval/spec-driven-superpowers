---
name: asds-execution-consumer
description: Consume an already delivered ASDS planning package after the caller explicitly selects this consumer and supplies current execution and persistence grants. The coordinator never implements product work.
---
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"consumer.entry","route":"consumer","mode":"coordinator","activation":{"handoff":"current","package":"delivered_or_partial","selection":"current_accepted_same_handoff","executionGrant":"current","persistenceGrant":"current"},"assignment":"coordinator_owned","fallback":{"missingWorker":"manual_handoff_required","missingBoundary":"manual_handoff_required","root":"forbidden","sequential":"forbidden"},"planner":"stopped","standalone":"not_applicable"} -->
# ASDS Execution Consumer
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `consumer.entry`
- Route: `consumer`
- Mode: `coordinator`
- Activation: handoff=`current`; package=`delivered_or_partial`; selection=`current_accepted_same_handoff`; executionGrant=`current`; persistenceGrant=`current`
- Assignment: `coordinator_owned`
- Fallback: missingWorker=`manual_handoff_required`; missingBoundary=`manual_handoff_required`; root=`forbidden`; sequential=`forbidden`
- Planner behavior: `stopped`
- Standalone behavior: `not_applicable`
<!-- asds-mode:end -->

This is the only official entrypoint for coordinated execution of a delivered
ASDS planning package. It is a later consumer, not a phase of the planning-only
`spec-driven-superpowers` skill. The planner remains stopped throughout a consumer
run unless a concrete planning defect is returned for a separately authorized
successor planning revision.

Read [handoff](references/handoff.md), [protocol](references/protocol.md),
[roles](references/roles.md), [host contract](references/harness-contract.md) and
[recovery](references/recovery.md) before initialization.

## Activation

Activate this skill only when all three caller-owned authorities are current:

1. an `asds.execution-handoff/1` envelope for an already delivered or valid
   consumable-partial package;
2. a current, accepted selection that names `asds-execution-consumer` for this
   handoff, request and project and binds the current package ID, planning revision,
   planning fingerprint and exact consumable leaf set;
3. distinct current grants for product execution and for persistence to the exact
   journal/evidence destination; the execution grant repeats that same binding.

The request context carries the identical binding and its objective must
match the original implementation intake persisted in the package. Missing legacy
bindings or any disagreement fail closed; do not enrich an old authority object or
infer the binding from the package on its behalf.

A delivered package plus a natural request to implement is enough to select this
route for preflight; it is not enough to start it. A package without a current
execution grant, or a grant without a delivered planning package, does not activate
execution. Conversation, bounded direct work without an ASDS package, and requests
for planning stay on their independent routes. Capabilities never come from the
handoff; observe them from the current host.

## Preflight and bootstrap

Before any product implementation, validate the handoff and current package,
workspace, repository and baseline with `validateExecutionHandoff`; load the
canonical task source; and initialize through `initExecutionConsumer` (or the
`consume init` CLI). Initialization must create and persist journal v3 and bind it
to the handoff digest, planning revision, current workspace and execution subset.

The host must then observe current capabilities/workspace and enforce the
coordinator boundary described in the host contract. The coordinator is technically
project-read-only and receives only journal, evidence and progress brokers. Missing
or prompt-only enforcement, no observed worker preparation/start capability, stale
authority, or an unknown required capability returns `manual_handoff_required`
before the first worker and before any product mutation. Do not implement in the
root/coordinator session as a fallback.

The bound journal and the enforced coordinator boundary must both exist before any
product implementation. Their ordering is a gate, not a reporting convention.

## Required loop

Use the pure API in `lib/execution-consumer.mjs` or the equivalent
`scripts/consume.mjs` commands; CLI text is not evidence.

1. Call `next` against the current journal, handoff, source, workspace observation
   and freshly observed capabilities.
2. For eligible work, obtain `packet` and have the host reserve, prepare and start
   a distinct executor using the official assignment. A worker skill enters consumer
   mode only from that assignment.
3. Observe a real stop, snapshot the candidate and persist its canonical receipt.
4. Dispatch a distinct reviewer against the host-owned snapshot. Rework uses a new
   bounded assignment and never turns the coordinator into an implementer.
5. Delegate integration to a fresh integrator or an observed atomic host operation;
   review the integrated revision independently.
6. Reconcile canonical receipt and projection receipt before requesting the narrow,
   idempotent progress broker. A checkbox is materialized progress, not evidence.
7. Repeat from current state. After all consumable leaves are accepted and progress
   is committed, dispatch the distinct objective verifier and append only its
   current `verifyObjective` result. Complete the dispatched verifier only through
   `hostCompleteVerifier`, which obtains the result through the host's bound
   `observeVerifierResult`; direct prose, caller-authored results and generic
   `appendEvent` calls are not evidence or terminal authority.

The serialized `verifyObjective` event is structural evidence only. Pure replay,
including replay of an exact captured journal, never grants terminal authority.
The live bridge qualifies completion only while its concrete host adapter has
persisted or re-observed the exact durable receipt. After restart call
`hostReobserveObjectiveCompletion`; no serialized token or store callback restores
authority by itself.

Never invoke or resume the ASDS planner merely to advance execution. Return an
identified contract defect to the caller; a new planning revision requires a new
handoff and explicit successor/rebind.

## Stop conditions

Pure consumer status returns `await_host_reobservation` for a structurally recorded
objective result. Only `authoritativeObjectiveStatus`, reached after live completion
or legitimate host reobservation, returns `complete`, `partial_consumed` or
`objective_blocked`. `complete` requires current objective verification after
reconciled integration and progress. A partial
scope preserves excluded IDs and remaining work and cannot pass the original
objective. Transport uncertainty, a requested cancellation, prose, worker narration
or an open/closed checkbox never manufactures completion.

The consumer API/CLI is deterministic coordination only. It does not itself call a
planner, spawn a worker, run a task shell command, invent isolation or grant authority.
