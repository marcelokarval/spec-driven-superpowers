# Autonomous Spec-Driven Superpowers (ASDS)

Para trabalhar na evolução deste repositório, comece pelo
[estado atual do projeto](PROJECT-STATUS.md) e pelas instruções de [AGENTS.md](AGENTS.md).
O estado distingue o release publicado do realinhamento local para entrega de planejamento.

OpenSpec organizes **what** must be preserved; adapted Superpowers practices help
ASDS understand, decompose, write and review the plan. ASDS delivers a reviewed,
persisted planning package. A caller-selected consumer implements future tasks.
It is a planning toolkit, not an inference engine or an implementation runtime.

The repository is self-contained: canonical ASDS/OpenSpec/Superpowers skills,
schema, templates, validators, installer and provenance live here. Exact Node and
OpenSpec CLI dependencies remain declared external executables; no sibling source
checkout supplies required ASDS behavior.

The AGY source payload describes two distinct review transports. Native nested
review remains fail-closed on AGY 1.3.3. A separate headless capture engine and
primary-only zero-write reviewer are source-tested with a fake CLI, but are not a
deployed service and cannot complete review or mint planning authority. Production
review still requires a private OS/service boundary unavailable to the model/thin
client; only that boundary may retain planning-store authority.

This fork separates a portable protocol, harness-specific adapters and an opt-in
project profile. See [architecture](docs/architecture.md) and
[upstream provenance](docs/provenance.md).

## Requirements and local setup

Node **>=20.19.0**, npm and Git. OpenSpec **1.14.0** and YAML **2.9.1** are pinned
in the local lockfile. No global npm installation is performed.

```bash
git clone https://github.com/marcelokarval/spec-driven-superpowers.git
cd spec-driven-superpowers
npm ci --ignore-scripts
npm test
npm run validate
npm run check
```

## Global installation and project activation

The normal setup installs skills globally **for the current user**. Global
availability does not activate ASDS or Superpowers for every terminal conversation.
An ordinary question receives a direct answer: no workflow, setup question or folder.

Each harness must actually discover its supported skill directory. Installing
into `.agents/skills` does not prove discovery by another client. The default
installation keeps `.asds/install-manifest.json`; explicitly selected native
skill roots use independent manifests under `.asds/install-manifests/`. They can
coexist without replacing the default manifest. Payload conflicts still abort
before writes. Older customized installations with a legacy default-named
manifest require explicit reconciliation; this change does not migrate them.

For suitable project work, the agent checks the intended project's `openspec/`.
If missing, it asks whether to create that exact path or continue without OpenSpec,
and waits before creating anything. Existing configuration is reused. A prior
explicit authorization to initialize that project is sufficient; no repeat question.
Refusal continues the task without OpenSpec. See the
[activation contract](skills/spec-driven-superpowers/references/activation.md).

### Install once for the user

Run from this toolkit checkout. Preview is the default:

```bash
node scripts/install.mjs --scope user --target "$HOME" \
  --data-home "${XDG_DATA_HOME:-$HOME/.local/share}"
```

After reviewing the preview, repeat with `--apply` to install.
The default layout is:

- `~/.agents/skills/`: ASDS, OpenSpec and Superpowers skills and references.
- `<data-home>/openspec/schemas/superpowers-bridge/`: reusable schema/templates.
- `~/.asds/`: installation manifest, license and provenance.

The global schema directory is **not project state**. Specifications, changes,
tasks and project configuration belong in `<project>/openspec/` after authorized
initialization. User installation does not initialize the current working directory.

On Unix, OpenSpec data home defaults to `~/.local/share` or `XDG_DATA_HOME`.
On Windows it is `LOCALAPPDATA`, unless overridden by `XDG_DATA_HOME`.
This is not `XDG_CONFIG_HOME`. A custom data home must also be selected in the
OpenSpec process environment; the installer does not edit shell startup files.

### Optional project-scoped installation

For projects that explicitly want their own copy of the skills and schema:

```bash
node scripts/install.mjs --scope project --target /absolute/path/to/project
node scripts/install.mjs --scope project --target /absolute/path/to/project --apply --activate
```

Project apply creates local schema files under `openspec/`, even without
`--activate`; that flag additionally creates a new `openspec/config.yaml` selecting
`superpowers-bridge`. Existing conflicting configuration is never overwritten.
The CLI does not ask an interactive question: the agent obtains authorization
before invoking a root-creating command. An explicit request for this project
installation already supplies that authorization.

