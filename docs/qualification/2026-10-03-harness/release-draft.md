# ASDS 1.2.0 — portable coordination and operational continuity

The prior workflow could stop after one task, globally reject a valid graph containing future unresolved work, or lose received approvals. This candidate adds partial readiness, operation-scoped blockers, explicit continuation/pause, source-bound existing-plan intake and revision-bound approval evidence. A host bridge reserves work before release and rejects stale, paused or cancelled assignments.

Validation: local Node suite and syntax/package checks; independent source reviews corrected reproduced races; real Accelerate v1 producer/consumer compatibility; bounded natural-entry Codex/Agy CLI cases with actual file effects and status/resumption evidence.

Qualification limits: Agy risk analysis reopened a settled zero-boundary rule, including after a documentation clarification; that gate is partial. No general provider, scheduler, cross-process or natural-entry guarantee is made. POSIX binary fixtures are skipped on Windows while actual Node discovery is covered by a portable test; remote CI has not been run for this candidate.

Existing owned Codex/Agy skill installations were updated without a new runtime, backup or auth configuration change. Optional tracker/dashboard integrations remain phase 2. This is a local release draft; publication is a separate action.
