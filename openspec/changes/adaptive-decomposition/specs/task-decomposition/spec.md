## ADDED Requirements

### Requirement: Bounded dispatch
The framework SHALL enforce bounded dispatch through its contract and coordination interfaces.

#### Scenario: Bounded dispatch
- **WHEN** Given a broad package with reviewed children, scheduling offers only ready leaf tasks.
- **THEN** the coordinator receives the bounded action or an explicit rejection without false completion.

### Requirement: Scope preserving refinement
The framework SHALL enforce scope preserving refinement through its contract and coordination interfaces.

#### Scenario: Scope preserving refinement
- **WHEN** Given approved unfinished work, decomposition preserves outcome, coverage and unrelated acceptance while refusing active workers and expanded scope.
- **THEN** the coordinator receives the bounded action or an explicit rejection without false completion.

### Requirement: Integrated package acceptance
The framework SHALL enforce integrated package acceptance through its contract and coordination interfaces.

#### Scenario: Integrated package acceptance
- **WHEN** Given accepted children, package completion remains pending until current integrated independent evidence is recorded.
- **THEN** the coordinator receives the bounded action or an explicit rejection without false completion.

### Requirement: Portable source continuity
The framework SHALL enforce portable source continuity through its contract and coordination interfaces.

#### Scenario: Portable source continuity
- **WHEN** Given native contracts or a bound existing plan, current identities and CLI transitions enforce the same graph and refuse source drift.
- **THEN** the coordinator receives the bounded action or an explicit rejection without false completion.

