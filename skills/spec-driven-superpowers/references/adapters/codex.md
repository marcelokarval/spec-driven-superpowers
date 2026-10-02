# Codex adapter

Documentation checked 2026-10-01:
[Agent skills](https://developers.openai.com/codex/skills).
Codex discovers project/user `.agents/skills`; read the actual path supplied by
discovery. Do not invent a `Skill` tool. Use exposed file/shell tools or the
session's native skill-loading mechanism.

Use spawn/wait/message operations only if the current session exposes them.
Named agents, roles and tool schemas vary; inspect them instead of editing
configuration to force availability. No spawn means sequential execution.
Pass the task, relevant rules/specs, scope and base explicitly to workers.

For an explicitly authorized CLI handoff, inspect `codex exec --help` and
`codex exec resume --help`, persist JSONL events and capture `thread_id` from
`thread.started`. Resume that ID rather than guessing from a display name.
Keep auth/provider/model settings unchanged. A persistent session ID is not
proof of successful completion or subscription billing.

Status: local CLI 0.159.3 used for isolated diagnostic/test execution; that did not
test this installed skill's discovery or full ASDS workflow. Do not generalize
session-specific executor workarounds into global shell or provider settings.
