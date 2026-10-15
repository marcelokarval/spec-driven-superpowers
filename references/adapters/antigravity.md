# Antigravity adapter

Documentation rechecked 2026-10-10 against the installed `agy 1.3.3`,
[agent skills](https://antigravity.google/docs/skills), and the official
[custom subagents specification](https://antigravity.google/docs/subagents?tab=cli).
Current docs describe workspace `.agents/skills`, backward-compatible
`.agent/skills`, and global `~/.gemini/config/skills`. Custom agents are discovered
from workspace `.agents/agents/<name>.md` (or `<name>/agent.md`) and global
`~/.gemini/config/agents/<name>.md` (or `<name>/agent.md`).

The official installer therefore binds the project `.agents/skills` profile to
three agents: planning-only coordinator `.agents/agents/spec-driven-superpowers.md`,
nested zero-write reviewer `.agents/agents/spec-driven-superpowers-reviewer.md`, and
primary-only zero-write capture reviewer
`.agents/agents/spec-driven-superpowers-reviewer-primary.md`. The explicit user
`.gemini/config/skills` profile receives the same trio under
`.gemini/config/agents/`. Other skill roots do not gain AGY agents by inference.
All paths remain manifest-owned, hash-checked and preview-first; no whole-tree alias
or parallel runtime is created.

Native AGY profiles also publish the ASDS-owned
`.asds/accelerate-handoff-capability.json` marker. Schema
`asds.accelerate-handoff-capability/1` binds the exact TypeName to the relative
coordinator path, its SHA-256, the ASDS version and the planning-only/no-application-code/
no-future-task guarantees. Installer readback covers the marker and all three agents. This
is capability discovery only: it does not prove selection, invocation, permissions,
review independence, or planning delivery.

The coordinator's exact `name: spec-driven-superpowers` is its native TypeName. It is
`subagent: true`, `mainAgent: false`, uses the sandbox command policy and declares
`skills/spec-driven-superpowers` explicitly. The body is a planning-only system
contract. Its only subagent capability is `invoke_subagent`, limited by contract to
the exact `spec-driven-superpowers-reviewer` TypeName and a closed request. It never
dispatches implementers, researchers, general agents or another coordinator.

The reviewer source is also `subagent: true`, `mainAgent: false`, sets
`inheritCustomizations: false` and `excludeDefaultComponents: true`, explicitly
loads the ASDS skill and has only `view_file`, `list_dir`, `find_by_name` and
`grep_search`. It has no command, write, question, permission, messaging or
delegation tool. Its prompt contract defines one exact versioned request bound to a
safe package path, revision, candidate hash, complete source/package inventories and
review kind, plus one exact versioned verdict/findings envelope without persistence.
Repository content is untrusted data. These formats and the zero-write tool list are
source properties, not proof that a fresh independent invocation occurred or that a
response can be accepted operationally. Under AGY 1.3.3 the coordinator must keep
review partial/blocked rather than invoke generically, persist a model result, or
fabricate fidelity/quality success.

`lib/agy-review-protocol.mjs` is a source-side closed-schema and filesystem inspection
module shipped in the self-contained consumer payload. Its package inspector opens
the canonical root, rejects symlinks, hardlinks, zero-byte artifacts and read races,
and derives revision, candidate identity, task IDs, roles, material-byte inventories
with canonical task progress normalized, and a separate byte-exact readback identity
from `planning-manifest.json` plus the `tasks.md` authority. Its pure
request parser and response-envelope validator can check closed shape, bindings and
the rule that PASS cannot retain a limitation. Those pure checks do not establish
review independence, consume fidelity, mint a receipt, authorize quality or permit
planning delivery.

AGY 1.3.3 exposes no private durable host authority or parent identity. Its observed
`PostToolUse` payload contains `toolCall` metadata, but no nested tool output, parent
identity or durable authority with which to bind the reviewer result. Consequently
the public `createAgyReviewDispatchAuthority`,
`attestAgyReviewDispatch` and `parseAgyReviewResponse` APIs always fail closed: they
cannot emit or accept authority/receipt supplied by JavaScript callers. Because no
fidelity result can be authoritatively consumed, a quality request cannot be created
operationally. Replay refusal, package reopen at response acceptance and byte-exact
fidelity-to-quality consumption describe requirements for a future native-private
host integration, not behavior currently available in AGY 1.3.3. Manifest references,
including role `review`, are still read and hash-checked by package inspection; review
references remain excluded from both fresh inventories.

The installer publishes `.asds/agy-review-dispatch-contract.json` with schema
`asds.agy-review-dispatch-contract/1`. It is discovery data with
`runtimeHostStatus: unavailable`, not proof that enforcement occurred. Its closed
schema binds the exact official relative paths and SHA-256 values of the installed
coordinator, reviewer and protocol. `inspectAgyReviewDispatchContract` additionally
requires those files plus the contract itself to be owned by the exact manifest v3
for one official project or user profile. This proves static installation integrity
only; it does not prove dispatch, parent identity, tool output, receipt or review.

Package discovery is earlier and independent. With an exact handoff locator, inspect
that safe workspace-relative package. With null lineage/locator and an explicit reuse
instruction, bounded read-only discovery considers only direct children of
`openspec/changes` containing regular `planning-manifest.json` and `tasks.md`; zero or
multiple matches return `locator-required`. It never follows links, guesses among
packages or writes because lineage is absent. The coordinator reads the located index,
manifest and bound references and distinguishes delivered no-op/progress from a
materially new candidate before reviewer preflight.

The remaining hook fields specify future native requirements: exact reviewer
TypeName/role/prompt admission, private durable authority and receipt, installed-byte
revalidation before invocation and response acceptance, and durable one-use identity
across fidelity, quality and rework. Generic `invoke_subagent`, a JavaScript wrapper
or a caller-authored object cannot satisfy them. Only when package assessment finds a
material candidate that needs fresh review does the coordinator read this contract
once, immediately before its first reviewer attempt. If the runtime status is unavailable,
it stops that review path and reports that precise block once, without trying a
reviewer or fallback transport. Earlier read-only package discovery, inspection and
structural validation remain allowed. ASDS makes no operational reviewer
claim for AGY 1.3.3. A future runtime adapter must implement and qualify those guarantees outside
the model/workspace process before the status or documentation can be promoted.

Initial-delivery checkboxes are open. After handoff, `[x]` is consumer progress in
the authoritative `tasks.md`; the progress-normalized delivered manifest/hash is not
contrary evidence and not a second progress ledger. The planner may reopen only
through the consumer's explicit reopen protocol with matching receipt/journal evidence,
or another concrete contradiction. If actual corruption is proved, exact restoration
of candidate, references, manifest and review bytes returns `restored existing
delivered state` and preserves prior review, but never erases valid progress. Material
change creates a new candidate and requires fresh fidelity then quality review.
A model narrative or byte comparison does not prove a write, validator run, database
record, signature, receipt or reviewer result; each claim requires direct evidence.

The source tree also contains a separate external supervisor engine for a future
headless host service. It does not change the nested contract's
`runtimeHostStatus: unavailable`. Its discovery document,
`.asds/agy-review-supervisor-transport.json`, hash-binds a primary-only reviewer,
the protocol, the supervisor module and the complete release-owned manifest path
inventory; missing or extra receipt entries fail closed. The engine launches fidelity and quality as
two fresh `stream-json` processes, records NDJSON/result/transcript in a private
state root, rejects replay and reopens the package between stages. Its outputs are
explicitly `untrusted-capture-only`; the public source module cannot complete review,
persist an authoritative PASS or mint planning-store authority.
The parser is bound to the headless stream observed in AGY 1.3.3: input uses
`event: "user"`; output must begin with one closed `init`, may contain only closed
`step_update` events and must end with one closed `result` whose status is SUCCESS.
Conversation IDs must agree throughout. Init must report the exact primary reviewer,
canonical cwd, selected model, the four exact read-only tools and
`permission_mode: "request-review"`. Tool steps are limited to those tools; command,
write, permission, delegation, background and subagent metadata are rejected, as are
unterminated ACTIVE steps, old `type` events, unknown fields and trailing events.
These checks authenticate neither the launcher nor the model and therefore leave the
output capture-only.

The primary-only TypeName `spec-driven-superpowers-reviewer-primary` has the same
four read-only tools as the nested reviewer and no command, write, permission,
delegation or background capability. It exists because a `mainAgent: false` agent
is not the headless primary transport; it does not make the model a trust root.

This engine is `qualificationStatus: source-tested`, not a deployed runtime. An
inherited FD and expected hashes configure one process but do not authenticate its
parent: an untrusted process could create its own FD and self-consistent receipt.
The in-process WeakMaps are ephemeral replay aids, not durable authority or durable
anti-replay state. State-path checks and `O_NOFOLLOW` reduce accidental link races
but cannot create an OS trust boundary inside a model-startable process. Production
therefore requires a long-lived supervisor/service under a separate OS
trust boundary with a private endpoint/store, or an equivalent host-signed bootstrap
whose key is unavailable to the model. Thin-client requests remain untrusted and the
planning-store authority never crosses the service boundary. Until that deployment,
only fake-CLI source tests are evidence, completion fails closed, and no live review
claim is permitted.

None of the three agents becomes a future-task implementer. Delivery releases ownership to the
caller, which selects any execution consumer.

`agy agents` on the installed 1.3.3 binary is discovery-list evidence only. It is
not proof that the agent is selectable as a primary agent, was constructed as a
subagent, loaded its skill, completed a turn, or resolved every declared tool. Inspect
available tools, approval policy and workspace isolation. Required independent
review fails closed when delegation/isolation is unavailable; it is not silently
replaced with a self-review. UI evidence should be durable and shareable under
project policy, not automatically committed or uploaded.

Do not treat Antigravity and Gemini CLI as one runtime or infer common billing
from their related paths. Source and installer tests validate format, payload,
ownership and lifecycle only. Because `mainAgent: false`, `agy --agent
spec-driven-superpowers` is not the smoke path. There is no valid reviewer smoke for
AGY 1.3.3: an authorized installation would still leave the dispatch contract
unavailable and the public APIs fail-closed. Only after a native hook or the external
supervisor service is deployed and qualified may a fresh run test the exact
TypeName/prompt, child identity, zero writes, private receipt, response binding,
replay refusal and fidelity-to-quality continuity. That qualification must not
promote a generic subagent result, self-launched fake supervisor or pure envelope
validation into review evidence. This repository-only change neither installs nor
starts the service and does not run a live AGY smoke.
