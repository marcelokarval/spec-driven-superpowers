# Host adapter contract

The execution consumer is harness-agnostic. It receives an injected adapter and
uses only operations that the current host reports as observed. This contract
does not invent spawn, isolation, snapshots, cancellation, shell access or model
selection, and adapter documentation alone is never runtime proof.

## Capability observation

`observeCapabilities()` returns a provenance-bearing observation with a runtime
capability object and a matrix. Every matrix entry has one of four states:
`documented`, `observed`, `unavailable` or `unknown`, plus its source. Only
`observed` permits the consumer to call that operation. The other three states
remain fail-closed; they are not upgraded from prompt text or from the presence
of a similarly named function.

The adapter also exposes `verifyHostObservation()`. It is the abstraction's trust
hook for distinguishing adapter-issued observations from caller data. Every
capability, workspace, boundary, authorization, prepared-context, start/stop,
snapshot, integration, progress and transition observation passes that hook and a
closed schema before use. A `source` string by itself is insufficient; caller
provenance, unknown fields and an unverified callback result fail closed. A fake
host can prove that the consumer cloned the candidate, detected verifier mutation,
revalidated its digest and closed schema after the await, and froze the accepted
copy. This is not a claim that a real harness authenticates observations unless
its adapter actually implements that guarantee.

Every capability observation also carries a host-owned, single-use lease with a
strictly increasing generation. A mutating operation is invoked only inside
`withCapabilityLease`, which atomically consumes the exact current lease and the
exact operation, actor, session, role, project realpath, task ID, requested role,
write scope and preparation intent binding. Revocation or replacement while
verification is awaiting therefore produces no operation side effect. A fake
host proves only this adapter protocol; real atomicity depends on the host
implementing lease consumption at the mutation boundary.

The portable operations are:

- `observeWorkspace()` — physical package/project realpaths, workspace and
  repository identity (including base/HEAD binding), baseline/current dirty
  fingerprints, effective write scope and observed tool calls. Realpaths and
  fingerprints are non-empty strings. Every tool call is a closed object with
  non-empty `id`, `operation`, `actor`, `session`, `role` and host-owned `source`.
  Scope paths are unique canonical repository-relative POSIX paths: absolute,
  empty, `.`, `..`, repeated/trailing separators and backslashes are rejected;
- `enforceCoordinatorBoundary()` — host-owned proof that the coordinator is
  project read-only and has exactly the narrow journal, evidence and progress
  brokers;
- `authorize(operation, context)` — a current, sourced decision for the exact
  operation; a handoff grant is only a reference and must be revalidated;
- `withCapabilityLease(binding, invoke)` — atomically consume the current
  capability lease around the one authorized host mutation;
- `prepareIntent(task, role, project, scope)` — return a host-owned intent that
  reserves the exact future actor/session identity before preparation;
- `prepare(role, summary)` — create a fresh standby session with no project work,
  process or tool call started;
- `start(prepared, packet)` — release that reserved session and return matching
  session, tool-call and provenance evidence;
- `persistStartState()` / `observeStartState()` — durable host-owned request and
  post-start observation ledger;
- `persistIntegrationState()` / `observeIntegrationState()` — durable host-owned
  request and validated post-integration observation ledger, required before
  preparing a native integrator;
- `persistProgressState()` / `observeProgressState()` — durable host-owned
  progress transaction and post-broker workspace ledger, required before the
  checkbox broker runs;
- `observeStop(session)` — distinguish running, completed, failed and stopped
  sessions from a cancellation request;
- `snapshot(target)` — freeze and reobserve the candidate or integration target;
- optional `interrupt`, `send`, `wait` and `integrate` operations, only when
  observed now;
- `cancelPrepared(prepared)` — cancel a standby session only when this capability
  is itself observed and its lease can be consumed;
- `persistEvidence()` and `commitProgress()` — narrow brokers for the authorized
  destinations; `commitProgress` accepts a structured request and may change only
  the canonical checkbox path.

