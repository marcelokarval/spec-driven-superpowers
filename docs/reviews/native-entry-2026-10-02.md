# Authorized native entry application — 2026-10-02

This follow-up supersedes the pending installation decision in the earlier
[qualification report](qualification-2026-10-02.md). The owner explicitly authorized
the proposed native Agy skill surface and conditional rules for both CLIs.
The earlier evidence remains historical; no release tag was changed.

## Applied and read back

- ASDS installer from main `b3550b1` applied user scope with target
  `/home/marcelo-karval`, data home `/home/marcelo-karval/.local/share`, and explicit
  skill destination `.gemini/config/skills`. 90/90 planned files match installed
  bytes. Existing default `.agents/skills` also matches 90/90. Repeat apply is
  idempotent. This adds the authorized native discovery surface, not a runtime.
- Accelerate adapter source `8207ec4` applied its approved preview fingerprint:
  new native `~/.gemini/config/skills/accelerate/SKILL.md`, and conditional rule in
  `~/.gemini/GEMINI.md`. Subsequent preview reports both unchanged.
- Existing `~/.codex/AGENTS.md` now contains the previously tested conditional rule.
  Only the exact disabled-bootstrap declaration was replaced using an atomic
  sibling temporary, removed on completion; existing permissions were retained.
- The installation-policy block is byte-identical in both global rule files.
  No backup, alternate executable/runtime, credential/provider change or launcher
  redirection was introduced. The initial ASDS command omitted required data-home
  and failed before writes; the explicit existing data-home corrected that invocation.
- Effective executables: `~/.local/bin/codex`, version0.159.3 (official standalone
  launcher resolves within `.codex/packages/standalone/releases/0.159.3-x86_64-unknown-linux-musl`);
  `~/.local/bin/agy`, version1.2.14. Neither executable was changed.

## Live qualification boundaries

Fresh CLI sessions loaded persistent native configuration. No per-call developer
rule override or skill name was placed in ordinary/structured/ready/refusal user
prompts. Handoff prompts explicitly name the workflow as expected for that case.
The tests permit read-only analysis and withhold writes. Headless Agy uses per-call
autoapproval while the task itself forbids mutation; this is not sandbox isolation.

- Ordinary question: both returned161, with no tool calls or fixture files.
- OpenSpec refusal: both preserved it, produced no artifacts, and did not ask again. This does not prove ASDS reception on refusal: Agy
  used no tools and Codex read Accelerate only.
- Incomplete handoff: both retained scope/authorization, asked the missing quantity
  decision, and distinguished accepted work from authorized execution and completion.
  This is a contextual handoff probe, not a new end-to-end task implementation.
- First structured probe: Agy read native Accelerate and ASDS and asked before
  OpenSpec creation, but did not inspect the project before asserting its absence;
  that assertion is not counted as verified discovery. Codex declared routing without reading skills; it is not
  counted as skill-loading proof. Both preserved no-write constraints. Because
  "do not execute code" may also suppress shell-based reading, a follow-up fresh
  request explicitly permits read tools while still prohibiting project execution.
- Agy's first response proposed an extra aggregate entry point and queried prefix
  spacing. No implementation occurred; this bounded entry test does not certify
  universal planning quality or absence of redundant questions.

Evidence includes sanitized public events, tool names/parameters, configuration
hashes and before/after fixture inventories. It omits reasoning/tool-output bodies.
Source/installer checks do not establish universal model compliance. Prior assisted
full-cycle evidence remains separate from these fresh native-entry probes.

The Codex fresh ready probe read Accelerate, ASDS and its intake/activation/planning
references, inspected the project, and asked before OpenSpec creation. It recovered
a login-shell E2BIG read failure by using a non-login shell. No writes occurred.

Independent peer readback reconstructed the original 3454-byte global files by
replacing only each new managed block with the old sentinel; both recovered original
SHA256 `66eb1f9924f16972e14408a2f4160df9a33c20d5a3875cdcce47efd2e1dffab0`.
This verifies preservation beyond merely matching the shared policy prefix.

The Agy ready probe completed in261 seconds but is **not a clean independent
preparation result**. It loaded Accelerate→ASDS before exposure, then inspected
README, but subsequently read sibling evidence from other probes, unrelated `/tmp`
logs/scripts, ASDS evaluation sources and prior reports, and attempted broad HOME
searches. Independent review confirmed this material read-scope deviation and
contamination. Only initial native selection and no-write behavior count from
that run. Its final narrative is not used to independently qualify preparation.
A new separately located project probe adds an explicit read boundary: current
project plus global instruction/skill files only; no other projects/logs/evidence.
This changes the probe conditions and cannot erase the original deviation.

The separately located Agy repeat passed the bounded native-entry probe: it read
native Accelerate→ASDS, activation/intake/planning references, listed the project,
read only its README and checked `node -v`; no sibling/other-project evidence was
read. It asked before OpenSpec creation and created no files. Wrapper elapsed116s
(runtime reports71s); this single repeat is not a latency benchmark. The explicit
read boundary is a changed condition, not proof that the earlier unbounded drift
is fixed globally. Both global rules remain exactly the approved versions.

For this installation, native loading and the activation question are demonstrated
in both CLIs; ordinary questions, prior refusal, and incomplete handoff boundaries
were also exercised. The remaining observation is Agy read-scope drift under the
less constrained probe, not missing native installation. Do not summarize these
results as "zero gaps" or universal unattended workflow correctness.

Independent Accelerate review confirmed the clean repeat with the same boundaries.
Its final wording "without executing programs" was imprecise: `node -v` ran,
while no project program/test ran, consistent with the prompt.

[Evidence archive](native-entry-2026-10-02.tar.gz): 14 JSON records,28696 bytes,
SHA256 `bd754dafb43de7e02cfeae3de46f7af348cb4d0c3650bc993faf6847fb890f3c`.
After verifying archive hashes, inventories, no symlinks/mounts/live cwd or file
descriptor consumers, both owned temporary test directories and two coordinator
files were removed. No installer temporary remained. Authorized native skills and
global rules remain installed; no software runtime or user project was removed.
