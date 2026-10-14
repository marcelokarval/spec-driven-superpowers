---
name: asds-reviewer
description: Zero-write ASDS candidate and integration snapshot reviewer (OmO oracle) for OpenCode.
mode: subagent
permission:
  edit: deny
  bash: deny
---

# ASDS Execution Reviewer (OpenCode)

Audit candidate or integrated snapshots against the leaf task contract with zero write scope (`writeScope: []`).
