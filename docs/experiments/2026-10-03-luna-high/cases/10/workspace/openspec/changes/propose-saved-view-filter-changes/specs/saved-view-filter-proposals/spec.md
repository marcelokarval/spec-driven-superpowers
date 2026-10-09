## Purpose

Define a local, synthetic workflow that lets an operator review and explicitly authorize AI-proposed changes to saved-view filters while preserving version safety and recovery.

## ADDED Requirements

### Requirement: Proposals and previews never apply changes

The system SHALL keep a proposed filter change separate from the saved view until a separately authorized apply operation succeeds.

#### Scenario: Create a proposal without changing the view
- **WHEN** the AI submits a valid proposal for a saved view
- **THEN** the system records the proposal and leaves the saved view's filters and version unchanged

#### Scenario: Preview the proposal
- **WHEN** an operator opens a proposal preview
- **THEN** the system shows the current filters, proposed filters, expected view version, and affected synthetic orders without changing the view

#### Scenario: Reject unsupported filter fields
- **WHEN** a proposal contains a filter field outside the supported status filter
- **THEN** the system rejects it before recording the proposal

### Requirement: Operation identifiers are idempotent and content-bound

The system SHALL bind each operation identifier to one canonical operation payload and retain its prior result for identical retries.

#### Scenario: Repeat an operation with identical content
- **WHEN** the system receives the same operation identifier and canonical content again
- **THEN** it returns the previously recorded proposal or operation result without applying the operation a second time

#### Scenario: Reuse an identifier with different content
- **WHEN** the system receives a previously recorded operation identifier with different canonical content or operation type
- **THEN** it rejects the request as an identifier conflict and leaves the saved view unchanged

### Requirement: Applying a proposal requires current permission and version

The system SHALL apply a proposal only when a separate, explicit, unexpired, unrevoked, unused permission is bound to that operation, view, and expected version, and the expected version is still current.

#### Scenario: Apply with a current permission and version
- **WHEN** the operator explicitly applies a proposal with its valid scoped permission and the saved view remains at the expected version
- **THEN** the system atomically changes the filters, increments the version once, consumes the permission, and records the result

#### Scenario: Reject apply without current permission
- **WHEN** the operator attempts to apply without a permission, or with an expired, revoked, consumed, or differently scoped permission
- **THEN** the system rejects the apply and leaves the saved view and version unchanged

#### Scenario: Reject a stale proposal
- **WHEN** the saved view version differs from the proposal's expected version at apply time
- **THEN** the system rejects the apply as stale and leaves the saved view unchanged

### Requirement: Recovery is a new authorized compensating operation

The system SHALL preserve local before-and-after snapshots and recover a prior filter state only through a new operation guarded by current permission and version.

#### Scenario: Preview and apply recovery
- **WHEN** an operator requests recovery to a retained prior snapshot and explicitly applies that recovery with valid permission at the current version
- **THEN** the system shows the compensating change, restores the selected filters, increments the version once, and appends a recovery result without rewriting prior history

#### Scenario: Reject stale or unauthorized recovery
- **WHEN** recovery permission is invalid or the current version differs from the recovery operation's expected version
- **THEN** the system rejects recovery and leaves the current view and operation history unchanged
