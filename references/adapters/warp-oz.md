# Warp / Oz adapter

Documentation checked 2026-10-01:
[Skills as agents](https://docs.warp.dev/agent-platform/cloud-agents/skills-as-agents).
Local repository discovery includes `.agents/skills`; cloud discovery depends on
repositories configured in the selected environment. This is not proof of loading.

When native orchestration tools are exposed, use their actual schemas for worker
launch, messages and lifecycle events. Do not require a local `oz` executable to
use native tools. Honor approval and nesting limits supplied in the session.
Use separate local worktrees; remote workers need explicit context and durable
handoff because unsynced local files are not available to them.

Keep launch model, harness, environment and runner distinct. Do not assume that a
Codex CLI subscription transfers to a cloud/non-default harness. Missing spawn or
failed coordination means the sequential fallback, not fabricated parallelism.

Status: documentation mapping; native tools were exposed in the development
session, but successful end-to-end worker completion was not established.
Persist command results independently when tool return and lifecycle diverge.
