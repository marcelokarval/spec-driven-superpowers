# Adaptive decomposition — local delivery

Implemented one-level packages and reviewed executable boundaries in the existing
planning, contract, CLI and journal surfaces. Decompose preserves the original root
outcome; refine subdivides an unfinished child into siblings and redirects dependents.
Packages never dispatch workers and need integrated independent evidence after their
children finish. Legacy v1/v2 plans retain their behavior; explicit nodes use v3.

## Evidence
- 114 Node tests passed, including 13 new decomposition/source/CLI cases.
- Syntax, toolkit validation and strict OpenSpec validation passed.
- Independent review found and confirmed fixes for v1 migration acceptance loss,
  sibling-boundary downgrade, impossible package acceptance and missing DAG edges.
- Existing Codex/Agy native skill roots each read back 93/93 planned files.
- Shared OpenSpec schema was reconciled with both manifest owners before updating;
  no parallel runtime, disk backup or project initialization was created.

## Limits and disposition
This closes the agreed local implementation and verification work, not universal
model compliance. Semantic granularity remains a coordinator judgement; structured
fields and scenario matching cannot prove semantic equivalence. Native agents can
bypass the optional toolkit unless their harness routes actions through it.
Prepared evals 14–16 are not reported as fresh-session harness qualifications.
Existing-plan projection v1 retains conservative whole-source identity: changing
its bound shared sources may require revalidation of otherwise independent work.
No customer project resumed. No new public release or remote CI run is claimed.

Source-artifact receipts bind this delivery to its recorded local sources and tests;
they are not per-task isolated Git branches or an operational provider certificate.
