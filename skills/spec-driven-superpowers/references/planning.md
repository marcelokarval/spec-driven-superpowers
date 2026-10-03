# From understanding to executable tasks

## Incremental understanding
Reuse direct conversation or received Accelerate context. Inspect the relevant
project sources before proposing a solution. In proposal.md record outcome/current
behavior and evidence, scope/non-goals, constraints, assumptions and open questions.
Do not create another intake document. Ask only material questions that block the
next step; resolve routine implementation details from evidence and record them.

Before listing a decision as open, compare it with the authoritative received
contract. Preserve explicit rules and their direct logical consequences. A boundary
missing from the sample/test data is a verification gap, not automatically an
unspecified behavior: a rule accepting nonnegative values already includes zero.
Do not ask to approve that boundary again or present an option that contradicts the
rule as routine clarification. A distinct issue such as conflicting duplicate
records may remain open; name that issue precisely instead of reopening the settled
rule. Changing a settled rule needs a concrete counterexample/contradiction, its
source and an applicable new decision. Review both resolved and open decision lists
against the same contract before delivery and on status/resumption.

A question is material when different answers change behavior, acceptance, public
interfaces, security, data migration, irreversible effects or approved scope.
Assign an owner to each material decision. Record chosen option, rationale and
consequence in design.md. If evidence is missing, plan a bounded investigation
with a concrete question/output before its dependent implementation.

## Read scope
After accepting work, ASDS preserves the selected project and the received read
boundaries throughout discovery, implementation, review and resumption. Default
to relevant project files plus the necessary global instruction/skill references.
Read access is not a reason to explore sibling projects, HOME, temporary logs,
other sessions or previous evaluation evidence. A suggestive directory name or
nearby report does not make that material relevant to the current task.

Before an outside-project read, identify the missing fact, why local evidence
cannot answer it and the exact external reference needed. Use existing authorized
references when sufficient; ask only if expansion needs a new decision or permission.
Never perform broad HOME/tmp searches to guess the purpose of a project. If the
necessary context is missing, report the gap and continue independent scoped work.
Delegated workers and reviewers inherit the same boundary, not just a write scope.

If unrelated evidence was read, record that exposure and exclude it from claims
of independent verification. A later restricted probe does not erase the earlier
deviation. These are behavioral instructions, not a filesystem sandbox.

Report observed operations precisely: reading source, checking `node -v`, running
project tests, writing artifacts and publishing are distinct actions. A version
command executed a program even when no project code ran. Inspect the project
before asserting that a file/directory is absent, and distinguish proposed paths
from existing artifacts. Do not substitute an agent's summary for tool evidence.

## One planning home
Use brainstorming before specs/design/tasks, only when understanding or choices
need elaboration. Under ASDS its output feeds proposal.md and design.md. Writing
plans produces microcontracts and tasks.md directly. Never create parallel plans
or progress indexes in docs/superpowers. Prior valid decisions/authorizations are
reused; a skill cannot revoke user authorization or require a new turn by itself.

Proposal -> specs and design -> microcontracts -> tasks.md -> readiness review.
The microcontracts artifact explicitly generates tasks/task-*.md so OpenSpec update
and apply can discover it. A glob match alone is not proof of collection completeness:
run ASDS validation for the index/contract bijection and every scenario.
Change specs use delta headers, not the main-spec Requirements section.

## Readiness
Each task states one observable outcome, inputs/prerequisite outputs, acceptance
assertions linked to scenarios, exact write scope, shared resources and verification.
Declare `kind`: implementation, investigation, documentation or operation. Declare
`openDecisions: []` only when no material choice blocking this task remains. An
investigation may answer a question blocking a later implementation task; its own
method, bounds and deliverable must be settled. Unknown interfaces are dependencies,
not permission to invent an API independently in parallel tasks.

Required body sections: Outcome, Inputs, Acceptance, Verification, Definition of done.
No empty/template-only sections or unresolved TODO/TBD. The validator checks minimum
structure; coordinator review checks meaning, scenario/assertion adequacy, cost and
feasibility. TDD applies to behavioral implementation; investigation requires evidence
and conclusions, documentation requires accuracy/link checks, operations require
applicable permission, preconditions, verification and failure/recovery handling.