The Bash and PowerShell wrappers accept the same arguments:
`bash scripts/install.sh ...` and `.\scripts\install.ps1 ...`.
Rules are optional: `--rules` installs the [project profile](rules/AGENTS.md) as
root `AGENTS.md` only when no conflicting file exists. No mandatory global rules
are installed.

### Harness paths

The default `.agents/skills` path is documented by Warp/Oz, Codex, OpenCode,
Gemini CLI and current Antigravity workspace discovery. Verify loading in the
actual session. Claude Code uses `.claude/skills`:

```bash
node scripts/install.mjs --scope project --target /absolute/project \
  --skills-dir .claude/skills
```

`--skills-dir` is relative to `--target`, with the same conflict/symlink checks.
Antigravity's documented user layout can be selected explicitly with
`--skills-dir .gemini/config/skills`. For native AGY profiles, the installer also
owns three planning-only custom agents: project installs `.agents/skills` with
coordinator `.agents/agents/spec-driven-superpowers.md`, nested zero-write reviewer
`.agents/agents/spec-driven-superpowers-reviewer.md`, and headless primary-only
zero-write reviewer `.agents/agents/spec-driven-superpowers-reviewer-primary.md`;
user installs place the same trio under `.gemini/config/agents`. Other skill roots
receive no custom agents by inference. The exact native TypeNames and roles are:
`spec-driven-superpowers`, a planning-only coordinator subagent;
`spec-driven-superpowers-reviewer`, a nested zero-write reviewer subagent; and
`spec-driven-superpowers-reviewer-primary`, a primary-only zero-write headless
capture reviewer. All explicitly load the installed workspace skill. The coordinator
may delegate only closed fidelity or quality requests to the nested reviewer; both reviewers have read-only discovery tools and
never persists findings. It also disables inherited customizations and default
components so each invocation starts from the explicit ASDS skill and read-only
tool set. No whole-tree aliases are created.
Each native AGY installation also publishes the ASDS-owned capability marker
`.asds/accelerate-handoff-capability.json`. Its versioned schema records the exact
TypeName, agent-relative path and agent hash together with the ASDS version and
the planning-only/no-application-code/no-future-task guarantees. The coordinator,
reviewer and marker are manifest-owned and read back; the marker advertises a source
capability, not a successful invocation, permission grant, or independent review.
The same profile publishes two review contracts:
`.asds/agy-review-dispatch-contract.json` and
`.asds/agy-review-supervisor-transport.json`. The first declares
the exact host hook contract for reviewer TypeName, role, byte-identical prompt,
one-use freshness and a bound dispatch receipt, and hash-binds the exact installed
coordinator, reviewer and protocol paths. Inspection also requires those exact paths
to be owned by the exact official manifest v3. This static file is discovery only and
currently records `runtimeHostStatus: unavailable`: AGY 1.3.3 exposes no private
durable host authority or parent identity. Its observed `PostToolUse` payload includes
`toolCall` metadata but not the nested tool output, parent identity or durable
authority needed to bind a reviewer result. Generic
`invoke_subagent` does not prove enforcement. The public
`createAgyReviewDispatchAuthority`, `attestAgyReviewDispatch`, and
`parseAgyReviewResponse` exports therefore fail closed and cannot mint or accept
caller-supplied authority or receipts. No operational independent-review claim is
made until a future native host integration supplies those missing guarantees.
Reviewer availability is not a package-discovery gate. An exact safe locator is used
when supplied; an explicit reuse handoff with null lineage performs bounded read-only
discovery among direct children of `openspec/changes`, returning `locator-required`
for zero or multiple matches. The coordinator reads the single package's `tasks.md`,
manifest and bound references and distinguishes delivered no-op/progress from a
material candidate before reviewer preflight. Missing lineage never authorizes a write.
A coordinator that then needs fresh review reads the dispatch contract once; if it
observes unavailable status, it stops that review path immediately, reports the
precise block once, and does not attempt a reviewer or another transport. Read-only
inspection and structural validation remain allowed. The
second binds the primary-only capture reviewer, protocol, supervisor module and the
complete release-owned manifest inventory; it explicitly records unavailable
authority/completion and untrusted capture output.
The capture supervisor speaks the observed AGY 1.3.3 headless protocol: one
`event: "user"` input followed by a unique closed `init`, closed `step_update`
events and one terminal successful `result`. It binds conversation identity,
primary reviewer, canonical cwd, model, exact read-only tools and
`request-review`; write/command, permission, delegation, background and subagent
steps fail closed. This is transport validation only and does not promote capture
to review authority.
The filesystem-backed builder hashes current canonical package bytes and derives
revision, candidate and inventories from the manifest and `tasks.md`; canonical task
checkboxes are progress-normalized while all material bytes remain exact. Quality
would require a byte-exact host-consumed fidelity PASS over that same binding. Pure
response-envelope validation rejects stale bindings or a PASS with limitations but
does not establish independence, consume fidelity, or authorize delivery. References with role `review`
are integrity-checked but excluded from both fresh inventories; quality receives
prior review evidence only as the exact host-consumed fidelity output.
Read the [adapter catalog](skills/spec-driven-superpowers/SKILL.md) for session
capabilities, sequential fallback and review limitations.

