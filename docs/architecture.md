# Autonomous Spec-Driven Superpowers (ASDS) Architecture

The ASDS standard unifies **OpenSpec** (Specification, Requirements & Contract Governance) and **Superpowers** (Autonomous Agentic Engineering, TDD & Subagents).

---

## The 5 Pillars

### 1. Zero-Command Autonomous Orchestration
The agent conducts the entire lifecycle proactively from natural language prompts. Developers are never forced to memorize slash commands.

### 2. Pre-flight Baseline Health Check
Before touching code in any change, the agent executes existing project test suites to record preexisting anomalies, preventing out-of-scope token burn on legacy bugs.

### 3. Master-Detail Task Architecture (`tasks.md` + `tasks/task-*.md`)
- `tasks.md`: Stable high-level checklist and wave graph tracked by the OpenSpec engine.
- `tasks/task-<ID>.md`: Atomic, self-contained micro-contracts defining exact permitted/prohibited file paths, 1:1 spec scenario mapping, TDD steps, shell verification commands, and definition of done.

### 4. Wave Concurrency & Native Parallelism
Independent tasks with disjoint write boundaries execute concurrently via subagents (`Workspace: 'share'` / worktrees) to avoid Windows file-locking and cache contention.

### 5. Strict TDD, Persisted Visual Proofs & Evidence Ledgers
- Every code change follows Red-Green-Refactor.
- UI/3D tasks capture headless screenshots persisted in `screenshots/` alongside tests for human validation.
- Atomic commits are created per verified task.
- Before archiving, an Evidence Ledger (`summary.md`) is compiled with commits, test outputs, and visual links.
