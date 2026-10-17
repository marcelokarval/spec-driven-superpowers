> HISTÓRICO SUPERSEDIDO pelo mandato humano C0 de ASDS passivo (2026-10-15).
> Não operacional; não instalar/ativar. Evidência anterior preservada abaixo.

# Review authority /2 — source implementation candidate

**Not activated/runtime-qualified; independent acceptance and grants pending.** See [report](../research/2026-10-14-opencode-review-authority/POSITIVE-REPORT.md).
The chosen single backend is a V2 plugin under a dedicated isolated
OpenCode UID, private filesystem store, planner Unix socket and separate consumer
admission socket. No PKI/signing. General API/config/store/imports must be outside
model reach; root/admin compromise is outside the guarantee.

Production factory accepts no caller object/config/env override; fixed profile
`/etc/asds/review-authority.json` and payload are root-protected, socket namespace
root-owned and endpoint UID distinct. Profile/endpoint metadata is revalidated around
every operation. Capability/admission WeakMaps cannot be reconstituted from JSON.
Source checks are not demonstrated OS qualification.

Material `/2` includes author/policy/context and canonical inventory. Generated
state/reviews/readback/C12–C16/taskManager are excluded. Raw examined and final
snapshots are distinct; final normalized identity includes review artifacts/manifest.
`canonicalIndexContent` preserves legitimate progress, not a global checkbox regex.
`/1` hashes unchanged. Fidelity commits before distinct-session quality with causal
digest. Authority produces artifacts/final manifest; caller PASS is never evidence.
Parser validates review declarations, not plan meaning by regex.

Protected completion submits persistence bytes, publishes prepared bundle, reopens
and verifies online. Prepared readback is not proof destination was already written.
Before publication it reobserves material and merges canonical progress observed
during review; material drift or progress regression rejects. This does not make
the existing multi-file publisher atomic against arbitrary uncooperative writers.
Sensitive `/1` remains closed; enrollment prevents ordinary/legacy downgrade.

Store uses exclusive writer, serialized operations, bounded integrity envelope,
temporary fsync/rename/directory fsync before reply. Generation/state provisioned
explicitly; missing/corrupt/inconsistent state/stale locks fail closed. Interrupted
jobs do not resume from idle or silently rerun. Digests do not defeat admin rollback.
Exact request retries reuse jobs; conflicting reuse fails. Verify is idempotent.
Admission binds consumer/grant/action/receipt/generation/sequence and immutable bytes.
Exact action retry returns same decision. Persistent revocation blocks later
decisions, not already authorized actions. Progress regression requires reopen,
which this candidate rejects rather than inventing a receipt.

Planner POST routes: `/v2/health`, `/v2/reviews`, `/v2/job`, `/v2/verify`.
Consumer-only POST: `/v2/admissions`, `/v2/revocations`, `/v2/consumer`. Closed request schemas,
bounded transport and nonce binding; no sign/import-review/record-pass endpoint.
OS socket access authenticates one configured consumer principal, not a caller name.
Distinct configured GIDs and consumer UID are checked against protected local account
databases (including primary groups/aliases). Separate service-owned 0710 directories
and exact-GID 0660 sockets reject extended/default ACLs via protected system getfacl.
Effective consumer UID gates client admissions; planner privileges cannot reach that
channel. Fixtures use 0600 and do not establish real OS isolation.

General API isolation uses a fixed root-protected named network namespace, different
from the operator-observed initial host namespace: service inside, clients outside,
zero kernel capabilities, no non-loopback TCP listeners. Named general API Unix sockets
need service-private 0700 ancestry; abstract sockets remain namespace-local. Namespace/
provider routing, fresh non-recycled GIDs, effective-group audit and ACL tooling are
additional explicit pending deployment grants, not operations performed here.

Admission authorizes immutable snapshot bytes, never later mutable-path reads. Sync
execution APIs stay separate and reject enrolled legacy bypasses. Optional init/next/
pause/cancel are administrative admission continuity only, not a second execution
engine. Identity is canonical per receipt/enrollment/generation/consumer/grant/binding,
not per action. Concurrent/restart retries preserve one record; new actions/admissions
cannot reset pause/cancel. Succession is not implemented and is denied.
CLI verify/progress/reconcile are typed UNSUPPORTED. objective-packet returns admitted
input with verification:false; product execution and a bound execution-host bridge
are not supplied by this scope. Caller JSON handles remain locators, never proofs.
Current observations and historical mutation receipts are distinct. init/next/status
reobserve the live administrative record instead of replaying readiness; next after
pause/cancel remains denied, including same-action retries after restart. Ready next
includes the immutable admitted snapshot and shared compiled planning graph with
binding/digests. Harness compares live state/sequence/digest and recompiles the exact
snapshot; a cached admission-ready string or swapped plan cannot qualify it.
Writable libraries cannot prohibit arbitrary shell activity.

Nine pinned snapshots establish context as a direct array, create/get unwrapped Info,
prompt inbox response, wait void and Model.Ref id/providerID. Default plugin/worker
have real setup/create/prompt/wait/get/context/interrupt calls, no ctx stubs or new SDK
dependency. Setup checks the running host version/location. Session/prompt are reserved
durably before prompt; full immutable text, deny-all, context/compaction/tool guards
and persisted user/assistant/idle with succeeded/stop are required before consuming
the closed review response. Clean restart tests are not SIGKILL proof. Real OpenCode/
config/socket/ACL/network/crash-window qualification is pending with
[explicit grants](../../templates/review-authority/README.md).

Correction after independent review: optional skills omitted by the official backend
are accepted; null/nonarray/nonempty lists reject. Model-facing messages must be the
one exact reserved user prompt (optional ID, no extra sources). Source-owned system
policy replaces configurable baseline and is locked with messages/tools against later
hooks. Only the protected entrypoint may be configured; complete configuration/plugin
manifest and actual loaded inventory remain operational checks, not digest-as-fidelity.
Harness prepare writes an explicit durable checkpoint; reobserve uses a new factory
after separately operator-approved restart, online receipt matching, different process
boot ID, stable generation and monotonic state, then positive admission readiness.
Polling budget derives from both review timeouts; restart-pending jobs remain failed,
never automatically replayed into a new model round.
