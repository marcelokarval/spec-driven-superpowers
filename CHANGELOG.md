# Changelog

## 2.0.0 — self-contained planning product, 2026-10-08

Tracked by GitHub issue #5.

Breaking: ASDS now ends at reviewed, persisted planning delivery. A
caller-selected consumer owns implementation, code review and software integration.

- Make reviewed, persisted planning the ASDS product boundary; future implementation
  belongs to a caller-selected consumer.
- Add pure recursive planning graph, traceability, lifecycle, revision-bound review,
  bounded publication/readback and planning-return v2 contracts.
- Keep OpenSpec and adapted Superpowers skills, schema, templates, validators,
  installer and provenance inside this repository.
- Preserve legacy orchestration/code-delivery APIs as explicit consumer utilities,
  not the ASDS entry lifecycle.
- Retain Accelerate wire v1 intake and manifest-owned preview-first updates.
- Add a deterministic task-manager projection with owners, decision routing,
  blockers, prerequisite outputs, reverse edges, execution frontier and waves.
- Validate a present planning manifest with lifecycle, on-disk contract inventory,
  reference hashes, protected-domain review policy and projection consistency.
- Make `tasks.md` authoritative for directory projections, enforce exact titles and
  monotonic numeric IDs, verify declared waves, expose per-task conflict exclusions,
  harden decision/blocker routing and reject invalid OpenSpec delta syntax.

### Earlier work retained in this candidate

- Distinguish coordinator-owned packages from executable tasks in one canonical plan.
- Add reviewed behavior boundaries, same-scope decomposition/refinement and explicit
  integrated package acceptance, retaining legacy journal compatibility.
- Preserve unchanged independent acceptance and bind package/dependent evidence to
  child revisions. Support CLI and existing-plan projections without a second plan.
- Native skill/schema copies updated; natural-language evals remain prepared, not run.

## 1.2.0 — local candidate, 2026-10-03

- Add portable DAG scheduling, tiered executor/reviewer profiles, resource
  reservations, independent candidate/integration reviews and replayable local state.
- Preserve strict v1 compilation and add opt-in v2 partial readiness. Add explicit
  pause/resume, stage-scoped blockers and next-operation decisions.
- Preserve explicit requirements and their direct consequences during incremental
  understanding; sample/test gaps do not reopen already settled decisions.
- Reuse existing canonical plans through reviewed source-bound projections;
  retain approval criteria and require current integrated evidence at acceptance.
- Diagnose existing Node/OpenSpec executables without downloads or project
  initialization; distinguish observed versions from proven command capability.
- Add an injectable host boundary that reserves before starting and rejects stale
  contracts, paused work and pending cancellation.
- Exercise natural entry with installed Codex/Agy CLIs on bounded fixtures;
  retain denied headless attempts and separate investigation completion from
  scheduler/provider qualification. Optional trackers and dashboards stay phase 2.
- Keep POSIX executable fixtures platform-specific and verify actual installed
  Node preflight on every supported test platform. Remote CI is not inferred from
  local Linux checks.

This is a prepared local version candidate. No public release is implied. Existing
source-artifact receipts remain historical; new source identity is recorded with
qualification evidence.

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
