# Local delivery — portable orchestration

## Outcome
Phase 1 implementation and independent technical review are complete in the local
checkout. Phase 2 is specified, not implemented: optional harness, tracker and
visual adapters with an explicit ownership/command boundary. No dashboard was
installed or forked, and no tracker workspace was changed.

## Verification

- Full local suite: 82 tests passed, including 18 new orchestration/store/CLI tests.
- Syntax and package validation passed; real OpenSpec strict change validation passed.
- Real Accelerate producer → ASDS receiver compatibility passed again (grants,
  refusals, gaps, resumption and direct-entry parity).
- CLI fixture exercised init → dispatch → delivery → candidate review → integration
  reservation → integration evidence → integrated review → root acceptance, then
  rejected source drift. Sessions and receipts in that fixture are simulated;
  it does not prove live model behavior.

## Independent review and root disposition
A fresh `/root/orchestration_review` agent inspected the local sources without
executor conversation history and ran independent in-memory probes. It found:

1. Integration had no reservation before mutation.
2. Integration incorrectly required evidence of its future review.
3. Delegated packets omitted additional intake constraints/refusals.
4. After the initial fixes, integration still bypassed the parallel isolation gate.

All four were corrected with regression coverage. The reviewer subsequently
reported no remaining blocking findings in the reviewed scope and approved local
technical acceptance. Root independently reran the full combined suite and
compatibility/structural checks. This is a bounded finding, not absence of all gaps.

## Evidence identity and completion scope
`evidence.json` records SHA256 source manifests, the baseline Git commit and the
exact aggregate identity formula. `receipts.json` records each microcontract identity
and contains portable source-artifact
receipts: changedFiles are the task's scoped contribution, and the common delivered/
integrated identity is the reviewed combined source manifest. The coordinator owns
planning files and this ledger; they are not attributed to individual workers.
These are not isolated Git branch delivery receipts and must not be passed to the
Git CLI as though each task represented the entire checkout diff. Source integrity
can be checked against the manifest; the task index is structurally validated with
`node scripts/validate.mjs --change openspec/changes/portable-orchestration --receipts openspec/changes/portable-orchestration/receipts.json`.

The manifest excludes this ledger, receipts, summary and mutable tasks.md index to
avoid self-reference. It binds implementation, tests, references, profile and
planning contracts. No runtime/provider identity is inferred from that hash.

## Existing native installations
The repository's manifest-checked updater updated the existing Codex `.agents/skills`
and Agy `.gemini/config/skills` installations: 92/92 files matched source in each
readback. One skill entry changed and two references were added per installation;
shared schema and existing owner rules remained unchanged. No executable, launcher,
authentication setting, alternate runtime or backup was created. The Node toolkit
continues to run from the existing checkout; installed skills are instructions.
Test fixtures and ordinary store temporaries were removed by test cleanup.

## Limits and next phase
No new public release/commit/tag was created; package version remains 1.1.1 plus
local changes. Native reference readback is not a new live provider qualification.
Host observations, actual isolation, review authenticity and external permissions
remain host/coordinator responsibilities. Storage is a trusted local single-writer
journal, not a distributed service or a guarantee against power loss.

Phase 2 begins with a public DTO/conformance suite and a read-only projection, then
qualifies one selected tracker and one selected visual/host integration. The full
recommendation and source comparison are in
[optional integrations](../../../skills/spec-driven-superpowers/references/integrations.md).
