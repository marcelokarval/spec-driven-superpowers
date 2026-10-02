# Autonomous Spec-Driven Superpowers (ASDS)

OpenSpec defines **what** to build; Superpowers guides **how** to build it.
ASDS connects them with a small task index, per-task microcontracts, TDD and
revision-bound reviews. It is a workflow toolkit, not an inference engine or a
guarantee of zero defects, lower token usage or faster delivery.

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
`--skills-dir .gemini/config/skills`. No whole-tree aliases are created.
Read the [adapter catalog](skills/spec-driven-superpowers/SKILL.md) for session
capabilities, sequential fallback and review limitations.

### Preservation and limits

- Existing identical files are accepted; conflicting files abort before writes.
- Repeat with the same flags for idempotence. This is not an in-place upgrader:
  changed source files or install options can conflict with an existing manifest.
  Compare old/new hashes and migrate explicitly; there is no force-overwrite flag.
- Existing rules/configuration and unrelated directory content are preserved.
- Symlinks in destination ancestry are rejected, including broken links. On
  systems with aliased temporary/home paths, select their canonical real path.
- On ordinary apply errors, only newly created files/directories are rolled back.
  This is not crash recovery or a defense against a hostile concurrent writer.
- No uninstall, provider/auth changes, service restarts, commits, push or automatic
  archive. Do not run concurrent installers against the same destination.

## Microcontracts and evidence

`tasks.md` is the sole completion index; only the coordinator changes it.
Each `tasks/task-ID.md` has YAML frontmatter for ID, kind, open material decisions,
dependencies, exact write paths, shared resources, scenarios and verification commands.
Readiness also requires Outcome, Inputs, Acceptance, Verification and Definition of
done sections. The schema exposes microcontracts as an artifact before the task index.

See the [valid example](examples/basic-change/tasks/task-0001.md) and
[contract reference](skills/spec-driven-superpowers/references/contracts.md).
Test paths are part of the allowed scope; the example has no self-dependency.

```bash
npm run validate -- --change examples/basic-change
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
