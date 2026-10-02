# Proposed conditional entry — not installed

This rule was tested through a per-call Codex `developer_instructions` override.
It is a candidate for explicit owner adoption, not a new global default. The
ordinary-question probe used no tools. The structured engineering probe read
Accelerate and ASDS without those names in the user's request. That demonstrates
this bounded configuration, not reliable selection from descriptions alone.

```text
For ordinary conversation, answer directly without loading engineering workflows.
For a new engineering request, use the available Accelerate skill to classify
the action and preserve its context; non-trivial structured work goes to ASDS.
An accepted ASDS workflow stays with its coordinator. Do not initialize OpenSpec
without prior explicit authorization. Do not create a second plan or repeat
already answered questions.
```

The existing global files inspected on 2026-10-02 are
`~/.codex/AGENTS.md` and `~/.gemini/GEMINI.md`. Both preserve the machine owner's
installation policy and explicitly state that no global workflow bootstrap is
configured. Neither file was changed by the qualification run. Any persistent
rule must preserve that policy and make the owner-approved behavior change
explicit; it must not introduce mandatory engineering for conversation.

Native Agy availability and activation require their own evidence. The ASDS
installation in `~/.agents/skills` is not sufficient proof of Agy discovery.
The documented Agy/Antigravity skill destination inspected in this run was
`~/.gemini/config/skills`, where ASDS was absent. A model diagnostic also reported
ASDS absent from its catalog; that statement is not an authenticated catalog dump.

The corrected ASDS installer previews 81 new files (443215 bytes at the reviewed
snapshot) in `~/.gemini/config/skills` plus a separate ownership manifest under
`~/.asds/install-manifests`. Existing shared schema/license/provenance files remain
identical. No application occurred. Explicit authorization of the native surface
is required under the owner's installation policy before creating these files.
Use the current preview at application time rather than assuming these bytes
remain unchanged. There are no runtime clones, launchers, credentials or backup
copies in this proposal.

Accelerate's source initially had no Agy exporter or GEMINI.md projection. Its
owner session prepared native source adapter commit `8207ec4`, independently
reviewed with 17 installer tests and a read-only live preview. Do not redirect
the Codex exporter or claim a combined native Agy flow before that adapter is
reviewed, explicitly applied and tested.
