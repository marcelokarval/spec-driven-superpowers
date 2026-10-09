# Design

## Context and authority
Owner: current ASDS coordinator. Authorization: current user request to implement and finish the agreed framework evolution. One canonical tasks.md, same checkout. Existing observational logs are preserved.

## Decisions
Reuse task contracts with optional nodeType and parentId. Explicit new nodes compile to plan protocol 3; legacy protocol 1/2 remains replayable. One package level, ordinary dependency DAG plus child-to-package completion edges. New tasks require a recorded semantic boundary review, whose truth is not mechanically certified.

Decompose converts an unfinished root task to a package without changing its outcome. Refine narrows an unfinished child and introduces siblings, conserving scope/scenarios/explicit approval criteria and redirecting dependent work. Stop affected workers first. Replan remains the material-change path. Evidence remains historical; unrelated unchanged accepted tasks retain status.

Packages are coordinator-owned. They never receive workers and require integrated receipts after all children and prerequisites are accepted. Existing-plan projections retain conservative source binding; source drift still needs explicit reconciliation. No claim that every model will follow the skill or that direct native spawn is intercepted.

## Validation
Unit/state-machine counterexamples; actual CLI/source fixtures; existing-plan projection; full existing suite; independent bounded review. Prepared natural-language evals are not represented as executed harness qualification.
