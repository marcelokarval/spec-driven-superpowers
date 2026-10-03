# Natural-entry qualification — 2026-10-03

## Scope and actual tools

Installed CLI readback: Codex 0.160.0 from the existing standalone installation, Agy 1.2.16 from ~/.local/bin/agy. Codex login reported ChatGPT authentication. Existing model/provider/auth configuration was preserved. These checks do not independently authenticate the billing route. No Gemini CLI or Claude Code was invoked.

Each initial prompt was a normal request, without naming Accelerate/ASDS or injecting corrective workflow instructions. Tests used temporary isolated test-data directories, not alternate software installations. Codex used read-only for inspection and workspace-write for authorized reports. Agy's initial headless runs denied command/read_file tools; process-local --dangerously-skip-permissions enabled the permitted repeat without editing configuration. This flag does not confine the agent to the fixture. Privacy filtering retains public messages/tool metadata and excludes private reasoning and full tool outputs.

## Observed cases

| Gate | Codex | Agy |
| --- | --- | --- |
| Ordinary arithmetic | 136, no tool calls or fixture artifacts observed | 136, no fixture artifacts; initial final-JSON mode did not expose tool calls |
| Missing OpenSpec, read-only engineering | Loaded Accelerate and ASDS skill/reference sources without naming them in prompt; inspected project and returned preliminary DAG without writes | Permitted repeat and fresh trace retest inspected project, returned DAG and asked before creation; no writes. Fresh retest explicitly read installed Accelerate/ASDS skill sources and intake/activation references |
| Existing TASKS.md and refused OpenSpec | Both reports delivered, revenue 15, canonical index retained, no re-prompt or new plan | Both reports delivered and revenue 15, canonical index retained, no re-prompt or new plan |
| Status by exact returned session ID | Public answer only, files unchanged | Public answer only, files unchanged |
| Settled requirements during risk analysis | Correctly derived that nonnegative includes zero | Reopened zero acceptance as a question despite resolved rule; partial semantic result |
| Scheduler/journal consumption | Not observed or required by the report-only write grant | Not observed or required by the report-only write grant |

Both report sessions explicitly disclosed absent third-party review and unimplemented future production tests. Source/report inspection by root confirmed both reports existed and the data classification was A/D accepted, duplicate A counted once, B rejected and C excluded. The original user-authored source inputs were preserved and no openspec directory was created. Report checkboxes indicate delivery of the two investigation artifacts under that existing plan, not an ASDS integrated receipt or production readiness.

## Failures and repeats

- Agy's initial existing-plan run returned SUCCESS and CLI exit 0 with an empty response and denied read_file. This is failed admission, not a successful workflow.
- Codex emitted E2BIG tool-launch errors and encountered failed verification commands before recovering. Successful final verification is distinct from those historical failures; the events retain failures rather than erasing them.
- Root accidentally launched one Agy retest from the toolkit directory. It was interrupted, process disappearance checked, no write tool call observed, and excluded from qualification. This contaminated attempt remains visible.
- The Agy zero-boundary contradiction triggered a planning.md clarification and prepared eval 13. A new-session repeat still asked whether zero should be accepted in risk-report.md. It did not visibly read the ASDS planning reference in the retained tool trace. Therefore the documentation patch has not been behaviorally qualified on that path; neither an ASDS-only cause nor a successful fix is claimed.

## Evidence and limits

baseline.json records CLI/session identities, ordinary outcomes and failed admission. Public JSONL files preserve natural-entry events; Agy final JSON records responses and denied actions. fixture-artifacts.json preserves inputs and actual reports. pre-status-hashes.json/post-status-hashes.json prove no report/index mutation during status. Private reasoning was filtered out; session stores remain the harness's own records.

This battery covers bounded Linux CLI outcomes and ordinary explicit investigation work. It does not cover a full dependent implementation/review/integration lifecycle, model-effective identity, cross-process coordination, arbitrary projects, spontaneous scheduler use, every catalog eval, or remote CI. The original eval catalog remains prepared_not_run; these are separate natural-entry cases, not evidence that all catalog prompts were executed.

## Disposition

Codex and Agy natural selection for structured read-only engineering passed with concrete skill-file reads. Codex authorized investigative continuity passed the observed scope. Agy artifact/authority/status gates passed after headless admission was configured per invocation; requirement fidelity remains partial. Phase 2 tracker/visual adapters remain optional. The 1.2.0 source candidate may be reviewed with these bounded claims, while broader operational qualification remains open.
