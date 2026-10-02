## ADDED Requirements

### Requirement: Positive count validation
The validator SHALL accept only positive integer counts.

#### Scenario: Accept a positive integer
- **WHEN** the caller supplies the integer 3
- **THEN** the validator returns true

#### Scenario: Reject zero
- **WHEN** the caller supplies 0
- **THEN** the validator returns false
