---
name: using-superpowers
description: Select relevant Superpowers workflows for software engineering work. Do not activate for ordinary conversation, general questions, translations or explanations merely because skills are installed.
---

# Using Superpowers

## Activation boundary

Global installation makes skills available; it does not activate an engineering
workflow on every message. First classify the user's request from the conversation.
For an ordinary question, answer directly without loading further engineering
skills, asking about project setup, running OpenSpec or creating artifacts. Being
inside a repository, even one with `openspec/`, does not change this rule.

For concrete engineering work, select only skills relevant to the actual task.
A small edit or read-only inspection does not require the full ASDS lifecycle.
Do not use a probability threshold such as “1% chance” to trigger workflows.

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

## Loading and execution

Use the session's discovered skill path and supported loading mechanism. There is
no universal `Skill` tool; read SKILL.md through an available file tool if needed.
Under ASDS, consult its session-specific adapter before translating tool names.

1. Select relevant process guidance (for example debugging for a reported defect).
2. Load implementation guidance required by the actual stack and scope.
3. Announce the selected skill and purpose, then follow its applicable steps.
4. Preserve TDD, verification and review requirements for the selected engineering
   workflow, without imposing unrelated workflows on ordinary conversation.

Missing delegation tools mean sequential execution. Never invent tool availability,
review independence or successful completion. User instructions govern both the
requested outcome and explicit constraints on how the task should be performed.