### Preservation and limits

- Default installation accepts identical files; conflicting files abort before writes.
- Repeat with the same flags for idempotence. Default installation is additive;
  use explicit `--update` for the manifest-checked update described below. Changed
  user content and incompatible install options remain conflicts.
  Compare old/new hashes and migrate explicitly; there is no force-overwrite flag.
- Existing rules/configuration and unrelated directory content are preserved.
- Symlinks in destination ancestry are rejected, including broken links. On
  systems with aliased temporary/home paths, select their canonical real path.
- On ordinary apply errors, newly created files/directories are removed; explicit
  updates also restore replaced bytes from memory. This is not crash recovery or
  a defense against a hostile concurrent writer.
- `--uninstall` is preview-first and removes only unchanged files in the selected
  versioned manifest with an exact official payload inventory. It preserves shared
  schema/license/provenance bytes owned by
  another installed profile and refuses modified, linked or unreceipted content.
  Receipt paths and their hash/mode/type/link-policy metadata must exactly match the
  current source payload or a source-registered versioned tombstone. An older/v2
  receipt that does not match the current inventory fails closed; run an explicit,
  verified `--update` first rather than treating that receipt as deletion authority.
  It creates no backup or alternate installation. There are no provider/auth
  changes, service restarts, commits, pushes or automatic archives. Do not run
  concurrent installers against the same destination.

## Planning package and evidence

`tasks.md` is the sole task index; only the planning coordinator changes it before delivery.
Directory projections consume that index and reject unindexed/orphaned contracts,
title drift and non-monotonic numeric IDs. Execution waves are declared separately
and checked against the manifest; they never renumber task identities.
Initial delivery has open future-work checkboxes. After handoff, `[x]` is consumer
progress and does not contradict the progress-normalized delivered manifest/hash.
The planner must not reopen it without the consumer's explicit reopen protocol and
matching receipt/journal evidence or another concrete contradiction.
Each `tasks/task-ID.md` has YAML frontmatter for ID/title, owner, kind, decision
inputs/resolution, dependencies with exact required outputs, write paths, shared
resources, scenarios and verification commands. Readiness also requires Outcome,
Inputs, Scope and dependencies, Acceptance, Verification and Definition of done.
The schema exposes microcontracts as an artifact before the task index.
The task-manager projection exports precedence (`waitingOn`/`blocks`), decision
blockers, safe peers and per-task conflict exclusions (`serializesWith`).

See the [valid example](examples/basic-change/tasks/task-0001.md) and
[contract reference](skills/spec-driven-superpowers/references/contracts.md).
Test paths are part of the allowed scope; the example has no self-dependency.

```bash
npm run validate -- --change examples/basic-change
node scripts/plan.mjs manager /project/openspec/changes/example
npm run validate -- --change /project/openspec/changes/example \
  --delivery /evidence/receipt.json --task 0001 --repo /project --base APPROVED_SHA
```

The second check compares the receipt to actual committed/staged/unstaged/untracked
Git paths and the current revision/fingerprint. It never executes command strings
from the contract. Evidence must be revision-bound; claimed test/reviewer identity
still needs human or harness verification.

