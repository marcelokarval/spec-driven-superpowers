# asds-core Specification

## Purpose
Provides an autonomous engineering framework combining OpenSpec specification governance with Superpowers test-driven development, subagent wave concurrency, and evidence ledgers for AI coding agents.

## Requirements

### Requirement: Zero-Command Autonomous Orchestration
The framework MUST provide complete end-to-end development orchestration without requiring users to type slash commands.

#### Scenario: Natural Language Initiation
- **GIVEN** a developer expresses a feature request in natural language
- **WHEN** the agent analyzes the request
- **THEN** it automatically initiates the OpenSpec change and presents a complete proposal for human review

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
- **THEN** all ASDS skills, plugins, and global rules MUST be installed and validated with zero errors
