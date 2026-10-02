# ASDS qualification — Codex and Agy, 2026-10-02

## Outcome and denominator

The five-step qualification found and corrected concrete defects, and completed
two **assisted** engineering cycles. It does not establish automatic native entry
or absence of all gaps. Existing global workflow configuration was not changed.
Only Codex and Agy CLIs were invoked; subscription access was the owner's stated
configuration, not a billing audit. Authentication/provider configuration was preserved.

| Requested step | Observed result | Boundary |
| --- | --- | --- |
| 1. Natural entry | Ordinary question passed in both CLIs without tools or artifacts. Structured request did not select ASDS in either observed run. | GAP: native automatic entry remains unqualified. |
| 1. Conditional entry experiment | Fresh Codex structured request selected Accelerate then ASDS; ordinary request stayed direct. | Per-call developer instruction only; not globally installed. |
| 2. Complete cycle | Understanding, specs, three contracts, implementation, verification, independent review and integration passed in both. | Explicit ASDS selection and root coordination; disposable real Git projects, not production deployment. |
| 3. Resume/change | Same sessions resumed; count limit changed 1000→100; affected task reopened, dependent task stayed pending, label implementation preserved. Agy also recovered an actual print timeout. | Shared planning hash invalidated label receipt; root renewed independent contextual review rather than silently reusing stale evidence. |
| 4. Negative gates | Both validator and both live agents rejected failed tests, a committed out-of-scope file, and absent independent integration review. | First two used real fixture commits; missing-review receipt deliberately synthetic to isolate the structural gate. |
| 5. Joint review | Accelerate independently approved both final integrations and ASDS installer fix. ASDS independently reviewed Accelerate's native Agy adapter. | Native installation/runtime proof remains pending specific owner authorization. |

## Exact reviewed states

