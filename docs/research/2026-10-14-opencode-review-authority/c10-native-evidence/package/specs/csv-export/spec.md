# CSV own-orders synthetic specification

## ADDED Requirements

### Requirement: Ownership-scoped authenticated export
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-OWN
- **GIVEN** synthetic owners A and B and an existing trusted principal A
- **WHEN** export is requested without owner parameters
- **THEN** only A rows are read through listByOwner and serialized; repeat for B.

### Requirement: Foreign owner override is rejected
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-FOREIGN
- **GIVEN** authenticated A
- **WHEN** ownerId or userId is supplied for any owner
- **THEN** return 400 before repository access and produce no downloadable CSV. A broken adapter returning B rows also yields no CSV.

### Requirement: Existing authentication is required
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-UNAUTH
- **GIVEN** missing or invalid trusted principal
- **WHEN** export is requested
- **THEN** return 401 without reading orders or exposing CSV; no authentication system is introduced.

### Requirement: Deterministic CSV safety
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-CSV
- **GIVEN** synthetic values with commas, quotes, CR/LF, Unicode and formula-leading or space-prefixed formula characters
- **WHEN** encoding allowed columns
- **THEN** exact UTF-8 CRLF bytes match the fixed quote-all and apostrophe-prefix contract without changing input records.

### Requirement: Empty own data has a downloadable header only
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-EMPTY
- **GIVEN** a valid principal with zero own orders
- **WHEN** export completes
- **THEN** status is 200 and body is exactly the five-column header plus CRLF; UI downloads it and announces empty success.

### Requirement: Only allowed non-PII columns
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-MINIMIZE
- **GIVEN** source records with owner metadata and deliberately synthetic extra customer/payment fields
- **WHEN** exporting
- **THEN** output includes only order_id, created_at, status, total_minor, currency and never the extra fields or foreign records.

### Requirement: Accessible export state and duplicate suppression
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-UI
- **GIVEN** an idle controller consuming I-EXPORT-1
- **WHEN** export is activated twice during one pending request
- **THEN** a single request runs, the action is busy/disabled, status is announced and success restores controls and saves exactly once.

### Requirement: Denied and failed requests do not download
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-ERROR
- **GIVEN** 400, 401, 500, unexpected content type or rejected requestExport Promise
- **WHEN** the UI settles
- **THEN** it announces a safe denied/error status, restores controls and does not call saveDownload or expose row data.

### Requirement: Preserve orders and existing behavior
The future synthetic implementation MUST satisfy this bounded behavior without exporting foreign records or adding authentication semantics.

#### Scenario: S-NOMUTATE
- **GIVEN** frozen synthetic fixtures and a spy on the read adapter
- **WHEN** all success and failure paths run
- **THEN** fixture/order state is unchanged, no write method runs and existing listing calls retain their established arguments/results.