The Node validator runs from this toolkit checkout. Installed skills are prompts
and references; they do not silently install another Node toolchain.
OpenSpec validation remains separate. Use its pinned executable from this checkout
against the target project's working directory. `openspec/config.yaml` in this
toolkit repository stays on `spec-driven`; installation with `--activate` selects
the bridge in the destination project.

## Verification and support status

- `npm test`: deterministic contracts, installer preservation/rollback, Git scope,
  package metadata/links and real OpenSpec schema discovery/status/apply/validation.
- `npm run validate`: YAML, skills, schema dependency graph and templates.
- `npm run check`: JavaScript syntax checks; this is not an external lint/typecheck.
- CI is configured for Linux Node 20.19/22/24 and Windows/macOS Node 24. Windows
  symlink-specific tests are skipped because link privileges vary. Local execution
  on one platform is not proof that every matrix job has run.
- Adapter documents distinguish documentation from runtime observation. No
  six-harness end-to-end compatibility or subscription-billing guarantee is made.
- [Skill evaluation scenarios](skills/spec-driven-superpowers/evals/evals.json)
  are prepared for human review. Model A/B runs are not implied by passing unit tests.

To generate a static scenario-review page with the `create-skill` viewer available
in your environment (Python 3 required):

```bash
python3 scripts/prepare-eval-review.py \
  --viewer-script /path/to/create-skill/eval-viewer/generate_review.py
```

The generated, git-ignored workspace is
`skills/spec-driven-superpowers-workspace/prepared/`. Every case is labeled
**prepared, not run**; there are no invented model outputs, grades or benchmarks.

Cancelled tool returns and agent lifecycle failures are not process exit codes.
Preserve independent evidence; use at most three recovery attempts per blocker,
defer unresolved blockers and their dependent tasks, and continue independent work.

## Credits

