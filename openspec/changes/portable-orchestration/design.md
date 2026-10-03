# Design

## Decisions and authority
The user authorized implementation of the complete first phase and expansion of the recommendation into two phases. This does not select or authorize installation of a third-party dashboard. Existing project OpenSpec is reused.

One canonical graph comes from microcontracts. Stable numbered IDs identify work; edges determine order. Split preparation and integration into separately testable contracts instead of ambiguous start/finish arrows. Dependencies release only on root acceptance of revision-bound integrated evidence.

Orchestration protocol version 1 is opt-in and distinct from the unchanged Accelerate protocol. Classify complexity, uncertainty and risk separately with rationale; select the maximum tier. Role models/efforts are profile data. Host capabilities and actual authority remain external inputs; no silent model fallback.

Persist a replayable event journal owned by one coordinator. Every command compares an expected sequence. Restart replays validations; active workers retain leases until an explicit stopped confirmation. The library does not authenticate reports or execute command strings. File persistence is a single-writer CLI with exclusive lock and atomic rename, not a distributed database.

A fresh reviewer receives a bounded packet with contract, immutable candidate identity, references and skills. The first review has no executor narrative; the coordinator can disclose evidence after independent findings. Distinct session identities and context provenance are recorded, not treated as cryptographic proof. Integrated review must be independent of the executor and bound to the integrated snapshot.

Phase 2 adapters submit proposals, never bypass core transitions. Trackers and UIs are optional projections. No remote Done event releases dependencies. Plugins declare capabilities/version and cannot grant permissions. Details and comparative evidence live in the phase-2 architecture reference, not another task plan.

## Verification
Behavioral tests cover causal waves, stale plans/candidates/events, classification, resource conflicts including review, failed/cancelled workers, recovery and root acceptance. Existing full suite and real OpenSpec validation guard compatibility. Independent source review precedes closure. Live harness execution, provider identity and remote tracker behavior remain separate qualification boundaries.
