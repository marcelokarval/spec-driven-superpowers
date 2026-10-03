# Design

Plans v1 stay strict. Explicit allowUnready yields v2 with recomputed task readiness diagnostics; invalid graphs still fail globally. CLI initialization uses v2. Admission checks readiness, pauses, operation blockers, dependencies and existing capability/resource rules.

The continuation result suggests the next operation without granting permission. Every accepted task triggers re-evaluation; all tasks accepted yields verify_objective, never automatic objectiveComplete. Pauses preserve active reservations and forbid new work; running workers must be stopped separately with host evidence. Blocking acceptance does not block an independent executor.

Preflight executes only --version on trusted PATH/documented absolute binaries, observes project configuration read-only, and returns capability unverified. No discovery outside those roots, shell commands, downloads or automatic installation. Exact expectedVersions are optional and explicit. Installation refusal survives diagnosis.

Legacy input is an explicit reviewed JSON projection bound to hashes and unique source anchors. The original TASKS.md remains the only progress authority. Normalize only canonical-index Markdown checkbox state before hashing and anchor lookup; progress alone cannot stale all contracts. Wording, IDs and order remain material. It is not heuristic Markdown parsing or an imported Done signal. Projection semantics/completeness need independent review against original sources.

Host bridge verifies current sources and permission, prepares a standby session, rechecks current state, persists dispatch reservation, then starts via injected host adapter. Uncertain start retains reservation. Tool-call evidence is a host assertion requiring independent confirmation; mocks do not prove provider execution.

Approval criteria carry stable identity, source, criterion and verification. Acceptance requires evidence for each at the current contract and integrated revision. Undeclared omitted criteria cannot be detected automatically; root must reconcile received approvals with contracts.

No shared schema or installation layout changes. Previous portable-orchestration receipts remain historical and do not certify this delta. No new global CLI or external publication is implied.
