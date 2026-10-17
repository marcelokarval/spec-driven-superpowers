# C10 native-harness preparation (not executed by the implementer)

Use the copied kit at `/tmp/opencode/asds-passive-c10`. Inputs are examples, NOT
real provenance, reviewer results, grants or runtime qualification. No inference
is performed by these commands. ROOT must supply the real C/F/Q identities,
observed messages/results, authorizations and semantic review.

1. Edit `csv-own-orders.spec.json`: actual author actor/session, authorized absolute
   destination, persistenceGranted and authorization from the human grant. Review
   every C01–C16 layer assessment; the fixture descriptions are not runtime evidence.
   Set the observer inputs only after actual harness readback. Do not run future tests.
2. From the source checkout (SOURCE is its absolute path):

```sh
node "$SOURCE/scripts/build-package.mjs" --change /tmp/opencode/asds-passive-c10/package --spec /tmp/opencode/asds-passive-c10/csv-own-orders.spec.json --candidate
node "$SOURCE/scripts/planning-review.mjs" inspect --change /tmp/opencode/asds-passive-c10/package --output /tmp/opencode/asds-passive-c10/binding-before-F.json
node "$SOURCE/scripts/validate.mjs" --help
```

`build-package` runs structural candidate validation. Review the actual package and
binding, then ROOT dispatches native read-only fidelity using its own harness tool.
Supply the original request, refusals, package path, binding and assignment scope.
Save the actual observed terminal response to `package/evidence/fidelity.txt`.
Do not use a generated string as a native response. Copy `observed.example.json`
to `F.observed.json` and fill all placeholders from this dispatch/readback.

```sh
node /tmp/opencode/asds-passive-c10/seal-observed.mjs "$SOURCE" /tmp/opencode/asds-passive-c10/package /tmp/opencode/asds-passive-c10/F.observed.json /tmp/opencode/asds-passive-c10/F.json
node "$SOURCE/scripts/planning-review.mjs" record --change /tmp/opencode/asds-passive-c10/package --input /tmp/opencode/asds-passive-c10/F.json
```

Read the registered fidelity and require PASS before dispatching quality in a new
native session. Supply its exact envelopeDigest to quality. Save observed Q result
to `package/evidence/quality.txt`; fill `Q.observed.json` independently, including
the exact priorReviewDigest, real assignment and messages. Same agent role allowed;
session and actor instances distinct. A coordinator parent is legitimate.

```sh
node /tmp/opencode/asds-passive-c10/seal-observed.mjs "$SOURCE" /tmp/opencode/asds-passive-c10/package /tmp/opencode/asds-passive-c10/Q.observed.json /tmp/opencode/asds-passive-c10/Q.json
node "$SOURCE/scripts/planning-review.mjs" record --change /tmp/opencode/asds-passive-c10/package --input /tmp/opencode/asds-passive-c10/Q.json
node "$SOURCE/scripts/planning-review.mjs" ready --change /tmp/opencode/asds-passive-c10/package
node "$SOURCE/scripts/planning-review.mjs" inspect --change /tmp/opencode/asds-passive-c10/package --output /tmp/opencode/asds-passive-c10/ready-binding.json
```

Use the actual `manifestSha256` from ready-binding.json as HASH and actual readback
coordinator session as C. Each command below is a fresh Node process:

```sh
node "$SOURCE/scripts/planning-review.mjs" publish --change /tmp/opencode/asds-passive-c10/package --observer "$C" --expected-manifest-sha256 "$HASH" --output /tmp/opencode/asds-passive-c10/persistence-receipt.json
node "$SOURCE/scripts/planning-review.mjs" verify --receipt /tmp/opencode/asds-passive-c10/persistence-receipt.json
```

For planning return call `createPlanningReturn(acceptedWork,{status:'delivered',
outcome:'Reviewed CSV own-orders planning',revision:'r1',manifest:'planning-manifest.json',
evidence:[actualReceiptReference],remainingPlanningWork:[],limitations:actualLimitations,
persistenceReceipt,originalRequest:{product:'implementation',status:'not_fulfilled'}})`.
`acceptedWork=acceptWork(receiveHandoff(originalSevenKeyContext))`; preserve the actual
original seven keys and grants, not a fictional implementation authorization.

Optional handoff is deterministic, NOT a consumer run. With separate real selection
and execution/evidence grants, use `inspectExecutionPackage(packageRoot)` to derive
the binding, then the existing `scripts/create-execution-handoff.mjs --input FILE
--output FILE`. FILE must follow `lib/execution-handoff.mjs` closed INPUT_FIELDS:
packageRoot, requestContext (requestId/objective/source/binding/project), author
(actor/adapter/source/observedAt), selection (consumer/selected/source/observedAt/binding),
grants (execution with projectRoot/binding; evidence-persistence with journal/evidence;
validFrom/validUntil/source), destination, actual workspace observation and
coordinatorBoundary, now. ROOT must not fabricate an enforced boundary. If no real
execution grant/boundary exists, stop after planning return: no valid execution handoff
can be claimed. Synthetic envelope conformance is tested separately, not operational.

Material correction -> new revision, recompile, fresh F then Q. Evidence tamper,
incomplete IDs, material findings, coverage limitations or forced delivered must fail.
Plane is optional project-neutral export; no Plane project/issue is created.
