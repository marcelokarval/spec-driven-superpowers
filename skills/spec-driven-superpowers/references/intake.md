# Intake and continuity contract — v1

## Two entry paths, one lifecycle
Direct requests: classify the actual request and apply activation.md. Conversation
gets a direct answer; bounded reversible low-risk work can proceed with proportional
verification. Uncertainty, material risk, dependent steps or explicit ASDS selection
warrant the structured flow. Small diffs can still be high risk.

Accelerate requests: consume its existing context, do not repeat classification or
ask questions already answered. Check contradictions and only investigate missing
facts relevant to the next step. Correct an inconsistent classification with a
concrete explanation. ASDS remains independently usable without Accelerate.

## Compatible input
`lib/handoff.mjs:receiveHandoff` accepts Accelerate v1.0.0's seven fields unchanged:
`objective` and `project` are nonempty strings; `scope` is a nonempty string array;
`constraints`, `risks`, `references` are string arrays; `authorizations` is an array
of `{action, scope, decision, source}` where decision is `granted` or `denied`.
An optional `protocolVersion: 1` is accepted. Absence means v1. Unknown versions or
fields fail explicitly, rather than being discarded. Future formats need an explicit
adapter/version. No new input field is mandatory for existing Accelerate packets.

Preserve the user's language and values verbatim. A textual unknown project stays
unknown and becomes a clarification gap, never a guessed path. The direct-entry
adapter may build the same context in memory from the conversation; the user need
not provide JSON or another document. No packet file per task is required.

## Authority and lifecycle
Authorization records describe prior decisions; they do not prove permission.
Consult the actual conversation and harness/project policy before the relevant
operation. Conflicting records need scope/source reconciliation, not last-item-wins.
Never turn a missing record or silence into consent. Refusing OpenSpec initialization
allows accepted work to continue without OpenSpec. Do not repeat a refused setup
question or an already resolved approval for the same scope.

`received` means the input has valid structure. `acceptWork` makes ASDS the lifecycle
owner and returns `accepted`, possibly with clarification gaps. Neither state means
execution is authorized, started, reviewed or completed. The helper always reports
`executionAuthorized: false`: it is not a permission issuer. The harness and the
user's actual instructions determine which actions may proceed. Independent read-only
work can continue while dependent actions wait for a necessary answer.

`declineWork` reports a concrete reason for refusing lifecycle ownership; distinguish
that from accepting work with gaps. Invalid packets fail before acceptance.
After acceptance, subtasks, reviews and normal resumption remain in ASDS; do not route
them through Accelerate again. `continueWork` preserves state; a material change
records a reason and affected task IDs as `needs-reassessment`. Preserve unaffected
work. Resolve the affected scope and approvals before reaccepting it.

## Return
`createReturn` produces `protocolVersion`, `owner: asds`, `status`, `outcome`,
`evidence` references, `remainingWork` and `limitations`. Status is `completed`,
`partial`, `blocked` or `cancelled`, never `received`. Completion requires no open
intake gaps/reassessment/remaining work and evidence references. This structural
check does not prove evidence authenticity, integration, deployment or runtime health.
Use the delivery/closure checks separately. Accelerate may present this return in
the user's language; it must not add another plan or closure approval.

## Verification
`node scripts/check-accelerate-handoff.mjs --accelerate /existing/accelerate`
loads the real producer's core/routing.py read-only with Python bytecode disabled,
then consumes its validated packets through this receiver. It checks grants,
refusals, missing context, resumption and direct-entry parity of limits/results.
It is a real producer/consumer data-path check, not proof that a model loaded skills
or followed the conversational protocol. Live harness evaluation remains separate.
