> HISTÓRICO SUPERSEDIDO pelo mandato humano C0 de ASDS passivo (2026-10-15).
> Não operacional; não instalar/ativar. Evidência anterior preservada abaixo.

# Positive path continuation — source candidate, not runtime qualification

## Latest operational status — 2026-10-15

After granting temporary isolated qualification, the user explicitly selected
**“Somente harness atual”**. Separate provisioning is suspended; none was executed.
The 27-file source manifest remains unchanged and verified. Current native sessions
can support procedural review, but no model-inaccessible authority has been
demonstrated in this same-UID harness. Source acceptance does not qualify it.
See the superseding decision in [PROVISIONING-DECISION.md](PROVISIONING-DECISION.md).

## Coordinator reconciliation — 2026-10-15

**Final independent readback:** oracle session `ses_ec359cc34ffeZnlpy4HBwPM7Se`,
message `msg_13d549fd8001okOYd6wSXukopd`, terminal idle, persisted model
`openai/gpt-6-astra`. It verified 27/27 manifest entries and manifest SHA256
`410ce5d2a7d21722c906d4008cfa92d881bc1a7a3c2830ac08bbf5dd20401019`, checked the
final 628/628 log and snapshot-only test delta, and accepted source-ready/tested/
review-final within the review-to-admission scope. Runtime-qualified remains **NO**.
It also reviewed the provisioning proposal with no new documentary blocker; actual
installation, isolation, loaded TCB, provider, restart and cleanup proof remain gates.
This final note records its returned verdict and does not change candidate source.

The final oracle message was read back through OpenChamber session.messages:
session `ses_ec359cc34ffeZnlpy4HBwPM7Se`, message
`msg_13d4a119d0010Q32YQoixroQV7`, terminal idle, persisted model
`openai/gpt-6-astra`. Its limited verdict closes the reported findings and permits
operational review of the source candidate, not deployment or runtime certification.
The reviewer reports 72 focused passes and a fresh-process cancellation reproducer;
the coordinator inspected the corrected consumer, core, parser, harness and integration.
No replacement worker was spawned during reconciliation.

Coordinator full suite `sh_13d4ae3b4001CKtrZbRxSfkZW8`: 628/628, check/validate/diff
passed. A subsequent documentation-only addition routes the planner skill explicitly
to protected OpenCode /2 independently of AGY. Full frozen verification including that
addition under `sh_13d4dc734001unzgJIVSvRhJNn` returned **627/628**, exit 1: the
active-surface hash correctly required review of the changed skill. Oracle reviewed
it and identified an imprecise return-envelope instruction; it now explicitly maps
`completed.context` to `result.reviewContext`. Oracle accepted the corrected text
with SHA256 `013d09396ab720b4dbf463410b2dd28c75ed0723a3de84da49edd0a62dacd124`.
Only then was the expected hash in `tests/workflow.test.js` updated. No assertion
was removed or weakened. Final frozen gate `sh_13d50e4e5001RozD0lk5Vy2SFr` completed:
**628/628**, zero failures/skips; `npm run check`, `npm run validate` and
`git diff --check` all passed (the chained command exited 0). No source, skill or
test changed afterward; only delivery documentation/evidence is being finalized.
Log: `/home/marcelo-karval/.local/share/opencode/shell/97750006b97297ec34c7660f504815b18406c421/sh_13d50e4e5001RozD0lk5Vy2SFr.out`.
One preliminary command named nonexistent
`tests/integration.test.js` and exited 1; this was a command-selection error, not a
behavioral RED or a product failure. No source change followed that error.

The previous 24 changed/new source, script, adapter, skill and test files (excluding docs and
the four pre-existing observations) have sorted `sha256  relative-path` manifest
digest `600f8aea78af18cef799dca3b7112d9beb9cc0bcee88761c036bd5fa043aa00a`.
This historical digest is superseded by the reviewed skill/snapshot update above;
it is not final candidate identity, an authority receipt or deployment attestation.

