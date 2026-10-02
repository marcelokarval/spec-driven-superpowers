# Claude Code adapter

Documentation checked 2026-10-01:
[Skills](https://code.claude.com/docs/en/skills).
Project/personal skills use `.claude/skills`, not a presumed universal directory.
Use the installer's explicit `--skills-dir .claude/skills` with the same conflict
checks. Do not copy the same skill into several discovery paths unnecessarily.

Use native skill and agent tools only as exposed by the installed version.
Subagents, teams, plugins and worktree support are not interchangeable guarantees.
Scope workers to isolated workspaces and use separate reviewer contexts when
available. A skill file cannot enable hidden tools or bypass approval settings.
Keep model/effort/auth/billing separate; do not assume CLI account access applies
to another host or harness.

Status: documentation mapping only; no end-to-end runtime evaluation.
