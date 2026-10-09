---
{
  "id": "001",
  "nodeType": "task",
  "kind": "implementation",
  "openDecisions": [],
  "dependsOn": [],
  "write": [
    "lib/decomposition.mjs",
    "lib/contracts.mjs",
    "lib/orchestration.mjs",
    "lib/validation.mjs",
    "scripts/orchestrate.mjs"
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
    "change": "Implement contract and lifecycle",
    "target": "lib/decomposition.mjs",
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
# Implement contract and lifecycle

## Outcome
Implement contract and lifecycle within the listed surfaces.

## Inputs
Approved user request and design.md; integrated prerequisites listed above.

## Acceptance
Preserve scope and identities, reject broad package dispatch, enforce coverage and integrated acceptance; no automatic new approval for same-scope refinement.

## Verification
Run the listed checks and inspect the negative cases and independent review.

## Definition of done
Scoped source changes reviewed; checks passed; integration evidence and limitations recorded.