Unknown or unavailable required capability yields `manual_handoff_required`.
There is no fallback that gives a generic project-write primitive to the
coordinator.

## Coordinator boundary

Before authorization or worker preparation, the host must attest all of the
following with provenance:

1. the named coordinator is technically read-only for the project;
2. only the `journal`, `evidence` and `progress` brokers are available for its
   consumer writes;
3. no boundary violation has been observed;
4. the current workspace observation matches the handoff/journal binding.

An instruction saying “do not edit”, `fresh: true`, a role name, or a coordinator
promise is not enforcement. Missing, prompt-only, `documented`, `unknown`, or
violated enforcement stops before the first worker is prepared.

## Await boundaries and drift

The adapter reobserves capabilities, the workspace and coordinator boundary after every
asynchronous phase that can make an earlier observation stale: authorization,
prepare, final start authorization, start, interrupt/stop, snapshots, native
integration and progress commit. The comparison includes every binding supplied
by the handoff or journal: realpaths, workspace ID, repository root/common-dir and
revision, planning/baseline/current dirty fingerprints, write scope and observed
tool calls.

Capability revocation or any matrix/runtime alteration between awaits blocks the
next action or commit; the bridge never keeps using the initial matrix. Closed
schemas validate nested fields, primitive types, enums, integer counts and array
shape for runtime/models, reservations, authorizations, snapshots and stops.
Path claims inside runtime `externalReservations` use the same canonical
repository-relative POSIX rules. Resource identity is `type + canonical name`,
with the same NFC and case normalization used by orchestration, so spellings such
as `A.js` and `a.js` conflict even when their modes differ; read/write conflicts
cannot hide behind distinct claim-object digests. Expected workspace changes are
represented by a host-verified `workspaceTransition` that
binds operation, before/after fingerprint, before/after tool calls, effective
write scope and changed paths. The fresh post-operation workspace must equal its
`after` side and every changed path must fit both the operation and its delegated
assignment scope; reviewer and verifier assignments have an empty write scope.
A mutating start or integration observation always requires a transition, even
when fingerprints and file paths remain stable. That transition must add exactly
one structured tool call, and
its ID, operation, actor, session, role and source must match the operation
observation. Claimed or rogue calls fail closed.
A fingerprint change without attributed paths, or an unattributed or over-broad
change, is drift. A mount, symlink, checkout,
HEAD, dirty fingerprint, scope or tool-call change otherwise blocks the phase. A
prepare/start drift cancels the standby session before project work starts. Drift
observed after start retains the reservation until a real stop is observed.

## Workers, reviewers and snapshots

Before `prepare`, the host must provide an observed `prepareIntent` binding the
future actor/session to the exact project, task, requested role, write scope and
the complete structured tool call reserved for the later `start` or `integrate`.
The prepare lease consumes that complete intent; null actor/session bindings are
forbidden. Actor and session are checked independently against the coordinator and
every prior worker/reviewer/integrator/verifier identity; a fresh session cannot
hide a reused or root actor. `prepare` must attest `preparedOnly: true`, a non-coordinator session, fresh
context, no inherited history and host provenance. It must not report a process or
tool call. The consumer persists the full actor/session/role reservation before
requesting a mutating authorization. Every such grant, including `start` and the
fallback integrator dispatch, must echo the exact operation, actor, session,
role, project, task, requested role, write scope and intent. Its `scope` must be
the exact project realpath and reserved tool-call object; absent or unrelated scope fails closed. Transport
uncertainty is not completion and does not release the
reservation.

Before releasing a reserved session, the bridge persists only a host-owned
`startRequested` record: identity, exact expected tool call, scope and digest of
the freshly observed pre-start workspace. It does not persist or derive a future
workspace as fact. After `start` succeeds under its lease, the bridge validates
the returned transition, freshly reobserves the real host workspace, and only
then asks the host ledger to persist `startObserved` with that attested baseline.
The journal keeps only the request reference. Completion, integration and
objective-verifier entry points resolve the latest operation request through its
host ledger and accept the workspace only when that ledger reports `observed`.
For a start request this operation is `observeStartState`. A thrown start, invalid
lease receipt, crash before the observed receipt, or failed post-start
reobservation remains `requested` or `ambiguous`, retains its reservation, and
cannot become the current baseline. These entry points never accept a replacement
baseline from their caller and never relax drift to accommodate a claimed call.