ASDS originated with João Manoel
([Jaoguatirica](https://github.com/Jaoguatirica/spec-driven-superpowers)).
This fork preserves its OpenSpec + Superpowers method while adapting installation,
validation and runtime boundaries. See [LICENSE](LICENSE) and
[provenance](docs/provenance.md) for the captured source and modification policy.


## Accelerate entry and workflow evolution

ASDS accepts both direct user requests and Accelerate v1.0.0 handoffs. It preserves
the seven-field input format and prior decisions. Receiving a packet, accepting
lifecycle ownership and being authorized to execute are distinct. Intake does not
initialize a project or write artifacts. See the
[intake contract](skills/spec-driven-superpowers/references/intake.md) and
[planning rules](skills/spec-driven-superpowers/references/planning.md).

The portable receiver is `lib/handoff.mjs`; it is a data contract, not an installed
harness hook. Validate the real producer/consumer boundary against an existing
Accelerate checkout (Python 3, read-only, no copied runtime):

```bash
node scripts/check-accelerate-handoff.mjs --accelerate /absolute/path/to/accelerate
```

This checks structured input, refusals/grants, acceptance with gaps, continuation
and direct-entry parity. It does not certify model behavior or skill discovery.
Under ASDS, upstream engineering skills use one OpenSpec planning home; brainstorming
precedes specification and decomposition. Existing authorizations persist.

Current change validation requires the richer readiness contract; archived legacy
changes are not rewritten automatically. Migrate old active contracts explicitly,
review them and regenerate evidence. Receipts now carry `contractRevision` from
`loadTasks`, bound to planning context and prerequisite contracts. Integrated receipts
also require evidence and independent reviews on `integrationRevision`. For checked
tasks, pass `--receipts /external/receipts.json` (a map keyed by task ID).
These structural checks cannot authenticate the user, reviewer or test log.

### Updating an existing installation

Use the same scope, target, data-home and skills-dir with `--update` to preview,
then add `--apply` after the update is authorized. The existing ownership manifest
and every owned file must match; changed user content, hardlinks, removed payload
entries and unknown conflicts fail before writing. Only unchanged owned files
are replaced. File modes are preserved, and ordinary failures restore replaced
bytes from memory and remove newly created files. No disk backups are made.
This is not crash recovery or protection against hostile concurrent mutations.
User-scope shared schema/license/provenance changes require explicit reconciliation
across installations. Add `--reconcile-shared` to the `--update` preview only when
that shared update is intended. The installer then validates every default/profile
manifest and every file they own before planning the shared bytes and all affected
receipts together. Any stale profile refuses the whole plan. Review the preview,
then add `--apply` separately; ordinary rollback covers the shared files and receipts.
Without this flag, `--update` remains fail-closed and cannot silently invalidate
another manifest.

Format-1 receipts require an explicit adoption step because they contain hashes
but no mode/type/link ownership metadata. First compute the SHA-256 of the exact
legacy receipt bytes and preview the migration; apply only by repeating the same
identity and hash with `--apply` plus the canonical plan digest printed by the
preview:

```bash
sha256sum /absolute/project/.asds/install-manifest.json
node scripts/install.mjs --scope project --target /absolute/project --update \
  --adopt-legacy-manifest-sha256 EXACT_LOWERCASE_SHA256
# inspect the complete preview and copy its Plan SHA-256, then:
node scripts/install.mjs --scope project --target /absolute/project --update \
  --adopt-legacy-manifest-sha256 EXACT_LOWERCASE_SHA256 --apply \
  --expect-plan-sha256 EXACT_PREVIEW_PLAN_SHA256
```

Adoption is limited to the historical default `.agents/skills` profile. It checks
the exact scope, target and schema root, unique canonical absolute paths, regular
single-link files, and hashes of every legacy entry. Every entry must be a path
in the current official payload or an exact source-controlled versioned tombstone;
merely residing beneath a skill or schema root grants no ownership. Foreign paths,
sibling skills, schema extensions, and ambiguous legacy `AGENTS.md` or
`openspec/config.yaml` ownership fail closed. Only exact registered tombstones may be removed;
new payload receives current manifest metadata and full readback. No backup,
parallel runtime or implicit adoption is created. The plan digest binds the
ordered actions, paths, before/after hashes and modes, feature flags, shared
reconciliation choice, sibling receipts, and migration-journal identity; direct
apply or state/options drift requires a new preview. A migration journal
provides CAS-bound recovery from interruption, accepts only exact old or
published official artifacts, and is removed only after payload and all sibling
receipts pass readback. User installations with no sibling profile may migrate
historically changed shared schema directly; installations with siblings require
the same explicit `--reconcile-shared` option in preview, apply, and resume. While
that journal exists, fresh install, ordinary update, and uninstall all fail closed;
only the exact adoption resume may proceed. Forward and compensating rollback
replaces share one deterministic journal-bound temporary identity and are recovered
only when their bytes and mode match the journal's exact old/new action images;
drifted or unknown `.asds-update-*` artifacts block the resume, and successful
readback removes both the journal and its proven temporary residue.

Use the same identity arguments with `--uninstall` to preview exact removals, then
repeat with `--apply` only after reviewing that plan:

```bash
node scripts/install.mjs --scope project --target /absolute/project --uninstall
node scripts/install.mjs --scope project --target /absolute/project --uninstall --apply
```

For the AGY user profile, include the original `--data-home` and
`--skills-dir .gemini/config/skills`. Uninstall validates every owned byte, mode,
file type and single-link invariant before its first mutation, performs a final
absence readback, and restores removals from memory on ordinary failure. It does
not remove content merely found under a customization directory.

Use a quiescent directory. A manifest records ownership, not human authorization.

## Portable coordination and optional integrations

The opt-in [coordination protocol](skills/spec-driven-superpowers/references/orchestration.md)
adds generated DAGs, configurable executor/reviewer profiles, causal ready waves,
resource reservations, fresh review packets, root dispositions and a replayable
local journal. Run `node scripts/orchestrate.mjs` from this checkout; installed
skills do not silently add a runtime or spawn agents.

The [two-phase evolution](skills/spec-driven-superpowers/references/integrations.md)
preserves a standalone core and defines the next optional tracker/UI boundaries.
The core now emits a deterministic neutral projection usable by simple queues or
Plane/Linear adapters; provider-specific read/write connectors remain unimplemented.
The two suggested OpenSpec dashboards are compared as documentary
references; neither has been installed or forked.

### Operational continuity

The optional coordinator now supports partial-readiness plans, stage-specific
blockers, pause/resume and next-action decisions, bounded runtime preflight, and
source-bound input from existing TASKS.md plans. See [the protocol](skills/spec-driven-superpowers/references/operational-continuity.md).
The injectable host bridge does not certify natural-entry activation in Codex or
Agy; local tests, controlled invocation and real-session qualification are separate.
