# Execution consumer recovery
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"consumer.recovery","route":"consumer","mode":"coordinator-reference","activation":{"handoff":"current","package":"delivered_or_partial","selection":"current_accepted_same_handoff","executionGrant":"current","persistenceGrant":"current"},"assignment":"coordinator_owned","fallback":{"missingWorker":"manual_handoff_required","missingBoundary":"manual_handoff_required","root":"forbidden","sequential":"forbidden"},"planner":"stopped","standalone":"not_applicable"} -->
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `consumer.recovery`
- Route: `consumer`
- Mode: `coordinator-reference`
- Activation: handoff=`current`; package=`delivered_or_partial`; selection=`current_accepted_same_handoff`; executionGrant=`current`; persistenceGrant=`current`
- Assignment: `coordinator_owned`
- Fallback: missingWorker=`manual_handoff_required`; missingBoundary=`manual_handoff_required`; root=`forbidden`; sequential=`forbidden`
- Planner behavior: `stopped`
- Standalone behavior: `not_applicable`
<!-- asds-mode:end -->

Recovery starts by reopening the handoff, package, journal and current workspace. Do
not reconstruct facts from coordinator prose or worker narration. Validate the hash
chain, replay journal v3, compare source/current bindings and reobserve the host
boundary and capabilities before selecting another operation.

- A preparation or start with uncertain transport keeps its reservation. Observe the
  host-owned start/stop ledger; do not redispatch or release it by assumption.
- A stopped worker without a valid receipt remains unaccepted. Preserve its snapshot
  and request bounded recovery or manual handoff.
- `progress_pending` is recoverable through the structured progress broker. Compare
  before/readback hashes and commit the matching event idempotently; never edit
  Markdown broadly or infer acceptance from a checkbox.
- Workspace, repository, realpath, revision, scope or capability drift blocks the
  next side effect. Rebinding to a successor journal requires a new validated handoff.
- A concrete planning-contract defect returns the affected requirement/task and
  revision to the caller. The planner stays stopped until separately reactivated;
  execution state never edits the delivered package in place.
- If the host cannot enforce the coordinator boundary or safely resolve an ambiguous
  reservation, return `manual_handoff_required` with the retained state.

Cancellation is terminal only after the official event and observed stop semantics.
Transport failure, interrupt request, pause and cancellation are distinct. Preserve
the last coherent journal and authorized evidence; do not create backup runtimes,
alternate installations, commits or publication as recovery side effects.