Split tasks by independently verifiable outcomes, not line counts. Keep coupled
interface decisions together or precede consumers with a shared contract task.
Schedule only after prerequisites are integrated. Scope independence alone does not
prove semantic or resource independence. Invalid graphs are blocked, never executed
as a sequential fallback. Lack of concurrency capabilities permits sequential work.

## Adaptive decomposition
A package groups an approved result; only its executable children are dispatched.
Keep one level (package -> tasks) in the existing tasks.md and task contracts. IDs
are stable identities; dependencies determine order. Do not create a second plan.
A simple change needs no package. More tasks do not mean more approved scope.

Before dispatch, the coordinator reviews granularity: name the exact behavior
change, target, exclusions, independent completion check and prerequisite decisions.
If multiple independently deliverable results remain, split them automatically
within the existing grant. If a material decision is unknown, schedule a bounded
investigation first. A negative experiment result completes the investigation,
not the implementation goal; another hypothesis is a separate justified task.
Do not split a coherent atomic operation merely by file, line count or test step.

Examples: "templates with AI authority" is a package. "Restore filters when opening
an existing saved view" is a task. "Change button X normal color from Y to Z while
preserving other states" is one task, including its proportional verification.
For scale, separate measuring query X on dataset Y from implementing the selected
correction and from proving the package's representative-volume acceptance.

New contracts declare nodeType: task or package. Tasks include boundary.change,
boundary.target, nonempty boundary.exclusions and boundary.review with verdict:
ready and source naming the coordinator's semantic assessment. These fields are
recorded claims, not proof of good granularity; review the meaning and evaluate
behavior. Package scenarios are covered by child scenarios; all approved acceptance
requirements must additionally be reconciled by the coordinator. No dropped or
invented requirement is permitted merely because scenario IDs match.

A worker finding an oversized contract reports the completed/partial evidence,
remaining results and a proposed split; it does not silently expand implementation
or start descendants. Coordinator stops affected workers, preserves artifacts and
uses decompose for an unfinished root task or refine for an unfinished child.
Neither requires a new human approval within the original grant. Material changes
use ordinary replan with applicable authorization. Existing accepted independent
work remains accepted when its contract identity is unchanged. Historical evidence
is retained but never relabelled as proof of a new contract.

Review is scoped to the task plus relevant regressions. Separate contract defects,
missing evidence and optional improvements. Improvements receive their own explicit
disposition, not endless additions to the same correction round. Integration review
checks composition once at the package boundary; reuse still-current evidence.
The package closes only after child acceptance AND its integrated outcome proof.

## Approval and change control
Readiness is not execution authorization. Carry forward applicable user decisions;
ask only for genuinely missing authorization or a material scope change. Record its
source and scope in design.md, not a new approval document per task.

Before dispatch, compute contractRevision with loadTasks: it hashes the task source, prerequisite contracts
and proposal/design/specs, excluding tasks.md progress. The coordinator records the
accepted revision; a worker cannot approve its own edited contract. Changing only a
checkbox does not change this identity. Shared planning edits conservatively invalidate
all contract identities; reassess affected tasks and their transitive dependents with
`affectedTasks`, preserve unrelated code, then revalidate/review before issuing fresh
receipts. A local task edit invalidates its own identity and those of its
transitive dependents even if their own source bytes are unchanged.

Stop dispatching affected tasks; contact any active worker before replacing its
instructions. Preserve its partial output. Update specs/design, affected microcontracts
and dependencies, then reopen affected checkboxes. Do not silently rewrite completed
requirements to match implementation. Material changes need applicable user decisions;
routine corrections inside the accepted scope do not restart intake.

## Completion
Use delivered -> reviewed -> integrated. An implementation checkbox is not a test
result. Integration requires passing evidence and independent spec/quality review on
the integrated revision. The coordinator checks completion receipts before checkoff.
Archived incomplete/cancelled work must retain that state, never imply completion.
A return to Accelerate reports the actual state, evidence, residual work and limits.
