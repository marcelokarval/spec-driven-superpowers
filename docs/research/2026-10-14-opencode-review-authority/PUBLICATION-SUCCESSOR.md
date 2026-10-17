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

## macOS CI portability successor

ROOT accepted the read-only diagnosis and authorized this bounded correction during
the publication round. Public PR #9 CI run `38992815292`, HEAD
`dbbc8e6abd6b81c40d993d2fa96a71477bd2edff`, passed its three Ubuntu jobs and Windows
job. macOS Node 24 job `117278689281` failed with 587/588 tests passing:
`tests/passive-correction.test.js:127` threw `symlink refused: /var` at the call to
`planInstall` on line 130, before payload application or assertions.

The new fixture passed the noncanonical path from `mkdtempSync(os.tmpdir())` to an
installer whose existing security gate rejects symlink ancestors. The installer
gate is unchanged from the publication base; this is a fixture-portability defect,
not evidence of an infrastructure flake. The exact delta wraps only the temporary
directory creation on line 128 in `fs.realpathSync`, matching existing installer-test
fixtures. No installer relaxation, test skip, CI edit, real installation, external
project access, backup or nested delegation is introduced.

Historical manifests remain byte-identical. There are now exactly two intentional
source-hash exceptions: the package-builder test identified above and
`tests/passive-correction.test.js` identified below. Earlier acceptance does not
automatically accept these successor bytes. The retained private/license-pending
attachments and observations remain excluded; the historical broken link,
F-001/Q-001 and Stage-2/Stage-3 limits above remain unchanged. ROOT owns independent
review and final acceptance. macOS portability is not closed by Linux tests alone;
it requires the next CI run on the successor commit.

Successor SHA-256 for `tests/passive-correction.test.js`:

```text
094e1f59feaef210668a44b9cf0e0000af14040bdf1da50b268920d477df084b
```

Validation uses the single existing chain
`sh_147973c9f001wwYGsu8VzYNMMX`, without duplicate execution or retries.
`TMPDIR=/tmp/opencode node --test tests/passive-correction.test.js tests/install.test.js`
completed with exit 0, 32/32 pass and zero failures/cancellations/skips/todos.
The same chain completed with terminal marker `MACOS_SUCCESSOR_CHAIN_EXIT=0`:

| Command | Exit | Actual result |
|---|---:|---|
| `TMPDIR=/tmp/opencode npm test` | 0 | 588/588 pass; zero failures, cancellations, skips or todos; explicit `tests/*.test.js` selection |
| `npm run check` | 0 | JavaScript syntax checks passed |
| `npm run validate` | 0 | Structural validation passed, not review-authenticity certification |
| `git diff --check` | 0 | No whitespace errors |

No duplicate test chain or CI rerun was requested. Integrity inspection found only
the two authorized source-hash exceptions and all 35 historical artifact entries
matching. The 20 retained untracked paths remain outside the publication. No
repository log is created; terminal output remains in ordinary harness storage.
The selective publication commit containing this section and the one-line fixture
delta is the macOS CI successor to `dbbc8e6abd6b81c40d993d2fa96a71477bd2edff`;
its commit identity is recorded in PR #9 rather than self-embedded here. A final
diff check follows this documentary update. No merge is authorized or performed.