Authorship clarification: the oracle did **not** edit `reviewContext` or any file.
It identified an API-documentation mismatch and proposed text. The coordinator
applied that text in `skills/spec-driven-superpowers/SKILL.md`; no implementation
of context mapping changed. The oracle then independently reread and accepted its
final bytes/hash. The coordinator subsequently changed only the expected hash in
`tests/workflow.test.js`. This is technical review acceptance under the existing
source/test grant, not a new human approval, host receipt or operational grant.
The negative 627/628 run and corrected final 628/628 run are both preserved.
Current file hashes are in `FINAL-SOURCE-SHA256.txt`; operational proposal is
[PROVISIONING-DECISION.md](PROVISIONING-DECISION.md), subject to separate human approval.

| Requested outcome | Source | Proof / remaining gate |
|---|---|---|
| Independent fidelity then quality | V2 worker and causal binding implemented | Synthetic positives/negatives; real provider pending |
| Durable receipt and reobservation | Private store and online /2 client implemented | Fresh Node fixtures; live restart/OS isolation pending |
| Planner/store/consumer entrypoints | Integrated; explicit planner skill route | Local regression; protected installed payload pending |
| Valid immutable consumer admission | Implemented with compiled plan and current-state validation | Synthetic proof; live protected consumer principal pending |
| Runtime activation and qualification | Harness prepare/reobserve and runbook supplied | Not authorized or performed |
| Consumer projects revalidated | Out of scope | None revalidated; no downstream unblock claim |

Operational preflight observed OpenCode 2.0.28 under the user's writable NVM tree,
not a protected TCB; system Node is 18.19.1. No protected `/etc/asds` profile or
system OpenCode installation was present, and `getfacl` was not found. The existing
OpenCode package occupies about 117 MiB; this is an observation, not a measured new
installation footprint. A protected official installation requires an explicit
exception/installation grant. Do not chown the user's NVM tree, redirect their
launcher, or silently add another runtime. Service accounts, namespace, ACL tool,
profile/payload, provider provisioning, service start/restart and live qualification
remain separate operational grants described in the runbook.

No Plane project was created (owner explicitly selected local governance). Existing
PR #8 was observed on the branch, not opened or updated by this work. Changes remain
uncommitted. No installation, global configuration, consumer edit, push or release.

## Current delivery after independent blockers (supersedes earlier scope claims)

Successor-review correction (latest candidate): init identity remained canonical,
but cached init/next could report readiness older than cancellation. Two focused
behavioral RED runs of `node --test --test-name-pattern='admission continuity'
tests/review-authority.test.js` exited 1: first missing admitted snapshot; then
admission-ready returned where admission-paused was required. Corrected separately
from operational qualification:

- init/next/status rederive current administrative state, even with the same action
  after a real fresh fixture Node process. Mutations stay idempotent but cached
  receipts explicitly say historical/current:false. No identity or cancel reset.
- Ready next returns the admitted immutable snapshot and shared planning compilation,
  digests and receipt/material/context/final binding. The existing admission facade
  reuses the same compiler. Harness requires current state, unpaused/uncancelled,
  matching sequence/state digest and exact recompilation; stale/swapped input rejects.
- Policy/runbook clarify **one external plugin**, not removal of official internal
  pre/post plugins. Those internal bytes/hooks are inventoried trusted TCB; configured
  external list checking is not asserted as proof of the runtime internal registry.
- Bound product execution is still not supplied and no product tasks were executed.
  Source acceptance/live qualification remain root-owned. Earlier 628 suite results
  (including root sh_13d3d02b3001sghnC7ztwIlecL) are invalidated for this changed candidate.

New focused GREEN and final frozen full-suite results are recorded at the end of
this section after execution; no runtime-qualified claim follows from them.

