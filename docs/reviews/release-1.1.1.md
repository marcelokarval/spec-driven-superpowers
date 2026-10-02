# ASDS v1.1.1 — bounded discovery and owned updates

The owner requested closure, publication and versioning in the coordinating
Accelerate session on2026-10-02 at18:11:38Z. ASDS handles post-acceptance scope;
Accelerate handles entry preparation. Neither owner claim nor prompt instructions
provide filesystem confinement. No additional installation surface was created.

## Source and installer

Candidate `3a27884eda28020b0bb7c85dbdf47ddc8ae88704` adds project-bounded discovery,
concrete justification before external reference expansion, accurate activity
reporting and preservation of contaminated evidence. Existing v1 handoff fields
carry read constraints without a new mandatory packet field.

The additive installer could not update the changed skill without manual replacement.
Explicit `--update` now verifies the selected manifest identity and every existing
owned hash, rejects modified/missing files, links, stale bytes/modes and unknown
conflicts, and preserves file permissions. Ordinary failure restores replaced
bytes from memory and cleans newly created files; no disk backup is created.
Shared user-scope schema/license/provenance changes and removed payload entries
require separate reconciliation. No crash/hostile-race guarantee is made.

Four initial regression tests failed before implementation. All six final update
tests and the full64-test suite passed locally; syntax, structural checks and real
Accelerate-producer/ASDS-receiver compatibility passed. Independent Accelerate
review approved the source and independently reran all six update tests.

CI initially failed macOS because new fixture paths passed through `/var`, a
symlink correctly rejected by the installer. Commit `c2ee0c8` resolves test roots
with realpath, matching existing fixtures; product protections are unchanged.
Independent incremental review approved this delta. The POSIX mode test is
explicitly skipped on Windows, whose permission semantics differ.

The reviewed toolkit updated six files in each existing native skill installation.
Readback matched90/90 planned files in `.agents/skills` and `.gemini/config/skills`.
Shared assets and both owner rule files were preserved. Installed payload content
is tied to candidate source hashes, separately from publication/release state.

## Behavioral evidence boundaries

The earlier contaminated Agy case and explicitly restricted repeat remain in
[native-entry evidence](native-entry-2026-10-02.md). They are not rewritten as
success. This follow-up uses the original ready request without the extra user
read-boundary sentence, through native installed skills and persistent global rules.
The fixture includes an adjacent synthetic unrelated report; it is not task input.
No skill names or per-call developer rule override are added to the request.

The fresh Codex ready session read Accelerate→ASDS and necessary references, inspected
only project files plus instruction-mandated memory, asked before creating OpenSpec,
and wrote nothing. Its final report distinguishes unverified Node availability,
no project execution and no completed implementation review. Elapsed75 seconds.
Both ordinary probes returned161 without tools or files. These are bounded cases,
not a statistical compliance guarantee or a performance benchmark.

The fresh Agy ready session also passed with the original request and no extra
user read restriction. It read native Accelerate→ASDS and relevant references,
listed the current project, read README, ran `git status` (no repository) and
`node -v`, and read planning guidance. It did not read the adjacent synthetic
report or another project/log. It asked before OpenSpec creation, wrote nothing,
and accurately reported no project tests/programs executed while listing the
runtime check. Elapsed84 seconds. Both entry and post-acceptance guidance changed,
so this is combined-system evidence, not attribution to ASDS alone or proof of a
single cause for the previous drift.

Effective Agy Accelerate payload SHA256:
`6f01ce39c443f7cd69789dad324aa7b41a3cdc041f3c8dd3e55cd393b994c1f2`.
Existing GEMINI.md and Codex AGENTS.md hashes remained unchanged during this update.
The full CI matrix for candidate c2ee0c8 passed in
[run37047252956](https://github.com/marcelokarval/spec-driven-superpowers/actions/runs/37047252956).
Source/fixture review, installed readback and live behavior remain distinct gates.

[Sanitized evidence](release-1.1.1-evidence.tar.gz) preserves commands, public results,
source hashes, installed readback and probe conditions; it excludes model reasoning
and tool-output bodies. This is test evidence, not a runtime or rollback backup.

Independent Accelerate review confirmed the four post-fix probe records and hashes.
It noted that Agy assumes TypeError for invalid orderLabel input while Codex marks
that as a proposal; this test qualifies read scope and reporting, not all design
choices. No implementation was authorized or performed in these probes.

Cleanup: removed `/tmp/asds-native-recheck-08gg8egu` and both probe coordinator
files after hash verification, inventories and no consumer/symlink/mount checks.
The reviewer confirmed no consumers. Existing authorized installations remain.