ASDS source fix: `6690f56832a5ba1a759d4c3f4ce13c3b3bb08721`,
[PR #2](https://github.com/marcelokarval/spec-driven-superpowers/pull/2).
58 local tests passed; check/validate passed. All five CI matrix jobs passed in
[run 37028454339](https://github.com/marcelokarval/spec-driven-superpowers/actions/runs/37028454339).
The default install manifest formerly conflicted with a second explicitly selected
native skill directory. The fix separates ownership manifests by skill destination,
retains default compatibility, and preserves conflict preflight.
This reviewed candidate is distinct from released/installed v1.1.0.

Accelerate source-only candidate:
`8207ec4ebac3f29cf6fddc0bbfca0199bd84f2e2`, branch `fix/agy-native-entry`.
Root read installer/rule/tests and independently ran 17 installer tests successfully;
peer reported 83 focused tests. Read-only live preview matched
`81489499f0bc285a96b7a552b932744cebfc5f4449c69467ccc477da4ad2c459`.
No apply, push or publication was performed for that adapter.
The opt-in installer replaces the exact disabled-bootstrap sentinel line; otherwise
it preserves owner bytes outside its managed block. It rejects conflicts
and links, requires the exact preview fingerprint, and cleans ordinary failed
writes. It does not promise crash recovery or protection from hostile filesystem races.

| Pilot | Final task 0002 delivery D | Independently reviewed integration I | Final tests |
| --- | --- | --- | --- |
| Codex | `71ac25f27c9e3aff4386b0e89b66cf58d7c7f317` | `66169303b789f412f5649eedf149143becd71323` | 94 suite + 5 external |
| Agy | `d73698a7da2a4da20f7a61b5a17601bc3af26a38` | same as D | 14 suite + 5 external |

Independent reviewer: Accelerate session
`01a0f874-589a-7081-82d9-a3815921ff3e`.
It inspected source/contracts/scope and reran suites/oracle at I. Root separately
ran required tests at historical D, negative probes, receipt validation and final
checkoff. The reviewer did not independently authenticate historical RED logs.
Test counts reflect different granularity, not a model ranking.

Codex engineering session: `01a0fd29-53b7-7552-bdd5-2f2ec3c3b65a`.
Agy engineering session: `00b06367-20fc-4d2e-862b-5858346124fa`.
Both preserved prior authorizations/refusals and a single task index. No OpenSpec
archive or production release is claimed. Existing OpenSpec artifacts were updated;
no additional OpenSpec artifacts were forced after the recorded refusal. Agy's final
return listed a final commit as pending; the coordinator had already committed
bookkeeping. The authoritative final verification records that commit and clean state.

## Defects and qualification corrections

- Agy pilot order code read `quantity` twice. An external accessor probe returned
  a valid value on validation and Infinity on the second read. Agy reproduced
  behavioral RED, cached the value, and passed regression plus independent review.
  This was a pilot implementation defect, not an ASDS library defect.
- ASDS install ownership conflict was reproduced, fixed and regression tested.
- Native Agy directory lacked ASDS. The diagnostic model also reported absence;
  this is not an authenticated catalog dump. A fresh Codex prompt rendering proved
  skill visibility there, not selection in the original request.
- Agy first planning print timed out with exit zero/SUCCESS metadata; root did not
  count that as completion and resumed the same conversation.
- Root's first final oracle readback used wrong environment key `ASDS_MAX`, causing
  fallback to old limit1000. Repeating with `ASDS_PILOT_MAX=100` passed, without a
  product code change. Final evidence records this correction.
- Initial module creation RED was missing-module failure. Requirement-change and
  accessor regressions additionally demonstrated behavioral RED→GREEN.
- Headless Agy required per-call autoapproval within the authorized test fixture;
  this was not an OS isolation guarantee or a persistent permission change.

## Remaining owner decision and acceptance checks

The machine policy requires specific prior approval before adding a separate
installation surface. A generic request to execute this qualification does not
waive that policy. The concrete native proposal is:

1. ASDS: 81 new files, 443215 bytes at reviewed preview, under
   `~/.gemini/config/skills` and `~/.asds/install-manifests`. Shared schema/license
   payload remains identical. Use the toolkit installer with explicit skill target.
2. Accelerate: new `~/.gemini/config/skills/accelerate/SKILL.md` (4617 bytes), optional
   managed conditional rule in existing `~/.gemini/GEMINI.md` (3454→4465 bytes).
   Total net growth5628 bytes; preview/apply commands are documented in the peer's
   `adapters/runtime/agy/README.md`. Preserve the owner's installation policy.
3. Codex: adopt the tested conditional rule in existing `~/.codex/AGENTS.md` only
   after explicit owner adoption. No second Codex runtime is needed. The old exporter
   that automatically creates backups must not be used for this operation.

There is no alternate runtime, launcher redirection, auth migration or backup in
this proposal. Native Agy placement is the documented native route selected here; the Codex/default
skill surface does not itself establish Agy discovery. Re-preview current bytes before
application. Clean any installer-owned transient files after applying; preserve
preexisting/user-owned files. Do not remove the shared existing Codex installation.

After approval: apply reviewed native files/rules; read back effective paths and
owner policy; run fresh ordinary and structured requests in both CLIs without
explicit skill names or per-call rule injection; exercise prior OpenSpec refusal
and incomplete forwarded context; reconcile results with Accelerate. Only then
can native entry be marked qualified for those cases.

See [conditional rule proposal](proposed-conditional-entry.md) and
[qualification evidence archive](qualification-2026-10-02.tar.gz). The archive
contains sanitized events, receipts, frozen revision/test records, selected fixture
source/specs and Git history/diffs, plus the test coordinator scripts. It excludes
Git object stores, credentials and model reasoning. It is a generated test evidence
artifact, not an installation or rollback backup. Fixture paths in historical
records identify their original execution locations; temporary projects are removed
after evidence preservation and consumer checks.

Cleanup completed: removed `/tmp/asds-qualification-5btv_iwl` and 23
operation-owned `.git/asds-*` coordinator files after archive hash verification,
clean fixture Git states, no symlinks/mounts and no live cwd/file-descriptor consumers.
The reviewer confirmed no consumers. No software installation or user data was removed.