Successor focused GREEN: `node --test tests/review-authority.test.js
tests/review-authority-terminal.test.js tests/review-authority-worker.test.js && npm
run check && npm run validate && git diff --check`, exit **0**, **20/20**. Tests also
reject swapped compiled input and stale response sequence; the same init/next action
after cancellation in a new Node process returns current cancelled state and cannot
qualify. Fixture processes/socket roots cleaned; observations/snapshots/history
preserved. Full-suite source/template payload is frozen while its final gate runs.
Successor final frozen gate: `npm test && npm run check && npm run validate && git
diff --check`, exit **0**, **628/628**, shell `sh_13d45ba89001eD3tLM6rRv0p7P`. This
supersedes the invalidated earlier 628 result; new assertions cover current reads,
fresh-process cancellation and bound compiled input without broadening execution.
No actual OpenCode/provider/OS deployment qualification was performed. Scope remains
review and valid admission, with administrative controls and no product execution.

Root confirmed original DoD: positive review and valid admission, **without product
task execution**. The attempted private execution engine was removed. Current optional
init/next/pause/cancel are administrative admission continuity only. Bound product
execution and a bridge to the existing execution journal are not supplied/not part of
admission. verify/progress/reconcile return typed ASDS_ADMISSION_OPERATION_UNSUPPORTED,
not host-proof-required success. objective-packet is input only, verification:false.

Oracle `ses_ec359cc34ffeZnlpy4HBwPM7Se` blockers read integrally. Correction RED
`node --test tests/review-authority-terminal.test.js tests/review-authority.test.js`
exit 1, 14/17: official omitted skills rejected, swapped model context accepted, and
second init action accepted. Source then corrected these together:

- Optional undefined skills follows pinned prompt normalization; null/arbitrary/
  nonempty lists reject. Mocks now reproduce absent skills.
- Exact single user/full prompt and optional prompt ID compared in model-facing
  context. Source-owned closed system replaces baseline; fields are locked against
  later hook mutation. Protected config pins one authority plugin; actual loaded
  inventory/config graph remains a required operational manifest check, not digest
  as fidelity proof. No unsupported hook-order API was invented.
- Canonical continuity identity binds receipt/enrollment/generation/consumer/grant/
  binding independently of actionID. Exact concurrent retries preserve one identity;
  new action or admission cannot reset pause/cancel across restart. Succession denied,
  not silently fabricated. Legacy/corrupt execution-run records fail closed on read.
- Health exposes a per-process boot ID and timeout; receipts bind issuing boot.
  prepare writes explicit fsynced checkpoint; reobserve creates a fresh factory and
  performs no review, requires new boot/stable generation/monotonic state, matches
  receipt online and demands admission-ready. Restart is operator-only, separate.
  Checkpoint spoofing cannot replace the online issuing-boot receipt binding.
- Client polling bound covers both configured reviews plus margin, not fixed five
  minutes. Pending jobs after restart stay failed; no automatic model retry.

Correction GREEN: focused review files 20/20 plus check, exit 0. Expanded focused
with handoff/store/execution legacy regressions 72/72 plus check/validate/diff, exit 0.
Final source/template freeze and full-suite result are recorded below once finished.
The preceding milestone ledger describes historical development, not current scope.

Final correction gate: `npm test && npm run check && npm run validate && git diff
--check`, exit **0**, **628/628**, syntax/structural/diff passed. Source and installed
templates remained frozen throughout. Shell log `sh_13d39fd41001SY6vqMAeU2A3Tb`.
Scoped local-link scan: exit 0, no missing links. These are source/conformance gates,
not OpenCode runtime qualification or approval by the independent reviewer.

Requested: complete protected OpenCode V2 review and positive admission, with a real
preparable harness, not product task execution. Delivered source: /2 material binding; causal core with
host artifacts/finalization; durable single-writer fsync store; protected fixed-profile
client/nonce protocol/private capabilities; publication/readback/online /2 store
integration; async immutable handoff/admission/graph compilation and enrollment
downgrade rejection; CLI/harness/source installer wiring; socket server, pinned
terminal validator/hooks; proposed deployment runbook.

Continuation after root supplied the missing schemas: default plugin/worker and
administrative admission controls are implemented. Source candidate awaits
independent acceptance and exact deployment grants. No runtime-qualified,
consumer-qualified or authentic E2E claim. Bound execution is not supplied; no
product tasks were executed.