Every `persistStartState`, `persistIntegrationState`, `persistProgressState` and
corresponding `observe*State` invocation keeps a bridge-private, deeply immutable
expected request and sends a separate clone to the adapter. The adapter must not
mutate its argument, including nested fields; host-issued IDs and provenance
belong in the returned record, not in the input object. The bridge detects input
mutation both after the call and after receipt attestation, and checks the record
against the original expectation. Mutation fails closed even if the adapter
returns the mutated argument as an otherwise valid record or reports a missing
lookup. Failure while persisting `requested` blocks the side effect; failure
while persisting `observed` never acknowledges completion, retains the existing
reservation and requires ledger recovery without repeating the side effect.
Preparation intent, authorization, snapshots and capability-lease consumption
use the same isolated-request check. The lease callback checks the argument on
entry and on exit. Its request guard is also available to the operation callback:
native integration, progress commit and verifier start check it immediately before
calling the host side effect, after all awaited workspace/boundary/journal gates.
An adapter that mutates the retained lease during a gate therefore cannot execute
that effect. A mutated lease cannot change the reserved identity, scope or
generation, including the binding retained for crash recovery.

Executor and integrator preparation carry their exact task write scope. Reviewer
and verifier snapshot, preparation intent, authorization grant and every lease
carry exactly `writeScope: []`; the task's implementation paths are never reused
as review authority.

If prepare may have run but its capability-lease receipt is invalid or ambiguous,
the bridge never reports `reservationRetained: false` and never attempts
cancellation from that invalid receipt. A separately attested returned identity
is conservatively persisted and the result is `manual_handoff_required` with
`ambiguous_prepare`; the same rule applies to native integrator preparation.

Reviewer freshness is separate from filesystem isolation. Before review, the host
must provide a read-only or disposable-copy isolation capability bound to the
candidate revision and a snapshot of revision, changed files and scope
fingerprint. Completion requires a matching session to be observed stopped with
outcome `completed`, followed by an identical host snapshot. Both before-review
and post-review snapshot requests explicitly carry `writeScope: []`. Reviewer prose cannot
replace either observation.

Objective verification has its own exported `hostDispatchVerifier` flow; reviewer
dispatch never substitutes for it. The bridge obtains the current canonical
objective snapshot, requests an objective snapshot with `writeScope: []`, reserves
a fresh verifier identity, prepares and starts it through the same grants and
leases, and appends the journal's distinct `role: verifier` dispatch with the exact
objective revision. Its snapshot, intent, grants, leases and start transition all
remain zero-write.
After the awaited start authorization, the verifier reobserves the host again and,
inside the atomic start lease immediately before invoking `start`, reobserves
capabilities, workspace and the coordinator boundary, then replays the
journal and rejects pause, invalidation, stop request, session replacement or
objective-revision drift without executing the side effect.

Completion has a matching exported `hostCompleteVerifier` flow. It observes that
the exact active reserved verifier session stopped with outcome `completed`, then
obtains the result through the host-owned `observeVerifierResult` operation bound
to actor, session, role, objective revision and current journal sequence. A caller
may supply an expected result only for equality checking; it never becomes the
signed result and a mismatch fails closed. The bridge reobserves the bound workspace, takes the
post-verification objective snapshot with zero write scope, and requires it to
match the dispatch snapshot. It then replays the journal to require the same
current `objectiveRevision`, assignment and sequence before using the observed
`persistEvidence` broker. The broker returns a closed host-owned receipt bound to
the verifier actor/session, result and evidence digests, stop observation,
workspace, both snapshots, the result observation, objective revision and journal
sequence. Only then may the bridge derive the next structural journal internally
and ask the store to persist those exact bytes. The store receives neither the
derivation function nor a reusable authority capability. Replay marks the record
`structural_only` and never reports authoritative completion. The bridge keeps a
process-local association between the concrete harness adapter, exact journal and
receipt. After restart the harness must re-observe the durable receipt through
`observeObjectiveVerificationReceipt`; only then can
`hostReobserveObjectiveCompletion` restore terminal status. This is trust in the
harness-injected adapter, not authentication created by JSON. Generic `appendEvent`,
captured bytes, caller-authored, string-only or unreceipted events never complete
the objective.

