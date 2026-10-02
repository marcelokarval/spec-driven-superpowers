# ASDS / Accelerate — local validation

## Scope
Existing ASDS checkout, HEAD c7b55e1f27f905b9d25096648e30b095967c9720 with local changes.
Standard user-scope installation followed local gates; no alternate runtime or repository commit.
Hash inventories identify source bytes, not an installed release; docs/reviews is
excluded because it contains the resulting reports, not product source.

## Independent review
Reviewer: Accelerate session 01a0f874-589a-7081-82d9-a3815921ff3e.
Initial source inventory: candidate-2026-10-01.json, 142 files,
d049f8e4a50510dfcc4a5b68a18b9652cf97d1058569607b4d965aef6db9a966.
Reviewer confirmed all hashes before/after and requested changes:

- F1/P1: CLI incorrectly required delivered revision D and integration revision I
  to equal the same current snapshot. Root added separate Git verification of D/I,
  explicit historical delivery commit mode and independently supplied integration scope.
- F2/P2: scheduling ignored readiness and could run unresolved material decisions.
  Root added readiness blocking to chooseExecution.

Revised inventory: candidate-r2-2026-10-01.json, 142 files,
097b978acc3f6f1fc79648d0e9c98d894a15b473d9f78bb71653236bf0d9d4a7.
Independent re-review approved F1/F2 on the revised inventory, with 142 matching hashes.
Reviewer ran 5 contracts tests and inspected the CLI regression; root ran all 57 tests.

## Root checks
- 57/57 tests passed after F1/F2 fixes.
- Regressions were observed failing before fixes, then passing.
- Real Accelerate core/routing.py producer -> ASDS receiver: passed.
- Package/change structural validation, JS syntax and diff whitespace: passed.
- Conversational model behavior is not inferred from the structural checks.

## Functional pilot
Temporary counts fixture recorded in counts-pilot-evidence.json.
Planning and microcontract validation passed; RED exit 1 (missing implementation)
then GREEN exit 0. Independent spec/quality review passed; reviewer reran 2/2 tests.
Root reran integration tests, validated the receipt against Git and reconciled checkoff.
Only test data and a disposable fixture Git repository were created; no toolkit or
runtime was installed. The fixture was removed after checking user-process consumers, mounts and links.
RED limitation: missing module, not failed behavioral assertion.

## Global preflight
No ASDS found at inspected standard user skill/schema destinations; no ASDS user
manifest found. Installer preview succeeded: 90 files, 466110 bytes at that snapshot,
no conflicts. Existing destination inspection is in global-preflight-2026-10-01.json.
This is a preview, not installation, discovery or runtime proof.


## Controlled conversational results
Seven public turns executed in the existing reviewer session with manual context:
ordinary question, forwarded gap/refusal, continuation, prior authorization, localized
change, partial return presentation and equivalent direct entry. Responses preserved
the tested boundaries and did not add setup or closure questions. No tool calls in
these response-only exercises. They are not unprompted routing/discovery proof.
Actual responses and turn IDs are in conversational-results-2026-10-01.json.

## Standard installation
Installed 90 files through the project's user-scope installer (89 payload files plus
manifest). Hash verification passed for every payload. No overwrite conflicts,
backup, parallel runtime, launcher/PATH/provider changes or service restart.
Fresh Codex prompt generation lists the installed ASDS and using-superpowers skills.
Fresh-session model execution is recorded separately; see its explicit outcome.


## Fresh-session result
Existing Codex CLI 0.159.3, default configured model, ephemeral session in the user's
home with read-only tool sandbox. Exit 0; answer: "17 × 8 = 136." No command/MCP
execution was reported; ~/openspec was absent before and after. Fresh prompt
construction discovered the installed skills. This proves a bounded ordinary-question
case in this CLI, not all clients or a full fresh-session forwarded engineering run.

## Delivery boundary
Local source delivered, initial independent audit plus focused correction re-review,
57 deterministic tests, real producer/consumer check, independently reviewed functional
pilot, seven controlled response turns, standard user installation and fresh CLI
ordinary-question check. No project commit/push/release publication performed.
The broad model evaluation suite remains prepared, not run; the seven observed turns
are separately recorded rather than relabeled as execution of that suite.
