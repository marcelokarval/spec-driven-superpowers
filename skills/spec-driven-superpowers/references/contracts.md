# Task and delivery contracts

`tasks.md` is the sole completion index. Contracts hold scope/dependencies, not a
second progress state. Link format:

```markdown
- [ ] [Task 0001](tasks/task-0001.md): Accept valid input
```

Each linked Markdown file starts with real YAML frontmatter:

```yaml
---
id: "0001"
kind: implementation
openDecisions: []
dependsOn: []
write: [src/input.js, tests/input.test.js]
resources: []
scenarios: [input/Accept valid input]
verification: [npm test]
---
```

Use string IDs, exact repository-relative POSIX file paths (including tests), no
globs/traversal/absolute paths, and explicit shared resource names such as
`db:integration` or `port:3000`. Empty `write` permits read-only verification tasks.
Quote IDs with leading zeros. Cycles, missing dependencies and duplicate IDs are
invalid. The filename must match the ID. Keep all contracts linked from the index.

Scenario IDs are `<capability>/<exact Scenario heading>`, from
`specs/<capability>/spec.md`. Names must be unique within a capability. All
scenarios must be assigned and all assigned scenarios must exist. Use required body sections
Outcome, Inputs, Acceptance, Verification and Definition of done. Include concrete
assertions and TDD steps for behavioral implementation. Declare openDecisions: []
only after material choices blocking this task are resolved. See [readiness](planning.md).
Verification commands are data for validation; the validator never executes them.

## Validation from the ASDS toolkit checkout

```bash
npm run validate
npm run validate -- --change /absolute/project/openspec/changes/example
```

The toolkit CLI and dependencies stay in its checkout; installation deploys skills
and schema, not another copy of the Node toolchain. OpenSpec validation remains a
separate check using the pinned CLI. A checked box alone is not verified evidence.

## Delivery receipt

```json
{
  "status": "reviewed",
  "contractRevision": "<hash returned by loadTasks for accepted planning>",
  "baseRevision": "<approved base SHA>",
  "revision": "<HEAD SHA or HEAD+worktree:sha256>",
  "changedFiles": ["src/input.js", "tests/input.test.js"],
  "evidence": [{"command": "npm test", "exitCode": 0, "revision": "<same revision>"}],
  "reviews": {"spec": "<same revision>", "quality": "<same revision>", "independent": true}
}
```

For `integrated`, also supply `integrationRevision`, `integrationEvidence` (command,
exitCode, revision) and `integrationReviews` (spec, quality, independent) bound to
that combined revision. Review the integrated result, not only each earlier branch. `delivered` does not claim independent review.
Save the receipt outside the inspected tree, then validate with an independently
approved base (do not trust a base chosen by the worker to hide its changes):

```bash
npm run validate -- --change /project/openspec/changes/example \
  --delivery /evidence/receipt.json --task 0001 --repo /project --base APPROVED_SHA
```

`collectGitScope(repo, baseRevision)` in `lib/git-scope.mjs` returns baseRevision,
revision and changedFiles. It includes both sides of renames and dirty files.
Use a quiescent repository root: the collector is not an atomic snapshot.
Ignored untracked files are not audited. Symlinks are hashed, not followed.
Git filters are disabled to avoid running repository-configured programs; projects
using clean filters may therefore see conservative dirty results.
These checks validate consistency and scope, not the authenticity of supplied
test logs or reviewer identities. Humans/harnesses still verify that evidence.


## Completion and migration
Current change validation requires readiness sections, openDecisions and proposal/design
context. Legacy contracts may still be read with parseFrontmatter/validateTasks for
structural inspection, but must be explicitly enriched and reviewed before execution;
do not label an old shape ready or silently rewrite archived changes.

`loadTasks` returns body and contractRevision in addition to frontmatter. Use its
identity in receipts. The coordinator must compare it with the accepted planning
revision before dispatch/checkoff; the hash is not an approval signature.

For checked tasks pass an external JSON map `{ "0001": <integrated receipt> }`:

```bash
npm run validate -- --change /project/openspec/changes/example --receipts /evidence/receipts.json
```

This reconciles historical completion receipts with current contracts and their
dependencies. It is structural validation of recorded evidence, not live Git proof.
The --delivery/--repo/--base mode verifies scoped delivery D against actual Git.
By default it inspects the current working tree. Use --delivery-revision COMMIT for
an explicitly selected historical committed delivery in the same repository; that
mode deliberately excludes current dirty state and cannot reconstruct a lost dirty
snapshot. Preserve uncommitted deliveries in their original authorized workspace.

Integrated receipts keep D and I distinct. Supply --integration-base APPROVED_SHA
and --integration-scope /evidence/approved-paths.json (an exact array of combined
changed paths supplied by the coordinator, not trusted from the worker receipt).
Optionally --integration-repo selects a different existing integration workspace;
otherwise the delivery repo is used. The integration check inspects its current
working tree, verifies I and the combined scope without widening the task's D scope.
Integration evidence/reviews must reference I. No workspace is created by validation.

```bash
npm run validate -- --change /project/openspec/changes/example \
  --delivery /evidence/receipt.json --task 0001 --repo /project --base TASK_BASE \
  --delivery-revision DELIVERED_COMMIT --integration-base INTEGRATION_BASE \
  --integration-scope /evidence/approved-paths.json
```

Writing tasks.md after verification changes a repository-wide dirty fingerprint.
Keep the receipt's tested revision as historical evidence; do not rewrite it to
claim that an untested bookkeeping edit was tested. Reconcile checkoff from that
receipt, then run final change-level verification on the combined state as needed.

## Packages and executable boundaries
New contracts use nodeType: task with boundary.change, boundary.target,
boundary.exclusions and boundary.review {verdict: ready, source: coordinator evidence}.
The coordinator assesses semantics; nonempty fields alone cannot establish granularity.
A nodeType: package uses the same contract file/index, preserving its approved scope,
scenarios and verification. Children use parentId; no nested packages. All package
scenarios need child coverage and all child scenarios/paths/resources stay in the
package scope. Child prerequisites include the parent's prerequisites. Packages do
not need worker model metadata. Keep normal readiness body sections on both kinds.
Checked packages require an integrated receipt and checked children. CLI journal
acceptance additionally verifies the complete child state. Independent reviews and
integrated checks are necessary even when all children passed. Legacy contracts
retain their existing shape; opting into the new protocol requires semantic review.
