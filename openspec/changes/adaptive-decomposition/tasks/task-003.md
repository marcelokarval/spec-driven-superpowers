---
{
  "id": "003",
  "nodeType": "task",
  "kind": "implementation",
  "openDecisions": [],
  "dependsOn": [
    "001",
    "002"
  ],
  "write": [
    "tests/decomposition.test.js",
    "tests/decomposition-sources.test.js",
    "skills/spec-driven-superpowers/evals/evals.json"
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
    "change": "Prove CLI and regression boundaries",
    "target": "tests/decomposition.test.js",
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
# Prove CLI and regression boundaries

## Outcome
Prove CLI and regression boundaries within the listed surfaces.

## Inputs
Approved user request and design.md; integrated prerequisites listed above.

## Acceptance
Preserve scope and identities, reject broad package dispatch, enforce coverage and integrated acceptance; no automatic new approval for same-scope refinement.

## Verification
Run the listed checks and inspect the negative cases and independent review.

## Definition of done
Scoped source changes reviewed; checks passed; integration evidence and limitations recorded.
