# asds-core Specification

## Purpose
ASDS is a self-contained planning product. It combines OpenSpec requirement
governance with Superpowers understanding, task-writing and review practices to
deliver reviewed and persisted planning. A separately selected consumer implements
the future work.

## Requirements

### Requirement: Natural Planning Entry
The framework MUST accept planning work without requiring slash commands and MUST
stop at a verified planning delivery.

#### Scenario: Natural-language initiation
- **GIVEN** a user requests planning or an implementation that needs planning
- **WHEN** ASDS accepts the planning contribution
- **THEN** it reuses received context and prepares the planning package
- **AND** it does not infer permission to implement the future tasks

#### Scenario: Planning delivery boundary
- **GIVEN** a ready planning package
- **WHEN** fidelity, quality and persistence checks pass
- **THEN** ASDS returns the planning contribution and releases ownership
- **AND** an originally requested implementation remains for a caller-selected consumer

### Requirement: Self-Contained Planning Distribution
The repository MUST contain its canonical ASDS skill, adapted OpenSpec and
Superpowers skills, bridge schema, templates, validators, installer and provenance.

#### Scenario: Installation payload
- **WHEN** the installer builds a user or project payload
- **THEN** it discovers all canonical bundled skills without another source checkout
- **AND** it installs the reusable bridge schema from this repository

#### Scenario: Smooth owned update
- **GIVEN** an existing manifest-owned installation whose bytes remain unchanged
- **WHEN** an explicit update is previewed and then applied
- **THEN** only owned files are replaced and conflicts fail before mutation
- **AND** shared payload changes require explicit multi-install reconciliation

### Requirement: Recursive Planning Composition
Planning MUST represent composition separately from precedence.

#### Scenario: Deep hierarchy
- **GIVEN** a result needing packages, subpackages and leaves
- **WHEN** the planning graph is validated
- **THEN** arbitrary justified depth is accepted without making packages executable
- **AND** composition cycles, orphans and scope escapes are rejected

#### Scenario: Precedence graph
- **GIVEN** leaves or aggregates with explicit dependencies
- **WHEN** the graph is compiled
- **THEN** effective terminal prerequisites and cycles are derived without a model,
  dispatch journal, host bridge or code receipt

### Requirement: Complete Traceability
Every source obligation, exception, negative rule and preservation rule MUST map
through decisions and scenarios to leaf acceptance.

#### Scenario: Structural map is not semantic certification
- **WHEN** all declared identifiers and routes are structurally valid
- **THEN** the result remains `need-review` until fidelity and quality review examine meaning

### Requirement: Planning Lifecycle
Planning state MUST be distinct from future implementation progress.

#### Scenario: Ready without implementation
- **GIVEN** all applicable planning layers and reviews are satisfied
- **WHEN** no future task has been implemented
- **THEN** the package MAY be planning-ready
- **AND** it MUST NOT be delivered without matching persistence readback

#### Scenario: Partial planning
- **GIVEN** a localized material blocker
- **WHEN** independent planning is ready and persisted
- **THEN** ASDS MAY return a partial package naming blocked tasks and dependents

### Requirement: Task Manager Projection
A delivered package MUST distinguish contract availability from current execution
readiness and MUST expose a deterministic projection usable by simple queues and
dependency-aware task managers.

#### Scenario: Initial frontier
- **GIVEN** reviewed tasks with precedence and localized blockers
- **WHEN** the planning package is delivered
- **THEN** each leaf is classified as ready, waiting, blocked or completed
- **AND** it names prerequisite tasks, blocker identities, reverse dependents,
  conflict-aware waves and parallel peers
- **AND** each task names conflict peers that a simple queue must serialize

### Requirement: Canonical Task Index
The framework MUST treat `tasks.md` as the sole ordered inventory for persisted
task contracts and directory-based task-manager projections.

#### Scenario: Index and contract divergence
- **WHEN** an indexed title differs, a contract is orphaned, an ID is duplicated,
  or numeric IDs are not strictly increasing
- **THEN** validation and directory projection fail before emitting a schedule

#### Scenario: DAG wave readback
- **WHEN** a planning manifest is delivered
- **THEN** the waves declared in `tasks.md` exactly match the deterministic projection
- **AND** stable task IDs are not renumbered to imitate execution order

### Requirement: OpenSpec Delta Compatibility
An OpenSpec-backed planning package MUST pass the structural delta contract before
ASDS claims delivery.

#### Scenario: Invalid delta artifact
- **WHEN** a change spec lacks an exact level-two delta heading, an RFC 2119
  requirement body, or a requirement-specific WHEN/THEN scenario
- **THEN** ASDS rejects planning delivery and reports the offending specification

#### Scenario: Sensitive planning review
- **GIVEN** authentication, authorization, credentials, security, financial,
  destructive or sensitive-data planning
- **WHEN** review policy is evaluated
- **THEN** ordinary-low self-review is rejected
- **AND** an independent planning reviewer is required

### Requirement: Evidence-Bound Planning Review
Fidelity review MUST precede quality review and both MUST bind the same package
revision, source inventory and task inventory.

#### Scenario: Stale or contradictory review
- **WHEN** a review references another revision, omits sources/tasks or passes with
  an open material finding
- **THEN** planning promotion is rejected

### Requirement: Equivalent Output With or Without OpenSpec
OpenSpec availability or refusal MUST NOT change the required planning quality.

#### Scenario: OpenSpec absent or refused
- **WHEN** project initialization is absent or explicitly refused
- **THEN** ASDS writes the same manifest, index and contracts to an authorized local
  destination without creating `openspec/` or asking again

### Requirement: Consistent Persistence and Return
A delivered planning return MUST bind a verified package revision and MUST not
claim implementation completion.

#### Scenario: Publication failure
- **WHEN** an ordinary write fails during package replacement
- **THEN** the previous bytes are restored from memory and operation temporaries are removed

#### Scenario: Implementation originally requested
- **WHEN** planning for an implementation request is delivered
- **THEN** return protocol v2 reports the original implementation as not fulfilled
- **AND** directs the caller to select the next consumer

### Requirement: Compatible Intake
ASDS MUST accept Accelerate's seven-field protocol v1 packet without adding
mandatory fields or treating authorization records as authenticated permission.

#### Scenario: Forwarded context
- **WHEN** Accelerate forwards objective, project, scope, constraints, risks,
  references and authorizations
- **THEN** ASDS preserves them and resolves only planning gaps
