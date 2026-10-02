# ASDS 1.1.0 release validation

## Reconciliation

The starting branch was `feat/harness-agnostic-core`, HEAD
`c7b55e1f27f905b9d25096648e30b095967c9720`, above `origin/main` at
`0e55c2d`. The earlier committed installer/contracts groundwork is retained.
All 142 source files matched the independently reviewed r2 inventory before
release preparation. No intervening source edits were found.

The pre-existing dirty changes are the reviewed candidate, not a separate new
implementation. Release preparation changes only package/lock root versions to
1.1.0, corrects CONTRIBUTING's clone URL, and adds release documentation/evidence.
Historical inventories are retained unchanged and identify their original bytes.

## Local verification

- `npm run check`, `npm run validate`, `npm test`: passed, 57 tests.
- Actual Accelerate producer -> ASDS receiver check: passed on the existing
  Accelerate checkout. This is structured-data compatibility evidence.
- All 89 installed payload hashes matched the user manifest.
- Installer preview compared all 90 planned files, including the manifest,
  byte-for-byte with the standard user installation: identical. No reinstall,
  alternate runtime, backup, launcher or provider change was needed.

## Fresh engineering session and resumption

Codex CLI 0.159.3, existing default model configuration (`gpt-6-astra`, medium),
read-only sandbox, current ASDS checkout. Session
`01a0faa4-7712-7a40-8ff3-77c92a27e179` was newly created rather than receiving
this coordinator's conversation. Accelerate was explicitly selected by the
request; the model read the installed Accelerate and ASDS skills itself.

The request proposed machine-readable validator reports with the format and
consumers undecided. Authorization allowed reading/understanding only and denied
implementation, new OpenSpec artifacts, publication and delegation. The first
turn transferred conversational ownership to ASDS and asked about the intended
consumer use. The second turn supplied JSON and CI; the model retained those
decisions and all restrictions, stayed with ASDS and asked about the output
interface without restarting triage. Both commands exited 0. Inspected commands
were read-only; the continuation used no tools. Public messages and command
metadata are in `fresh-engineering-2026-10-02.json`; tool output and reasoning
are omitted from that record.

This proves a bounded fresh CLI engineering intake and actual session resumption
with explicit skill selection. It does not prove unprompted skill selection,
model inference through the Python/JS contract modules, permission enforcement
by those modules, implementation execution, or all-harness behavior. The existing
project already contained OpenSpec; missing-root behavior is separately covered
by earlier tests/exercises. One login-shell attempt failed and was recovered
with a non-login shell; it did not change the outcome.

## Publication boundary

The earlier independent source review remains applicable to unchanged product
bytes. Release metadata/documentation require a final delta review; GitHub matrix
results and final release identity are reported separately at publication.
No new installation or backup temporary directories were created in this run.
Existing worktrees from earlier work were not created or removed by this release.

## Windows CI correction

Initial GitHub run 36960273904 passed Linux (Node 20.19, 22, 24) and macOS,
but failed Windows. Git rejected Node's Windows null-device spelling in fixture
configuration; the scope collector compared canonical paths as raw strings;
one fixture regex assumed LF. Use Git's `NUL` spelling on Windows, host path
comparison for the already-realpathed repository root, and a CRLF-aware fixture
regex. The existing nested-repository rejection test is retained; the clean
scope test also checks Windows drive/separator spelling. This functional delta
requires a focused independent re-review and a fresh CI run before publication.
