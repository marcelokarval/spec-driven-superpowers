# Planning consumer boundary

ASDS delivers planning. It does not dispatch, implement, integrate or close the
software described by its future-work contracts.

A later consumer may be a direct engineering workflow, Superpowers SDD, the legacy
ASDS orchestration toolkit or another explicitly selected mechanism. Selection and
authorization belong to the caller. The consumer receives the immutable planning
revision and maintains execution progress separately. It must not reinterpret
planning `delivered` as implemented software.

The consumer may return a concrete planning defect with affected requirements and
tasks. ASDS revises only the affected planning scope, invalidates stale reviews and
readback, and returns a successor revision. Runtime failures, code defects and test
results remain consumer-owned unless they expose an actual contract defect.

Legacy modules `orchestration.mjs`, `host-bridge.mjs`, `git-scope.mjs` and related
receipts are optional consumer utilities. Their presence in this self-contained
repository is compatibility, not activation by the ASDS entry skill.
