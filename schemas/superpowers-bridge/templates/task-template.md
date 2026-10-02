---
id: "0001"
kind: implementation
openDecisions: []
dependsOn: []
write: [src/example.js, tests/example.test.js]
resources: []
scenarios: [example/Accept valid input]
verification: [npm test]
---
# Task 0001: Replace this example with the approved task

## Outcome
<!-- State one observable result, bounded enough to review independently. -->

## Inputs
<!-- Name relevant specs, decisions, interface contracts and prerequisite outputs.
Dependencies must be integrated before this task is dispatched. -->

## Scope and dependencies
Replace the frontmatter with exact repository-relative paths, including test files.
All other files are read-only. Quote IDs; do not list the task as its own dependency.
Shared resources include test databases, ports and caches. Do not put progress here.

## Acceptance
Map each scenario to actual assertions. Scenario references use
`<capability>/<exact heading>` from `specs/<capability>/spec.md`.

## RED–GREEN–REFACTOR
1. Write the named failing check and record the expected failure.
2. Implement only the approved scope.
3. Refactor while keeping the relevant checks green.

## Verification
Use project-specific commands, not the illustrative `npm test` if inapplicable.
Record command, exit code and tested revision/fingerprint. UI tasks also identify
a durable, authorized evidence location. Keep receipts outside the audited tree.

## Definition of done
- Approved scope checked against committed, dirty and untracked Git paths.
- Required commands passed on the delivery snapshot.
- Spec/quality review status recorded, including independence limitations.
- Coordinator integrated/reverified the result before updating `tasks.md`.
- Commit/push/archive only if explicitly authorized.
