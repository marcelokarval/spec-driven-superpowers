# Antigravity adapter

Documentation checked 2026-10-01:
[Agent skills](https://antigravity.google/docs/skills).
Current docs describe workspace `.agents/skills`, backward-compatible
`.agent/skills`, and global `~/.gemini/config/skills`. Prefer project installation.
For explicitly requested user installation, `--skills-dir .gemini/config/skills`
selects that layout without linking or replacing the entire `.agents` tree.

IDE workspace/agent-manager features do not prove programmatic spawn capability.
Inspect available tools, approval policy and workspace isolation. Execute
sequentially if delegation is unavailable. UI evidence should be durable and
shareable under project policy, not automatically committed or uploaded.

Do not treat Antigravity and Gemini CLI as one runtime or infer common billing
from their related paths. Status: documentation mapping only; no end-to-end test.
