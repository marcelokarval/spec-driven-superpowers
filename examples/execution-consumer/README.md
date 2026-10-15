# Synthetic execution-consumer examples

These fixtures are **synthetic, illustrative, and non-production**. They carry no
authorization, do not prove a harness capability, and must never be used as a
live handoff, journal, receipt, or evidence record. Their purpose is to show the
current execution-consumer states and ordering without touching a user project.

- `full/scenario.json` ends only after progress is committed and an external objective verifier passes.
- `partial/scenario.json` preserves an excluded task and therefore ends as `partial_consumed`, not `complete`.
- `progress-recovery/scenario.json` shows an interrupted progress commit being inspected and recovered before objective verification can begin.

Every scenario uses `asds.execution-consumer-example/1` and contains a complete
journal v3 generated with the official `compilePlan`, `createJournal`,
`appendEvent`, `replay`, `objectiveSnapshot`, and `continuation` APIs. Events carry
the current sessions, capabilities, snapshots, revisions, execution evidence,
receipt/progress bindings, and objective revision. The recovery scenario also
preserves a valid `progress_pending` checkpoint whose next event is the matching
`progressCommitted`. Runtime truth still comes from a validated handoff, real host
observations, a persisted journal, canonical receipts, and material readback.
