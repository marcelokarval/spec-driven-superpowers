# Execution consumer roles

The execution consumer is separate from the planning-only ASDS entrypoint. A
planning return selects neither this consumer nor execution authority.

| Role | Permitted | Forbidden |
| --- | --- | --- |
| Coordinator | Validate handoff, request narrow journal/evidence/progress brokers, reserve and dispatch eligible work, reconcile receipts, request objective verification | Edit product files, run a leaf task as executor, integrate, review or verify its own work |
| Executor | Implement one leaf or its bounded rework in authorized scope and return evidence | Mark `tasks.md`, alter planning, accept its own result, review the same revision |
| Reviewer | Inspect a host-owned read-only/disposable snapshot and issue candidate or integration review | Implement, repair, mutate the index, trust executor narration as primary evidence |
| Integrator | Apply an explicitly delegated integration operation or run as a distinct integration worker | Act as coordinator under another label, self-review, mark progress |
| Verifier | Compare the integrated snapshot with the original objective or authorized partial subset | Implement, self-review, promote partial coverage to the original objective |
| Host adapter | Observe actual capabilities/workspace, enforce isolation and coordinator read-only boundaries, expose narrow brokers | Grant user authority, fabricate tools, treat prompt text as sandbox enforcement |

For a task/revision, coordinator, executor, integrator, candidate reviewer,
integration reviewer and verifier identities must satisfy the required separation.
The fixed handoff role profile declares `coordinatorMayImplement: false` and
`selfReviewAllowed: false`; it is a contract, not evidence that the host enforced
it. If the current host cannot enforce a read-only coordinator plus audited
journal/evidence/progress brokers, the later consumer must return
`manual_handoff_required` before dispatch.
