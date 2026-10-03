# Portable orchestration and optional integrations

## Why
ASDS validates task graphs and receipts but the coordinator must manually project ready waves, select pairs, track resource ownership and reconstruct interrupted work. Repeating those decisions per project loses dependency and evidence semantics.

## What Changes
Phase 1 implements a versioned, provider-independent orchestration core: canonical DAG, justified classification and configurable role profiles, ready-wave calculation, clean review packets, resource reservations, finite forensic decisions and replayable state. Existing handoff and delivery contracts remain compatible.
Phase 2 defines optional tracker and visual integration contracts and evaluates the two user-supplied OpenSpec UIs. No tracker, server, fork or alternate installation is created in this change.

## Impact
Additive toolkit library/CLI, skill references and tests. Existing installation layout, schema and Accelerate v1 input remain unchanged. Installed skills alone do not install a runtime or automatically spawn agents.
