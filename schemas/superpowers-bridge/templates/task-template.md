---
id: "0001"
title: "Replace this example with the approved task"
owner: "Role accountable for this outcome"
nodeType: task
# parentId: "P01" # Optional package at any justified composition depth.
boundary:
  change: ""
  target: ""
  exclusions: []
  review: {verdict: pending, source: ""}
kind: implementation
openDecisions: []
decisionInputs: []
resolvesDecisions: []
# decisionBundleReason: "Why multiple decisions cannot be resolved independently"
dependsOn: []
# dependencyDetails:
#   - id: "0000"
#     reason: "Why this outcome cannot begin until the named output from 0000 exists"
#     requiredOutput: "Exact artifact, interface, decision or verified state consumed from 0000"
write: [src/example.js, tests/example.test.js]
resources: []
scenarios: [example/Accept valid input]
verification: [npm test]
---
# Task 0001: Replace this example with the approved task

## Outcome
<!-- State one exact future result and its target. Split separable outcomes before delivery. A package groups outcomes and never receives an executor. -->

## Inputs
<!-- Name relevant specs, decisions, interface contracts and prerequisite outputs.
Name the exact prerequisite output required by each precedence dependency. -->

## Scope and dependencies
Replace the frontmatter with exact repository-relative paths, including test files.
All other files are read-only. Quote IDs; do not list the task as its own dependency.
Shared resources include test databases, ports and caches. Do not put progress here.
For every dependency, repeat the exact `requiredOutput` in this section so a worker
can verify admission without consulting the planning conversation.
Do not create precedence merely because tasks belong to the same feature; use
dependsOn only when a concrete output is consumed. Shared writes/resources belong
in conflict metadata and `serializesWith`, not in invented dependency edges.

## Acceptance
Map each scenario to actual assertions. Scenario references use
`<capability>/<exact heading>` from `specs/<capability>/spec.md`.

## Future implementation guidance
Describe the minimum useful verification strategy and expected observable result.
TDD may be recommended for behavioral code, but ASDS does not run this future work.

## Verification
Use project-specific commands, not the illustrative `npm test` if inapplicable.
State future commands and expected results. They are instructions for a later
consumer, not evidence that ASDS executed them.

## Definition of done
- Future result and exclusions are observable.
- Positive, negative and preservation criteria are mapped to requirements.
- Dependencies name their required outputs and the verification strategy is feasible.
- A later consumer can demonstrate completion without consulting the planning conversation.