Native integration applies the same final in-lease gate. Immediately before
`integrate`, it reobserves capabilities, workspace and the host boundary, replays
the journal, and requires the same active integrator session, candidate receipt,
objective generation and unpaused state. A state change after authorization
therefore cannot race into the integration side effect.

Native integration establishes its own persistent baseline. After standby
preparation and workspace reobservation, `persistIntegrationState` first records
`requested` with a host-issued `requestId`, exact actor/session/integrator role,
task ID, write scope, reserved integrate tool call and `workspaceBeforeDigest`.
The host must independently bind that digest to the pre-integration workspace.
The bridge then appends this `integrationRequest` in the existing integrator
dispatch context alongside `workspaceSnapshotBefore`; it records no future
workspace as fact and introduces no new journal event or schema version.

Only after the leased native operation, validated transition and fresh workspace
and boundary observations succeed may `persistIntegrationState` record
`observed`, with the same request binding plus `workspace` and
`workspaceTransition`. The host must independently confirm the actual workspace
and attributed operation, preserve the request binding, and persist the receipt
durably before acknowledging it. The ledger must survive host/session restart;
a process-local map or returned bridge result is insufficient for a real adapter.
`requested` and `ambiguous` records cannot contain a workspace or transition.

At every subsequent entry, including integration review and resumption, the
bridge selects the latest start, integration or progress request in journal order. An
integration request resolves only through observed `observeIntegrationState`.
Its closed, host-verified record must match the journal identity, task, exact
scope, reserved tool call and before-workspace digest. The bridge revalidates the
stored transition against the journal before-workspace and persisted
after-workspace: stable realpaths/repository/workspace identity, exact before and
after fingerprints/tool calls, one attributed integrate call and changed paths
within the assignment scope. The fresh current workspace must then equal that
baseline without a drift exception.

A missing (`null` or `undefined`), pending or ambiguous integration record blocks
with `manual_handoff_required` and retains the reservation; a ledger transport
failure remains `transport_error`. An invalid lease receipt, post-operation
boundary failure or interrupted observed-receipt persistence never establishes a
baseline. Recovery may use an independently reconstructed host-owned receipt for
the same request and actual operation; it may not rerun integration automatically,
fall back to the earlier start baseline, accept a journal integration claim as
workspace proof, or adopt caller-supplied/current workspace data. Forged identity,
transition, repository swaps and subsequent unassigned tool calls remain
fail-closed. Older requests without this proof do not gain it retroactively.

## Stop, cancellation and transport

Every stop request supplies a closed assignment with non-empty `actor`, `session`,
`role` and exact `writeScope`; its session must equal the separately requested
session. Missing identity fails before authorization or interrupt. Every
authorization grant, including dispatch intent, echoes the exact operation,
actor, session and role.

An interrupt receipt means only `cancel_requested`. `observeStop` decides whether
the session is still running or has actually stopped and records its outcome.
Transport failure is reported separately as `transport_error`; it never becomes a
successful cancellation, stopped worker or releasable reservation. The same rule
applies to start and native integration: both return a structured
`transport_error` and retain an already persisted reservation. A prepared reservation can be
cancelled only through an observed, leased `cancelPrepared`; if that capability is
unavailable or unknown, the bridge returns `manual_handoff_required`, does not
call the callback and retains the reservation.

## Integration and progress

