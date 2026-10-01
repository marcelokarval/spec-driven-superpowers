# Global Spec-Driven Development & Autonomous Superpowers Directive

All AI coding sessions, subagents, and automated workflows on this machine MUST adhere to the **Autonomous Spec-Driven Superpowers Standard** (`spec-driven-superpowers`):

## 1. Core Principle: OpenSpec Governs "What", Superpowers Governs "How"
- Never perform unplanned "vibe coding" on features, refactors, or architecture changes.
- Requirements, specifications, and scope boundaries must be formally governed via **OpenSpec** (`openspec/changes/<id>/`).
- Technical execution, testing, and delivery must be strictly executed via **Superpowers** skills.

## 2. Zero-Command Autonomous Orchestration & Pre-Validation Gate
- The agent conducts the development lifecycle proactively from end-to-end.
- Never force the user to type slash commands (`/opsx-propose`, `/opsx-apply`, `/opsx-archive`).
- Silently run `openspec validate <id>` to ensure zero schema/header defects BEFORE presenting proposals for human sign-off.
- Upon receiving natural language authorization (e.g. "aprovado", "pode prosseguir", "início autorizado"), the agent transitions immediately into execution.

## 3. Pre-flight Baseline Health Check
- Before starting Wave 1, run project test suites to detect any preexisting anomalies.
- Never waste tokens trying to debug out-of-scope legacy failures during a task.

## 4. Mandatory Master-Detail Task Architecture (`tasks.md` + `tasks/task-*.md`)
- For any change with multiple steps, decompose tasks into:
  1. `tasks.md` as the stable Master Index and Dependency Graph (using standard `- [ ] [Task ID](tasks/task-ID.md): Title` format).
  2. `tasks/task-<ID>.md` as atomic, isolated micro-contracts (specifying exact permitted/prohibited file paths, 1:1 spec scenario mapping, TDD steps, shell verification commands, and definition of done).

## 5. Native Parallelism & Workspace Isolation
- Analyze task dependencies into Concurrency Waves (`Wave 1`, `Wave 2`, etc.).
- Independent tasks with completely disjoint permitted file boundaries MUST be executed concurrently via subagents (`invoke_subagent` / `dispatching-parallel-agents`).
- For concurrent subagents, use isolated workspace mode (`Workspace: 'share'` / worktrees) to avoid Windows file-locking and cache contention.
- Subagents receive ONLY their specific `task-*.md` to ensure zero scope leakage.

## 6. Strict TDD, Atomic Commits, Visual Proofs & Evidence Ledger
- Every code change MUST follow Red-Green-Refactor (`test-driven-development`). Every BDD `#### Scenario:` in the spec MUST map 1:1 to a named test case.
- For UI/Visual/3D tasks, capture browser proof and **persist the screenshots in the codebase/change directory** alongside tests for human validation (never in disposable temp caches).
- Create an atomic git commit per verified task (`git commit -m "feat(...): [Task ID]..."`) before marking `- [x]` in `tasks.md`.
- Audit each completed task with `code-reviewer` to ensure the strict file boundary was respected.
- Prior to archival, generate an Evidence Ledger (`summary.md`) consolidating commits, visual proofs, and test proofs.
- Upon final wave completion, run consolidated project test suites, automatically archive the change (`openspec archive <change-id>`), and synthesize ready-to-merge PR and changelog notes.
