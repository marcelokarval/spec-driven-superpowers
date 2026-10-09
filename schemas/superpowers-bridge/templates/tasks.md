# Tasks: <!-- Change title -->

ASDS owns this planning index until the package is delivered. A new delivered plan
keeps implementation checkboxes open. Dependencies live in each linked contract;
waves are recommendations for a later consumer and never trigger concurrency.

## Ordered task inventory
- [ ] [Task 0001](tasks/task-0001.md): <!-- Description -->
- [ ] [Task 0002](tasks/task-0002.md): <!-- Description -->

Keep numeric IDs strictly increasing here. Titles exactly match their contracts.
Never renumber an existing task during revision; append the next unused ID.

## Execution projection
- Wave 1: 0001
- Wave 2: 0002

Create both linked contracts from task-template.md. Task 0002 may depend on
`"0001"`; Task 0001 must not depend on itself. Include all test paths.

For broad outcomes link package contracts with the same syntax. Packages may contain
packages or leaf tasks when meaningful; only leaves represent future executable work.
Composition uses parentId and does not imply precedence. Standalone tasks need no
package. Sequence comes from explicit dependsOn edges, not numbering.
Generate `planning-manifest.json.taskManager` from the deterministic projection;
the machine-readable wave declarations must agree with it. Each projected task
exports `serializesWith` when a path/resource conflict prevents safe parallel work.
A delivered contract can be waiting or
blocked and must not be labelled initially executable merely because it was reviewed.