Integration is always delegated. Before an observed atomic `integrate` operation,
the host prepares a fresh integrator session. Authorization must echo the exact
operation, actor, session and `integrator` role; the journal reserves that identity
before mutation. The result must come from the same session with tool-call
provenance. Coordinator, executor and any candidate/integration reviewer identity
are forbidden. Without that native operation, the bridge dispatches a fresh
`integrator` worker through the same
prepare/start boundary. If those capabilities are unavailable or unknown, the
result is `manual_handoff_required`; integration never runs in the root session.

The progress broker returns matching before-hash, a distinct read-back after-hash,
the one canonical index path and provenance. It cannot accept arbitrary Markdown
or use a checkbox as evidence of delivery. Journal, receipt reconciliation and
the checkbox CAS remain separate authorities.

`hostCommitProgress` also requires the exact structured `request.progressRequested`,
matching `taskId` and `indexBeforeHash`. The durable binding is its closed base:
`type`, `taskId`, `planningRevision`, `contractRevision`, `integrationRevision`,
`receiptDigest`, `indexBeforeHash` and the exact `expectedChange`. Journal-only
`indexReadback` and `authorityConsumption` are validated separately and are not
part of this key. The bridge supplies the deterministic request ID:

```js
`progress:${digest({ projectRootRealpath, canonicalIndex: 'tasks.md', progressRequested })}`
```

The official handoff binds the canonical index to `tasks.md`; another index path
cannot establish this baseline without a durable journal path binding. No new
journal field or EC-03 schema is required. The host must independently bind the
request to the persisted authorized `progressRequested` transaction and its
pre-broker workspace. `persistProgressState` records `requested` before the broker
mutation, with that request ID, the fixed `progress-broker` actor/session/role,
task, project realpath, canonical index, normalized request and
`workspaceBeforeDigest`. The ledger must preserve this original binding and
survive restart. An existing request is recovered through its host proof and
journal readback; the bridge refuses to overwrite it or rerun the broker.

Inside the progress capability lease, immediately before `commitProgress`, the
bridge reobserves capabilities, workspace and coordinator boundary. A successful
broker result requires a host-verified progress transition, matching index
before/after hashes and only the canonical changed path. After fresh workspace
and boundary observations, the ledger may record `observed` with `workspace`,
`workspaceTransition` and `indexAfterHash`. Pending or ambiguous states may not
contain these fields. The transition cannot add, remove or alter tool calls.
An observer whose implementation-scope fingerprint excludes checkbox bytes may
report a stable fingerprint and no project paths changed; the broker's distinct
index hashes still remain mandatory and independently attested.

On resume or the next worker/verifier entry, the bridge derives the same key
from the latest journal `progressRequested` and resolves it only through observed
`observeProgressState`. It reconstructs the prior expected workspace by resolving
the journal prefix before that request, so the ledger's before digest must match
the actual causal start/integration/progress baseline. It then revalidates the
transition, unchanged workspace/repository/realpath bindings and exact index
scope. For persisted `progressRequested` and `progressCommitted` it verifies the
host-owned readback and authority-consumption receipt against their exact preceding
journal sequence/digest, planning/candidate/integration/review revisions, payload
digest, authority handle and index hashes. A committed after-hash must equal the
ledger's independently observed after-hash.

Missing, requested, ambiguous, forged or stale proof blocks without adopting the
current workspace or falling back to integration. A crash after the checkbox
write but before the observed receipt preserves the request. Only independently
recovered host evidence for that same operation may complete the ledger; neither
the closed checkbox nor `progressCommitted` alone establishes a workspace fact.
The journal's progress state still controls dependency release separately.
Ledger transport failures remain `transport_error`; unsupported durable ledger
capabilities yield `manual_handoff_required` before broker mutation.

Fake-host unit tests prove these interface invariants only. They do not prove that
any real harness supplies isolation, read-only enforcement, authenticated tool
calls, snapshots or cancellation semantics. Every exported bridge result is a
deeply frozen clone so caller mutation cannot rewrite accepted evidence.
