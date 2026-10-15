# OpenCode adapter

Documentation checked 2026-10-01:
[Agent skills](https://opencode.ai/docs/skills/).
OpenCode documents `.agents/skills`, `.opencode/skills` and Claude-compatible
locations; skill loading uses the exposed `skill` tool. Permissions can hide or
block skills. Verify the loaded path, not just that a directory exists.

Agent definitions, plugins and providers are separate configuration layers.
Do not conflate OpenCode with OpenChamber, OMO Slim or other plugin products.
Do not edit provider/auth/permission settings to make ASDS appear operational.
Use native task delegation only when exposed and authorized, with scoped context
and isolated writes. Otherwise use sequential execution and disclose review limits.

Status: documentation mapping only; no end-to-end runtime evaluation.
