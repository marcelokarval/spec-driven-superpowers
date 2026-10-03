---
{
  "id": "002",
  "nodeType": "task",
  "kind": "implementation",
  "openDecisions": [],
  "dependsOn": [
    "001"
  ],
  "write": [
    "skills/spec-driven-superpowers/SKILL.md",
    "skills/spec-driven-superpowers/references/planning.md",
    "skills/spec-driven-superpowers/references/orchestration.md",
    "skills/spec-driven-superpowers/references/contracts.md",
    "skills/spec-driven-superpowers/references/operational-continuity.md",
    "schemas/superpowers-bridge/schema.yaml",
    "schemas/superpowers-bridge/templates/tasks.md",
    "schemas/superpowers-bridge/templates/task-template.md",
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
  ],
  "parentId": "P01",
  "orchestration": {
    "complexity": "medium",
    "uncertainty": "bounded",
    "risk": "medium",
    "rationale": "bounded framework contract evolution",
    "skills": [
      "spec-driven-superpowers",
      "requesting-code-review"
    ],
    "references": [
      "design.md"
    ],
    "claims": []
  },
  "boundary": {
    "change": "Align workflow and templates",
    "target": "skills/spec-driven-superpowers/SKILL.md",
    "exclusions": [
      "CRM, trackers, external publication and new runtimes"
    ],
    "review": {
      "verdict": "ready",
      "source": "coordinator inspected existing framework and approved user scope"
    }
  }
}
---
# Align workflow and templates

## Outcome
Align workflow and templates within the listed surfaces.

## Inputs
Approved user request and design.md; integrated prerequisites listed above.

## Acceptance
Preserve scope and identities, reject broad package dispatch, enforce coverage and integrated acceptance; no automatic new approval for same-scope refinement.

## Verification
Run the listed checks and inspect the negative cases and independent review.

## Definition of done
Scoped source changes reviewed; checks passed; integration evidence and limitations recorded.
