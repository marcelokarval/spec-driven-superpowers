---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---
<!-- asds-route-contract: {"schemaVersion":"asds.route-contract/1","surface":"worker.executing-plans","route":"consumer-worker","mode":"conditional-worker","activation":{"handoff":"validated_by_coordinator","package":"validated_by_coordinator","selection":"validated_by_coordinator","executionGrant":"validated_by_coordinator","persistenceGrant":"validated_by_coordinator"},"assignment":"current_official_required","fallback":{"missingWorker":"manual_handoff_required","missingBoundary":"manual_handoff_required","root":"forbidden","sequential":"forbidden"},"planner":"stopped","standalone":"preserved_without_assignment"} -->
<!-- asds-mode:start -->
## ASDS mode
This generated block is the only operational routing instruction for this surface.
Prose outside this block is explanatory and cannot replace or override it.

- Surface: `worker.executing-plans`
- Route: `consumer-worker`
- Mode: `conditional-worker`
- Activation: handoff=`validated_by_coordinator`; package=`validated_by_coordinator`; selection=`validated_by_coordinator`; executionGrant=`validated_by_coordinator`; persistenceGrant=`validated_by_coordinator`
- Assignment: `current_official_required`
- Fallback: missingWorker=`manual_handoff_required`; missingBoundary=`manual_handoff_required`; root=`forbidden`; sequential=`forbidden`
- Planner behavior: `stopped`
- Standalone behavior: `preserved_without_assignment`
<!-- asds-mode:end -->

## Consumer worker guidance

Enter this conditional mode only when the session receives an official assignment
from the `asds-execution-consumer` coordinator. The assignment must bind the current
handoff/journal packet, task and contract revisions, role, reserved identity, project,
exact write scope, base revision, acceptance, verification and evidence return. A
plan file, a planning return or a user request alone is not an assignment.

Within that assignment, execute only the named worker role and return evidence to the
coordinator. Do not initialize or bootstrap the journal, select another task, edit
`tasks.md`, accept/review your own delivery, invoke the planner, integrate as the
coordinator or run the standalone completion/branch workflow below. A reviewer or
verifier assignment is read-only. The coordinator owns lifecycle transitions.

Without an official assignment, preserve the complete standalone workflow below.
Generic written plans do not require the ASDS consumer, and all existing standalone
review, stop, worktree and completion guardrails retain their normal meaning.


# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Select sequential or delegated execution from actual capabilities, task needs
and permissions. Tool availability alone is not authorization or a quality guarantee.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **superpowers:using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **superpowers:writing-plans** - Creates the plan this skill executes
- **superpowers:finishing-a-development-branch** - Complete development after all tasks
