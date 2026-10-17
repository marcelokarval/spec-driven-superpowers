# Publication successor — isolated package-builder regression

## Authorization and scope

The human authorized a pre-publication correction of the machine-specific destructive
test. This successor changes only `tests/package-builder.test.js` and adds this
ASDS-only record. ROOT owns independent review, final selection and validation.
No installation, provider operation, Git mutation, external-project inspection,
backup or nested delegation is authorized or performed by this correction.

## Exact delta and historical acceptance

The installation-cleanup test no longer probes or removes an external project skill.
The adjacent machine-specific validation test was also removed: retaining it would
still read external projects during the requested focused/full validation. Neither
test's machine-dependent observation is reproduced or claimed by this successor.

One local static regression replaces those two tests. It reads this test source only,
rejects machine-specific home paths and requires its sole `fs.rmSync` call to clean
the `tmpDir` fixture created by the existing synthetic package-builder test. Installer
behavior remains covered by isolated tests in `tests/install.test.js`, including
explicit harness roots and preservation of unrelated project state. No global-only
installation policy is inferred from a developer's machine.

Earlier independent acceptance applies to the historical bytes in
`PASSIVE-SOURCE-SHA256.txt`, not automatically to this successor. That manifest and
all historical artifact manifests remain unchanged. The intentional source-hash
exception is exactly `tests/package-builder.test.js`; its successor hash and actual
validation results are recorded below after execution. No product implementation,
SKILL, schema, receipt or canonical C10 package is changed.

## Public selection and retained evidence

Retain locally, without deletion or publication, these 16 research attachments:

- `FINAL-STATE-AUDIT.md`
- `FINAL-STATE-AUDIT-EVIDENCE.json`
- `FINAL-STATE-CONSUMER-INDEX.json`
- `source-evidence/README.md` and the 12 existing TypeScript `.txt` snapshots there.

The first three combine ASDS evidence with unnecessary private consumer operations.
The snapshot set requires upstream redistribution-license/notice verification before
public inclusion; this record does not assert that the ASDS license covers it.
The four pre-existing observation collector/event files under `docs/observations/`
also remain local and unchanged. No private values or consumer inventory are copied
here. The other 42 research attachments remain the proposed public evidence set,
subject to ROOT's final selection. This successor is an additional public document.

## Known limits and historical link

`docs/architecture/review-authority-v2.md:85` still links to the absent
`templates/review-authority/README.md`; `POSITIVE-REPORT.md:318` references that same
removed runbook. This pre-existing historical link is explicitly unresolved, not
silently repaired by restoring a daemon, launcher or operational deployment guide.
ROOT must decide its documentary disposition before claiming all links are valid.

C10's F-001/Q-001 remain non-material/open. Their dispositions, extra unregistered
quality review, rejected duplicate fidelity registration and frozen bookkeeping
remain historical evidence, not normalized by this test change. Stage-2 planning
delivery does not prove product execution or Stage-3 admission. Real target, selection,
grants and enforcement remain separate gates. Local tests do not replace CI or
ROOT's independent review of the successor.

## Successor validation

Executed once, without retries, in shell `sh_1478e45a1001pHnhhetHNjvj9Z`:

| Command | Exit | Actual result |
|---|---:|---|
| `TMPDIR=/tmp/opencode node --test tests/package-builder.test.js` | 0 | 2/2 pass; no failures, cancellations, skips or todos |
| `TMPDIR=/tmp/opencode npm test` | 0 | 588/588 pass; no failures, cancellations, skips or todos |
| `npm run check` | 0 | JavaScript syntax checks passed |
| `npm run validate` | 0 | Structural validation passed, not review-authenticity certification |
| `git diff --check` | 0 | No whitespace errors |

The full suite selects `tests/*.test.js` explicitly. Its count decreases from the
historical 589 to 588 because two machine-specific tests were replaced by one local
regression; no test was skipped to obtain a pass. The existing synthetic builder
test and installer-fixture tests passed. This does not reproduce the removed
external-package observations or establish a universal filesystem sandbox.

Successor SHA-256 for `tests/package-builder.test.js`:

```text
a2e8fe1a1f7004e9553b554aeb434a105f72b3ad0eab13ca9300a844583ddc22
```

Integrity inspection found exactly that one intentional exception among the 57
historical source entries; all 35 entries of the historical artifact manifest still
match. Historical manifests were not edited. No repository log was created: actual
command output remains in the harness's ordinary shell-result storage outside this
checkout. Recording these results changes this document only; a final diff check
follows the documentation update. ROOT must independently review the successor
test/document and run applicable final/CI gates before publication or merge.