## Resolved source input and concrete implementation

The initial six snapshots omitted context's container. Root supplied three further
files at the pinned commit (all read-only, not imported as code):

- `packages/core/src/session.ts`: Session.Service context/prompt implementation;
- `packages/protocol/src/client.ts` and `groups/session.ts`: endpoint schema proves
  context is an array, create/get are Info, prompt is an admitted inbox user and wait
  is no-content. Core source confirms Model.Ref uses id, not modelID.

Worker/default setup uses actual pinned methods and awaited hook registrations,
durable session/prompt reservation before prompt, whole snapshot text, deny-all,
persisted prompt/terminal/context observations and interrupt on timeout. No SDK stub,
caller injection in production setup or dependency installation. Plugin setup checks
running host version/location; CLI version alone remains insufficient.

Administrative admission continuity is canonical and private; it is not journal-v3
execution or a bound host bridge. JSON handles cannot rewrite it or reconstruct
capabilities. Exact retries, binding/sequence and persistent revocation apply.
verify/progress/reconcile are typed UNSUPPORTED; admitted input packets do not verify
an objective. CLI supports admission controls. Prepare records actual reviews and
receipt; reobserve separately observes restart and positive admission, no re-review
or product tasks. Provisioning source
is operator-only, fixed profile and explicit --initialize, no auto-reset.

The channel issue found by root was corrected: distinct configured GIDs and consumer
UID, separate 0710 directories, exact-GID 0660 sockets, protected local-account
membership/alias checks, effective UID gate and extended/default ACL rejection via
protected system getfacl. Fixtures use private 0600, never impersonate real principals.
No arbitrary consumer body string substitutes for the configured channel principal.

General-API isolation now has a concrete source fence: named root-protected network
namespace distinct from operator-observed initial host namespace, service inside/
clients outside, no retained capabilities, no non-loopback TCP listener and private
ancestry for named general-API Unix sockets. Namespace/routing/ACL tooling are extra
pending operational grants and require independent review; no namespace/user/group/
package/service was created here. No external research or guessed API.

## Commands / exits

- Behavioral RED: `node --test tests/review-authority.test.js`, exit 1, explicit
  positive-path rejection, not import/setup failure.
- Intermediate same-command exits 1: fixture omitted write, then verification;
  cleanup removed root before writer close. Empty declared fixture arrays and
  close-before-removal corrected; existing negative tests not weakened.
- First GREEN: same command, exit 0, 1/1.
- Expanded focused: `node --test tests/review-authority.test.js tests/handoff.test.js
  tests/planning-store.test.js`, exit 0, 25/25.
- First background `npm test && npm run check && npm run validate && git diff --check`:
  exit 1, 608/616, eight migration failures. Payload changed during the suite;
  result invalidated, not called pre-existing or PASS. Chained checks not reached.
- Stable focused `node --test tests/review-authority.test.js
  tests/review-authority-terminal.test.js tests/handoff.test.js tests/planning-store.test.js
  tests/execution-handoff.test.js tests/execution-consumer.test.js && npm run check
  && npm run validate && git diff --check`: exit 0, 64/64; syntax/structure passed.
- Frozen-source full suite before the additional cross-job session test: exit 0,
  620/620 plus check/validate/diff check. Additional RED
  `node --test --test-name-pattern='previously observed' tests/review-authority.test.js`
  exit 1 exposed accepted session reuse across jobs. Core now durably reserves
  session/prompt/request identity through a host-internal pre-prompt callback and
  rejects all historical reuse, including failed jobs. The fixture reservation is
  explicitly synthetic, not evidence of actual create/prompt order. Expanded
  focused after the first reuse correction: exit 0, 30/30. Final frozen-source
  suite after the reservation change: exit 0, focused 30/30, full 621/621 and
  check/validate/diff check. Additional publication-progress RED
  `node --test --test-name-pattern='prepared publication' tests/review-authority.test.js`
  exit 1 showed the prepared index losing concurrent progress. Added a material
  recheck and canonical-progress merge before publication; regressions/material
  drift reject. Final frozen-source command
  `node --test tests/review-authority.test.js tests/review-authority-terminal.test.js
  tests/handoff.test.js tests/planning-store.test.js && npm test && npm run check
  && npm run validate && git diff --check` completed exit 0: focused 31/31, full
  **622/622**, syntax and structural validation passed. Log shell IDs:
  initial failed full `sh_13ced6344001THZ3KXsK6wqCCa`; successful final
  `sh_13cfae42b001f4XElaTHmXwTyG`. Root owns independent review/acceptance.

