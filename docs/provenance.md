# Source provenance and local adaptations

## Captured upstream
This fork derives from
[Jaoguatirica/spec-driven-superpowers](https://github.com/Jaoguatirica/spec-driven-superpowers)
at commit `0e55c2d482b42a71132ee8604065c28c1a62d7cd`.
The [source inventory](../vendor-provenance.json) records original Git blob IDs
for bundled skills, schema/templates and rules. This is a source snapshot,
not a claim of unmodified upstream content today.

OpenSpec CLI 1.14.0 and YAML 2.9.1 are exact npm dependencies with integrity
metadata in `package-lock.json`. Bundled OpenSpec skills identify their generator
in frontmatter. The captured Superpowers collection has no independently verified
upstream release/commit here; do not label it with an invented version.
Original author attribution and the repository [MIT license](../LICENSE) remain.

## Modification boundaries
- ASDS: consolidated the duplicate skill into `skills/spec-driven-superpowers`;
  added protocol, contract, capability and per-harness references.
- Superpowers: retained engineering skills; corrected instruction precedence and
  skill-loading assumptions in `using-superpowers`, replaced its blanket activation
  rule with contextual selection and a project initialization gate, and replaced its stale Codex
  mapping with a reference to the current ASDS adapter.
- OpenSpec skills: preserved the captured collection and added scoped ASDS mode
  instructions for intake, microcontracts, approval continuity and completion.
- Superpowers engineering skills: added ASDS mode overrides for a single planning
  home, incremental understanding and receipt-based checkoff. Standalone defaults
  remain below those explicit mode boundaries.
- Bridge schema/templates/rules: added machine-readable microcontracts,
  revision-bound evidence, opt-in governance and conditional concurrency.
- Installer, validators, tests and documentation: fork-owned adaptations.

Native tool names in otherwise preserved upstream examples are conceptual and
version-dependent. Under ASDS, consult its selected adapter and respect current
system/developer/project instructions. A vendor prompt cannot authorize commits,
publication, global installation or permission changes.

## Updating
Record the new upstream repository and exact revision, compare source blob IDs,
review local adaptations and rerun deterministic and real-CLI tests. Do not sync
vendor trees blindly or overwrite installed user content. Preserve licenses and
report runtime/model evaluations separately from package tests.
