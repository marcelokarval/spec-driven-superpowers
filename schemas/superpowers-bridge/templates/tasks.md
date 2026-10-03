# Tasks: <!-- Change title -->

Only the coordinator updates this index after integration and verification.
Dependencies live in each linked contract; waves do not imply concurrency.

## Wave 1: Foundation
- [ ] [Task 0001](tasks/task-0001.md): <!-- Description -->

## Wave 2: Dependent work
- [ ] [Task 0002](tasks/task-0002.md): <!-- Description -->

Create both linked contracts from task-template.md. Task 0002 may depend on
`"0001"`; Task 0001 must not depend on itself. Include all test paths.

For broad outcomes use package headings and link the package contract with the same
Task link syntax. Declare nodeType: package in that contract and parentId in its
nodeType: task children. Keep one level; package completion requires child acceptance
and integrated outcome evidence, not checkbox counting. Standalone tasks need no
package. Sequence comes from dependencies, not numbering.
