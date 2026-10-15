# Execution handoff v1

`createExecutionHandoff(input)` is a caller-owned bridge from an already delivered
ASDS planning package to a later execution consumer. It does not belong to the
planning lifecycle and does not grant authority merely because planning finished.

## Creation input

The caller supplies the package root, original request context, current consumer
selection, current execution and evidence-persistence grants, authorized journal
and evidence destinations, a current workspace observation, and a current
coordinator-boundary observation. Observations and grants expire; the consumer
must observe and authorize again at init and immediately before start.

Before asking for those authorities, `inspectExecutionPackage(packageRoot)` may be
used read-only to obtain the current `packageId`, `planningRevision`,
`planningFingerprint`, `executionScope`, and persisted original-request text/source.
It does not select the consumer or grant execution. The caller must place this exact
closed binding in `requestContext.binding`, `selection.binding`, and the execution
grant's `scope.binding`:

```json
{
  "requestId": "current-request-id",
  "packageId": "current-package-id",
  "planningRevision": "current-reviewed-revision",
  "planningFingerprint": "64-lowercase-hex",
  "consumableTaskIds": ["every", "consumable", "leaf"]
}
```

All three bindings must be identical and match the reopened package. The request
context objective must also exactly match `originalRequestedProduct.text` persisted
by the planning intake. A changed objective needs a new
planning decision/package; it cannot borrow authority from an older plan. Missing
bindings, legacy authority objects, stale revisions, changed fingerprints, and
broader/narrower task sets fail explicitly. The creator never fills these fields in
after the fact, because that would turn old prose into retroactive authority.

Exactly one execution grant names the authorized project root and carries the bound
request/package identity; its realpath must equal the current workspace project
realpath. Exactly one evidence-persistence
grant names the journal and evidence paths; both must exactly match the selected
destination. Only after these bindings pass does the creator record authorization
booleans plus their authority/project/destination fingerprints.

Workspace observations bind the project realpath, workspace ID, Git root/common
directory/base revision, and a baseline inventory split into
`committedSinceBase`, `staged`, `unstaged`, and non-ignored `untracked` entries.
Each entry carries its path and observed SHA-256. This records pre-existing dirt;
it is not permission to modify those paths.

Capabilities are intentionally forbidden. Spawn, isolation, model, budget, tools,
wait and message support are volatile host observations and cannot be inferred
from a handoff.

All caller-owned objects use closed schemas: request context/project, author,
selection, grants and their scopes, destination, coordinator boundary, workspace,
repository identity and baseline entries reject unknown keys. Preserved
constraints, refusals and authorizations remain duplicate-free string arrays.
The coordinator boundary accepts exactly the journal, evidence and progress
brokers; fields such as `spawn`, `model` or nested `capabilities` are invalid.

## Derived envelope

The creator first reuses the canonical planning lifecycle/delivery validator, so
synthetic evidence, stale reviews/readback, malformed layers, stale task-manager
projection, and manifest/contract/index inventory drift fail before handoff. It
then reopens `planning-manifest.json` and all declared references without following
symlinks. It derives package/revision, manifest and reference hashes,
canonical `tasks.md`, the deterministic task-manager projection, physical
realpaths, repository/workspace identity, planning fingerprint, and baseline
fingerprint. Caller attempts to provide a derived field fail closed.

The output version is `asds.execution-handoff/1`. `validateExecutionHandoff`
requires a fresh current workspace observation, rejects unknown top-level fields,
reopens the package, and compares stored shapes/fingerprints with current facts.
It resolves the persisted request project again and requires its realpath to equal
the current workspace project realpath. It revalidates all three authority bindings
against the reopened package; an older `/1` envelope without bindings remains data
that can be inspected, but is invalid for operational execution.
Operational validation also requires an explicit current package root. The
persisted package root and current package root must both resolve to the certified
`packageRootRealpath` before manifest/reference fingerprints are recomputed; the
current argument never silently replaces a tampered persisted path.
The derived planning return also carries the package's immutable reference
inventory and explicit coverage document when present. Journal initialization
combines those derived sources with the complete closed request context, constraints,
refusals, current authority references and original requested product in an
`asds.execution-intake-snapshot/1` value plus its digest. This is verifier input,
not a new authorization source.
It reports validation only; it does not initialize a journal, dispatch a worker,
call a planner or host, execute task commands, or install anything.

For `partial`, `planningContribution.usableTasks` must resolve uniquely to a
nonempty subset of leaf IDs. The complement must have blocker or remaining-work
provenance, and no consumable leaf may depend on an excluded leaf. The envelope
keeps excluded IDs as `excluded`, preserves original remaining work, and never
rewrites the planning package. Its restricted task manager is produced by the
canonical `scopePlanningProjection()` shared with runtime projection validation;
empty waves are removed and remaining task wave numbers are compacted there.

## CLI

`node scripts/create-execution-handoff.mjs --input INPUT_JSON` prints the envelope
to stdout and writes no project file. `--output NEW_JSON` uses create-exclusive
semantics and refuses an existing path. The CLI accepts no authorization or
capability convenience flags; all caller-owned facts must be explicit in input.
