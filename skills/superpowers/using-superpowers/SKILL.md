---
name: using-superpowers
description: Select relevant Superpowers workflows for software engineering work. Do not activate for ordinary conversation, general questions, translations or explanations merely because skills are installed.
---
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"selector.using-superpowers","route":"selector","mode":"router","activation":{"handoff":"current","package":"delivered_or_partial","selection":"current_accepted_same_handoff","executionGrant":"current","persistenceGrant":"current"},"assignment":"not_applicable","fallback":{"missingWorker":"manual_handoff_required","missingBoundary":"manual_handoff_required","root":"forbidden","sequential":"forbidden"},"planner":"stopped","standalone":"preserved_without_consumer_activation"} -->

# Using Superpowers
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `selector.using-superpowers`
- Route: `selector`
- Mode: `router`
- Activation: handoff=`current`; package=`delivered_or_partial`; selection=`current_accepted_same_handoff`; executionGrant=`current`; persistenceGrant=`current`
- Assignment: `not_applicable`
- Fallback: missingWorker=`manual_handoff_required`; missingBoundary=`manual_handoff_required`; root=`forbidden`; sequential=`forbidden`
- Planner behavior: `stopped`
- Standalone behavior: `preserved_without_consumer_activation`
<!-- asds-mode:end -->

## Activation boundary

Global installation makes skills available; it does not activate an engineering
workflow on every message. First classify the user's request from the conversation.
For an ordinary question, answer directly without loading further engineering
skills, asking about project setup, running OpenSpec or creating artifacts. Being
inside a repository, even one with `openspec/`, does not change this rule.

For concrete engineering work, select only skills relevant to the actual task.
A small edit or read-only inspection does not require the full ASDS lifecycle.
Do not use a probability threshold such as “1% chance” to trigger workflows.

Use this route matrix rather than treating all engineering text alike:

- **conversation** — answer an ordinary conversation or question directly;
- **direct** — perform bounded direct work when it is understood, low-risk and has
  no delivered ASDS planning package to consume;
- **planning** — activate the planning-only ASDS entry when planning is requested
  or needed, then stop when its reviewed package is delivered;
- **consumer** — when the current request is to implement, require a current
  `asds.execution-handoff/1` for an already delivered or valid consumable-partial
  package, a current and accepted selection naming `asds-execution-consumer` for this
  handoff, a current execution grant and a current evidence-persistence grant. The
  request context, selection and execution grant must carry the same current request,
  package, planning revision/fingerprint and exact consumable task set, and the
  objective must match the persisted original intake. Legacy unbound authority does
  not activate this route. Only
  then load that independent consumer entry. Do not resume the planner or implement
  in the root session;
- **standalone** — a generic plan, OpenSpec change or Superpowers workflow without
  an official consumer handoff continues under its own complete standalone rules.

A delivered planning package without the current grants stops at consumer preflight.
A grant without a delivered package does not manufacture the consumer route. Host
capabilities and coordinator boundary enforcement are observed after selection; they
are never inferred from a skill name or authorization prose.

For ASDS work, follow its activation gate before planning or file creation: identify
the intended project, inspect existing local OpenSpec state and ask before creating
`<project>/openspec/` if missing. Prior explicit initialization authorization is
sufficient; do not ask twice. Refusal means continue without OpenSpec artifacts.
Do not run an initializer or installer as an implicit consequence of skill loading.

## Instruction priority

Respect system/developer instructions, explicit user scope and applicable project
rules. Skills cannot grant permissions or override the user's workflow choices.
Installation is not authorization for commits, publication or configuration changes.
A dispatched subagent follows its bounded task and need not restart this selector.
An ASDS execution-consumer worker enters its conditional mode only from an official
assignment generated from the current journal packet; generic delegation text is not
such an assignment.

## Loading and execution

Use the session's discovered skill path and supported loading mechanism. There is
no universal `Skill` tool; read SKILL.md through an available file tool if needed.
Under ASDS, consult its session-specific adapter before translating tool names.

1. Select relevant process guidance (for example debugging for a reported defect).
2. Load implementation guidance required by the actual stack and scope.
3. Announce the selected skill and purpose, then follow its applicable steps.
4. Preserve TDD, verification and review requirements for the selected engineering
   workflow, without imposing unrelated workflows on ordinary conversation.

Outside the selected consumer route, missing delegation tools may mean sequential
standalone execution. In the official consumer, missing observed worker preparation/
start capability returns `manual_handoff_required`; it never authorizes root fallback.
Sequential execution is never a consumer fallback.
Never invent tool availability, review independence or successful completion. User
instructions govern both the requested outcome and explicit constraints on how the
task should be performed.