## Evidence tiers / gaps

Latest continuation ledger:

- Worker behavioral RED: `node --test tests/review-authority-worker.test.js`, exit 1,
  explicit positive-path rejection, not import/setup error.
- First worker/core focused GREEN: 15/15, plus syntax check, exit 0.
- Expanded protected lifecycle initially failed: empty synthetic execution scenarios/
  verification, then missing journal intakeDigest. Synthetic fixture was enriched
  before its review; intake binding corrected in source. No existing test weakened.
- Integrated focused `node --test tests/review-authority-worker.test.js
  tests/review-authority.test.js tests/review-authority-terminal.test.js
  tests/handoff.test.js tests/planning-store.test.js tests/execution-consumer.test.js
  tests/execution-handoff.test.js && npm run check && npm run validate && git diff
  --check`: exit 0, 71/71, syntax and structural gates passed.
- Full suite runs only after all source and installed template payload edits are
  frozen. Final `npm test && npm run check && npm run validate && git diff --check`
  completed exit **0**, **627/627**, syntax/structural/diff checks passed; log shell
  `sh_13d1edca1001Whev35v7sQ8q1Y`. No source/template payload changed during that run.
  Final status/diff check exit 0; `/tmp/opencode/asds-review-*` listing was empty.
  Root owns independent review and acceptance, not this implementer.

Synthetic positives: fidelity→quality→finalization, clean fresh Node reobservation,
immutable admission, retries/progress. Negatives: fake callbacks/roots/PASS, unknown
fields, self/parent/same-session/kind/causal binding, author/policy/revision/inventory
drift, conflicting replay/idempotency, concurrent retry/revocation, timeout/malformed/
limited output, interrupted pending state/corruption/writer lock, synthetic/tools/
compaction/extra prompt/truncated or failed terminal, JSON replay and wrong channel.
Existing /1 negatives preserved. Factory/harness tests prove rejected ingress and
BLOCKED nonzero, not production positives.

Gaps: real ownership/group/ACL/network/config/socket drift, SIGKILL commit windows
(fresh process uses clean lock close), live OpenCode/provider execution, semantic
review quality evaluation and operational qualification. No substitute PASS.
The existing multi-file publisher is not a filesystem transaction against arbitrary
non-cooperative writers; admission remains about returned immutable snapshot bytes,
not subsequent caller-path reads. Final acceptance must review this publication seam.
Author is bound as enrolled data, not authenticated human identity. Client-side
reports/JSON are never admission authority: the protected driver/store must run only
operator-approved code/imports/launcher environment, outside model reach (including
no model-controlled preload). Real launcher, signals, namespaces, cached process
groups and actual provider behavior still need operational qualification. No test of
the kernel ownership/ACL/namespace boundary was substituted with injected conformance.

## Self-review / forensic

Conformance seams do not create client WeakMap capabilities. No caller key/boolean,
env/config override, PKI, /1 hash change or admin rollback-resistance claim. Prepared
readback differs from destination verification. No production listeners/OpenCode,
users/services/credentials/dependency installs/globals/other-project writes/commit/
push/delegation. Four observations, historical REPORT and evidence snapshots
preserved. Installer tests use only existing hermetic fixtures, not real installation.
Root retains independent review and full acceptance; [grants](../../../templates/review-authority/README.md)
are proposed and explicit, never inferred.
