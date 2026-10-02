# Gemini CLI adapter

Documentation checked 2026-10-01:
[Agent skills](https://geminicli.com/docs/cli/skills/).
Gemini documents project/user `.agents/skills` aliases and `.gemini/skills`.
Activation uses `activate_skill` with user consent. Verify the actual loaded path
and scope. Do not confuse these with Antigravity's global config layout.

Map file operations, shell execution and task tracking to exposed tools.
Do not claim every Gemini version lacks subagents or always has them: inspect
current capabilities and approvals. Fall back to sequential execution if absent.
Do not generate global `GEMINI.md`, install extensions or change permissions just
to activate ASDS. Rules are an explicit project opt-in.

Status: documentation mapping only; no end-to-end runtime evaluation.
