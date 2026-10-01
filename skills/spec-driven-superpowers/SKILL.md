---
name: spec-driven-superpowers
description: Unified operational standard combining OpenSpec (specification governance, living documentation, and delta contracts) with Superpowers (TDD, micro-planning, worktree isolation, subagents, and double-review execution). Use this skill whenever planning, designing, or implementing features, refactors, or fixes requiring strict specification and zero-defect engineering.
---

# Autonomous Spec-Driven Superpowers (ASDS) Standard

This operational skill defines the **universal engineering standard** unifying **OpenSpec** (Product Intent, Specification & Contract Governance) and **Superpowers** (Autonomous Agentic Engineering, TDD, Wave Concurrency & Delivery Verification).

---

## 1. Core Principle: Zero-Command Autonomous Orchestration

The AI coding agent operates as an **autonomous software engineer and multi-tasking orchestrator**, not as a passive prompt awaiting manual slash commands (`/opsx-propose`, `/opsx-apply`, `/opsx-archive`).

1. **Natural Dialogue Ingestion:**
   - The user communicates goals, features, or architectural adjustments in natural language.
   - The agent never demands the user memorize or execute slash commands.
2. **Autonomous Specification & Pre-Validation Gate:**
   - The agent proactively drafts the OpenSpec structure (`openspec/changes/<change-id>/`).
   - **Pre-Validation Gate**: Before presenting the proposal to the user, the agent silently runs:
     ```bash
     openspec validate <change-id>
     ```
   - Any schema, header, or formatting errors are auto-corrected immediately. The user is only ever shown a proposal that is 100% syntactically valid.
3. **Single Human Approval Gate:**
   - The agent presents an executive summary of the proposal, architecture, and task waves, pausing **only** to request the user's natural language sign-off (e.g., *"Aprovado"*, *"Pode prosseguir"*, *"Início autorizado"*).
4. **Immediate Autonomous Handoff:**
   - Upon receiving user authorization, the agent immediately transitions into the Superpowers execution engine without waiting for `/opsx-apply`.

---

## 2. Pre-flight Baseline Health Check (Sanity Gate)

Before writing any code or initiating Wave 1:
1. **Execute Baseline Validation:**
   ```bash
   npm test
   npm run typecheck --workspaces --if-present
   ```
2. **Handle Preexisting Anomalies:**
   - If the baseline is clean (GREEN), proceed immediately.
   - If any preexisting tests fail, log them explicitly in the session notes as **Known Baseline Failures**.
   - **Prohibition:** Never waste tokens or attempt out-of-scope refactoring on preexisting test failures during a task. Preserve their state and isolate newly introduced tests.

---

## 3. Master-Detail Task Architecture (`tasks.md` + `tasks/task-*.md`)

To prevent line-drift errors, context bloating, and cross-task boundary leakage, changes with multiple tasks MUST use the **Master-Detail Decomposition Pattern**:

```text
openspec/changes/<change-id>/
├── proposal.md
├── design.md
├── summary.md                     <-- EVIDENCE LEDGER (AUTO-GENERATED BEFORE ARCHIVE)
├── specs/
│   └── <capability>/
│       └── spec.md                <-- BDD SCENARIOS (#### Scenario:)
├── tasks.md                       <-- LEVEL 1: MASTER GOVERNANCE INDEX & WAVE GRAPH
├── screenshots/                   <-- PERSISTED VISUAL PROOFS (FOR HUMAN VALIDATION)
│   └── task-0004-pedestal.png
└── tasks/                         <-- LEVEL 2: ATOMIC EXECUTION CONTRACTS
    ├── task-0001.md
    ├── task-0002.md
    ├── task-0003.md
    └── ...
```

### Level 1: `tasks.md` (Master Governance Index)
`tasks.md` is the stable checklist tracked by the OpenSpec engine. Tasks are grouped into **Concurrency Waves**:

```markdown
# Tasks: <Change Title>

## Wave 1: Foundation & Scaffolding (Concurrent)
- [ ] [Task 0001](tasks/task-0001.md): Scaffolding and build configuration
- [ ] [Task 0002](tasks/task-0002.md): Core type definitions and schema contracts

## Wave 2: Core Components (Concurrent - Depends on Wave 1)
- [ ] [Task 0003](tasks/task-0003.md): Canvas stage component with lifecycle cleanup
- [ ] [Task 0004](tasks/task-0004.md): Volumetric mesh loader and shaders
- [ ] [Task 0005](tasks/task-0005.md): Event bus reactive bridge

## Wave 3: Integration & Polish (Sequential - Depends on Wave 2)
- [ ] [Task 0006](tasks/task-0006.md): Screen assembly with overlay DOM HUD
- [ ] [Task 0007](tasks/task-0007.md): Full regression and performance verification
```

### Level 2: `tasks/task-<ID>.md` (Atomic Subagent Contract with 1:1 Spec Traceability)
Each micro-task is an isolated specification delivered directly to a spawned subagent. Standard format:

