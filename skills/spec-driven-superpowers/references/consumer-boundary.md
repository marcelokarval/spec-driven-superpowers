# Planning consumer boundary
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"planner.consumer-boundary","route":"planner","mode":"planning","activation":{"handoff":"not_applicable","package":"not_applicable","selection":"not_applicable","executionGrant":"not_applicable","persistenceGrant":"not_applicable"},"assignment":"not_applicable","fallback":{"missingWorker":"not_applicable","missingBoundary":"not_applicable","root":"not_applicable","sequential":"not_applicable"},"planner":"owner","standalone":"planning_only"} -->
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `planner.consumer-boundary`
- Route: `planner`
- Mode: `planning`
- Activation: handoff=`not_applicable`; package=`not_applicable`; selection=`not_applicable`; executionGrant=`not_applicable`; persistenceGrant=`not_applicable`
- Assignment: `not_applicable`
- Fallback: missingWorker=`not_applicable`; missingBoundary=`not_applicable`; root=`not_applicable`; sequential=`not_applicable`
- Planner behavior: `owner`
- Standalone behavior: `planning_only`
<!-- asds-mode:end -->

ASDS delivers planning. It does not dispatch, implement, integrate or close the
software described by its future-work contracts.

The official coordinated consumer is the independent
[`asds-execution-consumer`](../../asds-execution-consumer/SKILL.md) entrypoint. A
later consumer may instead be a direct engineering workflow, standalone Superpowers
SDD, the legacy ASDS orchestration toolkit or another explicitly selected mechanism.
Selection and authorization belong to the caller. This planning reference points to
the official option but does not load or activate it. The consumer receives the
immutable planning revision and maintains execution progress separately. It must not
reinterpret planning `delivered` as implemented software.

The planning return does not contain harness capabilities and does not select a
consumer or grant product execution. After ownership is released, a caller that has
selected the official consumer may create `asds.execution-handoff/1` with current
selection, execution/persistence grants, destination and workspace observations.
The request context, selection and execution grant must each bind the same current
request, package ID, planning revision/fingerprint and exact consumable task set;
the request objective must match the original intake persisted by this
planning package. Legacy unbound authorities cannot be enriched retroactively.
That envelope still requires consumer preflight and host-owned boundary enforcement.

The consumer may return a concrete planning defect with affected requirements and
tasks. ASDS revises only the affected planning scope, invalidates stale reviews and
readback, and returns a successor revision. Runtime failures, code defects and test
results remain consumer-owned unless they expose an actual contract defect.

Legacy modules `orchestration.mjs`, `host-bridge.mjs`, `git-scope.mjs` and related
receipts are optional consumer utilities. Their presence in this self-contained
repository is compatibility, not activation by the ASDS entry skill. The planner
never imports the consumer lifecycle to finish its own return.
