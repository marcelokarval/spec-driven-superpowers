---
{
  "id": "P01",
  "nodeType": "package",
  "kind": "implementation",
  "openDecisions": [],
  "dependsOn": [],
  "write": [
    "lib/decomposition.mjs",
    "lib/contracts.mjs",
    "lib/orchestration.mjs",
    "lib/validation.mjs",
    "scripts/orchestrate.mjs",
    "skills/spec-driven-superpowers/SKILL.md",
    "skills/spec-driven-superpowers/references/planning.md",
    "skills/spec-driven-superpowers/references/orchestration.md",
    "skills/spec-driven-superpowers/references/contracts.md",
    "skills/spec-driven-superpowers/references/operational-continuity.md",
    "schemas/superpowers-bridge/schema.yaml",
    "schemas/superpowers-bridge/templates/tasks.md",
    "schemas/superpowers-bridge/templates/task-template.md",
    "tests/decomposition.test.js",
    "tests/decomposition-sources.test.js",
    "skills/spec-driven-superpowers/evals/evals.json",
    "CHANGELOG.md"
  ],
  "resources": [],
  "scenarios": [
    "task-decomposition/Bounded dispatch",
    "task-decomposition/Scope preserving refinement",
    "task-decomposition/Integrated package acceptance",
    "task-decomposition/Portable source continuity"
  ],
  "verification": [
    "npm test",
    "npm run check",
    "npm run validate"
  ]
}
---
# Adaptive decomposition

## Outcome
Adaptive decomposition within the listed surfaces.

## Inputs
Approved user request and design.md; integrated prerequisites listed above.

## Acceptance
Preserve scope and identities, reject broad package dispatch, enforce coverage and integrated acceptance; no automatic new approval for same-scope refinement.

## Verification
Run the listed checks and inspect the negative cases and independent review.

## Definition of done
Scoped source changes reviewed; checks passed; integration evidence and limitations recorded.
