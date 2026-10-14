# Session capabilities, not product assumptions

At session start record the harness/version, discovered skill path, available
tools, approvals, workspace kind, maximum parallelism and evidence location.
Separate **documented**, **observed**, **unavailable**, and **unknown**.
Installing a file does not prove discovery or activation.

Planning operations are load skill, read sources, write planning artifacts, request
review and persist/read back the package. The adapter maps only operations exposed
in this session. Spawn, execution isolation and code delivery are consumer capabilities,
not prerequisites for ASDS planning.

`chooseExecution(tasks, capabilities)` requires `spawn: true`,
`isolatedWrites: true` and an integer `maxParallel` covering the whole wave.
It blocks invalid graphs and tasks failing readiness, including unresolved material
decisions. It conservatively avoids parallel waves containing dependencies. After verifying external
prerequisites are integrated, form a ready-wave projection with satisfied
dependencies removed; retain the original contracts for validation and handoff.
It also rejects overlapping paths and shared resources. This helper checks
declared data; it cannot discover or enforce live tool capabilities.

## Consumer compatibility
Legacy `chooseExecution` remains available to explicitly selected consumers. ASDS
does not call it. If a separate planning reviewer is unavailable, record self-review;
when policy requires independence, leave delivery blocked rather than fabricating it.

## Models and access
Track model, reasoning effort, provider, authentication route and billing route
as distinct facts. Do not infer subscription billing from a model name, installed
CLI or successful login. Never modify auth/provider configuration as discovery.
Do not copy credentials into prompts, receipts or worker environments.

## Operational recovery
Persist exit status and artifacts separately from orchestration state. Cancelled
tool return can coexist with an already completed process. Read evidence first.
A worker that failed without delivery has not completed its contract. Reassign
with context and a separate workspace when appropriate, within three recovery
attempts per blocker. Defer unresolved blockers and their dependents at the end;
do not repeatedly launch agents into the same unexplained failure.
