# asds-core Specification

## Purpose
Provides an autonomous engineering framework combining OpenSpec specification governance with Superpowers test-driven development, subagent wave concurrency, and evidence ledgers for AI coding agents.

## Requirements

### Requirement: Zero-Command Autonomous Orchestration
The framework MUST provide complete end-to-end development orchestration without requiring users to type slash commands.

#### Scenario: Natural Language Initiation
- **GIVEN** a developer expresses a feature request in natural language
- **WHEN** the agent analyzes the request
- **THEN** it checks the intended project and initialization authorization before creating an OpenSpec change, then presents the proposal for review

#### Scenario: Immediate Execution Transition
- **GIVEN** an approved OpenSpec proposal
- **WHEN** the user provides natural language authorization
- **THEN** the orchestrator MUST immediately transition into TDD execution without requiring slash commands

### Requirement: Master-Detail Task Decomposition
The framework MUST separate high-level wave tracking from atomic task contracts.

#### Scenario: OpenSpec Checklist Compatibility
- **GIVEN** a change with multiple tasks
- **WHEN** the tasks are indexed in `tasks.md` with links to `tasks/task-*.md`
- **THEN** `openspec status` and `openspec instructions apply` MUST accurately calculate task progress and checkboxes

#### Scenario: Atomic Scope Isolation
- **GIVEN** an atomic `task-*.md` file
- **WHEN** assigned to a subagent
- **THEN** it MUST strictly specify permitted and prohibited file paths, TDD steps, and verification commands

### Requirement: 1-Click Installer
The repository MUST provide cross-platform installation scripts.

#### Scenario: Cross-Platform Environment Setup
- **GIVEN** a machine with Antigravity CLI or Gemini CLI
- **WHEN** running `install.ps1` or `install.sh`
- **THEN** the scripts MUST preview an explicit installation target by default and apply only when requested, preserving existing files
- **AND** user-scope installation makes skills and reusable schemas available globally without initializing a project or installing mandatory global rules


### Requirement: Contextual Activation and Project Initialization
Skills MAY be installed globally for the user. The system MUST distinguish global
availability from workflow activation and project-local `openspec/` state.

#### Scenario: Ordinary Question
- **GIVEN** globally installed skills, with or without an existing project root
- **WHEN** the user asks an ordinary question unrelated to project execution
- **THEN** the agent MUST answer without activating ASDS or Superpowers, asking about setup, or creating workflow artifacts

#### Scenario: Project Without OpenSpec
- **GIVEN** a suitable ASDS project task and no local `openspec/`
- **WHEN** initialization has not already been explicitly authorized
- **THEN** the agent MUST ask whether to create the exact project path or continue without OpenSpec, and wait before any root-creating action

#### Scenario: Refusal or Pending Answer
- **GIVEN** the initialization question was asked
- **WHEN** the user refuses or has not answered
- **THEN** the agent MUST NOT create OpenSpec state
- **AND** refusal MUST allow normal task execution without OpenSpec and without repeated setup prompts for that task

#### Scenario: Existing Project or Prior Authorization
- **GIVEN** the project already has OpenSpec or initialization of that exact project was explicitly authorized
- **WHEN** the agent starts suitable project work
- **THEN** it MUST reuse existing configuration or perform authorized initialization without a redundant creation question


### Requirement: Compatible Intake and Continuity
ASDS MUST accept the existing Accelerate v1.0.0 seven-field handoff and remain usable
through direct requests. Receipt and acceptance MUST NOT grant execution permission.

#### Scenario: Forwarded Context
- **WHEN** Accelerate forwards objective, project, scope, constraints, risks, references and authorizations
- **THEN** ASDS preserves that context and resolves only relevant gaps without duplicate discovery or approval

#### Scenario: Accepted With Gaps
- **WHEN** ASDS accepts work with an unresolved material question
- **THEN** it owns the lifecycle while dependent execution remains pending

#### Scenario: Return and Resumption
- **WHEN** work resumes or returns to Accelerate
- **THEN** ASDS preserves decisions and returns actual outcome, evidence, remaining work and limitations without a second planning or closure gate

### Requirement: Executable Planning
ASDS MUST resolve material decisions before implementation tasks and maintain a
single planning home with discoverable microcontracts and delta specifications.

#### Scenario: Task Readiness
- **WHEN** a microcontract has no substantive readiness sections or unresolved material decisions
- **THEN** change validation rejects it for execution

#### Scenario: Material Change
- **WHEN** planning or prerequisite contracts change
- **THEN** affected contract identities and receipts become stale and affected work requires reassessment

### Requirement: Evidence Bound Completion
An integrated delivery MUST include verification and independent reviews bound to
the integrated revision and a matching contract identity. Checked tasks MUST have
corresponding valid integrated receipts.

#### Scenario: Missing Integration Proof
- **WHEN** a receipt supplies only an integration revision string without matching evidence and reviews
- **THEN** validation rejects integrated completion
