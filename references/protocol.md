# Portable planning protocol
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"planner.protocol","route":"planner","mode":"planning","activation":{"handoff":"not_applicable","package":"not_applicable","selection":"not_applicable","executionGrant":"not_applicable","persistenceGrant":"not_applicable"},"assignment":"not_applicable","fallback":{"missingWorker":"not_applicable","missingBoundary":"not_applicable","root":"not_applicable","sequential":"not_applicable"},"planner":"owner","standalone":"planning_only"} -->
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `planner.protocol`
- Route: `planner`
- Mode: `planning`
- Activation: handoff=`not_applicable`; package=`not_applicable`; selection=`not_applicable`; executionGrant=`not_applicable`; persistenceGrant=`not_applicable`
- Assignment: `not_applicable`
- Fallback: missingWorker=`not_applicable`; missingBoundary=`not_applicable`; root=`not_applicable`; sequential=`not_applicable`
- Planner behavior: `owner`
- Standalone behavior: `planning_only`
<!-- asds-mode:end -->

## Authority

The project and user supply scope, sources, destination and permission. ASDS
supplies a planning method, never implementation authority. Preserve project rules,
read boundaries and prior grants/refusals.

## Planning sequence

1. Receive direct or Accelerate context and distinguish original requested product.
2. Apply the project activation gate. OpenSpec refusal selects the neutral package,
   not reduced quality.
3. Consolidate requirements, negative/preservation rules, decisions and interfaces.
4. Create proposal/design/spec sources as useful, then recursive packages and leaf
   microcontracts in the sole `tasks.md` index.
5. Validate composition, precedence and traceability without dispatch/model calls.
6. Review fidelity, then quality. Correct material findings and re-review the
   changed revision. Self-review is declared; required independence may block delivery.
7. Publish only to an authorized destination, read back the package and bind the
   receipt to its revision.
8. Return planning status and release ownership. Do not execute future tasks.
9. If the caller later selects the official execution consumer, supply the immutable
   delivered package to caller-owned `createExecutionHandoff(input)`. Selection,
   execution/persistence grants, destination and current workspace observation do not
   originate in the planning return. Handoff creation is after ownership release and
   does not resume planning, initialize runtime state or grant authority.

## Planning versus execution

Future test commands, TDD guidance and file scopes are contract data. Running them,
spawning implementers, using worktrees, integrating code and checking future progress
belong to a caller-selected consumer. Legacy execution modules are opt-in consumer
utilities described in `consumer-boundary.md`; the ASDS planning entry does not load them.
The handoff envelope contains stable package/workspace bindings but no spawn, model,
isolation or tool capability claims. Those belong to the later harness observation.

## Recovery

Preserve the last coherent planning revision. Ordinary publication failures restore
prior bytes from memory and remove operation temporaries. A crash or incomplete
external destination is reported as blocked until readback/recovery; never label it
delivered. No backup, alternate runtime, commit or publication is automatic.
