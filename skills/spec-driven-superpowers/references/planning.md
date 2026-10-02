# From understanding to executable tasks

## Incremental understanding
Reuse direct conversation or received Accelerate context. Inspect the relevant
project sources before proposing a solution. In proposal.md record outcome/current
behavior and evidence, scope/non-goals, constraints, assumptions and open questions.
Do not create another intake document. Ask only material questions that block the
next step; resolve routine implementation details from evidence and record them.

A question is material when different answers change behavior, acceptance, public
interfaces, security, data migration, irreversible effects or approved scope.
Assign an owner to each material decision. Record chosen option, rationale and
consequence in design.md. If evidence is missing, plan a bounded investigation
with a concrete question/output before its dependent implementation.

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