```markdown
# Task <ID>: <Short Descriptive Title>

## 1. Metadata & Dependencies
- **Task ID:** <e.g. Task 0001>
- **Concurrency Wave:** <e.g. Wave 1>
- **Prerequisites:** <None or IDs of completed tasks>

## 2. Rigid File Boundary (Scope Isolation)
- **Permitted for Write (Write Allowed):**
  - `<exact/path/to/target/file.ts>`
  - `<exact/path/to/target/test.test.ts>`
- **Strictly Prohibited (Read-Only / Do NOT Touch):**
  - `<other/project/apps/*>`
  - `<packages/*>`

## 3. Implementation Requirements & Spec Traceability
<Concise technical requirements.>
- **Target Spec Scenarios (1:1 Mapping):**
  - `#### Scenario: <Exact Name from spec.md>`
  - `#### Scenario: <Edge Case Name from spec.md>`

## 4. Test-Driven Development Protocol (Superpowers TDD)
1. **RED:** Author failing test in `<path/to/test.ts>` mirroring the exact Scenario names:
   ```typescript
   it('Scenario: <Exact Name from spec.md> - should behave as specified', () => { ... });
   ```
   Run test and confirm it fails for the expected reason.
2. **GREEN:** Write minimal production code within the permitted files to satisfy the test.
3. **REFACTOR:** Remove duplication and optimize code without breaking existing tests.

## 5. Visual Smoke Proof (Mandatory for UI / Visual / 3D Tasks)
- Capture browser proof via headless runner or browser tools.
- **Persist in codebase:** Save screenshot to `openspec/changes/<change-id>/screenshots/<task-id>-<component>.png` or `tests/screenshots/`.
- Never store visual proofs in disposable git-ignored temp folders; they are permanent test artifacts for human inspection.

## 6. Empirical Verification Command
```bash
<exact shell command, e.g. npm test -w @pkg/name>
```

## 7. Definition of Done
- Verification command exits with code 0 and zero warnings.
- 100% of target spec scenarios have corresponding passing unit tests.
- For UI tasks: screenshot captured, persisted, and linked for human review.
- `git status` verifies zero modifications outside the permitted boundary.
```

---

## 4. Wave Concurrency & Native Parallelism

1. **Wave Identification & Disjoint Boundaries:**
   - Tasks within the same wave MUST have **completely disjoint permitted write boundaries** (never write to the same files concurrently).
2. **Subagent Spawning with Workspace Isolation:**
   - Use `invoke_subagent` specifying `Workspace: 'share'` (or dedicated git worktrees) for concurrent subagents.
   - This eliminates Windows file-locking issues in `node_modules`, build cache contention, and temp file collision.
   - Each subagent receives *only* its specific `task-*.md` and direct context files.
3. **Reactive Non-Blocking Monitoring:**
   - The orchestrator waits reactively for subagent completions without polling loops.
4. **Pre-Checkoff Audit (`code-reviewer`):**
   - For each completed task, validate:
     1. Did the tests pass with empirical proof, covering all declared spec scenarios?
     2. If UI-related, was the screenshot persisted in the codebase?
     3. Were all modifications strictly within the permitted boundary?

---

## 5. Atomic Task Commits & Checkpointing

To prevent cascading regressions and enable instant rollback:
1. Immediately after each `task-<ID>.md` is verified and audited, create an **atomic git commit**:
   ```bash
   git commit -m "feat(<change-id>): [Task <ID>] <short title>"
   ```
2. Mark the task complete in `tasks.md`: `- [ ]` → `- [x]`.
3. If a subsequent task fails or introduces architectural flaws, rollback is an instant `git checkout` / `git revert` to the last atomic task commit without losing prior successful tasks.

---

## 6. Evidence Ledger (`summary.md`), Delivery & Auto-PR

Upon completion of the final wave:
1. **Consolidated Monorepo Verification:**
   - Run full project build, test, and typecheck suites.
2. **Generate Evidence Ledger (`summary.md`):**
   - Create `openspec/changes/<change-id>/summary.md` documenting:
     - **Atomic Commits Ledger:** Table of commit hashes and descriptions per task.
     - **Visual Gallery:** Clickable markdown links to all persisted screenshots in `screenshots/`.
     - **Test Certificate:** Terminal verification output proving 100% passing tests and clean typechecking.
     - **Execution Waves:** Summary of parallel waves executed.
3. **Autonomous Archival (`openspec archive`):**
   - Execute `openspec archive <change-id>`, merging delta specs into `openspec/specs/` permanent living documentation.
4. **Automated Pull Request & Changelog Synthesis:**
   - Generate a complete, ready-to-merge Pull Request summary based on `proposal.md` and `summary.md`.
   - Update `CHANGELOG.md` with the new capability entry.
   - Present the PR summary to the user for 1-click review and integration.

---

## 7. Strict Guardrails & Prohibitions

| Prohibited Anti-Pattern | Mandatory Standard Behavior |
| :--- | :--- |
| **"Vibe Coding" directly in chat** | Proactively create OpenSpec change before writing code. |
| **Presenting proposals with syntax bugs** | Run `openspec validate <id>` before asking for human approval. |
| **Requiring user to type `/opsx-apply`** | Orchestrator starts execution immediately upon user's natural authorization. |
| **Monolithic `tasks.md` with inlined code** | Use Master-Detail: `tasks.md` (index) + `tasks/task-*.md` (atomic contracts). |
| **Skipping edge-case spec scenarios** | Map every `#### Scenario:` 1:1 to a named test case. |
| **Concurrent subagents in the same physical directory** | Use `Workspace: 'share'` or git worktrees to prevent Windows file locks. |
| **Writing code before tests** | Enforce strict Red-Green-Refactor (`test-driven-development`). |
| **Discarding UI screenshots in temp caches** | Persist screenshots in the codebase/change directory alongside tests. |
| **Accumulating changes without commits** | Commit atomically per completed task (`git commit -m "feat(...): [Task ID]..."`). |
| **Marking `- [x]` without empirical test output** | Never claim completion without terminal execution evidence (`verification-before-completion`). |
