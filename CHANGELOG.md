# Changelog

## 1.1.1 — 2026-10-02

- Give explicitly selected native harness skill roots separate installation
  manifests so a second supported root can coexist with the default installation.
  Existing default payload and manifest bytes are preserved. Payload conflicts
  remain errors; native discovery and global activation are separate checks.

- Bound discovery after acceptance to the project and necessary references;
  require concrete justification for expansion and report actual commands precisely.
- Add explicit manifest-checked updates of unchanged owned skills, with in-memory
  rollback of ordinary failures and no automatic backups. Shared user payload
  changes/removals require separate reconciliation.
- Preserve native-entry evidence, including the contaminated Agy probe and its
  restricted repeat; instructions do not provide filesystem confinement.

## 1.1.0 — 2026-10-02

- Separate global skill availability from project activation. Ordinary questions
  bypass engineering; explicit initialization permissions and refusals persist.
- Receive Accelerate's seven-field v1 handoff without treating receipt or
  acceptance as execution permission. Preserve workflow ownership and return
  results, evidence, pending work and limitations.
- Consolidate understanding before artifacts, keep one task index and require
  ready microcontracts before scheduling. Changes invalidate affected contracts.
- Verify delivery and integration separately against Git scope and revisions,
  including different delivered and integrated commits and current review evidence.
- Provide portable installation, schema discovery, validation and CI coverage.

Existing active task contracts must explicitly supply the new readiness fields
and integration evidence before using the stricter validators. Archived records
are historical evidence and are not rewritten automatically. Installer application
is additive: conflicting installed files fail rather than being silently replaced.

Validation includes deterministic tests, an independent review, a functional pilot
and bounded conversational checks. These do not certify all models or harnesses.
