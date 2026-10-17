# CSV own-orders — synthetic planning only

## Encomenda and source

The original requested product is PLANNING, status in_progress. Source is the bound
original-request.md, containing the current human C10 authorization. ASDS contributes
only four reviewed future contracts and their DAG; no CSV implementation is supplied.
All src/, tests/ and docs/ write paths in the contracts are relative to a SYNTHETIC
FUTURE implementation target, NOT this ASDS source checkout and NOT an inspected app.
No implementation grant, workspace baseline, enforced host boundary or production
readiness is inferred. Future execution must inspect target APIs and obtain separate
scope/grants; incompatibility with these interfaces returns to Stage-2 rather than
silently changing ownership/authentication rules or broadening write scope.

## Requirements and scenario routing

| Requirement | Positive and negative scenarios | Tasks |
|---|---|---|
| R-OWNERSHIP existing authenticated principal, own rows only | S-OWN A/B each receives own rows; S-FOREIGN ownerId/userId override rejected before read; S-UNAUTH missing principal denied with no data read | 0001,0002,0004 |
| R-CSV exact allowed columns, UTF-8, escaping/formula defense | S-CSV comma/quote/CR/LF cells and formula-leading values; S-EMPTY header-only result; S-MINIMIZE no extra PII fields | 0001,0002,0004 |
| R-UI authenticated download and accessible states | S-UI idle/loading/disabled duplicate/success/empty; S-ERROR denied/network/internal error does not download and restores controls | 0001,0003,0004 |
| R-PRESERVE no order writes/auth redesign/install | S-NOMUTATE fixture state unchanged; existing list invocation unaffected; errors omit row data | all |

## Exclusions and boundedness

No administrator/bulk/cross-user export, arbitrary owner selection, credentials,
customer email/address, payment details, order mutations, authentication redesign,
dependencies, live endpoints, repository migration, or implementing the CSV feature
in this phase. Synthetic order IDs/timestamps and amounts are not actual user data.
There is no Plane project or issue applicable to this local fixture.

## Author decomposition assessment, not independent review

Four leaves are separate outcomes: freeze interoperable contract/test fixtures (0001),
backend handler/serializer (0002), UI controller against the fixed mock interface
(0003), then integrated ownership/regression acceptance (0004). Flat leaves suffice;
no artificial package hierarchy. Wave 1: 0001. Wave 2: 0002 and 0003 can run in parallel
using I-EXPORT-1 mocks; disjoint writes, common inputs read-only. Wave 3: 0004 depends
on both. Integration does not authorize editing prior leaves outside task 0004 scope.

## Current delivery state

Author preparation only, reviewing. Boundary verdicts are the named author's explicit
pre-review assessment of boundedness, NOT native F/Q. C12/C13/C14/C15/C16 are pending.
The harness must review semantics, persist actual F/Q evidence and update observed
layer assessments before ready; readback/publication are separate gates. No product
verification commands in the contracts have been executed. [x] would later be
consumer progress, never planning certification of implementation.

Scenario IDs in contracts are namespace-qualified as csv-export/S-... by the bound specification. This is a planning artifact, not OpenSpec initialization or activation.
